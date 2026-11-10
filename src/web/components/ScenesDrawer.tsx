// The scenes drawer, along the bottom of the map in show mode (the account
// menu's; settings.ts): the room's scenes
// (shared/scenes.ts), each a button that applies it, lit while the room
// looks like it; and, in each one's menu, its name, its sketch (one in the
// room, with its knobs as they are), its knobs taken from the room again,
// and taking it away. "+ Scene" keeps the room as a scene: its one sketch on
// (but Base Color), with its knobs; with none on, or more than one, a scene
// to give one to.
//
// Applying one outside a show is an edit to the room, as any other
// (draft.ts): previewed till it's applied, or straight in, in live mode.
// Changes to the scenes themselves are the room's, made at once.
//
// With no show on, Start show at the end of the scenes' row starts one, for
// the whole room (ending it is the show's row's menu).
//
// While a show's on, the show's row (Transport.tsx) sits above the scenes,
// and a scene applied goes on the show's clock, for everyone, whatever the
// mode (server/show-apply.ts): now, or on the next beat or bar's first, as
// the show's cue mode (beside them) says. The press is put in arclamp's time
// as the finger comes down (rtime.ts), as Tap's is. One waiting for its
// frame is marked so; and the number keys apply them, 1 to 9, away from
// anything typed in.
//
// In a show, the show's timeline (Timeline.tsx) opens between the two.
// While it's open, a scene's chip drags onto it, and applies as it's let go
// of without moving (still at the moment it was pressed, for the cue); its
// Enter puts it on the timeline, at the playhead.

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { pathOf, type Op } from "../../shared/live.ts";
import { isBase, knobsOf, onScene, shaderOn, type Scene as SavedScene, type Scenes } from "../../shared/scenes.ts";
import type { CueMode } from "../../shared/show.ts";
import { drafts } from "../draft.ts";
import { MoreIcon } from "../icons.tsx";
import { rOfEvent } from "../rtime.ts";
import { sendApply, sendScenes, sendTransport, useLights, useScene, useScenes, useShowCue, useShowOn, useShowQueued, useTimeline, type Scene } from "../scene.ts";
import { Menu } from "./Menu.tsx";
import { Segmented } from "./Segmented.tsx";
import { ChipGhost, chipDrag, dropChip, putChip, Timeline } from "./Timeline.tsx";
import { press, Transport } from "./Transport.tsx";

// A chip pressed and moved this far is being dragged, not applied.
const DRAG_PX = 6;

/** A chip's press, while the timeline's open: dragged, onto it; let go of where it was, applied, at the moment it was pressed (a keyboard's click, onto it at the playhead). */
function dragOrApply(scene: string, name: string, apply: (e: { timeStamp: number }) => void) {
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      const x0 = e.clientX;
      const y0 = e.clientY;
      const pressed = e.timeStamp;
      let dragging = false;
      const move = (m: PointerEvent) => {
        if (!dragging && Math.hypot(m.clientX - x0, m.clientY - y0) < DRAG_PX) return;
        dragging = true;
        chipDrag.set({ scene, name, x: m.clientX, y: m.clientY });
      };
      const done = (u: PointerEvent, dropped: boolean) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        if (dragging) {
          if (dropped) dropChip({ scene, name, x: u.clientX, y: u.clientY });
          chipDrag.set(null);
        } else if (dropped) apply({ timeStamp: pressed });
      };
      const up = (u: PointerEvent) => done(u, true);
      const cancel = (u: PointerEvent) => done(u, false);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
    },
    onClick: (c: MouseEvent) => {
      if (c.detail === 0) putChip(scene);
    },
  };
}

const CUES: { value: CueMode; label: string }[] = [
  { value: "now", label: "Now" },
  { value: "beat", label: "Beat" },
  { value: "bar", label: "Bar" },
];

/** The first "Scene n" not taken. */
function nextName(scenes: Scenes): string {
  const taken = new Set(Object.values(scenes.list).map((s) => s.name));
  let n = 1;
  while (taken.has(`Scene ${n}`)) n++;
  return `Scene ${n}`;
}

/** The shaders a scene could have as its sketch: every one in the room but Base Color, and any that failed. */
const choosable = (room: Scene) => room.shaders.filter((s) => s.stage !== "failed" && !isBase(s));

export function ScenesDrawer({ onHeight }: { onHeight: (px: number) => void }) {
  const showOn = useShowOn();
  const [timelineOpen, setTimelineOpen] = useState(false);
  const building = showOn && timelineOpen;
  const dock = useRef<HTMLElement>(null);

  // As tall as it is, for the map to keep its own along the bottom above it.
  useLayoutEffect(() => {
    const el = dock.current;
    if (!el) return;
    const measure = () => onHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      onHeight(0);
    };
  }, [onHeight]);

  return (
    <section className="show-dock" ref={dock} aria-label={showOn ? "Show" : "Scenes"}>
      {showOn && <Transport />}
      {building && <Timeline />}
      <ScenesBar building={building} onTimeline={showOn ? () => setTimelineOpen(!timelineOpen) : null} />
      <ChipGhost />
    </section>
  );
}

