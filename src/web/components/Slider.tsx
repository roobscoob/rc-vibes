import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

interface Props {
  /** What it sets, for assistive technology (its field names it: Field.tsx). */
  label: string;
  /** Each light's value, in its units. */
  values: readonly number[];
  min: number;
  max: number;
  step: number;
  /** CSS background for the track. */
  track: string;
  /** What the value reads as, for assistive technology. */
  display: string;
  /** Some of the lights (`which`, indices into `values`) to `v`: as it's dragged, and where it's let go. */
  onChange: (v: number, which: number[]) => void;
  ends?: [ReactNode, ReactNode];
}

/** Which end of the range a press or the keys move: the low one, the high one, or (all at one value) the one thumb. */
type End = "lo" | "hi" | "one";

/** How far past a knob's edge, in pixels, a press still takes it: a little for a mouse, more for a finger. */
export const knobSlack = { fine: 3, touch: 8 };

/**
 * What a press at client `x` (and `dy` above or below the track's center
 * line) takes: a knob if it's on one, within `knobRadius` of its center,
 * the nearer of the two where they overlap (the high one from the midpoint
 * between them on), and otherwise, or with the lights all at one value,
 * every light.
 */
export function pressTarget(p: {
  x: number;
  dy?: number;
  trackLeft: number;
  trackWidth: number;
  lo: number;
  hi: number;
  min: number;
  max: number;
  single: boolean;
  knobRadius: number;
}): End {
  if (p.single) return "one";
  const centerOf = (v: number) => p.trackLeft + ((Math.min(p.max, Math.max(p.min, v)) - p.min) / (p.max - p.min)) * p.trackWidth;
  const loX = centerOf(p.lo);
  const hiX = centerOf(p.hi);
  const dy = p.dy ?? 0;
  const on = (cx: number) => Math.hypot(p.x - cx, dy) <= p.knobRadius;
  const onLo = on(loX);
  const onHi = on(hiX);
  if (onLo && onHi) return p.x >= (loX + hiX) / 2 ? "hi" : "lo";
  if (onLo) return "lo";
  if (onHi) return "hi";
  return "one";
}

/**
 * An end moved to `v`, from values `now`: every light it passes is clamped
 * to it, and the ones at it go along; "one" sets every light. The new
 * values, and which changed.
 */
export function moved(end: End, now: readonly number[], v: number): { next: number[]; which: number[] } {
  const which: number[] = [];
  if (end === "one") {
    now.forEach((_, i) => which.push(i));
  } else if (end === "lo") {
    // Up past lights: they're raised to it; down: the lowest come along.
    const t = Math.max(v, Math.min(...now));
    now.forEach((x, i) => x <= t && which.push(i));
  } else {
    const t = Math.min(v, Math.max(...now));
    now.forEach((x, i) => x >= t && which.push(i));
  }
  const next = [...now];
  for (const i of which) next[i] = v;
  return { next, which };
}

/**
 * Lights' values along a track whose background can carry a gradient. All at
 * one value, one thumb: dragging it, clicking the track, or the keys, set
 * every light. At different values, a range: a knob at the lowest and one at
 * the highest, and dragging either clamps every light it passes, which then
 * go along with it (pulling the low end up raises every light below it to
 * it; pulling it back down takes them, at the end, down with it). A knob
 * moves only when the press is on it; pressing anywhere else sets every
 * light to the value there, and dragging on takes them all along together.
 * The keys move the end last moved.
 */
export function Slider({ label, values, min, max, step, track, display, onChange, ends }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // While dragging: which end, the values as they are now (each move clamps these, not what's shown, which may lag), and how far off a grabbed knob's center the pointer took it.
  const drag = useRef<{ end: End; now: number[]; offset: number } | null>(null);
  const [held, setHeld] = useState<End | null>(null);
  // The end the keys move: the last one dragged.
  const lastEnd = useRef<"lo" | "hi">("hi");
  const lo = values.length > 0 ? Math.min(...values) : min;
  const hi = values.length > 0 ? Math.max(...values) : min;
  const single = lo === hi;
  const fractionOf = (v: number) => (Math.min(max, Math.max(min, v)) - min) / (max - min);

  const valueAt = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round((min + f * (max - min)) / step) * step;
  };

  const apply = (v: number) => {
    const d = drag.current;
    if (!d) return;
    const { next, which } = moved(d.end, d.now, v);
    d.now = next;
    if (which.length > 0) onChange(v, which);
  };

  const down = (e: PointerEvent) => {
    const v = valueAt(e.clientX);
    const rect = ref.current!.getBoundingClientRect();
    // The knob as drawn (bigger for coarse pointers: styles.css), and some slack past its edge.
    const knobEl = ref.current!.querySelector<HTMLElement>(".slider-knob");
    const slack = e.pointerType === "mouse" ? knobSlack.fine : knobSlack.touch;
    const end = pressTarget({
      x: e.clientX,
      dy: e.clientY - (rect.top + rect.height / 2),
      trackLeft: rect.left,
      trackWidth: rect.width,
      lo,
      hi,
      min,
      max,
      single,
      knobRadius: (knobEl ? knobEl.offsetWidth / 2 : 8) + slack,
    });
    if (end !== "one") lastEnd.current = end;
    // A grabbed knob stays where it is until it's dragged, held where it was taken.
    const offset = end === "one" ? 0 : e.clientX - (rect.left + fractionOf(end === "lo" ? lo : hi) * rect.width);
    drag.current = { end, now: [...values], offset };
    setHeld(end);
    ref.current!.setPointerCapture(e.pointerId);
    if (end === "one") apply(v);
  };
  const move = (e: PointerEvent) => {
    if (drag.current) apply(valueAt(e.clientX - drag.current.offset));
  };
  const up = () => {
    drag.current = null;
    setHeld(null);
  };

  const key = (e: KeyboardEvent) => {
    const big = e.shiftKey ? 10 : 1;
    const end: End = single ? "one" : lastEnd.current;
    const from = end === "lo" ? lo : hi;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = from + step * big;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = from - step * big;
    if (e.key === "Home") next = min;
    if (e.key === "End") next = max;
    if (next === null) return;
    e.preventDefault();
    next = Math.min(max, Math.max(min, Math.round(next / step) * step));
    const { which } = moved(end, values, next);
    if (which.length > 0) onChange(next, which);
  };

  const knob = (end: End, at: number) => (
    <span key={end} className={["slider-thumb", end !== "one" && "slider-knob", held === end && "held"].filter(Boolean).join(" ")} style={{ left: `${fractionOf(at) * 100}%` }} />
  );

  return (
    <div className="slider">
      <div
        ref={ref}
        className="slider-track"
        style={{ background: track, cursor: held === "lo" || held === "hi" ? "grabbing" : undefined }}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={hi}
        aria-valuetext={display}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
      >
        {single ? (
          knob("one", lo)
        ) : (
          <>
            {/* The range, between its ends. */}
            <span className="slider-range" style={{ left: `${fractionOf(lo) * 100}%`, width: `${(fractionOf(hi) - fractionOf(lo)) * 100}%` }} />
            {knob("lo", lo)}
            {knob("hi", hi)}
          </>
        )}
      </div>
      {ends && (
        <div className="slider-ends">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      )}
    </div>
  );
}
