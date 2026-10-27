// The show's tempo, beside the transport: a light on the beat (warm on the
// downbeat, a bar's first), the beats a minute (click to type), Tap, and
// Sync, which makes now the downbeat. (A MIDI clock sets it too: MidiPads.)
//
// Tapping: two taps or more, each within two seconds of the last, set the
// tempo from the taps' pace (the last eight), the first tap a downbeat.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BEATS_PER_BAR, clockAt, MAX_BPM, MIN_BPM, type ClockPatch, type HeardClock } from "../../shared/params.ts";

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

  // The run of taps: the last few, the bar its first began, and how many beats on the last is.
  const taps = useRef<number[]>([]);
  const run = useRef({ bar: 0, beats: 0 });
  const tap = () => {
    const now = performance.now();
    const was = taps.current;
    const fresh = was.length > 0 && now - was[was.length - 1]! < TAP_GAP_MS;
    if (fresh) run.current.beats++;
    else run.current = { bar: barOf(beatNow() ?? 0), beats: 0 };
    taps.current = fresh ? [...was, now].slice(-TAPS) : [now];
    const t = taps.current;
    if (t.length < 2) return;
    const bpm = clamp(60_000 / ((t[t.length - 1]! - t[0]!) / (t.length - 1)));
    onSet({ bpm: Math.round(bpm * 10) / 10, beat: run.current.bar + run.current.beats });
  };

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
      <button className="tempo-tap" onClick={tap} title="Tap on the beat (the first tap a bar's first beat)">
        Tap
      </button>
      <button className="tempo-sync" onClick={() => onSet({ beat: barOf(beatNow() ?? 0) })} disabled={bpm === undefined} title="Sync: now is the downbeat, the first beat of a bar">
        Sync
      </button>
    </div>
  );
}