/** `building`: the timeline's open, the chips drag onto it; `onTimeline`, in a show: opens or closes it. */
function ScenesBar({ building, onTimeline }: { building: boolean; onTimeline: (() => void) | null }) {
  const scenes = useScenes();
  const room = useScene().data;
  const lights = useLights().data?.lights;
  const showOn = useShowOn();
  const cue = useShowCue();
  const queued = useShowQueued();
  const lit = room ? onScene(scenes, room.shaders, room.pools) : null;
  const [error, setError] = useState<string | null>(null);
  // A scene just made with no sketch, its menu opened for one to be chosen.
  const [fresh, setFresh] = useState<string | null>(null);
  const said = (sent: Promise<unknown>) =>
    void sent.then(
      () => setError(null),
      (err: Error) => setError(err.message),
    );
  const send = (ops: Op[]) => said(sendScenes(ops));

  // A scene applied: on the show's clock, as the press came down, in a show; else an edit, as any other.
  const apply = (id: string, e: { timeStamp: number }) => {
    const scene = scenes.list[id];
    if (!scene || !room) return;
    if (showOn) said(sendApply(id, rOfEvent(e)));
    else
      drafts.applyScene(
        scene,
        room,
        (lights ?? []).map((l) => l.id),
      );
  };

  // In a show, 1 to 9 apply the scenes in order, away from anything typed in.
  const keys = useRef({ apply, order: scenes.order });
  keys.current = { apply, order: scenes.order };
  useEffect(() => {
    if (!showOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || !/^[1-9]$/.test(e.key)) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable], .cm-editor")) return;
      const id = keys.current.order[Number(e.key) - 1];
      if (!id) return;
      keys.current.apply(id, e);
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showOn]);

  const create = () => {
    if (!room) return;
    const id = crypto.randomUUID();
    const ops: Op[] = [[pathOf("scenes", "list", id), { name: nextName(scenes) }]];
    const on = choosable(room).filter(shaderOn);
    if (on.length === 1) ops.push([pathOf("scenes", "list", id, "shaders", on[0]!.key), knobsOf(on[0]!, room.pools)]);
    else setFresh(id);
    send(ops);
  };

  return (
    <div className="dock-bar scenes-bar">
      {showOn && (
        <Segmented
          className="scene-cue"
          label="How scenes come in"
          options={CUES}
          value={cue}
          onChange={(mode) => said(sendTransport({ do: "cue", mode }))}
        />
      )}
      <div className="scenes" role="group" aria-label="Scenes">
        {scenes.order.map((id, i) => {
          const scene = scenes.list[id];
          return scene && room ? (
            <SceneChip key={id} id={id} n={i + 1} scene={scene} lit={lit === id} queued={queued?.scene === id} show={showOn} building={building} fresh={fresh === id} opened={() => setFresh(null)} room={room} apply={apply} send={send} />
          ) : null;
        })}
        {scenes.order.length === 0 && <span className="scenes-empty">No scenes yet</span>}
      </div>
      {error && (
        <span className="dock-error" role="alert">
          {error}
        </span>
      )}
      <button className="scene-add" onClick={create} disabled={!room} aria-label="+ Scene: a new scene, the room as it is" title="A new scene: the room as it is, if one sketch is on">
        + Scene
      </button>
      {onTimeline && (
        <button className={`scene-add${building ? " on" : ""}`} onClick={onTimeline} aria-pressed={building}>
          Timeline
        </button>
      )}
      {!showOn && (
        <button
          className="scene-add"
          onClick={(e) => said(sendTransport({ do: "start", at: rOfEvent(e) }))}
          aria-label="Start show: for everyone, the show clock's row, the piece at 0:00, the beat going on"
        >
          Start show
        </button>
      )}
    </div>
  );
}

interface ChipProps {
  id: string;
  n: number;
  scene: SavedScene;
  lit: boolean;
  /** Applied, waiting for its frame. */
  queued: boolean;
  /** A show's on: applied on its clock, as the press comes down. */
  show: boolean;
  /** The timeline's open: it drags onto it. */
  building: boolean;
  /** Just made, with no sketch: its menu opens, to choose one. */
  fresh: boolean;
  /** Its menu's been opened for that: it's no longer just made. */
  opened: () => void;
  room: Scene;
  apply: (id: string, e: { timeStamp: number }) => void;
  send: (ops: Op[]) => void;
}

