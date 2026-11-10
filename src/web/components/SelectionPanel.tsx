// What's selected, in the panel along the right of the map on a wide screen
// (always there, beside the map: IdlePanel while nothing's selected, with the
// groups of lights to select), and up from the bottom as a sheet while
// anything is on a narrow one, as Google
// Maps does with a place. The sheet rests at one of three
// heights (just its head, most of what's in it, or the whole screen), and its
// head drags it between them, settling where it's let go. Its title says
// how many lights are selected, beside a button that lets go of them all. Then what's on
// these lights, as the room builds their light: Room Tone (arclamp's, in
// admin view only), then each shader up the stack that's on any of them (the
// base Tone's params opened under it to start with), joined by a rail as the
// light builds up through them: in the room, on its way in, or one you're
// adding (or taking out). Which lights a shader's on, and everything else
// done to it, is the layers panel's (ShadersPanel.tsx): here are its params.

import { useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import type { Channels, LightInfo } from "../../shared/arclamp.ts";
import { lemtoneOf, seenOf } from "../../shared/fixtures.ts";
import { lemtoneCss } from "../../shared/lemtone.ts";
import { isBaseColor } from "../../shared/base-color.ts";
import { useGamut } from "../display.ts";
import { useAdminMode } from "../settings.ts";
import {
  changeable,
  changedLights,
  domainOf,
  drafts,
  layerOf,
  layersOf,
  onFor,
  removedOf,
  templateOf,
  useDraft,
  type Layer,
} from "../draft.ts";
import { ChevronUpIcon, CloseIcon, SaveIcon, UndoIcon } from "../icons.tsx";
import { isRoomFrames, pipelineFrame, useFrames } from "../live.ts";
import { peek, ROOM_TONE, SAVED } from "../peek.ts";
import { useNarrow } from "../narrow.ts";
import { useLights, useScene, type Scene } from "../scene.ts";
import { count } from "../words.ts";
import { Reveal } from "./Reveal.tsx";
import { Sidebar, SidebarDetails } from "./Sidebar.tsx";
import { RoomToneEditor } from "./RoomToneEditor.tsx";
import type { SelectMode } from "../selection.ts";
import { Tooltip } from "./Tooltip.tsx";
import { offDefault, paramRowsOf, resetParams, ShaderParams } from "./ShaderParams.tsx";
import { TagChips } from "./TagChips.tsx";
import { useOpened } from "../opened.ts";
import { useOnFocus } from "../focus.ts";
import { useShowUnsaved } from "../unsaved.ts";
import { usePointsOut } from "../hint.ts";
import { useStuckHeads } from "../stuck.ts";

const NO_SCENE: Scene = { shaders: [], roomtone: null, pools: {} };


// The sheet's middle height, at most, as a share of the screen.
const HALF = 0.6;
// A sheet let go faster than this (px per ms) was flicked: it goes on to the
// next height that way. Slower, or after a pause this long (ms), it settles at the nearest.
const FLICK = 0.4;
const PAUSE_MS = 100;
// A press on the head that moves less than this (px) is a tap.
const TAP_PX = 4;

/** The heights a sheet rests at: just its head, most of what's in it, the whole screen. */
type Rest = "peek" | "half" | "full";

/** The pending edits, and saving them to the room: the panel's head says and does this. */
export interface Saving {
  /** How many edits are pending. */
  pending: number;
  /** They're on their way. */
  saving: boolean;
  /** The last save failed. */
  error: string | null;
  onSave: () => void;
  /** Drop them all, the room staying as it is. */
  onDiscard: () => void;
}

interface Props {
  /** The floor being shown. */
  floor: number;
  /** The lights on this floor. */
  here: LightInfo[];
  /** The selected ones among them. */
  selected: ReadonlySet<number>;
  save: Saving;
  /** Selecting lights, from the groups at the top. */
  onSelect: (ids: number[], mode: SelectMode) => void;
}

export function SelectionPanel({ here, selected, save, onSelect }: Props) {
  const panel = useRef<HTMLElement>(null);
  // Unsaved changes, if they're shown (not in live mode: unsaved.ts).
  const unsaved = useShowUnsaved() && save.pending > 0;
  const chosen = here.filter((l) => selected.has(l.id));

  // What's on these lights, bottom of the stack first: each shader on any of them
  // (or, one you're taking out, that was).
  const scene = useScene();
  const lights = useLights();
  const draft = useDraft();
  const gamut = useGamut();
  const live = scene.data ?? NO_SCENE;
  const template = templateOf(live, draft);
  const stack = layersOf(live, draft);
  // And the ones you're taking out (when you apply), where they are, to keep after all.
  const going = new Set(removedOf(live, draft));
  const shown = withGoing(
    stack,
    [...going].flatMap((key) => layerOf(live, draft, key) ?? []),
    live,
  );
  // Not one made outside vibes: it's only muted or not, with no lights (or params) of its own here.
  const onThese = [...shown].reverse().filter((layer) => changeable(layer) && (layer.instance || layer.adding) && [...selected].some(onFor(layer)));
  // The room tone, the room's "normal", is admin view's to change; everyone's color is the base Tone's
  // (shared/base-color.ts: vibes' own shader at the bottom, on every light, always in).
  const admin = useAdminMode();


  // The layers whose parameters are open under them, any number at once: room tone's, to start with.
  const opened = useOpened(["roomtone"]);
  // The base Tone's params are open under it to start with: it's closed once it's toggled.
  const isOpen = (layer: Layer) => (isBaseColor(layer.key) ? !opened.isOpen(`closed:${layer.key}`) : opened.isOpen(layer.key));
  const toggle = (layer: Layer) => opened.toggle(isBaseColor(layer.key) ? `closed:${layer.key}` : layer.key);
  // A layer picked in the layers panel: its row the only one open (room
  // tone's and the base Tone's shut too, those open to start with).
  useOnFocus((key) => {
    const base = shown.filter((l) => isBaseColor(l.key) && l.key !== key).map((l) => `closed:${l.key}`);
    opened.only([...base, key]);
  });

  const title = `${count(chosen.length, "light")} selected`;
  const toneToggle = toggling(opened.isOpen("roomtone"), () => opened.toggle("roomtone"));

  // As a sheet, the heights it rests at: its head (and the safe area under
  // it); up to HALF the screen, or less when that's all of it; the screen.
  const narrow = useNarrow();
  const head = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useStuckHeads(body);
  const [heights, setHeights] = useState<Record<Rest, number> | null>(null);
  useLayoutEffect(() => {
    if (!narrow) return;
    const el = panel.current!;
    const app = el.parentElement!;
    const measure = () => {
      const peek = head.current!.offsetHeight + (parseFloat(getComputedStyle(el).paddingBottom) || 0);
      const full = app.clientHeight;
      const half = Math.max(peek, Math.min(peek + body.current!.scrollHeight, full * HALF));
      setHeights((h) => (h && h.peek === peek && h.half === half && h.full === full ? h : { peek, half, full }));
    };
    measure();
    // Its head and what's in it change size as the selection (or what they look like) does.
    const watch = new ResizeObserver(measure);
    watch.observe(app);
    watch.observe(head.current!);
    for (const child of body.current!.children) watch.observe(child);
    return () => watch.disconnect();
  });

  // It opens at its head; its head drags it, following the finger. Let go,
  // it settles at the nearest of its heights, or flicked, at the next one
  // the way it was flicked. A tap on its head, resting there, opens it to the
  // middle. The height mid-drag is kept in a ref too, as a quick flick can
  // let go before React re-renders.
  const [rest, setRest] = useState<Rest>("peek");
  // The heights it rests at, shortest first (with just a little in it, fewer than three).
  const rests = heights ? (["peek", "half", "full"] as const).filter((r, i, all) => i === 0 || heights[r] > heights[all[i - 1]!]) : [];
  const [dragged, setDragged] = useState<number | null>(null);
  const grip = useRef<{ y: number; from: number; at: number; lastY: number; lastT: number; speed: number; moved: boolean } | null>(null);
  const grab = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      // Its own buttons do their own things, but the grabber, which is where it's pulled from.
      if (!narrow || !heights || (e.target as Element).closest("button:not(.sidebar-grabber)")) return;
      const from = panel.current!.offsetHeight;
      grip.current = { y: e.clientY, from, at: from, lastY: e.clientY, lastT: e.timeStamp, speed: 0, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
      // A drag, not a text selection.
      e.preventDefault();
    },
    onPointerMove: (e: PointerEvent) => {
      const g = grip.current;
      if (!g || !heights) return;
      if (Math.abs(e.clientY - g.y) > TAP_PX) g.moved = true;
      if (!g.moved) return;
      // Upward is taller; px per ms, eased so one jittery move doesn't decide a flick.
      const dt = Math.max(1, e.timeStamp - g.lastT);
      g.speed = 0.6 * ((g.lastY - e.clientY) / dt) + 0.4 * g.speed;
      [g.lastY, g.lastT] = [e.clientY, e.timeStamp];
      g.at = Math.min(heights.full, Math.max(heights.peek, g.from - (e.clientY - g.y)));
      setDragged(g.at);
    },
    onPointerUp: (e: PointerEvent) => {
      const g = grip.current;
      grip.current = null;
      setDragged(null);
      if (!g || !heights) return;
      if (!g.moved) {
        if (rest === "peek") setRest("half");
        return;
      }
      const speed = e.timeStamp - g.lastT > PAUSE_MS ? 0 : g.speed;
      const nearest = rests.reduce((best, r) => (Math.abs(heights[r] - g.at) < Math.abs(heights[best] - g.at) ? r : best));
      if (speed > FLICK) setRest(rests.find((r) => heights[r] > g.at) ?? "full");
      else if (speed < -FLICK) setRest([...rests].reverse().find((r) => heights[r] < g.at) ?? "peek");
      else setRest(nearest);
    },
    onPointerCancel: () => {
      grip.current = null;
      setDragged(null);
    },
  };
  const sheet = narrow && heights;

  // By keyboard, its grabber is a button: pressed, on to the next height up, and from the top, back to just its head.
  // (A tap on it is the head's, above: a click from the pointer has a detail, one from the keyboard none.)
  const grabber = sheet
    ? {
        "aria-label": "Resize panel",
        "aria-expanded": rest !== "peek",
        onClick: (e: MouseEvent) => e.detail === 0 && setRest(rests[(rests.indexOf(rest) + 1) % rests.length] ?? "peek"),
      }
    : undefined;
  // Tabbing into what's under its head while it's just its head: up to its middle, so what has the keyboard shows.
  const peeking = !!sheet && rest === "peek";
  useEffect(() => {
    if (!peeking) return;
    const el = body.current!;
    const up = () => setRest("half");
    el.addEventListener("focusin", up);
    return () => el.removeEventListener("focusin", up);
  }, [peeking]);

  // As a sheet, its height lifts the map's bottom controls clear of it
  // (--sheet-h), up to its middle height: taller, they stay put and it rises over them.
  const lift = sheet ? heights.half : Infinity;
  useLayoutEffect(() => {
    const el = panel.current!;
    const app = el.parentElement!;
    const measure = () => app.style.setProperty("--sheet-h", `${Math.min(el.offsetHeight, lift)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      app.style.removeProperty("--sheet-h");
    };
  }, [lift]);

  return (
    <Sidebar
      ref={panel}
      side="right"
      label="Selection"
      className={[unsaved && "unsaved", sheet && dragged !== null && "dragging", sheet && rest === "full" && dragged === null && "full"].filter(Boolean).join(" ")}
      style={sheet ? { height: dragged ?? heights[rest] } : undefined}
      headRef={head}
      headProps={grab}
      grabber={grabber}
      bodyRef={body}
      head={
        <>
          {title}
          <UnsavedMark here={here} onSelect={onSelect} />
        </>
      }
      actions={
        <>
          <SaveButtons save={save} />
          <button className="icon-button deselect-all" onClick={() => onSelect([], "replace")} aria-label="Deselect all">
            <CloseIcon />
          </button>
        </>
      }
    >
      <Groups here={here} selected={selected} onSelect={onSelect} />
      {/* The rows read in the order light builds up: room tone, then each shader over what's above it.
              Their order is the room's, not these lights': it's changed in the layers panel. */}
      <ol className="layers">
            {/* Always the base, in admin view: it can't move or be switched off. Its parameter, the
                        color, opens under it (open to start with). */}
            {admin && (
            <li className={opened.isOpen("roomtone") ? "layer base open" : "layer base"}>
              {/* All of its head opens and closes it. */}
              <div className="layer-rail">
                <ToneNode colors={toneColors(chosen, template, gamut)} />
              </div>
              <div className="layer-head toggle" {...toneToggle.head}>
                <span className="layer-text">
                  <span className="layer-name layer-name-button" {...toneToggle.name}>
                    Room Tone
                  </span>
                </span>
                <Chevron />
              </div>
              <Reveal open={opened.isOpen("roomtone")}>
                <SidebarDetails>
                  <RoomToneEditor lights={chosen} template={template} />
                </SidebarDetails>
              </Reveal>
            </li>
            )}
            {onThese.map((layer) =>
              going.has(layer.key) ? (
                <GoingRow key={layer.key} layer={layer} />
              ) : (
                <ShaderRow
                  key={layer.key}
                  layer={layer}
                  lights={chosen}
                  details={detailsOf(layer, chosen)}
                  opened={isOpen(layer)}
                  onToggle={() => toggle(layer)}
                />
              ),
            )}
      </ol>
    </Sidebar>
  );
}

/**
 * After the title, with changes not saved yet: an asterisk saying how many
 * lights they change, which selects those of them on this floor.
 */
function UnsavedMark({ here, onSelect }: { here: LightInfo[]; onSelect: Props["onSelect"] }) {
  const scene = useScene();
  const draft = useDraft();
  // Not in live mode, where they're sent as they're made (unsaved.ts).
  const shown = useShowUnsaved();
  const changed = shown && scene.data ? changedLights(scene.data, draft) : [];
  if (changed.length === 0) return null;
  return <ChangesMark changed={changed} here={here} onSelect={onSelect} />;
}

/**
 * An asterisk, in the unsaved pink, for changes not saved yet (the room's,
 * or one shader's): under the pointer, how many lights they change, and
 * those lights pointed out on the map (hint.ts, as a layer's row does);
 * pressed, it selects those of them on this floor.
 */
export function ChangesMark({ changed, here, onSelect }: { changed: readonly number[]; here: LightInfo[]; onSelect: Props["onSelect"] }) {
  // Under the pointer (or focused): where to say so, under it, on the screen.
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.bottom + 6 });
  };
  const pointsOut = usePointsOut(() => changed);
  const ids = new Set(here.map((l) => l.id));
  const mine = changed.filter((id) => ids.has(id));
  const what = `${count(changed.length, "light")} ${changed.length === 1 ? "has" : "have"} unsaved changes`;
  const title = mine.length === changed.length ? what : `${what} (${mine.length} on this floor)`;
  return (
    <>
      <button
        className="unsaved-mark"
        aria-label={`${title}: select them`}
        // Not disabled, which would take the pointer events that show its tooltip.
        aria-disabled={mine.length === 0}
        onClick={() => mine.length > 0 && onSelect(mine, "replace")}
        onPointerEnter={(e) => {
          show(e.currentTarget);
          pointsOut.onPointerEnter(e);
        }}
        onPointerLeave={(e) => {
          setTip(null);
          pointsOut.onPointerLeave(e);
        }}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setTip(null)}
      >
        *
      </button>
      {tip && (
        <Tooltip x={tip.x} y={tip.y} side="below" fixed>
          <span className="tooltip-title">{`${count(changed.length, "light")}${mine.length > 0 ? " (click to view)" : ""}`}</span>
        </Tooltip>
      )}
    </>
  );
}

// The chip just pressed, by its text, while the panel gives way to the other one (IdlePanel and
// SelectionPanel, App.tsx, as the selection empties or fills): the new panel's same chip takes the
// keyboard, rather than it dropping to the page. Kept only for the panel the press itself brings.
let pressed: string | null = null;

/** The groups of lights here (all of them, the main space, each tag), to select and let go of. */
function Groups({ here, selected, onSelect }: { here: LightInfo[]; selected: ReadonlySet<number>; onSelect: Props["onSelect"] }) {
  const section = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const text = pressed;
    pressed = null;
    if (text === null || document.activeElement !== document.body) return;
    [...(section.current?.querySelectorAll("button") ?? [])].find((b) => b.textContent === text)?.focus();
  }, []);
  if (here.length === 0) return null;
  const press = (e: MouseEvent) => {
    pressed = (e.target as Element).closest("button")?.textContent ?? null;
    setTimeout(() => (pressed = null));
  };
  return (
    <section className="panel-groups" ref={section} onClick={press}>
      <TagChips lights={here} selected={selected} onSelect={onSelect} />
    </section>
  );
}

/** The panel while nothing's selected: the groups to pick from. */
export function IdlePanel({
  here,
  selected,
  onSelect,
  save,
}: {
  here: LightInfo[];
  selected: ReadonlySet<number>;
  onSelect: Props["onSelect"];
  save: Saving;
}) {
  const unsaved = useShowUnsaved() && save.pending > 0;
  return (
    <Sidebar
      side="right"
      label="Selection"
      className={unsaved ? "idle unsaved" : "idle"}
      head={
        <>
          No lights selected
          <UnsavedMark here={here} onSelect={onSelect} />
        </>
      }
      actions={<SaveButtons save={save} />}
    >
      <Groups here={here} selected={selected} onSelect={onSelect} />
    </Sidebar>
  );
}

/**
 * The pending edits, in the head: save them to the room (dim with none, lit
 * while there are any), and, beside it while there are, drop them instead.
 */
function SaveButtons({ save }: { save: Saving }) {
  const { pending, saving, error } = save;
  const title = error ? `Couldn't save: ${error}` : saving ? "Saving…" : "Save";
  // Not in live mode, where they're sent as they're made, unless that's failed (unsaved.ts).
  const shown = useShowUnsaved();
  // Under the pointer, discard shows the saved pipeline: the room without what's pending (peek.ts).
  useEffect(() => () => peek.clear(SAVED), []);
  const peekSaved = {
    onPointerEnter: () => peek.set(SAVED),
    onPointerLeave: () => peek.clear(SAVED),
    onPointerCancel: () => peek.clear(SAVED),
  };
  const discard = () => {
    peek.clear(SAVED);
    save.onDiscard();
  };
  if ((pending === 0 || !shown) && !error) return null;
  return (
    <span className="save-buttons">
      <button className="icon-button discard-button" onClick={discard} disabled={saving} aria-label="Discard" {...peekSaved}>
        <UndoIcon />
      </button>
      <button className={["icon-button", "save-button", "lit", error && "failed"].filter(Boolean).join(" ")} onClick={save.onSave} disabled={saving} aria-label={title}>
        <SaveIcon />
      </button>
    </span>
  );
}

/** The most colors a stop's pie shows. */
const NODE_COLORS = 6;

/**
 * A stop on the rail, in the color of the light at it: one color, or up to
 * NODE_COLORS in a pie when the lights there aren't alike. Hollow when nothing's
 * lit there, or the stop's bypassed (off here, or not in the room yet).
 */
function LayerNode({ colors, hollow = false, ...rest }: { colors: string[]; hollow?: boolean } & HTMLAttributes<HTMLSpanElement>) {
  const shown = hollow ? [] : colors.slice(0, NODE_COLORS);
  const background =
    shown.length === 0
      ? undefined
      : shown.length === 1
        ? shown[0]
        : `conic-gradient(${shown.map((c, i) => `${c} ${(i / shown.length) * 100}% ${((i + 1) / shown.length) * 100}%`).join(", ")})`;
  const node = (
    <span
      {...rest}
      className={[background ? "layer-node" : "layer-node hollow", rest.className].filter(Boolean).join(" ")}
      style={background ? { background } : undefined}
      aria-hidden="true"
    />
  );
  if (!background) return node;
  // Lit, a blurred copy of it behind it: a soft glow round each slice, in its own color.
  return (
    <span className="layer-stop">
      <span className="layer-glow" style={{ background }} aria-hidden="true" />
      {node}
    </span>
  );
}

/** Room tone's stop: hovering it peeks at the room tone alone (every shader set aside, on the map). */
function ToneNode({ colors }: { colors: string[] }) {
  return <LayerNode colors={colors} {...usePeekable(ROOM_TONE)} />;
}

/**
 * What makes a stop peekable: while the pointer's on it, the map shows the
 * room as the light is there (peek.ts). Stops peeking if it goes away under
 * the pointer.
 */
function usePeekable(key: string | null): HTMLAttributes<HTMLSpanElement> {
  useEffect(() => (key === null ? undefined : () => peek.clear(key)), [key]);
  if (key === null) return {};
  return {
    className: "peekable",
    onPointerEnter: () => peek.set(key),
    onPointerLeave: () => peek.clear(key),
    onPointerCancel: () => peek.clear(key),
  };
}

/** The room tone's colors on these lights, as it sets them (an old bulb that's on, as its incandescent). */
function toneColors(lights: LightInfo[], template: Record<string, Channels>, gamut: ReturnType<typeof useGamut>): string[] {
  const colors = new Set<string>();
  for (const l of lights) {
    const t = lemtoneOf(template[String(l.id)], l.type);
    if (t) colors.add(lemtoneCss(t, gamut));
  }
  return [...colors];
}

/**
 * A shader's stop: the light as the selected lights it reaches are making
 * it right now (the room's, or the preview's), kept up every second. There's
 * no seeing what each shader alone adds, so this is the light as it leaves
 * the stack, on just the lights this shader is on (none: hollow). Hovering it peeks at
 * the room as it is up to this shader (once its script's here to preview).
 */
export function ShaderNode({ layer, lights, hollow }: { layer: Layer; lights: LightInfo[]; hollow: boolean }) {
  const gamut = useGamut();
  const frames = useFrames();
  // The room's whole pipeline, not what the map shows: peeking at a stop (or the saved room) sets layers aside there, not here.
  const latest = isRoomFrames(frames) ? pipelineFrame : () => frames.latest();
  const peekable = usePeekable(layer.script !== "" ? layer.key : null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (hollow) return;
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [hollow]);
  const frame = latest();
  // Just the lights it's on: masked off the rest, their light isn't its.
  const on = new Set(domainOf(layer));
  const colors = new Set<string>();
  for (const l of lights) {
    if (!on.has(l.id)) continue;
    const t = seenOf(frame?.lights.get(l.id), l.type);
    if (t) colors.add(lemtoneCss(t, gamut));
  }
  return <LayerNode colors={[...colors]} hollow={hollow} {...peekable} />;
}

/**
 * Whether a shader's in the light the stops show (the preview's, with your
 * unsaved changes, or the room's): in the room, or one you're adding once
 * it's built (its script here to preview). Not yet, its stop is hollow.
 */
export const inPreview = (layer: Layer) => layer.stage === "live" || (layer.stage === "adding" && layer.script !== "");

interface RowProps {
  layer: Layer;
  /** The selected lights, for its stop's color. */
  lights: LightInfo[];
  /** What it shows under its row when that's opened (detailsOf), if anything. */
  details: ReactNode | null;
  opened: boolean;
  onToggle: () => void;
}

/**
 * What a shader shows under its row, opened, as room tone shows its color:
 * its params, for these lights (ShaderParams.tsx: the base Tone's are a color
 * for each color light and on or off for the old bulbs); nothing, if it has
 * none for them.
 */
function detailsOf(layer: Layer, chosen: LightInfo[]): ReactNode | null {
  const params = paramRowsOf(layer, chosen);
  return params.length > 0 ? <ShaderParams layer={layer} rows={params} /> : null;
}

/**
 * A row's head that opens and closes what's under it: by mouse, from anywhere
 * on it (but its own buttons, which do their own things); by keyboard, its
 * name is the button (the head itself holds its switch, which a button
 * can't). Clicking does nothing else.
 */
function toggling(open: boolean, onToggle: () => void): { head: HTMLAttributes<HTMLDivElement>; name: HTMLAttributes<HTMLSpanElement> } {
  return {
    head: { onClick: (e) => !(e.target as Element).closest("button") && onToggle() },
    name: {
      role: "button",
      tabIndex: 0,
      "aria-expanded": open,
      onKeyDown: (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onToggle();
      },
    },
  };
}

/** The arrow at the end of a row that opens: just a picture of it (its head is what's clicked). */
const Chevron = () => (
  <span className="layer-chevron" aria-hidden="true">
    <ChevronUpIcon />
  </span>
);

/**
 * A shader on these lights. One with something to show opens and closes it
 * from anywhere on its head, as room tone's does (its buttons still do their
 * own things); one with nothing to show doesn't, and doesn't light up.
 */
function ShaderRow(props: RowProps) {
  const { layer, lights, details, opened, onToggle } = props;
  const expandable = details !== null;
  const open = opened && expandable;
  // Not in the room yet: on its way in, or yours to add (previewed once it's built).
  const { stage, adding } = layer;
  const coming = stage === "live" ? "" : stage === "adding" ? (adding?.build?.state === "built" ? " coming adding built" : " coming adding") : " coming";
  const toggle = expandable ? toggling(open, onToggle) : null;
  const head = <RowParts {...props} name={toggle?.name} />;
  return (
    <li className={`layer${coming}${open ? " open" : ""}`}>
      <div className="layer-rail">
        <ShaderNode layer={layer} lights={lights} hollow={!inPreview(layer)} />
      </div>
      {expandable ? (
        <div className="layer-head toggle" {...toggle!.head}>
          {head}
        </div>
      ) : (
        <div className="layer-head">{head}</div>
      )}
      {expandable && (
        <Reveal open={open}>
          <SidebarDetails>{details}</SidebarDetails>
        </Reveal>
      )}
    </li>
  );
}

/**
 * A shader's stop on the rail: its name, what's become of it, and, at the
 * end, under room tone's chevron, a toggle for what it shows under its row,
 * or, if it shows nothing, the quiet dot in its place, so every row ends in
 * the same column.
 */
function RowParts({ layer, lights, details, name }: RowProps & { name?: HTMLAttributes<HTMLSpanElement> }) {
  const sketch = layer.sketch;
  // Its params on these lights, if any aren't at their default: one link puts them all back, under its name.
  const changed = offDefault(layer, paramRowsOf(layer, lights));
  return (
    <>
      <span className="layer-text">
        <span className={name ? "layer-name layer-name-button" : "layer-name"} title={layer.name} {...name}>
          {layer.name}
          {/* Not built by vibes (no stamp): made in rclamp some other way. */}
          {!sketch && <span className="layer-badge external">external</span>}
          {sketch?.deleted && <span className="layer-badge">deleted</span>}
          {sketch?.edited && <span className="layer-badge">edited</span>}
        </span>
        {changed.length > 0 && (
          <span className="layer-meta">
            <button className="layer-reset" onClick={() => resetParams(layer, changed)}>
              Set to default
            </button>
          </span>
        )}
      </span>
      {details !== null ? (
        <Chevron />
      ) : (
        <span className="layer-chevron layer-end" aria-hidden="true" />
      )}
    </>
  );
}

/** One you're taking out, when you apply: where it is, crossed out, to keep after all. */
function GoingRow({ layer }: { layer: Layer }) {
  return (
    <li className="layer coming going">
      <div className="layer-rail">
        <LayerNode colors={[]} hollow />
      </div>
      <div className="layer-head">
        <span className="layer-text">
          <span className="layer-name" title={layer.name}>
            {layer.name}
          </span>
        </span>
        <button className="quiet layer-keep" onClick={() => drafts.keep(layer.key)}>
          Keep
        </button>
        <span className="layer-chevron layer-end" aria-hidden="true" />
      </div>
    </li>
  );
}

/**
 * The stack (top first) with the shaders the draft takes out back in it,
 * each just above the one under it in the room, or, moved since (`order`,
 * the draft's, which keeps their keys), in the place it was moved to (the
 * lowest first, so one over another going too goes above it).
 */
export function withGoing(stack: Layer[], going: Layer[], scene: Scene, order: readonly string[] | null = null): Layer[] {
  const keys = order && going.every((l) => order.includes(l.key)) ? [...order] : scene.shaders.map((s) => s.key);
  const all = [...stack];
  for (const layer of [...going].sort((a, b) => keys.indexOf(b.key) - keys.indexOf(a.key))) {
    const under = keys.slice(keys.indexOf(layer.key) + 1).find((k) => all.some((l) => l.key === k));
    all.splice(under === undefined ? all.length : all.findIndex((l) => l.key === under), 0, layer);
  }
  return all;
}
