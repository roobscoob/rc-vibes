// Fade's code (src/shared/fade.ts, one of vibes' default sketches:
// shared/default-sketches.ts): each color light eased toward what the layers
// below it make, over its Fade time; at once while a show is on. Old bulbs
// only switch: they're left as they are. Built with vibes as Tone is
// (vite.config.ts's defaultSketchScripts).
import type { Color } from "../../packages/vibes/src/color.ts";
import { param, show, sketch } from "../../packages/vibes/src/index.ts";
import { FADE_PARAMS, fadeToward } from "../shared/fade.ts";

const { time: t } = FADE_PARAMS;
const time = param(t.name, t.default, t.options);

// Longer than this since a light was last shown (Fade switched off on it, or
// muted), what it showed then is stale: it starts again from what's below.
const STALE_MS = 250;

export const update = sketch((here) => {
  const s = here.light.state as { shown?: Color; at?: number };
  const { shown, at } = s;
  const below = here.light.below;
  const fresh = shown !== undefined && at !== undefined && here.now - at <= STALE_MS;
  s.shown = fresh ? fadeToward(shown, below, here.dt, show.on(here) ? 0 : time(here)) : below;
  s.at = here.now;
  return s.shown;
});
