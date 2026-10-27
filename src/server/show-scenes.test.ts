import { describe, expect, it, vi } from "vitest";
import type { Op, Pool } from "../shared/live.ts";
import type { NumberSpec } from "../shared/params.ts";
import { cueOf, firingOf, untilDownbeat } from "../shared/show-scenes.ts";
import type { Me, Shader, ShowScene } from "../shared/vibes.ts";
import { openDb } from "./db.ts";
import { createShowScenes, type Room } from "./show-scenes.ts";

const ada: Me = { id: "rc:1", name: "Ada", dev: false };
const speed: NumberSpec = { kind: "number", name: "speed", label: "Speed", lights: {}, default: 1, min: 0, max: 4, step: 0.1 };
const size: NumberSpec = { ...speed, name: "size", label: "Size" };

/** A shader in the room, with a pool of its own (named after it) when it has knobs. */
const shader = (key: string, muted: boolean, pool = true): Shader => ({ key, stage: "live", muted, pool: pool ? `pool-${key}` : null }) as unknown as Shader;
const poolOf = (values: Pool["values"], declared = [speed]): Pool => ({ declared, values });
const roomOf = (shaders: Shader[], pools: Record<string, Pool> = {}): Room => ({ shaders, pools });
const NONE = roomOf([]);
const sceneOf = (shaders: ShowScene["shaders"]): ShowScene => ({ id: "s", name: "Scene 1", shaders, by: ada, at: 0 });

describe("firing a scene", () => {
  it("switches off what it hasn't, sets the knobs of what it has (as it keeps them), and switches that on", () => {
    const shaders = [shader("a", false), shader("b", true), shader("c", false)];
    const pools = { "pool-b": poolOf({ speed: { "1": 2, "2": 3 } }) };
    expect(firingOf(sceneOf({ b: { speed: { "1": 3 } }, c: null }), shaders, pools)).toEqual({
      knobs: [["pools/pool-b/values/speed/2"], ["pools/pool-b/values/speed/1", 3]],
      off: ["a"],
      on: ["b"],
      stay: ["c"],
    });
  });

  it("sets just the knobs it keeps, leaving the others as they are", () => {
    const pools = { "pool-a": poolOf({ speed: { "1": 2 }, size: { "1": 3 } }, [speed, size]) };
    expect(firingOf(sceneOf({ a: { speed: { "1": 4 } } }), [shader("a", false)], pools).knobs).toEqual([["pools/pool-a/values/speed/1", 4]]);
  });

  it("passes over shaders gone from the room, and failed ones", () => {
    const failed = { ...shader("f", false), stage: "failed" } as Shader;
    expect(firingOf(sceneOf({ gone: null }), [failed], {})).toEqual({ knobs: [], off: [], on: [], stay: [] });
  });
});

