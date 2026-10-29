import { describe, expect, it } from "vitest";
import type { LightInfo } from "../shared/arclamp.ts";
import { applyLayer, baseState, mergeOutput, prevOf, runPipeline } from "./sim.ts";
import type { Layer } from "./draft.ts";

const light = (id: number, channels: string[]): LightInfo => ({ id, type: "br30", tags: null, coords: null, rail: null, channels });
const lights = [light(1, ["a", "b", "brightness", "fidelity"]), light(64, ["on"])];

describe("the preview's room", () => {
  it("starts from room tone, with every channel set", () => {
    const state = baseState(lights, { "1": { a: 0.06, b: 0.13, brightness: 0.7 } });
    expect(state.get(1)).toEqual({ a: 0.06, b: 0.13, brightness: 0.7, fidelity: 0 });
    expect(state.get(64)).toEqual({ on: 0 });
  });

  it("shows shaders the room below them, with each light's metadata", () => {
    const state = baseState(lights, {});
    const prev = prevOf(state, lights, 5);
    expect(prev.initial_time).toBe(5);
    expect(prev.lights[1]).toEqual({ id: 64, channels: { on: 0 }, tags: [], coords: null, rail: null });
  });

  it("merges a shader's output channel by channel, as arclamp does", () => {
    const state = baseState(lights, { "1": { a: 0.06, b: 0.13, brightness: 0.7, fidelity: 1 } });
    const next = mergeOutput(state, lights, {
      lights: [
        { id: 1, channels: { brightness: 1.4, a: null, b: "x", nope: 1 } },
        { id: 64, channels: { on: 1 } },
        { id: 999, channels: { on: 1 } },
      ],
    });
    // Out of range passes through; null, strings and unknown channels and lights don't.
    expect(next.get(1)).toEqual({ a: 0.06, b: 0.13, brightness: 1.4, fidelity: 1 });
    expect(next.get(64)).toEqual({ on: 1 });
    expect(next.has(999)).toBe(false);
    // The state below is left alone.
    expect(state.get(1)!.brightness).toBe(0.7);
  });

  it("ignores output that isn't a list of lights", () => {
    const state = baseState(lights, {});
    expect(mergeOutput(state, lights, { lights: "all" })).toBe(state);
    expect(mergeOutput(state, lights, null)).toBe(state);
  });

  it("leaves the lights a shader is masked from as the layer below had them", () => {
    const state = baseState(lights, { "1": { brightness: 0.7 }, "64": { on: 1 } });
    const out = { lights: [{ id: 1, channels: { brightness: 0.1 } }, { id: 64, channels: { on: 0 } }] };
    const next = mergeOutput(state, lights, out, new Set([64]));
    expect(next.get(1)!.brightness).toBe(0.1);
    expect(next.get(64)).toEqual({ on: 1 });
  });

  it("counts what a shader tries to change before its mask or mute", () => {
    const state = baseState(lights, { "1": { brightness: 0.7 }, "64": { on: 1 } });
    // Light 64 set to what it already is: not a change.
    const out = { lights: [{ id: 1, channels: { brightness: 0.1 } }, { id: 64, channels: { on: 1 } }] };
    const masked = applyLayer(state, lights, out, { muted: false, mask: [1] });
    expect(masked.trying).toEqual([1]);
    expect(masked.state.get(1)!.brightness).toBe(0.7);
    // Muted is masked from every light: it passes everything on as it was.
    const muted = applyLayer(state, lights, out, { muted: true, mask: [] });
    expect(muted.trying).toEqual([1]);
    expect(muted.state).toBe(state);
  });
});

describe("peeking at a stop", () => {
  // Two layers, top first: each sets light 1's brightness to its own.
  const layer = (key: string, brightness: number) => ({ key, muted: false, mask: [], brightness }) as unknown as Layer & { brightness: number };
  const top = layer("top", 0.9);
  const under = layer("under", 0.4);
  const stack = [top, under];
  const call = async (l: Layer, _state?: unknown) => ({ lights: [{ id: 1, channels: { brightness: (l as Layer & { brightness: number }).brightness } }] });
  const one = [light(1, ["a", "b", "brightness", "fidelity"])];

  it("shows the light as it leaves that stop, every layer still running for the whole pipeline", async () => {
    const ran: string[] = [];
    const run = (await runPipeline(one, stack, { "1": { brightness: 0.1 } }, 1, async (l, s) => (ran.push(l.key), call(l, s))))!;
    expect(ran).toEqual(["under", "top"]);
    // What the map shows: the top set aside, the light as it leaves the one under.
    expect(run.shown.get(1)!.brightness).toBe(0.4);
    // The whole pipeline, for the rail's stops: as if nothing were peeked at.
    expect(run.full.get(1)!.brightness).toBe(0.9);
  });

  it("at room tone's stop, shows the room tone alone; not peeking, the whole pipeline", async () => {
    const tone = (await runPipeline(one, stack, { "1": { brightness: 0.1 } }, 2, call))!;
    expect(tone.shown.get(1)!.brightness).toBe(0.1);
    expect(tone.full.get(1)!.brightness).toBe(0.9);
    const none = (await runPipeline(one, stack, { "1": { brightness: 0.1 } }, 0, call))!;
    expect(none.shown).toBe(none.full);
  });
});
