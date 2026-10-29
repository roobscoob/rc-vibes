// The show's timeline: scenes (shared/scenes.ts) put on it as blocks, each
// on a row, from its start to its end, in beats from bar 1's first
// (BEATS_PER_BAR to a bar). One for the room, kept by vibes
// (server/show-timeline.ts) and in the live tree (timeline/blocks); its
// playhead is the show's (show/playhead), moved by the show's transport as
// the piece's time is.
//
// Played (server/timeline-player.ts), the timeline has the room: a sketch is
// on while a block holding it plays, with the knobs of the topmost such
// block's scene (the lowest row); every other one's off, but Base Color,
// which is always left as it is. As a block ends its sketch goes off (unless
// another still holds it), and the knobs it set go back as they were when
// the timeline began playing. It plays through once, to its last block's
// end, and stops.
//
// The playhead goes with the beat. Played, it starts at once, and its first
// beat stretches or shrinks (by half a beat at most) so its next whole beat
// lands on one of the clock's; whenever the clock's beat moves (a tempo,
// Sync, a nudge, a seek), it locks on again the same way, from where it is.
// So its beats are always the room's, and it never jumps. Its bars count
// from where it was played.

import { beatAt, RESTING_BPM, type ShowClock } from "../../packages/vibes/src/wire.ts";
import type { Scene } from "./scenes.ts";
import type { TransportAction } from "./show.ts";
import type { Person, ShaderKey } from "./vibes.ts";

export interface Block {
  scene: string;
  /** Its row, 0 at the top: a higher block's scene has the say over a sketch's knobs. */
  row: number;
  /** Beats from bar 1's first: it plays from its start up to (not at) its end. */
  start: number;
  end: number;
  by: Person;
  at: number;
}

/** Every block, by id. */
export interface Timeline {
  blocks: Record<string, Block>;
}

export const NO_TIMELINE: Timeline = { blocks: {} };

export const MAX_BLOCKS = 500;
export const MAX_ROWS = 16;
/** A thousand bars. */
export const MAX_BEATS = 4000;

/** Something done to the timeline (a page's, at timeline/blocks/<id>; server/show-timeline.ts makes it): a block put there, whole, or taken away. */
export type BlockOp = { op: "put"; id: string; scene: string; row: number; start: number; end: number } | { op: "remove"; id: string };

/**
 * Where the timeline's playhead is: at `pos` (beats from bar 1's first) at
 * `at` (arclamp's time). Playing, it's locked to the clock's beat: `from`,
 * the clock's beat count at `at`, and `next`, the clock's beat its next whole
 * beat lands on. Stopped, it stays at `pos`.
 */
export interface Playhead {
  pos: number;
  at: number;
  lock: { from: number; next: number } | null;
}

export const PARKED: Playhead = { pos: 0, at: 0, lock: null };

/** Where the playhead is at `ms` (arclamp's time), by the clock it was locked to. */
export function posAt(p: Playhead, c: ShowClock, ms: number): number {
  if (!p.lock) return p.pos;
  const { from, next } = p.lock;
  const whole = Math.floor(p.pos) + 1;
  const b = beatAt(c, ms);
  if (b >= next) return whole + (b - next);
  return p.pos + ((b - from) / (next - from)) * (whole - p.pos);
}

/** When the playhead gets to `pos` (arclamp's time), by the clock it was locked to: null stopped, or with no tempo. */
export function msAt(p: Playhead, c: ShowClock, pos: number): number | null {
  if (!p.lock || c.bpm === null || c.beat === null) return null;
  const { from, next } = p.lock;
  const whole = Math.floor(p.pos) + 1;
  const b = pos >= whole ? next + (pos - whole) : from + ((pos - p.pos) / (whole - p.pos)) * (next - from);
  return c.at + c.nudge + ((b - c.beat) * 60_000) / c.bpm;
}

/** The playhead playing from `pos` at `ms`, locked to `c`'s beat: its next whole beat on the clock's beat nearest to where it'd fall, after `ms`. */
export function lockedAt(pos: number, c: ShowClock, ms: number): Playhead {
  if (c.bpm === null || c.beat === null) return { pos, at: ms, lock: null };
  const from = beatAt(c, ms);
  let next = Math.round(from + Math.floor(pos) + 1 - pos);
  if (next <= from) next += 1;
  return { pos, at: ms, lock: { from, next } };
}

/**
 * The playhead after an action on the show's clock (`before` it, `after`
 * it; `now` for one that doesn't say when it happened): the show starting or
 * ending puts it back at bar 1, stopped; playing and stopping it go with the
 * piece's; a seek puts it at the piece's new time, in beats at the tempo;
 * anything that moves the beat while it plays locks it on again from where
 * it is.
 */
export function playheadAfter(p: Playhead, before: ShowClock, after: ShowClock, a: TransportAction, now: number): Playhead {
  const ms = "at" in a ? Math.max(a.at, before.at + before.nudge) : now;
  switch (a.do) {
    case "start":
    case "end":
      return { pos: 0, at: ms, lock: null };
    case "play":
      return p.lock ? p : lockedAt(p.pos, after, ms);
    case "stop":
      return { pos: posAt(p, before, ms), at: ms, lock: null };
    case "seek": {
      const pos = Math.max(0, (a.t * (after.bpm ?? RESTING_BPM)) / 60);
      return p.lock ? lockedAt(pos, after, ms) : { pos, at: ms, lock: null };
    }
    case "tempo":
    case "downbeat":
    case "nudge":
      return p.lock ? lockedAt(posAt(p, before, ms), after, ms) : p;
    case "cue":
      return p;
  }
}

/** The blocks playing at `pos`, topmost first (a later start first, on one row); or, `justBefore`, the ones playing up to it. */
export function playingAt(t: Timeline, pos: number, justBefore = false): [string, Block][] {
  return Object.entries(t.blocks)
    .filter(([, b]) => (justBefore ? b.start < pos && pos <= b.end : b.start <= pos && pos < b.end))
    .sort(([ia, a], [ib, b]) => a.row - b.row || b.start - a.start || (ia < ib ? -1 : ia > ib ? 1 : 0));
}

/** The sketches on at `pos` (or just before it), each with the scene whose knobs it has: the topmost playing block's holding it. A block whose scene's gone holds nothing. */
export function onAt(t: Timeline, scenes: Record<string, Scene>, pos: number, justBefore = false): Map<ShaderKey, string> {
  const on = new Map<ShaderKey, string>();
  for (const [, b] of playingAt(t, pos, justBefore)) {
    for (const key of Object.keys(scenes[b.scene]?.shaders ?? {})) if (!on.has(key)) on.set(key, b.scene);
  }
  return on;
}

/** Every block's start and end, in order, once each: where what's on can change. */
export function edgesOf(t: Timeline): number[] {
  return [...new Set(Object.values(t.blocks).flatMap((b) => [b.start, b.end]))].sort((a, b) => a - b);
}

/** Where the timeline ends: its last block's end (0 with none). */
export const endOf = (t: Timeline): number => Math.max(0, ...Object.values(t.blocks).map((b) => b.end));
