// The show clock: one for the room, in vibes' memory: where the piece is, in
// seconds, and whether it's running. Started, stopped and moved from the
// transport in any browser (over the room socket, api.ts), and told to every
// browser, and to every sketch in the room on its stream of params
// (params.ts), as it changes, so they all agree where the piece is. Nothing's
// written: a vibes that starts over starts it at 0, stopped.

import { clockAt, type ClockPatch, type HeardClock, type ShowClock } from "../shared/params.ts";

export function createShowClock(now: () => number = Date.now) {
  let heard: HeardClock | null = null;
  const listeners = new Set<(clock: ShowClock) => void>();

  return {
    /** Where the clock is now; null if it's never been set. */
    current: (): ShowClock | null => clockAt(heard, now()),

    /** Started, stopped or moved: where it is now, told to everyone listening. */
    set(patch: ClockPatch): ShowClock {
      const was = clockAt(heard, now()) ?? { playing: false, t: 0 };
      heard = { playing: patch.playing ?? was.playing, t: Math.max(0, patch.t ?? was.t), at: now() };
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
