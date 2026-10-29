// The show's timeline played (shared/show-timeline.ts): while a show's on
// and its playhead moves, the blocks' scenes go on and off in the room, each
// edge (a block's start or end) in its frame, through arclamp's schedule, as
// a scene applied in a show goes in (show-apply.ts): mutes (shaders.ts:
// setMutedAt) and knobs (a statement run before the shader renders that
// frame: timeline.ts' applyCode), all in one frame. vibes' own record of the
// knobs (the pools) changes as the frame comes; the mutes, as the feed shows
// them.
//
// It works AHEAD_MS ahead: an edge is sent once it's that near, and kept
// till its frame. Anything that could move one (a block put or taken away, a
// scene changed, the clock, the playhead) has everything sent and not yet
// come worked out again, every TICK_MS and at once on a change: what's still
// wanted, as it was, stays; anything else is said again in its place
// (emplacing it: arclamp's §10.1), as the timeline would have the room then,
// so the room ends right however that races its frame. Stopped (or the show
// over, or its last block taken away), what's sent and not yet come is said
// again the same way, as the room is now: stopping leaves the room as it is.
//
// Played (from wherever the playhead is, or moved there while it plays), it
// first makes the room what the timeline has there, whole: every shader but
// Base Color (and any that failed) on or off as the blocks say, and every
// knob as their scenes set it. The knobs go back, as their blocks end, to
// what they were when it began playing (`base`); a vibes that starts again
// while one plays begins again from the room as it is then. At the last
// block's end, the show's clock stops.

import { randomUUID } from "node:crypto";
import type { LiveTree } from "../shared/live.ts";
import { sameValue, type ChangeEvent, type ParamValue } from "../shared/params.ts";
import { isBase, type Scene } from "../shared/scenes.ts";
import type { ShowClock } from "../shared/show.ts";
import { edgesOf, endOf, msAt, onAt, posAt, type Playhead, type Timeline } from "../shared/show-timeline.ts";
import type { Me, Shader, ShaderKey } from "../shared/vibes.ts";
import type { Arclamp } from "./arclamp.ts";
import type { Pools } from "./pools.ts";
import type { ScenesSource } from "./scenes.ts";
import type { Shaders } from "./shaders.ts";
import type { ShowTimeline } from "./show-timeline.ts";
import type { Show } from "./show.ts";
import { applyCode, frameOf } from "./timeline.ts";

// How far ahead an edge is sent; how soon the soonest frame is, for a change to get to arclamp before it; how often it's all worked out again.
export const AHEAD_MS = 2000;
const LEAD_MS = 40;
const TICK_MS = 250;

/** Who the timeline's changes are by. */
export const TIMELINE: Me = { id: "vibes:timeline", name: "the timeline", dev: false };

/** A param's values, by light (a light not here is at the default). */
type Values = Record<string, ParamValue>;
/** Knobs said whole: by param, by light (null: back to the default). */
type Knobs = Record<string, Record<string, ParamValue | null>>;

/** One change in one frame: a shader's mute, or its knobs. */
type Change = { kind: "m"; key: ShaderKey; muted: boolean } | { kind: "k"; key: ShaderKey; pool: string; knobs: Knobs };
type Planned = Change & { frame: number };
/** A change sent, waiting for its frame, under its schedule id (null: knobs for a shader arclamp hasn't got, kept just for the pools). */
type Sent = Planned & { id: string | null };

/** Playing: by what playhead and clock, the knobs it began with, and where it made the room whole. */
interface Run {
  tag: string;
  seq: number;
  playhead: Playhead;
  clock: ShowClock;
  /** By pool, by param. */
  base: Record<string, Record<string, Values>>;
  whole: { frame: number; pos: number };
}

