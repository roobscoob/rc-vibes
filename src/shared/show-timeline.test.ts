import { describe, expect, it } from "vitest";
import type { Scene } from "./scenes.ts";
import { beatAt, transported, type ShowClock, type TransportAction } from "./show.ts";
import { edgesOf, endOf, lockedAt, msAt, onAt, PARKED, playheadAfter, playingAt, posAt, type Block, type Playhead, type Timeline } from "./show-timeline.ts";

const T = 1_800_000_000_000;
// 120 BPM: a beat every 500 ms, beat 8 at T.
const clock: ShowClock = { playing: false, at: T, t: 0, bpm: 120, beat: 8, nudge: 0 };
const by = { id: "u", name: "U" };

/** The playhead and clock after each action in turn. */
function act(p: Playhead, c: ShowClock, ...as: TransportAction[]): [Playhead, ShowClock] {
  for (const a of as) {
    const next = transported(c, a);
    p = playheadAfter(p, c, next, a, "at" in a ? a.at : T);
    c = next;
  }
  return [p, c];
}

describe("the playhead", () => {
  it("starts at once, its first beat shrunk so its next whole one lands on the clock's next", () => {
    // Played a fifth of a beat after beat 8.
    const [p, c] = act(PARKED, clock, { do: "play", at: T + 100 });
    expect(posAt(p, c, T + 100)).toBe(0);
    expect(posAt(p, c, T + 300)).toBeCloseTo(0.5);
    expect(posAt(p, c, T + 500)).toBe(1);
    expect(posAt(p, c, T + 1500)).toBe(3);
    expect(msAt(p, c, 1)).toBe(T + 500);
  });

  it("stretches its first beat instead when it's played just before one of the clock's: never more than half a beat either way", () => {
    // Played a fifth of a beat before beat 9: its beat 1 lands on 10, not 9.
    const [p, c] = act(PARKED, clock, { do: "play", at: T + 400 });
    expect(msAt(p, c, 1)).toBe(T + 1000);
    expect(posAt(p, c, T + 700)).toBeCloseTo(0.5);
  });

  it("is where msAt says, and the other way round", () => {
    const [p, c] = act(PARKED, clock, { do: "seek", at: T, t: 1.25 }, { do: "play", at: T + 130 });
    expect(p.pos).toBe(2.5);
    for (const pos of [2.5, 2.9, 3, 3.5, 17.25]) expect(posAt(p, c, msAt(p, c, pos)!)).toBeCloseTo(pos, 9);
  });

  it("goes on from where it is when the tempo changes, its beats on the clock's new ones", () => {
    const [p, c] = act(PARKED, clock, { do: "play", at: T });
    const before = posAt(p, c, T + 1250);
    const [q, d] = act(p, c, { do: "tempo", at: T + 1250, bpm: 60 });
    expect(posAt(q, d, T + 1250)).toBeCloseTo(before);
    // From then a beat a second; its next whole one on one of the clock's.
    const whole = msAt(q, d, Math.floor(before) + 1)!;
    const beat = beatAt(d, whole);
    expect(beat).toBeCloseTo(Math.round(beat), 9);
    expect(posAt(q, d, whole + 1000) - posAt(q, d, whole)).toBeCloseTo(1);
  });

  it("locks on again at Sync, never jumping", () => {
    const [p, c] = act(PARKED, clock, { do: "play", at: T });
    const [q, d] = act(p, c, { do: "downbeat", at: T + 1100 });
    expect(posAt(q, d, T + 1100)).toBeCloseTo(posAt(p, c, T + 1100));
    expect(Math.abs(posAt(q, d, T + 3000) - posAt(p, c, T + 3000))).toBeLessThanOrEqual(0.5);
  });

  it("stops where it is, plays on from there, and seeks in beats at the tempo", () => {
    let [p, c] = act(PARKED, clock, { do: "play", at: T }, { do: "stop", at: T + 1000 });
    expect(p).toEqual({ pos: 2, at: T + 1000, lock: null });
    [p, c] = act(p, c, { do: "play", at: T + 5000 });
    expect(posAt(p, c, T + 5000)).toBe(2);
    [p, c] = act(p, c, { do: "seek", at: T + 6000, t: 8 });
    expect(posAt(p, c, T + 6000)).toBe(16);
    expect(p.lock).not.toBeNull();
  });

  it("goes back to bar 1, stopped, as a show starts or ends", () => {
    const [p] = act(PARKED, clock, { do: "play", at: T }, { do: "start", at: T + 1000 });
    expect(p).toEqual({ pos: 0, at: T + 1000, lock: null });
  });

  it("doesn't move without a tempo", () => {
    expect(lockedAt(3, { ...clock, bpm: null, beat: null }, T).lock).toBeNull();
  });
});

describe("what plays", () => {
  const scene = (shaders: Scene["shaders"]): Scene => ({ name: "s", shaders, by, at: 0 });
  const scenes = { A: scene({ a: { speed: { "1": 5 } } }), B: scene({ a: { speed: { "1": 7 } }, b: {} }), C: scene({ c: {} }) };
  const block = (scene: string, row: number, start: number, end: number): Block => ({ scene, row, start, end, by, at: 0 });
  const t: Timeline = { blocks: { x: block("A", 1, 0, 8), y: block("B", 0, 4, 12), z: block("C", 1, 6, 8), gone: block("D", 0, 0, 16) } };

  it("is every block from its start up to its end, topmost first (on one row, the later start)", () => {
    expect(playingAt(t, 4).map(([id]) => id)).toEqual(["y", "gone", "x"]);
    expect(playingAt(t, 8).map(([id]) => id)).toEqual(["y", "gone"]);
    expect(playingAt(t, 8, true).map(([id]) => id)).toEqual(["y", "gone", "z", "x"]);
  });

  it("puts each sketch on with the topmost block's scene holding it; a block whose scene's gone holds nothing", () => {
    expect(onAt(t, scenes, 2)).toEqual(new Map([["a", "A"]]));
    expect(onAt(t, scenes, 6)).toEqual(new Map([["a", "B"], ["b", "B"], ["c", "C"]]));
    expect(onAt(t, scenes, 12)).toEqual(new Map());
  });

  it("can change at each block's start and end, and ends at the last", () => {
    expect(edgesOf(t)).toEqual([0, 4, 6, 8, 12, 16]);
    expect(endOf(t)).toBe(16);
    expect(endOf({ blocks: {} })).toBe(0);
  });
});
