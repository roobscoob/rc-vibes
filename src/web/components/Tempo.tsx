// The show's tempo, beside the transport: a light on the beat (warm on the
// downbeat, a bar's first), the beats a minute (click to type), Tap, and
// Sync, which makes now the downbeat. (A MIDI clock sets it too, and Tap and
// Sync can be mapped to a controller: midi-settings.ts.)
//
// Tapping: two taps or more, each within two seconds of the last, set the
// tempo from the taps' pace (the last eight), the first tap a downbeat.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BEATS_PER_BAR, clockAt, MAX_BPM, MIN_BPM, type ClockPatch, type HeardClock } from "../../shared/params.ts";
import { Mappable } from "./Mappable.tsx";

interface Props {
  clock: HeardClock | null;
  onSet: (patch: ClockPatch) => void;
}

// Taps further apart than this start again.
const TAP_GAP_MS = 2000;
const TAPS = 8;

const bpmText = (bpm: number) => (Number.isInteger(bpm) ? String(bpm) : bpm.toFixed(1));
export const clamp = (bpm: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));

/** The first beat of the bar nearest `beat`: a downbeat. */
export const barOf = (beat: number) => Math.round(beat / BEATS_PER_BAR) * BEATS_PER_BAR;

// The run of taps (one for the page, whether tapped here or from a controller): the last few, the bar its first began, and how many beats on the last is.
let taps: number[] = [];
let run = { bar: 0, beats: 0 };

/** A tap on the beat: from the second of a run, the tempo set from the run's pace. */
export function tapTempo(clock: HeardClock | null, onSet: (patch: ClockPatch) => void) {
  const now = performance.now();
  const fresh = taps.length > 0 && now - taps[taps.length - 1]! < TAP_GAP_MS;
  if (fresh) run.beats++;
  else run = { bar: barOf(clockAt(clock, Date.now())?.beat ?? 0), beats: 0 };
  taps = fresh ? [...taps, now].slice(-TAPS) : [now];
  if (taps.length < 2) return;
  const bpm = clamp(60_000 / ((taps[taps.length - 1]! - taps[0]!) / (taps.length - 1)));
  onSet({ bpm: Math.round(bpm * 10) / 10, beat: run.bar + run.beats });
}

/** Sync: now's the downbeat (with a tempo). */
export function syncTempo(clock: HeardClock | null, onSet: (patch: ClockPatch) => void) {
  const beat = clockAt(clock, Date.now())?.beat;
  if (beat !== undefined) onSet({ beat: barOf(beat) });
}

export function Tempo({ clock, onSet }: Props) {
  const latest = useRef({ clock, onSet });
  latest.current = { clock, onSet };
  const beatNow = () => clockAt(latest.current.clock, Date.now())?.beat;

  // The light, drawn each frame without React: bright on the beat, fading to the next.
  const light = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const el = light.current;
      const beat = beatNow();
      if (el) {
        const into = beat === undefined ? 1 : beat % 1;
        el.style.opacity = String(0.15 + 0.85 * (1 - into) ** 2);
        el.classList.toggle("bar", beat !== undefined && Math.floor(beat) % BEATS_PER_BAR === 0);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  const [typed, setTyped] = useState<string | null>(null);
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const bpm = Number(typed);
      if (Number.isFinite(bpm) && bpm >= MIN_BPM && bpm <= MAX_BPM) onSet({ bpm: Math.round(bpm * 10) / 10 });
      setTyped(null);
    }
    if (e.key === "Escape") setTyped(null);
  };

  const bpm = clock?.bpm;
  return (
    <div className="tempo" role="group" aria-label="Tempo">
      <span ref={light} className="tempo-light" aria-hidden="true" />
      {typed === null ? (
        <button className="tempo-bpm mono" onClick={() => setTyped(bpm === undefined ? "120" : bpmText(bpm))} title="The tempo, in beats a minute: click to type one">
          {bpm === undefined ? "—" : bpmText(bpm)}
          <small> BPM</small>
        </button>
      ) : (
        <input className="tempo-bpm mono" autoFocus value={typed} size={5} inputMode="decimal" onChange={(e) => setTyped(e.target.value)} onKeyDown={key} onBlur={() => setTyped(null)} aria-label="Beats a minute" />
      )}
      <Mappable target={{ kind: "tap" }} label="Tap">
        <button className="tempo-tap" onClick={() => tapTempo(clock, onSet)} title="Tap on the beat (the first tap a bar's first beat)">
          Tap
        </button>
      </Mappable>
      <Mappable target={{ kind: "sync" }} label="Sync">
        <button className="tempo-sync" onClick={() => syncTempo(clock, onSet)} disabled={bpm === undefined} title="Sync: now is the downbeat, the first beat of a bar">
          Sync
        </button>
      </Mappable>
    </div>
  );
}
