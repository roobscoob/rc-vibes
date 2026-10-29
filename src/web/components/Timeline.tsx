// The show's timeline (shared/show-timeline.ts), in the scenes drawer while
// a show's on and it's open: a ruler in bars (press it to put the playhead
// there), rows, the scenes on them as blocks, and the playhead going with
// the beat (as the room has it, by arclamp's time: the map plays the room a
// moment later).
//
// A scene's chip dragged onto a row puts the scene there, four bars long
// (ScenesDrawer.tsx makes its chips draggable while the timeline's open). A
// block dragged moves, by beats and from row to row; its ends dragged make
// it shorter or longer; selected (pressed, or reached with Tab), Delete takes
// it away. Each change is the room's, made at once, for everyone
// (server/show-timeline.ts); while a block's being dragged, it's shown where
// it's going.

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { BEATS_PER_BAR, RESTING_BPM } from "../../shared/show.ts";
import { endOf, MAX_BEATS, MAX_ROWS, posAt, type Block } from "../../shared/show-timeline.ts";
import { rNow, rOfEvent } from "../rtime.ts";
import { sendBlock, sendTransport, useScenes, useShowClock, useShowPlayhead, useTimeline } from "../scene.ts";

const ROW_H = 30;
// A scene dropped on the timeline: four bars long.
const NEW_BEATS = 4 * BEATS_PER_BAR;
// How wide a beat is, zoomed all the way out and in; and to begin with.
const MIN_PX = 4;
const MAX_PX = 96;
const START_PX = 20;

/** A scene's chip being dragged onto the timeline: which, and where the pointer is. */
export interface ChipDrag {
  scene: string;
  name: string;
  x: number;
  y: number;
}

let chip: ChipDrag | null = null;
const chipListeners = new Set<() => void>();
// Where a chip dropped goes: the timeline's, while it's open.
let dropOn: ((d: ChipDrag) => void) | null = null;

/** The chip being dragged, as it moves (null: none, or it's dropped). */
export const chipDrag = {
  get: () => chip,
  set(d: ChipDrag | null) {
    chip = d;
    for (const l of chipListeners) l();
  },
  subscribe(l: () => void) {
    chipListeners.add(l);
    return () => void chipListeners.delete(l);
  },
};

/** A chip let go of: onto the timeline, if it's over a row. */
export const dropChip = (d: ChipDrag) => dropOn?.(d);

/** The chip being dragged, under the pointer. */
export function ChipGhost() {
  const d = useSyncExternalStore(chipDrag.subscribe, chipDrag.get);
  return d ? (
    <div className="chip-ghost" style={{ transform: `translate(${d.x + 12}px, ${d.y - 28}px)` }} aria-hidden="true">
      {d.name}
    </div>
  ) : null;
}

/** A scene's colour on the timeline: the same for every block of it. */
const hueOf = (scene: string) => [...scene].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

type Span = Pick<Block, "row" | "start" | "end">;