describe("the show's scenes", () => {
  it("makes an empty scene, in the database, and tells everyone", () => {
    const db = openDb(":memory:");
    const scenes = createShowScenes(db, () => 5);
    const told: unknown[] = [];
    scenes.subscribe((s) => told.push(s));
    const made = scenes.change({ op: "create" }, NONE, ada)!;
    expect(made).toMatchObject({ name: "Scene 1", shaders: {}, by: { id: ada.id }, at: 5 });
    expect(createShowScenes(db).current().scenes).toEqual([made]);
    expect(told).toHaveLength(1);
  });

  it("loads a shader with its knobs as the room has them, in place of the one it had, and takes it out", () => {
    const scenes = createShowScenes(openDb(":memory:"));
    const { id } = scenes.change({ op: "create" }, NONE, ada)!;
    const room = roomOf([shader("a", false), shader("b", true, false)], { "pool-a": poolOf({ speed: { "1": 2 } }) });
    expect(scenes.change({ op: "load", scene: id, key: "a" }, room, ada)!.shaders).toEqual({ a: { speed: { "1": 2 } } });
    expect(scenes.change({ op: "load", scene: id, key: "b" }, room, ada)!.shaders).toEqual({ b: null });
    expect(scenes.change({ op: "unload", scene: id, key: "b" }, room, ada)!.shaders).toEqual({});
  });

  it("takes its shader's knobs from the room again, keeping what it had while it's gone", () => {
    const scenes = createShowScenes(openDb(":memory:"));
    const { id } = scenes.change({ op: "create" }, NONE, ada)!;
    scenes.change({ op: "load", scene: id, key: "a" }, roomOf([shader("a", false)], { "pool-a": poolOf({ speed: { "1": 2 } }) }), ada);
    expect(scenes.change({ op: "knobs", scene: id }, NONE, ada)!.shaders).toEqual({ a: { speed: { "1": 2 } } });
    expect(scenes.change({ op: "knobs", scene: id }, roomOf([shader("a", false)], { "pool-a": poolOf({ speed: { "1": 3 } }) }), ada)!.shaders).toEqual({ a: { speed: { "1": 3 } } });
  });

  it("keeps a knob's values in a scene, starting from the room's, as its sketch declares it", () => {
    const scenes = createShowScenes(openDb(":memory:"));
    const { id } = scenes.change({ op: "create" }, NONE, ada)!;
    const room = roomOf([shader("a", false, true)], { "pool-a": poolOf({}) });
    scenes.change({ op: "load", scene: id, key: "a" }, room, ada);
    const later = roomOf([shader("a", false)], { "pool-a": poolOf({ speed: { "1": 2 } }) });
    expect(scenes.change({ op: "param", scene: id, key: "a", name: "speed", set: [[2, 3]] }, later, ada)!.shaders.a).toEqual({ speed: { "1": 2, "2": 3 } });
    expect(scenes.change({ op: "param", scene: id, key: "a", name: "speed", set: [[1, null], [2, 99]] }, later, ada)!.shaders.a).toEqual({ speed: { "2": 4 } });
    expect(scenes.change({ op: "param", scene: id, key: "a", name: "nope", set: [[1, 1]] }, later, ada)).toBeNull();
  });

  it("keeps the order scenes were made in, names each anew, and forgets one fired when it's removed", async () => {
    const scenes = createShowScenes(openDb(":memory:"));
    const one = scenes.change({ op: "create" }, NONE, ada)!;
    const two = scenes.change({ op: "create" }, NONE, ada)!;
    scenes.change({ op: "rename", scene: one.id, name: "Intro" }, NONE, ada);
    expect(scenes.current().scenes.map((s) => s.name)).toEqual(["Intro", "Scene 2"]);
    await scenes.land(two.id, NONE, ada, 0, async () => ({}));
    expect(scenes.current().fired).toBe(two.id);
    scenes.change({ op: "remove", scene: two.id }, NONE, ada);
    expect(scenes.current()).toEqual({ scenes: [expect.objectContaining({ name: "Intro" })], fired: null, queued: null, mode: "cut" });
    expect(scenes.change({ op: "create" }, NONE, ada)!.name).toBe("Scene 1");
  });

  it("refuses a scene that isn't there", async () => {
    const scenes = createShowScenes(openDb(":memory:"));
    expect(await scenes.land("nope", NONE, ada, 0, async () => ({}))).toBeNull();
    expect(scenes.change({ op: "rename", scene: "nope", name: "x" }, NONE, ada)).toBeNull();
    expect(scenes.change({ op: "load", scene: "nope", key: "a" }, NONE, ada)).toBeNull();
  });

  it("keeps how scenes come in", () => {
    const scenes = createShowScenes(openDb(":memory:"));
    expect(scenes.current().mode).toBe("cut");
    scenes.change({ op: "mode", to: "fade" }, NONE, ada);
    expect(scenes.mode()).toBe("fade");
  });
});

