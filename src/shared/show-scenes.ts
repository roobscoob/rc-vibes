// A show scene fired, as changes to the live state (shared/live.ts): what
// vibes' server makes when one's fired (server/show-scenes.ts), and what a
// browser not in live mode previews (pending edits, till Apply). The shaders
// it has are switched on, with its knobs set as it keeps them (in their
// pools), and every other off; its knobs first, as their own update, so
// none comes on with its old values. A shader a scene has that's gone from
// the room is passed over; one it doesn't have, put in since, goes off.

import { pathOf, type Op, type Pool } from "./live.ts";
import { BEATS_PER_BAR, sameValue, type ShowClock } from "./params.ts";
import type { CueMode, SceneKnobs, Shader, ShaderKey, ShowScene } from "./vibes.ts";

// Fired this little after a beat (as a fraction of one), it's that beat's, not the next's.
const LATE = 0.04;

/** A shader's knobs as the room has them now: its pool's values (null: it has no pool). */
export const knobsOf = (shader: Shader, pools: Record<string, Pool>): SceneKnobs | null => (shader.pool ? (pools[shader.pool]?.values ?? {}) : null);

/** A scene fired in a room of these shaders and pools: its knobs' changes, and which shaders go off and on. */
export interface Firing {
  knobs: Op[];
  off: ShaderKey[];
  on: ShaderKey[];
  /** Its shaders that are on already, and stay on. */
  stay: ShaderKey[];
}

export function firingOf(scene: ShowScene, shaders: Shader[], pools: Record<string, Pool>): Firing {
  const out: Firing = { knobs: [], off: [], on: [], stay: [] };
  for (const s of shaders) {
    if (s.stage === "failed") continue;
    if (!Object.hasOwn(scene.shaders, s.key)) {
      if (!s.muted) out.off.push(s.key);
      continue;
    }
    (s.muted ? out.on : out.stay).push(s.key);
    const saved = scene.shaders[s.key] ?? null;
    const pool = s.pool ? pools[s.pool] : undefined;
    if (!saved || !pool) continue;
    // The knobs it keeps, as the sketch still declares them; any other's left as it is.
    for (const spec of (pool.declared ?? []).filter((p) => Object.hasOwn(saved, p.name))) {
      const now = pool.values[spec.name] ?? {};
      const want = saved[spec.name]!;
      for (const light of Object.keys(now)) if (!Object.hasOwn(want, light)) out.knobs.push([pathOf("pools", s.pool!, "values", spec.name, light)]);
      for (const [light, v] of Object.entries(want)) {
        if (Object.hasOwn(now, light) && sameValue(now[light]!, v)) continue;
        out.knobs.push([pathOf("pools", s.pool!, "values", spec.name, light), v]);
      }
    }
  }
  return out;
}

/** Shaders switched on or off, as changes. */
export const mutesOf = (keys: readonly ShaderKey[], muted: boolean): Op[] => keys.map((k) => [pathOf("shaders", k, "muted"), muted]);

/** How long (ms) a scene's fade takes: a beat of the show's tempo, within reason; most of a second without one. */
export function fadeMs(clock: ShowClock | null): number {
  return clock?.bpm === undefined ? 800 : Math.round(Math.min(1500, Math.max(300, 60_000 / clock.bpm)));
}

/** How long (ms) a scene fired now waits for the show's next downbeat (a bar's first beat); 0 at once (or with no tempo). */
export function untilDownbeat(clock: ShowClock | null): number {
  if (clock?.bpm === undefined || clock.beat === undefined) return 0;
  const into = (clock.beat % BEATS_PER_BAR) / BEATS_PER_BAR;
  return into < LATE / BEATS_PER_BAR ? 0 : ((1 - into) * BEATS_PER_BAR * 60_000) / clock.bpm;
}

/** A scene fired in this mode now: how long it waits, and how long it blends. */
export function cueOf(mode: CueMode, clock: ShowClock | null): { wait: number; blend: number } {
  if (mode === "downbeat") return { wait: untilDownbeat(clock), blend: 0 };
  if (mode === "fade") return { wait: 0, blend: fadeMs(clock) };
  return { wait: 0, blend: 0 };
}
