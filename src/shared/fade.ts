// Fade: each color light eased toward what the layers below it make, so
// nothing under it changes a light at once (a layer switched on or off, a
// scene, the show on the beat, a param, a sketch's own jumps). Its code is
// vibes' own (src/default-sketches/fade.ts), one of vibes' default sketches
// (default-sketches.ts), and one Fade is the room's, kept by vibes on top of
// every layer, on every light (kept-layers.ts). Switched off, its Fade time
// at 0, or while a show is on (its flashes on the beat stay sharp), the
// lights are as the layers below make them, at once.
//
// A light closes in on what's below by the same share of the way each
// moment, as a dimmer with a capacitor would: the same at 100 ticks a second
// as at 30, a new color midway just turns it, and it never goes past. Colors
// move as Color.mix moves them, evenly as they look: hue and chroma in a
// straight line through OKLab, brightness by its cube root.

import type { Color } from "../../packages/vibes/src/color.ts";
import { decay } from "../../packages/vibes/src/shape.ts";
import { checkSpec, type ParamSpec } from "../../packages/vibes/src/wire.ts";

export const FADE = {
  name: "Fade",
  sketch: "b45e0c01-0000-4000-8000-000000000006",
  instance: "b45e0c01-0000-4000-8000-000000000007",
  pool: "b45e0c01-0000-4000-8000-000000000008",
} as const;

/** Its param, as its code declares it (src/default-sketches/fade.ts) and with those very options. */
export const FADE_PARAMS = {
  /** Seconds to get all but 1% of the way to a new color; 0, at once. */
  time: { name: "time", default: 1, options: { min: 0, max: 3, step: 0.05, label: "Fade time", lights: "color" as const } },
};

const spec = checkSpec({ name: "time", kind: "number", ...FADE_PARAMS.time.options, default: FADE_PARAMS.time.default });
if (typeof spec === "string") throw new Error(spec);
/** Its params as declared: what its code says once it runs, said ahead so its knobs are there from the start. */
export const FADE_SPECS: ParamSpec[] = [spec];

/** Whether an instance is the room's Fade (by its id, or a layer's key). */
export const isFade = (id: string | null | undefined) => id === FADE.instance;

// Fade time is when all but this share of the way is gone.
const LEFT = 0.01;
const HALVINGS = Math.log2(1 / LEFT);
// This close (in OKLab's a and b, lumens' cube root, and fidelity), a light is
// there: it ends the fade, rather than closing in forever and never sending
// the same frame twice.
const HAIR = 1e-3;

// Dark is dark, whatever hue it was dimmed from (a fade to dark keeps its hue).
const dark = (c: Color) => Math.cbrt(c.lm) < HAIR;
const near = (x: Color, y: Color) =>
  (dark(x) && dark(y)) ||
  (Math.abs(x.a - y.a) < HAIR && Math.abs(x.b - y.b) < HAIR && Math.abs(Math.cbrt(x.lm) - Math.cbrt(y.lm)) < HAIR && Math.abs(x.fidelity - y.fidelity) < HAIR);

/** A light showing `shown`, `dt` seconds on, fading to `target` over `time` seconds (0, there at once). */
export function fadeToward(shown: Color, target: Color, dt: number, time: number): Color {
  const next = shown.mix(target, 1 - decay(dt, time / HALVINGS));
  return near(next, target) ? target : next;
}