interface Deps {
  show: Pick<Show, "tree" | "act">;
  timeline: Pick<ShowTimeline, "tree">;
  scenes: Pick<ScenesSource, "tree">;
  /** The room as the live tree has it. */
  room: () => Pick<LiveTree, "shaders" | "stack" | "pools">;
  shaders: Pick<Shaders, "setMutedAt" | "idOf">;
  arclamp: Pick<Arclamp, "evalAt">;
  pools: Pick<Pools, "set">;
  /** arclamp's time now (rclamp-time.ts). */
  rNow: () => number;
  log?: (message: string, err: unknown) => void;
}

const slot = (c: Planned) => `${c.frame}|${c.kind}|${c.key}`;

const sameValues = (a: Record<string, ParamValue | null>, b: Record<string, ParamValue | null>) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((l) => Object.hasOwn(b, l) && (a[l] === null || b[l] === null ? a[l] === b[l] : sameValue(a[l]!, b[l]!)));
};
const sameKnobs = (a: Knobs, b: Knobs) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((p) => Object.hasOwn(b, p) && sameValues(a[p]!, b[p]!));
const same = (a: Planned, b: Planned) => a.frame === b.frame && a.key === b.key && (a.kind === "m" ? b.kind === "m" && a.muted === b.muted : b.kind === "k" && sameKnobs(a.knobs, b.knobs));

/** A param going from one set of values (or lights) to another, said whole: every light either has, as the second has it. */
function whole(from: Record<string, unknown>, to: Values): Record<string, ParamValue | null> {
  const out: Record<string, ParamValue | null> = {};
  for (const l of new Set([...Object.keys(from), ...Object.keys(to)])) out[l] = to[l] ?? null;
  return out;
}

