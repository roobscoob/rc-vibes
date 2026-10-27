// The show's MIDI: on or off, and following a MIDI clock (the account menu:
// MidiSettings, in UserMenu.tsx); and what a controller's pads, keys and
// knobs are mapped to, as Ableton maps them. The dock's MIDI button turns on
// map mode: each control that can be mapped (MidiTarget) lights up; click
// one, then press or turn something on the controller, and that's its
// mapping (right-click one to forget it). Out of map mode, the dock hears
// them (useShowMidi): a note, or a control change going up past halfway,
// presses what it's mapped to (fires a scene, taps the tempo…); a control
// change turns a knob across its range (an on-or-off one, past halfway),
// and a note, pressed, flips an on-or-off one.
//
// A MIDI clock (Ableton's, say), followed, sets the show's tempo from its
// pace (24 ticks a beat); its Start makes now the downbeat, and from then
// its ticks are counted, so the beat stays where the clock's is. Everything
// here is kept in this browser.

import { useEffect, useRef, useSyncExternalStore } from "react";
import { clockAt, type ClockPatch, type HeardClock } from "../shared/params.ts";
import { barOf, clamp } from "./components/Tempo.tsx";
import { listenMidi } from "./midi.ts";

const ON_KEY = "vibes.midiOn";
const CLOCK_KEY = "vibes.midiClock";
const MAP_KEY = "vibes.midiMap";
// A clock's ticks a beat, the change in tempo worth saying, and at most one say this often; and the drift from its count worth putting right.
const TICKS = 24;
const BPM_STEP = 0.5;
const SAY_MS = 500;
const DRIFT = 0.05;

/** What a control can be mapped to. */
export type MidiTarget =
  | { kind: "fire"; scene: string }
  | { kind: "knob"; key: string; name: string }
  | { kind: "play" }
  | { kind: "tap" }
  | { kind: "sync" };

/** A control on a controller: a note, or a control change, on a channel (1–16). */
export type Control = `note:${number}:${number}` | `cc:${number}:${number}`;

export interface MidiSettings {
  on: boolean;
  /** Whether a MIDI clock sets the tempo. */
  following: boolean;
  /** What each control is mapped to. */
  mappings: Record<Control, MidiTarget>;
  /** Map mode: the controls that can be mapped are lit, and clicking one picks it. */
  mapping: boolean;
  /** The one picked, waiting for a control to be pressed or turned. */
  picked: MidiTarget | null;
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
const savedMappings = (): Record<Control, MidiTarget> => {
  try {
    const v = JSON.parse(load(MAP_KEY) ?? "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<Control, MidiTarget>) : {};
  } catch {
    return {};
  }
};

let settings: MidiSettings = { on: load(ON_KEY) === "1", following: load(CLOCK_KEY) === "1", mappings: savedMappings(), mapping: false, picked: null, error: null };
const listeners = new Set<() => void>();
function set(patch: Partial<MidiSettings>) {
  settings = { ...settings, ...patch };
  for (const l of listeners) l();
}

/** Whether two targets are the same control of vibes'. */
export const sameTarget = (a: MidiTarget, b: MidiTarget) => JSON.stringify(a) === JSON.stringify(b);

/** The controls mapped to a target, as their badges say them (N36, CC7; with a channel past the first, 2/CC7). */
export function controlsOf(target: MidiTarget, mappings: Record<Control, MidiTarget> = settings.mappings): string[] {
  return (Object.entries(mappings) as [Control, MidiTarget][])
    .filter(([, t]) => sameTarget(t, target))
    .map(([c]) => {
      const [kind, ch, n] = c.split(":");
      return `${ch === "1" ? "" : `${ch}/`}${kind === "note" ? "N" : "CC"}${n}`;
    });
}

const saveMappings = (mappings: Record<Control, MidiTarget>) => {
  keep(MAP_KEY, JSON.stringify(mappings));
  set({ mappings });
};

export const midi = {
  setOn(on: boolean) {
    keep(ON_KEY, on ? "1" : null);
    set({ on, mapping: on && settings.mapping, picked: on ? settings.picked : null, error: on ? null : settings.error });
  },
  setFollowing(following: boolean) {
    keep(CLOCK_KEY, following ? "1" : null);
    set({ following });
  },
  /** Map mode on or off (on turns MIDI on, too). */
  setMapping(mapping: boolean) {
    if (mapping && !settings.on) midi.setOn(true);
    set({ mapping, picked: null });
  },
  pick: (target: MidiTarget) => set({ picked: target }),
  /** A target's mappings, forgotten. */
  forget(target: MidiTarget) {
    saveMappings(Object.fromEntries((Object.entries(settings.mappings) as [Control, MidiTarget][]).filter(([, t]) => !sameTarget(t, target))) as Record<Control, MidiTarget>);
  },
  forgetAll: () => saveMappings({} as Record<Control, MidiTarget>),
};

/** The settings now, outside React. */
export const midiSettings = () => settings;

export function useMidiSettings(): MidiSettings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => settings,
  );
}

