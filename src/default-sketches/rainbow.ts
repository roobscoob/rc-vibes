// Rainbow (shared/default-sketches.ts). Built with vibes as Tone is
// (vite.config.ts's defaultSketchScripts), from the workspace's library
// rather than the published @roobscoob/vibes.
import { br30, sketch, lemtone, fract, param } from "../../packages/vibes/src/index.ts";

// How much of the bulbs' most chroma at a brightness to ask for: just inside it, so they make it rather than pale it.
const MARGIN = 0.97;

// chromaAt's answers, by whole degree of hue and lumens: every light asks
// every frame, and the room's lights are mostly at a few brightnesses.
const known = new Map<number, number>();
const KNOWN_MAX = 20_000;

/** The most chroma the bulbs make of `hue` at `lm` lumens without paling it (by halves: less chroma, more lumens). */
function chromaAt(hue: number, lm: number): number {
  const deg = Math.round(hue) % 360;
  const key = deg * 10_001 + Math.min(10_000, Math.round(lm));
  const was = known.get(key);
  if (was !== undefined) return was;
  if (known.size >= KNOWN_MAX) known.clear();
  const most = search(deg, Math.round(lm));
  known.set(key, most);
  return most;
}

function search(hue: number, lm: number): number {
  let lo = 0;
  let hi = br30.edgeOf(hue);
  if (br30.maxLm(lemtone(hue, hi, lm)) >= lm) return hi;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (br30.maxLm(lemtone(hue, mid, lm)) >= lm) lo = mid;
    else hi = mid;
  }
  return lo;
}

// A rainbow rolling across the room. `scale` is how many rainbows fit across,
// `speed` how many times a second each light goes round the hues.
// Petals above 0 bend the bands into a rose around the room's center.
// Each light keeps the brightness, saturation and fidelity of the light below
// it (the layers under this one, the Base Tone to start with), and only its
// hue turns: so a white below makes a white rainbow, and setting the color
// below sets how bright and how vivid the rainbow is.
//
// Brightness comes first: the light below's lumens, exactly, at every hue.
// Saturation is what's let go of when the bulbs can't make both: the light
// below's chroma, but no more than the bulbs make of each hue at that
// brightness (bright yellow and green only come pale; blue and violet keep
// more). So a dim, vivid color below makes a vivid rainbow, and a bright one
// a paler one, as bright as the color below all the way round.
const scale = param("scale", 1, { min: 0.1, max: 8, step: 0.1, label: "Zoom" });
const speed = param("speed", 0.1, { min: -1, max: 1, step: 0.01, label: "Speed" });
const petals = param("petals", 0, { min: 0, max: 12, step: 1, label: "Petals" });

export const update = sketch((here) => {
  const { light, u, v, dt } = here;

  // Phase advances by dt, so dragging speed never makes it jump.
  const s = light.state as { phase?: number };
  s.phase = ((s.phase ?? 0) + dt * speed(here)) % 1;

  const n = petals(here);
  const dx = u - 0.5, dy = v - 0.5;
  const pos = n > 0
    ? Math.hypot(dx, dy) * 2 + 0.25 * Math.cos(n * Math.atan2(dy, dx)) // rings, rippled into petals
    : u;                                                                // straight bands, left to right

  const hue = 360 * fract(pos * scale(here) - s.phase);
  const below = light.below;
  return lemtone(hue, Math.min(below.chroma, chromaAt(hue, below.lm) * MARGIN), below.lm, below.fidelity);
});