export function createTimelinePlayer({ show, timeline, scenes, room, shaders, arclamp, pools, rNow, log = console.error }: Deps) {
  let run: Run | null = null;
  const sent = new Map<string, Sent>();
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  /** The shaders the timeline turns on and off: all but Base Color, and any that failed. */
  const playable = (tree: Pick<LiveTree, "shaders" | "stack">): Shader[] =>
    tree.stack.flatMap((k) => (tree.shaders[k] ? [tree.shaders[k]] : [])).filter((s) => s.stage !== "failed" && !isBase(s));

  /** A shader's param as the timeline has it with `scene`'s knobs on it (none: off): the scene's, if it sets that param; else as it began. */
  function valuesOf(r: Run, list: Record<string, Scene>, s: Shader, scene: string | undefined, param: string): Values {
    const mine = scene ? list[scene]?.shaders[s.key] : undefined;
    if (mine && Object.hasOwn(mine, param)) return mine[param]!;
    return (s.pool ? r.base[s.pool]?.[param] : undefined) ?? {};
  }

  /** The params a shader's sketch declares now. */
  const declared = (tree: Pick<LiveTree, "pools">, s: Shader) => (s.pool ? (tree.pools[s.pool]?.declared ?? []).map((p) => p.name) : []);

  /** The room as the timeline has it at `pos`, said whole against the room as it is: every shader's mute, and any knob that isn't so. */
  function wholeAt(r: Run, list: Record<string, Scene>, t: Timeline, pos: number): Change[] {
    const tree = room();
    const on = onAt(t, list, pos);
    const out: Change[] = [];
    for (const s of playable(tree)) {
      out.push({ kind: "m", key: s.key, muted: !on.has(s.key) });
      const knobs: Knobs = {};
      for (const p of declared(tree, s)) {
        const now = tree.pools[s.pool!]?.values[p] ?? {};
        const want = valuesOf(r, list, s, on.get(s.key), p);
        if (!sameValues(now, want)) knobs[p] = whole(now, want);
      }
      if (Object.keys(knobs).length > 0) out.push({ kind: "k", key: s.key, pool: s.pool!, knobs });
    }
    return out;
  }

  /** What changes over edges from `first` to `last` (in one frame): from what was on just before the first to what's on at the last. */
  function edgeChanges(r: Run, list: Record<string, Scene>, t: Timeline, first: number, last: number): Change[] {
    const tree = room();
    const was = onAt(t, list, first, true);
    const is = onAt(t, list, last);
    const out: Change[] = [];
    for (const s of playable(tree)) {
      if (was.has(s.key) !== is.has(s.key)) out.push({ kind: "m", key: s.key, muted: !is.has(s.key) });
      const from = was.get(s.key);
      const to = is.get(s.key);
      if (from === to || !s.pool) continue;
      const knobs: Knobs = {};
      for (const p of declared(tree, s)) {
        const a = valuesOf(r, list, s, from, p);
        const b = valuesOf(r, list, s, to, p);
        if (!sameValues(a, b)) knobs[p] = whole(a, b);
      }
      if (Object.keys(knobs).length > 0) out.push({ kind: "k", key: s.key, pool: s.pool, knobs });
    }
    return out;
  }

  /** Everything the timeline wants sent now: the room made whole, till that frame's come, and each edge after it within AHEAD_MS. */
  function wanted(r: Run, now: number): Map<string, Planned> {
    const t = timeline.tree();
    const list = scenes.tree().list;
    const out = new Map<string, Planned>();
    const add = (frame: number, c: Change) => out.set(slot({ ...c, frame }), { ...c, frame });
    if (r.whole.frame >= now + LEAD_MS) for (const c of wholeAt(r, list, t, r.whole.pos)) add(r.whole.frame, c);
    const byFrame = new Map<number, number[]>();
    for (const e of edgesOf(t)) {
      if (e <= r.whole.pos) continue;
      const ms = msAt(r.playhead, r.clock, e);
      if (ms === null) continue;
      const frame = frameOf(ms);
      if (frame <= r.whole.frame || frame < now + LEAD_MS || frame > now + AHEAD_MS) continue;
      byFrame.set(frame, [...(byFrame.get(frame) ?? []), e]);
    }
    for (const [frame, es] of byFrame) for (const c of edgeChanges(r, list, t, es[0]!, es.at(-1)!)) add(frame, c);
    return out;
  }

  /** In place of a change sent that isn't wanted now: the same shader, as the timeline has it in that frame; or, not playing (or not yet from there), as it is now. */
  function instead(old: Sent): Planned {
    const tree = room();
    const s = tree.shaders[old.key];
    const playing = run && old.frame >= run.whole.frame ? run : null;
    const list = scenes.tree().list;
    const on = playing ? onAt(timeline.tree(), list, posAt(playing.playhead, playing.clock, old.frame)) : null;
    if (old.kind === "m") return { ...old, muted: on ? !on.has(old.key) : (s?.muted ?? old.muted) };
    const knobs: Knobs = {};
    for (const [p, byLight] of Object.entries(old.knobs)) {
      const want = playing && s ? valuesOf(playing, list, s, on!.get(old.key), p) : (tree.pools[old.pool]?.values[p] ?? {});
      knobs[p] = whole(byLight, want);
    }
    return { ...old, knobs };
  }

  /** As a frame comes: vibes' record of the knobs changed in it. */
  function arm(frame: number) {
    if (timers.has(frame)) return;
    const timer = setTimeout(
      () => {
        timers.delete(frame);
        for (const [k, c] of sent) {
          if (c.frame !== frame) continue;
          sent.delete(k);
          if (c.kind !== "k") continue;
          for (const [p, byLight] of Object.entries(c.knobs)) {
            void pools.set(c.pool, p, Object.entries(byLight).map(([l, v]) => [Number(l), v]), `user:${TIMELINE.id}`).catch((err) => log("timeline: a pool's values", err));
          }
        }
      },
      Math.max(0, frame - rNow()),
    );
    timers.set(frame, timer);
  }

  async function send(c: Planned, emplace: string | null) {
    const r = run;
    const id = `tl:${r?.tag ?? "stop"}:${r ? ++r.seq : randomUUID().slice(0, 8)}`;
    const schedule = { at: c.frame, id, emplace: emplace ?? undefined };
    let sentId: string | null = id;
    if (c.kind === "m") await shaders.setMutedAt(c.key, c.muted, schedule, TIMELINE);
    else {
      const shaderId = shaders.idOf(c.key, TIMELINE);
      // Not in arclamp yet: its stream gives it every value as it starts, the pool's by then.
      if (shaderId === null) sentId = null;
      else {
        const events: ChangeEvent[] = Object.entries(c.knobs).map(([name, byLight]) => ({ name, set: Object.entries(byLight).map(([l, v]) => [v, [Number(l)]]) }));
        await arclamp.evalAt(shaderId, applyCode(events), schedule);
      }
    }
    sent.set(slot(c), { ...c, id: sentId });
    arm(c.frame);
  }

  /** Playing, or not, as the show and its timeline say now; and made so (a jump of the playhead makes the room whole again where it lands). */
  function follow(now: number) {
    const state = show.tree();
    const t = timeline.tree();
    if (!state.on || !state.playhead.lock || Object.keys(t.blocks).length === 0) {
      run = null;
      return;
    }
    const ph = state.playhead;
    const wholeFrom = (): Run["whole"] => {
      const frame = frameOf(Math.max(ph.at, now + LEAD_MS));
      return { frame, pos: posAt(ph, state.clock, frame) };
    };
    if (!run) {
      const base = Object.fromEntries(Object.entries(room().pools).map(([id, p]) => [id, structuredClone(p.values)]));
      run = { tag: randomUUID().slice(0, 8), seq: 0, playhead: ph, clock: state.clock, base, whole: wholeFrom() };
    } else if (ph !== run.playhead || state.clock !== run.clock) {
      const jumped = Math.abs(posAt(run.playhead, run.clock, ph.at) - ph.pos) > 1e-6;
      run = { ...run, playhead: ph, clock: state.clock, whole: jumped ? wholeFrom() : run.whole };
    }
  }

  async function step() {
    const now = rNow();
    follow(now);
    const want = run ? wanted(run, now) : new Map<string, Planned>();
    const sends: Promise<void>[] = [];
    for (const [k, old] of sent) {
      if (old.frame <= now) continue;
      const w = want.get(k);
      want.delete(k);
      // Wanted otherwise, or not at all: said as it should be then. Already so (or said so in its place already), it stays.
      const then = w ?? instead(old);
      if (same(then, old)) continue;
      sends.push(send(then, old.id).catch((err) => log("timeline: a change in place of one sent", err)));
    }
    for (const w of want.values()) sends.push(send(w, null).catch((err) => log("timeline: a change", err)));
    await Promise.all(sends);
    // Its last block's end come: the show's clock stops there.
    if (run) {
      const end = msAt(run.playhead, run.clock, endOf(timeline.tree()));
      if (end !== null && end <= now) {
        try {
          show.act({ do: "stop", at: Math.max(end, now - 1000) }, TIMELINE);
        } catch (err) {
          log("timeline: stopping at its end", err);
        }
      }
    }
  }

  // One working-out at a time; a change meanwhile has it done again after.
  let busy = false;
  let again = false;
  async function changed() {
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    try {
      do {
        again = false;
        await step();
      } while (again);
    } finally {
      busy = false;
    }
  }
  const tick = setInterval(() => void changed(), TICK_MS);
  tick.unref?.();

  return {
    /** Something the timeline plays by changed (the show, a block, a scene): worked out again now. */
    changed,
    stop() {
      clearInterval(tick);
      for (const t of timers.values()) clearTimeout(t);
    },
  };
}

export type TimelinePlayer = ReturnType<typeof createTimelinePlayer>;

/** Where the show and the timeline tell the player of a change: made before it is (index.ts), pointed at it once it is (api.ts). */
export interface PlayingRef {
  changed: () => void;
}
