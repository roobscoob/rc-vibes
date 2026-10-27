// The show's scenes, as vibes last said them: one set for the room, saved,
// changed and fired from any browser (scene.ts carries them both ways).

import { useSyncExternalStore } from "react";
import type { ShowScenes } from "../shared/vibes.ts";
import { onScenes } from "./scene.ts";

const NONE: ShowScenes = { scenes: [], fired: null, queued: null, mode: "cut" };
let scenes = NONE;
const listeners = new Set<() => void>();

onScenes((s) => {
  scenes = s;
  for (const l of listeners) l();
});

const snapshot = () => scenes;

/** The show's scenes, in order, and the one fired last (none until vibes says). */
export function useShowScenes(): ShowScenes {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, snapshot);
}

export { fireScene, sayScene } from "./scene.ts";