function SceneChip({ id, n, scene, lit, queued, show, building, fresh, opened, room, apply, send }: ChipProps) {
  const [deleting, setDeleting] = useState(false);
  const [align, setAlign] = useState<"start" | "end">("start");
  const chip = useRef<HTMLSpanElement>(null);
  const blocks = Object.values(useTimeline().blocks).filter((b) => b.scene === id).length;
  const keys = Object.keys(scene.shaders);
  const sketch = room.shaders.find((s) => keys.includes(s.key));
  const path = (...more: string[]) => pathOf("scenes", "list", id, ...more);

  const rename = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const name = e.currentTarget.value.trim();
    if (e.key === "Enter" && name && name !== scene.name) send([[path("name"), name]]);
  };

  // Its menu opens over it, from the scenes' row (so the chips scrolling
  // don't cut it off: styles.css), lined up with its end in the dock's right
  // half, to stay on the screen and off the sidebar.
  const aim = () => {
    const el = chip.current;
    const bar = el?.closest(".scenes-bar");
    if (!el || !bar) return;
    const r = el.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    el.style.setProperty("--chip-left", `${r.left - b.left}px`);
    el.style.setProperty("--chip-right", `${b.right - r.right}px`);
    el.style.setProperty("--chip-below", `${b.bottom - r.top}px`);
    setAlign(r.left + r.width / 2 > b.left + b.width / 2 ? "end" : "start");
  };

  // Just made with no sketch: its menu opened, to choose one.
  useEffect(() => {
    const button = fresh ? chip.current?.querySelector<HTMLButtonElement>(".menu > button") : null;
    if (!button) return;
    button.focus();
    button.click();
    opened();
  }, [fresh]);

  // Taken away: focus on to the next chip, or + Scene, rather than lost with it.
  const remove = () => {
    send([[path()]]);
    const next = chip.current?.nextElementSibling?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    (next ?? chip.current?.closest(".scenes-bar")?.querySelector<HTMLButtonElement>(".scene-add"))?.focus();
  };

  const what = sketch ? sketch.name : keys.length > 0 ? "a sketch that's left the room" : "no sketch yet";
  const applying = building ? dragOrApply(id, scene.name, (e) => apply(id, e)) : show ? press((e) => apply(id, e)) : { onClick: (e: { timeStamp: number }) => apply(id, e) };
  const label = !sketch ? `${n} ${scene.name}: it has ${what}` : show && n <= 9 ? `${n} ${scene.name}: apply it (${n}), ${what}` : `${n} ${scene.name}: apply it, ${what}`;
  return (
    <span
      className={`scene-chip${lit ? " lit" : ""}${queued ? " queued" : ""}${building ? " draggable" : ""}`}
      ref={chip}
      title={sketch ? undefined : `It has ${what}: choose one in its menu`}
      onPointerDownCapture={aim}
      onFocusCapture={aim}
    >
      <button className="scene-apply" {...applying} disabled={!sketch && !building} aria-label={building ? `${label}; drag it onto the timeline, or Enter to put it at the playhead` : label}>
        <small className="mono">{n}</small> <span className="scene-label">{scene.name}</span>
      </button>
      <Menu align={align} side="above" className="transport-button" name={`${scene.name}: its name, its sketch`} label={<MoreIcon />}>
        <p className="menu-heading">{scene.name}</p>
        <label className="menu-field">
          <span>Name</span>
          <input className="scene-name" defaultValue={scene.name} maxLength={60} onKeyDown={rename} aria-label="The scene's name (Enter to keep it)" />
        </label>
        <div className="menu-field">
          <span>
            Sketch
            <small>Its knobs come with it, as they are now. {keys.length > 0 && !sketch ? "Its last one has left the room." : ""}</small>
          </span>
        </div>
        {choosable(room).map((s) => (
          <button key={s.key} className={`menu-item${keys.includes(s.key) ? " chosen" : ""}`} onClick={() => send([[path("shaders", s.key), knobsOf(s, room.pools)]])}>
            {s.name}
            {keys.includes(s.key) && " ✓"}
          </button>
        ))}
        {sketch && (
          <button className="menu-item" onClick={() => send([[path("shaders", sketch.key), knobsOf(sketch, room.pools)]])} aria-label="Take knobs from the room: keep its sketch's knobs as the room has them now">
            Take knobs from the room
          </button>
        )}
        {deleting ? (
          <button className="menu-item bad" onClick={remove}>
            Delete scene?{blocks > 0 && ` ${blocks === 1 ? "Its timeline block" : `Its ${blocks} timeline blocks`} will play nothing.`}
          </button>
        ) : (
          <button className="menu-item" onClick={() => setDeleting(true)}>
            Delete…
          </button>
        )}
      </Menu>
    </span>
  );
}