/** A message heard, as the mappings have it: the control it's from, and what to do (a press, or a turn to 0–1); null for nothing. `was`: that control change's last value, to tell one going up past halfway. */
export function heardAs(status: number, n: number, v: number, was: number, mappings: Record<Control, MidiTarget>): { control: Control; target: MidiTarget | undefined; does: "press" | "turn" | null } | null {
  const kind = status & 0xf0;
  const isNote = kind === 0x90 && v > 0;
  if (!isNote && kind !== 0xb0) return null;
  const control: Control = `${isNote ? "note" : "cc"}:${(status & 0x0f) + 1}:${n}`;
  const target = mappings[control];
  const does = !target ? null : target.kind === "knob" && !isNote ? "turn" : isNote || (v >= 64 && was < 64) ? "press" : null;
  return { control, target, does };
}

/** What the dock does with what's mapped: a press (of a knob: flipped, if it's on or off), or a knob turned (0 to 1). */
export interface MidiActions {
  press(target: MidiTarget): void;
  turn(target: Extract<MidiTarget, { kind: "knob" }>, to: number): void;
  clock: HeardClock | null;
  onClock: (patch: ClockPatch) => void;
}

/** While it's on, MIDI heard for the show: mapped controls pressed and turned, mapped in map mode, and a clock, if it's followed, setting the tempo. */
export function useShowMidi(actions: MidiActions) {
  const { on } = useMidiSettings();
  const latest = useRef(actions);
  latest.current = actions;

  useEffect(() => {
    if (!on) return;
    let stop: (() => void) | null = null;
    let gone = false;
    const ticks: number[] = [];
    let said = 0;
    // Ticks since the clock's Start, and the beat it started on (null: no Start heard).
    let counted = 0;
    let startedOn: number | null = null;
    // Each control change's last value, to tell one going up past halfway.
    const last = new Map<Control, number>();
    const clockTick = (status: number) => {
      const a = latest.current;
      if (status === 0xfa) {
        // Start: now's the downbeat, and its ticks are counted from here.
        ticks.length = 0;
        counted = 0;
        startedOn = barOf(clockAt(a.clock, Date.now())?.beat ?? 0);
        a.onClock({ beat: startedOn });
        return;
      }
      if (status === 0xfc) {
        startedOn = null;
        return;
      }
      const now = performance.now();
      ticks.push(now);
      if (ticks.length > TICKS + 1) ticks.shift();
      counted++;
      // On each beat the clock's counted, the show's beat put back where the clock's is, if it's drifted.
      if (startedOn !== null && counted % TICKS === 0) {
        const want = startedOn + counted / TICKS;
        const is = clockAt(a.clock, Date.now())?.beat;
        if (is !== undefined && Math.abs(is - want) > DRIFT) a.onClock({ beat: want });
      }
      if (ticks.length <= TICKS || now - said < SAY_MS) return;
      const bpm = Math.round(clamp(60_000 / (ticks[ticks.length - 1]! - ticks[0]!)) * 10) / 10;
      if (a.clock?.bpm !== undefined && Math.abs(a.clock.bpm - bpm) < BPM_STEP) return;
      said = now;
      a.onClock({ bpm });
    };
    const heard = ([status = 0, n = 0, v = 0]: Uint8Array) => {
      if (status === 0xf8 || status === 0xfa || status === 0xfc) {
        if (settings.following) clockTick(status);
        return;
      }
      const cc: Control = `cc:${(status & 0x0f) + 1}:${n}`;
      const was = last.get(cc) ?? 0;
      const got = heardAs(status, n, v, was, settings.mappings);
      if (!got) return;
      const { control, target, does } = got;
      if (control === cc) last.set(cc, v);
      // Map mode, with something picked: this is its control now (and only its).
      if (settings.mapping) {
        if (!settings.picked) return;
        const rest = Object.fromEntries((Object.entries(settings.mappings) as [Control, MidiTarget][]).filter(([c]) => c !== control));
        saveMappings({ ...rest, [control]: settings.picked } as Record<Control, MidiTarget>);
        set({ picked: null });
        return;
      }
      if (does === "turn") latest.current.turn(target as Extract<MidiTarget, { kind: "knob" }>, v / 127);
      else if (does === "press") latest.current.press(target!);
    };
    listenMidi(heard)
      .then((unlisten) => {
        if (gone) unlisten();
        else stop = unlisten;
        set({ error: null });
      })
      .catch((err: unknown) => {
        set({ error: err instanceof Error ? err.message : String(err), on: false, mapping: false });
      });
    return () => {
      gone = true;
      stop?.();
    };
  }, [on]);
}
