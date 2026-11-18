// A light eased toward a color: the same share of the way each moment, as a
// dimmer with a capacitor would. The same at 100 ticks a second as at 30, a
// new color midway just turns it, and it never goes past. Colors move as
// Color.mix moves them, evenly as they look: hue and chroma in a straight line
// through OKLab, brightness by its cube root. Tone eases its color by it
// (src/default-sketches/tone.ts), so the base Tone changed doesn't jump.

import type { Color } from "../../packages/vibes/src/color.ts";
import { decay } from "../../packages/vibes/src/shape.ts";

// A fade's time is when all but this share of the way is gone.
const LEFT = 0.01;
const HALVINGS = Math.log2(1 / LEFT);
// This close (in OKLab's a and b, lumens' cube root, and fidelity), a light is
// there: it ends the fade, rather than closing in forever and never sending
// the same frame twice.
const HAIR = 1e-3;

// Dark is dark, whatever hue it was dimmed from.
const dark = (c: Color) => Math.cbrt(c.lm) < HAIR;
const near = (x: Color, y: Color) =>
  (dark(x) && dark(y)) ||
  (Math.abs(x.a - y.a) < HAIR &&
    Math.abs(x.b - y.b) < HAIR &&
    Math.abs(Math.cbrt(x.lm) - Math.cbrt(y.lm)) < HAIR &&
    Math.abs(x.fidelity - y.fidelity) < HAIR);

/** A light showing `shown`, `dt` seconds on, fading to `target` over `time` seconds (0, there at once). */
export function fadeToward(shown: Color, target: Color, dt: number, time: number): Color {
  const next = shown.mix(target, 1 - decay(dt, time / HALVINGS));
  return near(next, target) ? target : next;
}
