// Tone's code (src/shared/base-color.ts, one of vibes' default sketches:
// shared/default-sketches.ts): each color light its color, each old bulb on or
// off, both params. Built with vibes (vite.config.ts's defaultSketchScripts)
// as the builder builds a sketch: one script, its update() made global. The
// library is the workspace's own.
//
// Its color changed, a light eases to the new one over a second
// (shared/fade.ts), so changing the base Tone doesn't jump. Old bulbs only
// switch: they switch at once.
import { param, sketch } from "../../packages/vibes/src/index.ts";
import type { Color } from "../../packages/vibes/src/color.ts";
import { BASE_COLOR_PARAMS, TONE_FADE_S } from "../shared/base-color.ts";
import { fadeToward } from "../shared/fade.ts";

const { color: c, on: o } = BASE_COLOR_PARAMS;
const color = param(c.name, c.default, c.options);
const on = param(o.name, o.default, o.options);

// Longer than this since a light was last shown (muted, or masked off it),
// what it showed then is stale: it starts again at its color.
const STALE_MS = 250;

export const update = sketch({
  color: (here) => {
    const s = here.light.state as { shown?: Color; at?: number };
    const target = color(here);
    const fresh = s.shown !== undefined && s.at !== undefined && here.now - s.at <= STALE_MS;
    s.shown = fresh ? fadeToward(s.shown!, target, here.dt, TONE_FADE_S) : target;
    s.at = here.now;
    return s.shown;
  },
  switch: on,
});