export function Timeline() {
  const timeline = useTimeline();
  const scenes = useScenes();
  const playhead = useShowPlayhead();
  const clock = useShowClock();
  const drag = useSyncExternalStore(chipDrag.subscribe, chipDrag.get);
  const [px, setPx] = useState(START_PX);
  const [selected, setSelected] = useState<string | null>(null);
  // The block being dragged, where it's going (and, let go of, till vibes says it's there).
  const [moving, setMoving] = useState<{ id: string; span: Span } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const rowsEl = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);

  const blocks = Object.entries(timeline.blocks).map(([id, b]): [string, Block] => [id, moving?.id === id ? { ...b, ...moving.span } : b]);
  const rows = Math.min(MAX_ROWS, Math.max(2, ...blocks.map(([, b]) => b.row + 2)));
  const bars = Math.max(16, Math.ceil(endOf(timeline) / BEATS_PER_BAR) + 8);
  const said = (sent: Promise<unknown>) =>
    void sent.then(
      () => setError(null),
      (err: Error) => setError(err.message),
    );

  /** Where a point on the screen is on the timeline: its row, and the beat nearest. Null off the rows. */
  const at = (x: number, y: number) => {
    const r = rowsEl.current?.getBoundingClientRect();
    if (!r || x < r.left || x > r.right || y < r.top - 8 || y > r.bottom + 8) return null;
    return { row: Math.min(rows - 1, Math.max(0, Math.floor((y - r.top) / ROW_H))), beat: Math.max(0, Math.round((x - r.left) / px)) };
  };

  // A chip dropped on a row: its scene there, four bars long, selected.
  useEffect(() => {
    dropOn = (d) => {
      const p = at(d.x, d.y);
      if (!p) return;
      const id = crypto.randomUUID();
      said(sendBlock(id, { scene: d.scene, row: p.row, start: p.beat, end: Math.min(MAX_BEATS, p.beat + NEW_BEATS) }));
      setSelected(id);
    };
    return () => {
      dropOn = null;
    };
  });
  const over = drag ? at(drag.x, drag.y) : null;

  // The playhead, each frame, the view following it while it plays (unless something's being dragged).
  const following = useRef(true);
  following.current = !moving && !drag;
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const x = posAt(playhead, clock, rNow()) * px;
      if (head.current) head.current.style.transform = `translateX(${x}px)`;
      const s = scroll.current;
      if (s && playhead.lock && following.current && (x > s.scrollLeft + s.clientWidth - 32 || x < s.scrollLeft)) s.scrollLeft = Math.max(0, x - 32);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [playhead, clock, px]);

  // The ruler pressed: the playhead to that beat (the piece's time, at the tempo), as the press came down.
  const seek = (e: ReactPointerEvent) => {
    const r = rowsEl.current?.getBoundingClientRect();
    if (!r || e.button !== 0) return;
    const beat = Math.max(0, Math.round((e.clientX - r.left) / px));
    said(sendTransport({ do: "seek", at: rOfEvent(e), t: (beat * 60) / (clock.bpm ?? RESTING_BPM) }));
  };

  // A block, or one of its ends, dragged: by beats, and (moved) from row to row; put there as it's let go of.
  const grab = (id: string, b: Block, how: "move" | "start" | "end") => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setSelected(id);
    e.currentTarget.closest<HTMLElement>(".tl-block")?.focus({ preventScroll: true });
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const y0 = e.clientY;
    let span: Span = { row: b.row, start: b.start, end: b.end };
    const move = (m: PointerEvent) => {
      const beats = Math.round((m.clientX - x0) / px);
      if (how === "move") {
        const start = Math.min(MAX_BEATS - (b.end - b.start), Math.max(0, b.start + beats));
        span = { row: Math.min(MAX_ROWS - 1, Math.max(0, b.row + Math.round((m.clientY - y0) / ROW_H))), start, end: start + (b.end - b.start) };
      } else if (how === "start") span = { ...span, start: Math.min(b.end - 1, Math.max(0, b.start + beats)) };
      else span = { ...span, end: Math.max(b.start + 1, Math.min(MAX_BEATS, b.end + beats)) };
      setMoving({ id, span });
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (span.row === b.row && span.start === b.start && span.end === b.end) return setMoving(null);
      said(sendBlock(id, { scene: b.scene, ...span }).finally(() => setMoving((m) => (m?.id === id ? null : m))));
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const onKey = (e: ReactKeyboardEvent) => {
    if (!selected || !timeline.blocks[selected]) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      said(sendBlock(selected, null));
      setSelected(null);
    } else if (e.key === "Escape") setSelected(null);
    else return;
    e.preventDefault();
  };

  // Zoomed with − and +, or the wheel with ⌘ or Ctrl held, about the pointer.
  const zoom = (by: number, around?: number) => {
    const s = scroll.current;
    const next = Math.min(MAX_PX, Math.max(MIN_PX, px * by));
    if (s) {
      const x = around ?? s.clientWidth / 2;
      const beat = (s.scrollLeft + x) / px;
      requestAnimationFrame(() => (s.scrollLeft = beat * next - x));
    }
    setPx(next);
  };
  // Listened for itself, not passively (as React does), so the page doesn't zoom too.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const s = scroll.current;
    if (!s) return;
    const wheel = (e: WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      e.preventDefault();
      zoomRef.current(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - s.getBoundingClientRect().left);
    };
    s.addEventListener("wheel", wheel, { passive: false });
    return () => s.removeEventListener("wheel", wheel);
  }, []);

  const grid = { "--px": `${px}px`, "--bar-px": `${px * BEATS_PER_BAR}px`, "--row-h": `${ROW_H}px` } as CSSProperties;
  return (
    <div className="timeline" onKeyDown={onKey}>
      <div className="tl-scroll" ref={scroll}>
        <div className="tl-canvas" style={{ ...grid, width: bars * BEATS_PER_BAR * px + 32 }}>
          <div className="tl-ruler" onPointerDown={seek} aria-hidden="true">
            {Array.from({ length: bars }, (_, n) => (
              <span key={n} className="tl-bar mono" style={{ left: n * BEATS_PER_BAR * px }}>
                {px * BEATS_PER_BAR >= 28 || n % 4 === 0 ? n + 1 : ""}
              </span>
            ))}
          </div>
          <div className="tl-rows" ref={rowsEl} style={{ height: rows * ROW_H }} onPointerDown={() => setSelected(null)}>
            {blocks.map(([id, b]) => {
              const name = scenes.list[b.scene]?.name;
              return (
                <div
                  key={id}
                  className={`tl-block${selected === id ? " selected" : ""}${moving?.id === id ? " moving" : ""}${name ? "" : " gone"}`}
                  style={{ left: b.start * px, width: (b.end - b.start) * px, top: b.row * ROW_H, "--hue": hueOf(b.scene) } as CSSProperties}
                  tabIndex={0}
                  onFocus={() => setSelected(id)}
                  onPointerDown={grab(id, b, "move")}
                  aria-label={`${name ?? "A scene that's gone"}: bar ${Math.floor(b.start / BEATS_PER_BAR) + 1}, ${b.end - b.start} beats, row ${b.row + 1}`}
                >
                  <span className="tl-end start" onPointerDown={grab(id, b, "start")} />
                  <span className="tl-name">{name ?? "Gone"}</span>
                  <span className="tl-end end" onPointerDown={grab(id, b, "end")} />
                </div>
              );
            })}
            {drag && over && (
              <div className="tl-block landing" style={{ left: over.beat * px, width: NEW_BEATS * px, top: over.row * ROW_H, "--hue": hueOf(drag.scene) } as CSSProperties}>
                <span className="tl-name">{drag.name}</span>
              </div>
            )}
          </div>
          <div className="tl-playhead" ref={head} aria-hidden="true" />
        </div>
      </div>
      <div className="tl-foot">
        <span className="tl-hint">
          {blocks.length === 0 ? "Drag a scene onto a row to put it on the timeline." : "Drag a block to move it, its ends to make it longer or shorter. Delete takes it away."}
        </span>
        {error && (
          <span className="dock-error" role="alert">
            {error}
          </span>
        )}
        <span className="dock-spacer" />
        <button className="transport-button" onClick={() => zoom(1 / 1.5)} disabled={px <= MIN_PX} aria-label="Zoom out">
          −
        </button>
        <button className="transport-button" onClick={() => zoom(1.5)} disabled={px >= MAX_PX} aria-label="Zoom in">
          +
        </button>
      </div>
    </div>
  );
}
