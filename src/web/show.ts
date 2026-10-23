// The show clock, as vibes last said it: one for the room, set from the
// transport in any browser (scene.ts carries it both ways), and run on from
// when it was heard while it plays (clockAt).

import { useSyncExternalStore } from "react";
import type { ClockPatch, HeardClock } from "../shared/params.ts";
import { onClock, sayClock } from "./scene.ts";

let clock: HeardClock | null = null;
const listeners = new Set<() => void>();

onClock((c) => {
  clock = { ...c, at: Date.now() };
  for (const l of listeners) l();
});

const snapshot = () => clock;

/** The show clock as last heard (null: never set). clockAt() says where it is now. */
export function useClock(): HeardClock | null {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, snapshot);
}

/** Start, stop or move the show clock: said to vibes, which tells everyone, this browser too. */
export function setClock(patch: ClockPatch) {
  sayClock(patch);
}
