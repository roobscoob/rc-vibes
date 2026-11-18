import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VibesHost } from "../../packages/vibes/src/param.ts";
import type { Out, Prev } from "../../packages/vibes/src/arclamp.ts";
import { color } from "../../packages/vibes/src/color.ts";

const g = globalThis as Record<string, unknown>;
const T = 1_800_000_000_000;
// A tick at arclamp's 100 a second.
const TICK = 10;

beforeEach(() => {
  delete g.__vibesParams;
  delete g.__vibes;
  delete g.__vibesStart;
});

describe("Tone", () => {
  it("starts at its color", async () => {
    const { update } = await load();
    expect(lm(update(room, T, T))).toBeCloseTo(703, 3);
  });

  it("eases a light to a new color over a second, rather than jumping", async () => {
    const { update, host } = await load();
    update(room, T, T);
    setLm(host, 100);
    const soon = lm(update(room, T + TICK, T + TICK));
    expect(soon).toBeLessThan(703);
    expect(soon).toBeGreaterThan(600);
    let now = T + TICK;
    let later = soon;
    while (now < T + 1000) {
      now += TICK;
      later = lm(update(room, now, now));
    }
    // 99% of the way as it looks, by brightness' cube root.
    const way = (Math.cbrt(703) - Math.cbrt(later)) / (Math.cbrt(703) - Math.cbrt(100));
    expect(way).toBeCloseTo(0.99, 6);
    // And there, exactly, a little after.
    for (let i = 0; i < 100; i++) later = lm(update(room, (now += TICK), now));
    expect(later).toBeCloseTo(100, 6);
  });

  it("starts again at its color after a while not shown", async () => {
    const { update, host } = await load();
    update(room, T, T);
    setLm(host, 100);
    expect(lm(update(room, T + 300, T + 300))).toBeCloseTo(100, 6);
  });

  it("switches old bulbs at once", async () => {
    const { update, host } = await load();
    const bulb: Prev = { initial_time: T, lights: [{ id: 2, channels: { on: 0 }, tags: [], coords: { mm_x: 0, mm_y: 0, floor: 4 }, rail: null }] };
    update(bulb, T, T);
    host.apply("change", { name: "on", set: [[true, [2]]] });
    expect(update(bulb, T + TICK, T + TICK).lights[0]!.channels.on).toBe(1);
  });
});

// Helpers

/** Tone's code, loaded anew (its lights' memory, and what it's heard from vibes, with it). */
async function load() {
  vi.resetModules();
  const { update } = (await import("./tone.ts")) as { update: (prev: Prev, nowMs: number, initialMs: number) => Out };
  return { update, host: g.__vibes as VibesHost };
}

/** One color light, as the layers below make it (Tone pays it no mind). */
const room: Prev = {
  initial_time: T,
  lights: [{ id: 1, channels: { a: 0, b: 0, brightness: 0, fidelity: 1 }, tags: [], coords: { mm_x: 0, mm_y: 0, floor: 4 }, rail: null }],
};

/** Light 1's color set to the default warm white, at these lumens. */
const setLm = (host: VibesHost, at: number) => host.apply("change", { name: "color", set: [[color("2800K").at(at).toJSON(), [1]]] });

/** Light 1's lumens, as sent (brightness 1.0 is 1000 lm). */
const lm = (out: Out) => out.lights[0]!.channels.brightness! * 1000;
