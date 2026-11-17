import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Color, color } from "../../packages/vibes/src/color.ts";
import { FADE_PARAMS, fadeToward } from "./fade.ts";

describe("fadeToward", () => {
  it("gets 99% of the way in its fade time, brightness by how it looks", () => {
    // Off to 1000 lm: its cube root goes 0 to 10, and is 9.9 after a second.
    const shown = fadeToward(color("2700K").at(0), color("2700K").at(1000), 1, 1);
    expect(Math.cbrt(shown.lm)).toBeCloseTo(9.9, 9);
  });

  it("is there at once with a fade time of 0", () => {
    const target = color("#ff8800");
    expect(fadeToward(color("2700K"), target, 0.01, 0)).toBe(target);
  });

  it("stays put over no time", () => {
    const shown = color("2700K").at(400);
    expect(fadeToward(shown, color("#0044ff"), 0, 1)).toBe(shown);
  });

  it("takes a second by default", () => {
    expect(FADE_PARAMS.time.default).toBe(1);
  });

  it("never goes past where it's going, in any part", async () => {
    await fc.assert(
      fc.property(colors, colors, dts, times, (shown, target, dt, time) => {
        const next = parts(fadeToward(shown, target, dt, time));
        parts(shown).forEach((from, i) => {
          const to = parts(target)[i]!;
          expect(next[i]).toBeGreaterThanOrEqual(Math.min(from, to) - 1e-9);
          expect(next[i]).toBeLessThanOrEqual(Math.max(from, to) + 1e-9);
        });
      }),
    );
  });

  it("never turns back on its way", async () => {
    await fc.assert(
      fc.property(colors, colors, fc.array(dts, { minLength: 1 }), times, (start, target, steps, time) => {
        let shown = start;
        let left = gaps(start, target);
        for (const dt of steps) {
          shown = fadeToward(shown, target, dt, time);
          const now = gaps(shown, target);
          now.forEach((gap, i) => expect(gap).toBeLessThanOrEqual(left[i]! + 1e-9));
          left = now;
        }
      }),
    );
  });

  it("is all but 1% of the way after its fade time, however it's ticked, and there after three", async () => {
    await fc.assert(
      fc.property(colors, colors, fc.array(fc.double({ min: 0.01, max: 1, noNaN: true }), { minLength: 1 }), times, (start, target, weights, time) => {
        const total = weights.reduce((a, b) => a + b, 0);
        const tick = (from: Color) => weights.reduce((c, w) => fadeToward(c, target, (w / total) * time, time), from);
        const once = tick(start);
        const at = gaps(start, target);
        gaps(once, target).forEach((gap, i) => expect(gap).toBeLessThanOrEqual(0.01 * at[i]! + 1e-3 + 1e-9));
        expect(tick(tick(once))).toBe(target);
      }),
    );
  });

  it("is the same at any tick rate", async () => {
    await fc.assert(
      fc.property(colors, colors, fc.integer({ min: 1, max: 100 }), dts, times, (start, target, ticks, dt, time) => {
        let ticked = start;
        for (let i = 0; i < ticks; i++) ticked = fadeToward(ticked, target, dt / ticks, time);
        const whole = parts(fadeToward(start, target, dt, time));
        // Within a hair: one of them may have landed where the other's a hair short.
        parts(ticked).forEach((p, i) => expect(Math.abs(p - whole[i]!)).toBeLessThanOrEqual(2e-3));
      }),
    );
  });
});

// Helpers

/** A color's parts as a fade moves them: OKLab's a and b, lumens' cube root, fidelity. */
const parts = (c: Color) => [c.a, c.b, Math.cbrt(c.lm), c.fidelity];
/** How far each part has to go: going dark, only brightness (a light dims in its own hue). */
const gaps = (from: Color, to: Color) => parts(from).map((p, i) => (to.lm > 0 || i === 2 ? Math.abs(parts(to)[i]! - p) : 0));

const colors = fc
  .record({
    a: fc.double({ min: -0.4, max: 0.4, noNaN: true }),
    b: fc.double({ min: -0.4, max: 0.4, noNaN: true }),
    lm: fc.oneof(fc.constant(0), fc.double({ min: 0, max: 2000, noNaN: true })),
    fidelity: fc.double({ min: 0, max: 1, noNaN: true }),
  })
  .map(({ a, b, lm, fidelity }) => new Color(a, b, lm, fidelity));
const dts = fc.double({ min: 0, max: 0.25, noNaN: true });
const times = fc.double({ min: 0.05, max: 3, noNaN: true });
