import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VibesHost } from "../../packages/vibes/src/param.ts";
import type { Out, Prev } from "../../packages/vibes/src/arclamp.ts";
import { restingClock } from "../../packages/vibes/src/wire.ts";

const g = globalThis as Record<string, unknown>;
const T = 1_800_000_000_000;
// A tick at arclamp's 100 a second.
const TICK = 10;

beforeEach(() => {
  delete g.__vibesParams;
  delete g.__vibes;
  delete g.__vibesStart;
});

describe("Fade", () => {
  it("starts where the layers below are", async () => {
    const { update } = await load();
    expect(brightness(update(below(0.8), T, T))).toBeCloseTo(0.8, 9);
  });

  it("eases a light toward what's below over its fade time, a second to start with", async () => {
    const { update } = await load();
    update(below(0), T, T);
    const soon = brightness(update(below(1), T + TICK, T + TICK));
    let now = T + TICK;
    let later = soon;
    while (now < T + 1000) {
      now += TICK;
      later = brightness(update(below(1), now, now));
    }
    expect(soon).toBeGreaterThan(0);
    expect(soon).toBeLessThan(0.2);
    // 99% of the way as it looks, by brightness' cube root.
    expect(Math.cbrt(later)).toBeCloseTo(0.99, 6);
  });

  it("passes changes through at once while a show is on, and eases them again once it ends", async () => {
    const { update, host } = await load();
    update(below(0), T, T);
    host.apply("clock", { v: 1, clock: restingClock(T), on: true });
    expect(brightness(update(below(1), T + TICK, T + TICK))).toBeCloseTo(1, 9);
    expect(brightness(update(below(0.2), T + 2 * TICK, T + 2 * TICK))).toBeCloseTo(0.2, 9);
    host.apply("clock", { v: 1, clock: restingClock(T + 3 * TICK), on: false });
    const eased = brightness(update(below(1), T + 3 * TICK, T + 3 * TICK));
    expect(eased).toBeGreaterThan(0.2);
    expect(eased).toBeLessThan(0.3);
  });

  it("starts again from what's below after a while not shown", async () => {
    const { update } = await load();
    update(below(0), T, T);
    expect(brightness(update(below(1), T + 300, T + 300))).toBeCloseTo(1, 9);
  });

  it("leaves old bulbs as they are", async () => {
    const { update } = await load();
    const out = update({ initial_time: T, lights: [{ id: 2, channels: { on: 1 }, tags: [], coords: { mm_x: 0, mm_y: 0, floor: 4 }, rail: null }] }, T, T);
    expect(out.lights).toEqual([]);
  });
});

// Helpers

/** Fade's code, loaded anew (its lights' memory, and what it's heard from vibes, with it). */
async function load() {
  vi.resetModules();
  const { update } = (await import("./fade.ts")) as { update: (prev: Prev, nowMs: number, initialMs: number) => Out };
  return { update, host: g.__vibes as VibesHost };
}

/** One warm color light, at this brightness (1.0 is 1000 lm), as the layers below make it. */
const below = (brightness: number): Prev => ({
  initial_time: T,
  lights: [{ id: 1, channels: { a: 0.02, b: 0.06, brightness, fidelity: 1 }, tags: [], coords: { mm_x: 0, mm_y: 0, floor: 4 }, rail: null }],
});

const brightness = (out: Out) => out.lights[0]!.channels.brightness!;
