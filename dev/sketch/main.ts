// A sketch to work on the preview with (http://localhost:5173/preview/,
// see src/web/preview/dev.tsx): bands rolling across the room, with knobs of
// each kind, and a piece on the show clock: the first ten seconds fade the
// room in, then the bands roll. Edit and save it, and the page swaps the new
// build in. The library is the workspace's own, not npm's.
import { osc, palettes, param, show, sketch } from "../../packages/vibes/src/index.ts";

const speed = param("speed", 0.05, { min: 0, max: 0.5, step: 0.01, label: "Speed" });
const bands = param("bands", 3, { min: 1, max: 8, step: 1, label: "Bands" });
const tint = param("tint", "2700K", { label: "Tint" });
const lm = param("lm", 300, { min: 0, max: 800, step: 10, label: "Brightness", lights: "color" });
const blink = param("blink", true, { label: "Old bulbs blink", lights: "switch" });

const pattern = osc(bands, speed);
const t = show.time;
// Section one, the fade: how long it takes.
const FADE_S = 10;

export const update = sketch({
  color: (here) => {
    const at = t(here);
    if (at < FADE_S) return tint(here).at((lm(here) * at) / FADE_S);
    return here.light.rail ? palettes.dusk(pattern(here)).at(lm(here)) : tint(here).at(lm(here) * pattern(here));
  },
  switch: (here) => t(here) >= FADE_S && (blink(here) ? pattern(here) > 0.5 : true),
});
