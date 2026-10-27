// The show's MIDI, as set in the account menu (MidiSettings, in UserMenu.tsx)
// and heard by the show's dock (useShowMidi): on or off; a controller's pads,
// learned (the pad pressed next is the first scene's, and the ones above it
// the next scenes'), each firing its scene; and, if wanted, a MIDI clock
// (Ableton's, say) setting the show's tempo from its pace (24 ticks a beat),
// its Start making now the downbeat. Each is kept in this browser.

import { useEffect, useRef, useSyncExternalStore } from "react";
import { clockAt, type ClockPatch, type HeardClock } from "../shared/params.ts";
import { barOf, clamp } from "./components/Tempo.tsx";
import { listenMidi } from "./midi.ts";

const ON_KEY = "vibes.midiOn";
const PAD_KEY = "vibes.midiScene1";
const CLOCK_KEY = "vibes.midiClock";
// A clock's ticks a beat, the change in tempo worth saying, and at most one say this often.
const TICKS = 24;
const BPM_STEP = 0.5;
const SAY_MS = 500;

export interface MidiSettings {
  on: boolean;
  /** The note of the pad that fires the first scene (null: not learned). */
  first: number | null;
  /** Whether a MIDI clock sets the tempo. */
  following: boolean;
  /** Waiting for a pad, to be the first scene's. */
  learning: boolean;
  /** Why it couldn't listen. */
  error: string | null;
}

const load = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const keep = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Kept for now only.
  }
};

const pad = load(PAD_KEY);
let settings: MidiSettings = {
  on: load(ON_KEY) === "1",
  first: pad !== null && Number.isInteger(Number(pad)) ? Number(pad) : null,
  following: load(CLOCK_KEY) === "1",
  learning: false,
  error: null,
};
const listeners = new Set<() => void>();
function set(patch: Partial<MidiSettings>) {
  settings = { ...settings, ...patch };
  for (const l of listeners) l();
}

export const midi = {
  setOn(on: boolean) {
    keep(ON_KEY, on ? "1" : null);
    set({ on, learning: on && settings.learning, error: on ? null : settings.error });
  },
  setFirst(first: number | null) {
    keep(PAD_KEY, first === null ? null : String(first));
    set({ first, learning: false });
  },
  setFollowing(following: boolean) {
    keep(CLOCK_KEY, following ? "1" : null);
    set({ following });
  },
  setLearning: (learning: boolean) => set({ learning }),
};

export function useMidiSettings(): MidiSettings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => settings,
  );
}

/** While it's on, MIDI heard for the show: pads fire scenes (1 to `count`), and a clock, if it's followed, sets the tempo. */
export function useShowMidi(count: number, onPad: (n: number) => void, clock: HeardClock | null, onClock: (patch: ClockPatch) => void) {
  const { on } = useMidiSettings();
  const latest = useRef({ count, onPad, clock, onClock });
  latest.current = { count, onPad, clock, onClock };

  useEffect(() => {
    if (!on) return;
    let stop: (() => void) | null = null;
    let gone = false;
    const ticks: number[] = [];
    let said = 0;
    const heard = ([status = 0, n = 0, velocity = 0]: Uint8Array) => {
      const s = latest.current;
      if (status === 0xf8 || status === 0xfa) {
        if (!settings.following) return;
        const now = performance.now();
        if (status === 0xfa) {
          // Start: now's the downbeat.
          ticks.length = 0;
          s.onClock({ beat: barOf(clockAt(s.clock, Date.now())?.beat ?? 0) });
          return;
        }
        ticks.push(now);
        if (ticks.length > TICKS + 1) ticks.shift();
        if (ticks.length <= TICKS || now - said < SAY_MS) return;
        const bpm = Math.round(clamp(60_000 / (ticks[ticks.length - 1]! - ticks[0]!)) * 10) / 10;
        if (s.clock?.bpm !== undefined && Math.abs(s.clock.bpm - bpm) < BPM_STEP) return;
        said = now;
        s.onClock({ bpm });
        return;
      }
      if ((status & 0xf0) !== 0x90 || velocity === 0) return;
      if (settings.learning) return midi.setFirst(n);
      if (settings.first === null) return;
      const pad = n - settings.first + 1;
      if (pad >= 1 && pad <= s.count) s.onPad(pad);
    };
    listenMidi(heard)
      .then((unlisten) => {
        if (gone) unlisten();
        else stop = unlisten;
        set({ error: null });
      })
      .catch((err: unknown) => {
        set({ error: err instanceof Error ? err.message : String(err), on: false });
      });
    return () => {
      gone = true;
      stop?.();
    };
  }, [on]);
}
