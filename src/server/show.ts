// The show clock: one for the room, in vibes' memory: where the piece is, in
// seconds, and whether it's running; and its tempo, once set (beats a
// minute, and the beat it's on). Started, stopped, moved and given a tempo
// from the transport in any browser (over the room socket, api.ts), told to every
// browser, and to every sketch in the room on its stream of params
// (params.ts), as it changes, so they all agree where the piece is. Each
// start, stop and move is in the history (api.ts); the clock itself isn't
// written: a vibes that starts over starts it at 0, stopped.

import { clockAt, withClockPatch, type ClockPatch, type HeardClock, type ShowClock } from "../shared/params.ts";

export function createShowClock(now: () => number = Date.now) {
  let heard: HeardClock | null = null;
  const listeners = new Set<(clock: ShowClock) => void>();

  return {
    /** Where the clock is now; null if it's never been set. */
    current: (): ShowClock | null => clockAt(heard, now()),

    /** Started, stopped or moved: where it is now, told to everyone listening. */
    set(patch: ClockPatch): ShowClock {
      heard = withClockPatch(heard, patch, now());
      const is = clockAt(heard, now())!;
      for (const l of listeners) l(is);
      return is;
    },

    /** Told where the clock is each time it's set. */
    subscribe(listener: (clock: ShowClock) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type ShowClockSource = ReturnType<typeof createShowClock>;
