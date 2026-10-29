import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_COLOR } from "../shared/base-color.ts";
import type { Pool } from "../shared/live.ts";
import type { ParamSpec } from "../shared/params.ts";
import type { Scene } from "../shared/scenes.ts";
import { transported, type ShowState, type TransportAction } from "../shared/show.ts";
import { PARKED, playheadAfter, type Block, type Timeline } from "../shared/show-timeline.ts";
import type { Shader } from "../shared/vibes.ts";
import type { Schedule } from "./arclamp.ts";
import { applyCode } from "./timeline.ts";
import { createTimelinePlayer, type TimelinePlayer } from "./timeline-player.ts";

const T = 1_800_000_000_000;
const speed: ParamSpec = { kind: "number", name: "speed", label: "Speed", lights: {}, default: 1, min: 0, max: 10, step: 0.1 };
const by = { id: "u", name: "U" };
const shader = (key: string, more: Partial<Shader> = {}) => ({ key, stage: "live", muted: false, pool: null, instance: null, ...more }) as Shader;
const block = (scene: string, start: number, end: number, row = 0): Block => ({ scene, row, start, end, by, at: 0 });
const speedTo = (v: number) => applyCode([{ name: "speed", set: [[v, [1]]] }]);

describe("the timeline played", () => {
  let state: ShowState;
  let t: Timeline;
  let shaders: Record<string, Shader>;
  let pools: Record<string, Pool>;
  let list: Record<string, Scene>;
  let mutes: ({ key: string; muted: boolean } & Schedule)[];
  let evals: ({ shaderId: number; code: string } & Schedule)[];
  let sets: { pool: string; name: string; changes: unknown }[];
  let acts: TransportAction[];
  let now: number;
  let player: TimelinePlayer;

  /** An action on the show, as show.ts makes it. */
  const act = (a: TransportAction) => {
    const clock = transported(state.clock, a);
    state = { ...state, clock, playhead: playheadAfter(state.playhead, state.clock, clock, a, now) };
  };
  /** Time going by: the frames that come meanwhile come. */
  const until = async (ms: number) => {
    const by = ms - now;
    now = ms;
    await vi.advanceTimersByTimeAsync(by);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    now = T;
    // A show on, stopped at bar 1; 120 BPM, beat 0 at T: beat 4 at T + 2000.
    state = { on: true, clock: { playing: false, at: T, t: 0, bpm: 120, beat: 0, nudge: 0 }, cue: "now", queued: null, playhead: PARKED };
    shaders = { a: shader("a", { muted: true, pool: "pa" }), b: shader("b"), base: shader("base", { pool: BASE_COLOR.pool }) };
    pools = { pa: { declared: [speed], values: { speed: { "1": 3 } } } as unknown as Pool };
    const scene = (s: Scene["shaders"]): Scene => ({ name: "s", shaders: s, by, at: 0 });
    list = { A: scene({ a: { speed: { "1": 5 } } }), B: scene({ b: {} }) };
    // A for a bar, then B for one.
    t = { blocks: { x: block("A", 0, 4), y: block("B", 4, 8) } };
    mutes = [];
    evals = [];
    sets = [];
    acts = [];
    player = createTimelinePlayer({
      show: { tree: () => state, act: (a) => (acts.push(a), act(a), state.clock) },
      timeline: { tree: () => t },
      scenes: { tree: () => ({ list, order: Object.keys(list) }) },
      room: () => ({ shaders, stack: Object.keys(shaders), pools }),
      shaders: {
        setMutedAt: async (key, muted, s) => (mutes.push({ key, muted, ...s }), s.at),
        idOf: (key) => ({ a: 11, b: 12 })[key] ?? null,
      },
      arclamp: { evalAt: async (shaderId, code, s) => (evals.push({ shaderId, code, ...s }), true) },
      pools: { set: async (pool, name, changes) => (sets.push({ pool, name, changes }), true) },
      rNow: () => now,
      log: () => {},
    });
  });
  afterEach(() => {
    player.stop();
    vi.useRealTimers();
  });

  const muteList = () => mutes.map(({ key, muted, at, emplace }) => [key, muted, at, emplace ?? null]);

  it("does nothing stopped, or with nothing on it", async () => {
    await player.changed();
    act({ do: "play", at: T });
    t = { blocks: {} };
    await player.changed();
    expect([mutes, evals]).toEqual([[], []]);
  });

  it("played, makes the room whole where it starts, then sends each edge ahead, in its frame; the pools as each comes", async () => {
    act({ do: "play", at: T });
    await player.changed();
    expect(muteList()).toEqual([
      // Whole, at once: A's sketch on, everything else off but Base Color.
      ["a", false, T + 40, null],
      ["b", true, T + 40, null],
      // At beat 4, A's block ends and B's starts.
      ["a", true, T + 2000, null],
      ["b", false, T + 2000, null],
    ]);
    expect(evals.map(({ shaderId, code, at }) => [shaderId, code, at])).toEqual([
      [11, speedTo(5), T + 40],
      // A's knob back as it was when it began playing.
      [11, speedTo(3), T + 2000],
    ]);
    await until(T + 40);
    expect(sets).toEqual([{ pool: "pa", name: "speed", changes: [[1, 5]] }]);
    await until(T + 2000);
    expect(sets.at(-1)).toEqual({ pool: "pa", name: "speed", changes: [[1, 3]] });
  });

  it("has what a block moved changes said again, in place of what was sent", async () => {
    act({ do: "play", at: T });
    await player.changed();
    const sent = new Map(mutes.filter((m) => m.at === T + 2000).map((m) => [m.key, m.id]));
    mutes = [];
    evals = [];
    // B's block starts half a bar later: b stays off at beat 4.
    t = { blocks: { ...t.blocks, y: block("B", 6, 8) } };
    await player.changed();
    expect(muteList()).toEqual([["b", true, T + 2000, sent.get("b")]]);
    expect(evals).toEqual([]);
    // Its own start, once it's near enough.
    mutes = [];
    await until(T + 1000);
    await player.changed();
    expect(muteList()).toEqual([["b", false, T + 3000, null]]);
  });

  it("stopped, says what was sent again as the room is, so stopping leaves it as it is", async () => {
    act({ do: "play", at: T });
    await player.changed();
    const sent = new Map(mutes.filter((m) => m.at === T + 2000).map((m) => [m.key, m.id]));
    const sentEval = evals.find((e) => e.at === T + 2000)!.id;
    await until(T + 100);
    // The room as the feed and the pools have it, A's in.
    shaders = { ...shaders, a: { ...shaders.a!, muted: false }, b: { ...shaders.b!, muted: true } };
    pools = { pa: { ...pools.pa!, values: { speed: { "1": 5 } } } };
    mutes = [];
    evals = [];
    act({ do: "stop", at: T + 100 });
    await player.changed();
    expect(muteList()).toEqual([
      ["a", false, T + 2000, sent.get("a")],
      ["b", true, T + 2000, sent.get("b")],
    ]);
    expect(evals.map(({ code, at, emplace }) => [code, at, emplace])).toEqual([[speedTo(5), T + 2000, sentEval]]);
  });

  it("makes the room whole again where a seek lands", async () => {
    act({ do: "play", at: T });
    await player.changed();
    await until(T + 500);
    // The pools, A's in.
    pools = { pa: { ...pools.pa!, values: { speed: { "1": 5 } } } };
    mutes = [];
    evals = [];
    // To beat 6, B's.
    act({ do: "seek", at: T + 500, t: 3 });
    await player.changed();
    expect(muteList().filter(([, , at]) => at === T + 540)).toEqual([
      ["a", true, T + 540, null],
      ["b", false, T + 540, null],
    ]);
    expect(evals.filter((e) => e.at === T + 540).map((e) => e.code)).toEqual([speedTo(3)]);
  });

  it("moves what's sent with a new tempo, on its beats, without making the room whole again", async () => {
    act({ do: "play", at: T });
    await player.changed();
    const sent = new Map(mutes.filter((m) => m.at === T + 2000).map((m) => [m.key, m.id]));
    const sentEval = evals.find((e) => e.at === T + 2000)!.id;
    await until(T + 500);
    mutes = [];
    evals = [];
    // Half as fast from beat 1: beat 4 comes at T + 3500.
    act({ do: "tempo", at: T + 500, bpm: 60 });
    await player.changed();
    // What was sent for T + 2000, said again as the timeline has it then (beat 2.5: still A's).
    expect(muteList()).toEqual([
      ["a", false, T + 2000, sent.get("a")],
      ["b", true, T + 2000, sent.get("b")],
    ]);
    expect(evals.map(({ code, at, emplace }) => [code, at, emplace])).toEqual([[speedTo(5), T + 2000, sentEval]]);
    mutes = [];
    await until(T + 1600);
    await player.changed();
    expect(muteList()).toEqual([
      ["a", true, T + 3500, null],
      ["b", false, T + 3500, null],
    ]);
  });

  it("stops the show's clock at its last block's end", async () => {
    act({ do: "play", at: T });
    await player.changed();
    await until(T + 3990);
    expect(acts).toEqual([]);
    await until(T + 4000);
    await player.changed();
    expect(acts).toEqual([{ do: "stop", at: T + 4000 }]);
    expect(state.playhead).toEqual({ pos: 8, at: T + 4000, lock: null });
  });
});