describe("landing a scene", () => {
  const at = (beat: number) => ({ t: 0, playing: true, bpm: 120, beat });

  it("waits for the next downbeat of the tempo; at once with none, or just after one", () => {
    expect(untilDownbeat(at(5))).toBe(1500);
    expect(untilDownbeat(at(7.5))).toBe(250);
    expect(untilDownbeat(at(8.01))).toBe(0);
    expect(untilDownbeat({ t: 0, playing: true })).toBe(0);
    expect(untilDownbeat(null)).toBe(0);
  });

  it("cuts at once, waits for the downbeat, or fades over a beat, as the mode says", () => {
    expect(cueOf("cut", at(5))).toEqual({ wait: 0, blend: 0 });
    expect(cueOf("downbeat", at(5))).toEqual({ wait: 1500, blend: 0 });
    expect(cueOf("fade", at(5))).toEqual({ wait: 0, blend: 500 });
    expect(cueOf("fade", null)).toEqual({ wait: 0, blend: 800 });
  });

  it("holds one fired till then, the latest standing in for one waiting, and says which is waiting", () => {
    vi.useFakeTimers();
    const scenes = createShowScenes(openDb(":memory:"));
    const [one, two] = [scenes.change({ op: "create" }, NONE, ada)!, scenes.change({ op: "create" }, NONE, ada)!];
    const went: string[] = [];
    scenes.queue(one.id, 500, () => went.push("one"), () => went.push("one dropped"));
    expect(scenes.current().queued).toBe(one.id);
    scenes.queue(two.id, 500, () => went.push("two"), () => went.push("two dropped"));
    vi.advanceTimersByTime(500);
    expect(went).toEqual(["one dropped", "two"]);
    expect(scenes.current().queued).toBeNull();
    expect(scenes.queue("nope", 0, () => went.push("nope"), () => {})).toBe(false);
    vi.useRealTimers();
  });
});

describe("a scene blending in", () => {
  it("sets its knobs first; brings what's coming in up from none, takes what's going down, then switches it off, all of it showing again", async () => {
    vi.useFakeTimers();
    const said: string[] = [];
    const levels = { linked: (pool: string) => pool !== "pool-plain", level: (pool: string, to: number, ms: number) => (said.push(`${pool}→${to}/${ms}`), true) };
    const scenes = createShowScenes(openDb(":memory:"), Date.now, levels);
    const { id } = scenes.change({ op: "create" }, NONE, ada)!;
    const room = roomOf([shader("in", true), shader("out", false), shader("plain", false)], { "pool-in": poolOf({ speed: { "1": 2 } }) });
    scenes.change({ op: "load", scene: id, key: "in" }, room, ada);
    scenes.change({ op: "param", scene: id, key: "in", name: "speed", set: [[1, 3]] }, room, ada);
    const made: Op[][] = [];
    const make = async (ops: Op[]) => (made.push(ops), {});
    await scenes.land(id, room, ada, 300, make);
    expect(made).toEqual([
      [["pools/pool-in/values/speed/1", 3]],
      [
        ["shaders/plain/muted", true],
        ["shaders/in/muted", false],
      ],
    ]);
    expect(said).toEqual(["pool-in→0/0", "pool-in→1/300", "pool-out→0/300"]);
    await vi.advanceTimersByTimeAsync(300);
    expect(made[2]).toEqual([["shaders/out/muted", true]]);
    expect(said.at(-1)).toBe("pool-out→1/0");
    vi.useRealTimers();
  });

  it("leaves the last one's going out to the next scene fired before it's done", async () => {
    vi.useFakeTimers();
    const scenes = createShowScenes(openDb(":memory:"), Date.now, { linked: () => true, level: () => true });
    const { id } = scenes.change({ op: "create" }, NONE, ada)!;
    const made: Op[][] = [];
    const room = roomOf([shader("out", false)]);
    await scenes.land(id, room, ada, 300, async (ops) => (made.push(ops), {}));
    await scenes.land(id, room, ada, 300, async (ops) => (made.push(ops), {}));
    await vi.advanceTimersByTimeAsync(300);
    expect(made.filter((ops) => ops.length > 0)).toHaveLength(1);
    vi.useRealTimers();
  });
});
