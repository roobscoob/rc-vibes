// The layers in the room (its shaders), in a panel along the left of the
// map: where you say which lights each one is on. The bottom of the stack
// first, as the selection's rows read (each draws over what's above it), on
// the same rail as the selection's: a stop each, in the light it makes on its
// lights (hollow while it's off, or not in yet). Last on the rail, the
// library (AddSketch.tsx): adding another, on the lights selected (every
// light, with none). The library also opens from the code button in the
// panel's head.
//
// Each row is shut to start with: its name, and under it the lights it's on
// now (your pending edits and all) in a few words (domain-words.ts:
// "Couches, Dave, and 3 more lights"; off, "No lights"; made outside vibes,
// which vibes can't say what it's meant for, "External"). Clicking
// its head selects the lights it's on (on this floor; shift adds them, alt
// lets go of them); under the pointer, they're ringed on the map (hint.ts).
// Then its switch (Off · On), and its chevron: clicked, it opens and shuts
// the row; dragged, it moves the shader in the stack. Opened: its lights,
// each kind on a line in their colors (LightsSummary.tsx), and what can be
// done to it: opening its code, cloning it, updating it, and deleting it.
// Deleted (till you save), it's just its head: its name grey and crossed
// out (not its asterisk), and Restore in its switch's place.
//
// The switch is about whatever's selected (of the lights shaders can light:
// not the old bulbs). With nothing selected, it's about every one of them:
// Off takes it off them all; On undoes a pending Off (back on the lights the
// room has it on), or else puts it on them all. With some
// selected, it's about them; while it's on for some of them, both sides are
// lit, with how many of them each is ("12 off · 5 on"): On is on for all
// of them, taking any outside its home in, and Off is off for all of them.

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, type ButtonHTMLAttributes, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { LightInfo } from "../../shared/arclamp.ts";
import { queryClient, request, useBranchHead, useSketchChanges, useStatus } from "../api.ts";
import { invalidateScene } from "../scene.ts";
import { focusLayer } from "../focus.ts";
import {
  changeable,
  changesByLayer,
  drafts,
  layerOf,
  layersOf,
  removedOf,
  reorderWithin,
  useDraft,
  type Layer,
} from "../draft.ts";
import { domainWords } from "../domain-words.ts";
import { ChevronUpIcon, CodeIcon, PlusIcon } from "../icons.tsx";
import { useLights, useScene, type Scene } from "../scene.ts";
import { isBaseColor } from "../../shared/base-color.ts";
import { defaultSketch } from "../../shared/default-sketches.ts";
import { AddSketch } from "./AddSketch.tsx";
import { reorderAnnouncements, reorderInstructions } from "./layer-announcements.ts";
import { Reveal } from "./Reveal.tsx";
import { litOf, ShaderSwitch } from "./ShaderSwitch.tsx";
import { Sidebar, SidebarDetails, SidebarSection } from "./Sidebar.tsx";
import { LightsSummary } from "./LightsSummary.tsx";
import { AddingActions, CloneShader, ComingActions, OpenCode, RemoveShader } from "./ShaderPanel.tsx";
import { keyedMode, type SelectMode } from "../selection.ts";
import { ChangesMark, inPreview, ShaderNode, withGoing } from "./SelectionPanel.tsx";
import { useShowUnsaved } from "../unsaved.ts";
import { usePointsOut } from "../hint.ts";
import { useOpened } from "../opened.ts";

const NO_SCENE: Scene = { shaders: [], roomtone: null, pools: {} };
const NO_CHANGES: ReadonlyMap<string, number[]> = new Map();

interface Props {
  /** The lights on this floor. */
  here: LightInfo[];
  /** The selected ones among them. */
  selected: ReadonlySet<number>;
  onSelect: (ids: number[], mode: SelectMode) => void;
}

export function ShadersPanel({ here, selected, onSelect }: Props) {
  const scene = useScene();
  const lights = useLights();
  const draft = useDraft();
  const status = useStatus();
  const live = scene.data ?? NO_SCENE;
  const stack = layersOf(live, draft);
  const going = new Set(removedOf(live, draft));
  // Bottom of the stack first, as the selection's rows read: in the order the light builds up.
  const shown = withGoing(
    stack,
    [...going].flatMap((key) => layerOf(live, draft, key) ?? []),
    live,
    draft.order,
  ).reverse();
  const all = lights.data?.lights ?? [];
  const everyId = all.map((l) => l.id);
  // What each layer has that isn't saved yet: the lights it changes.
  // Not in live mode, where they're sent as they're made (unsaved.ts).
  const showUnsaved = useShowUnsaved();
  const changes = showUnsaved ? changesByLayer(live, draft) : NO_CHANGES;
  const opened = useOpened();
  // The switches are about the selection, if there is one (each, of those lights, the ones it can light: ShaderSwitch); with none, about each shader.
  const chosen = here.filter((l) => selected.has(l.id));
  const scope = chosen.length > 0 ? chosen : null;

  // Adding one: on the lights selected (here), if any are, its home and all
  // it lights, masked off the rest; else on every light in the room. From
  // main, for now: there's no picking a branch yet.
  const [picking, setPicking] = useState(false);
  const add = (sketch: { id: string; name: string }) => {
    setPicking(false);
    const home = selected.size > 0 ? [...selected].sort((a, b) => a - b) : everyId;
    const inHome = new Set(home);
    drafts.add({
      sketchId: sketch.id,
      sketchName: sketch.name,
      branch: "main",
      home,
      mask: everyId.filter((id) => !inHome.has(id)),
    });
  };
  const sketches = status.data?.sketches === true;

  // Dragging a sketch by its chevron moves it in the stack (the room's order, for every light).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // By keyboard, Space picks it up to move (Enter, as a click, opens and shuts it).
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
  // The base Tone stays at the bottom (shared/base-color.ts): it's no place among them to move to.
  // One going is moved like any other: where it's dropped is where Restore puts it back.
  const listed = shown.filter((l) => changeable(l) && !isBaseColor(l.key)).map((l) => l.key);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const moved = arrayMove(listed, listed.indexOf(String(active.id)), listed.indexOf(String(over.id)));
    // The list is bottom first; the stack's order is top first (those going kept in it, for their places: layersOf passes over them).
    drafts.reorder(
      reorderWithin(
        [...shown].reverse().map((l) => l.key),
        moved.reverse(),
      ),
    );
  };

  const propsOf = (layer: Layer): RowProps => ({
    layer,
    going: going.has(layer.key),
    changed: changes.get(layer.key) ?? null,
    here,
    all,
    scene: live,
    scope,
    open: opened.isOpen(layer.key),
    onToggle: () => opened.toggle(layer.key),
    onPick: (mode) => {
      // The selection panel shuts every row but this one's.
      focusLayer(layer.key);
      const mine = litOf(
        layer,
        here.map((l) => l.id),
      );
      // Shift adds them (or, all selected already, lets go of them); alt always lets go of them: keyedMode.
      if (mine.length > 0) onSelect(mine, mode === "add" || mode === "remove" ? keyedMode(mode, mine, selected) : mode);
      else if (mode === "replace") onSelect([], "replace");
    },
    onSelect,
  });

  return (
    <Sidebar
      side="left"
      label="Layers"
      head="Layers"
      // An opened row's head, pinned above the list as what it shows scrolls up: the same head, but not a handle to drag it by.
      pinned={({ key }) => {
        const layer = shown.find((l) => l.key === key);
        return layer && !going.has(key) && <ShaderRow {...propsOf(layer)} pinned />;
      }}
      actions={
        // The sketches library, as the last row's Add opens it: an icon button, as the selection's head has.
        sketches && (
          <button className="icon-button library-button" onClick={() => setPicking(true)} aria-label="Sketches library">
            <CodeIcon />
          </button>
        )
      }
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        // While one's carried, the whole page's cursor is the grabbing hand: the row follows only up and down, so the pointer soon leaves its chevron.
        onDragStart={() => document.documentElement.classList.add("dragging-layer")}
        onDragEnd={(e) => {
          document.documentElement.classList.remove("dragging-layer");
          onDragEnd(e);
        }}
        onDragCancel={() => document.documentElement.classList.remove("dragging-layer")}
        accessibility={{
          announcements: reorderAnnouncements(listed, (key) => shown.find((l) => l.key === key)?.name ?? key),
          screenReaderInstructions: reorderInstructions,
        }}
      >
        <SortableContext items={listed} strategy={verticalListSortingStrategy}>
          <ol className="layers">
            {shown.map((layer) => {
              const props = propsOf(layer);
              return listed.includes(layer.key) ? <SortableShaderRow key={layer.key} {...props} /> : <ShaderRow key={layer.key} {...props} />;
            })}
            {/* Last on the rail, another, on the lights selected (every light, with none). */}
            {sketches && (
              <li className="layer add-row" onClick={() => setPicking(true)}>
                <div className="layer-rail">
                  <span className="layer-node add" aria-hidden="true">
                    <PlusIcon />
                  </span>
                </div>
                <button className="layer-head">
                  <span className="layer-name">Add or view a sketch</span>
                </button>
              </li>
            )}
          </ol>
        </SortableContext>
      </DndContext>
      <AddSketch open={picking} onPick={add} onClose={() => setPicking(false)} />
    </Sidebar>
  );
}

interface RowProps {
  layer: Layer;
  /** Coming out of the room when you save. */
  going: boolean;
  /** With changes to it not saved yet, the lights they change; else null. */
  changed: readonly number[] | null;
  here: LightInfo[];
  all: LightInfo[];
  scene: Scene;
  /** The selected lights here, its switch's (null: none, it's about the whole shader). */
  scope: readonly LightInfo[] | null;
  open: boolean;
  onToggle: () => void;
  /** Its head clicked: its lights on this floor selected (shift: added; alt: taken out), or, with none here, nothing selected. */
  onPick: (mode: SelectMode) => void;
  /** Lights selected from its asterisk. */
  onSelect: (ids: number[], mode: SelectMode) => void;
  /** Its head pinned above the list (Sidebar's): just its head, a copy of the one in the list. */
  pinned?: boolean;
  /** Moving it: its chevron is the handle to drag it by (useSortable's), and how it's carried. */
  drag?: {
    handle: ButtonHTMLAttributes<HTMLButtonElement>;
    ref: (el: HTMLElement | null) => void;
    style: CSSProperties;
    dragging: boolean;
  };
}

/** A sketch that can be moved: dragged by its chevron to another place in the stack. */
function SortableShaderRow(props: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.layer.key });
  const drag = {
    handle: { ...attributes, ...listeners } as ButtonHTMLAttributes<HTMLButtonElement>,
    ref: setNodeRef,
    // Up and down only (the stack's one way), and never stretched to the size of the row it's over.
    style: { transform: CSS.Translate.toString(transform && { ...transform, x: 0 }), transition },
    dragging: isDragging,
  };
  return <ShaderRow {...props} drag={drag} />;
}

function ShaderRow({ layer, going, changed, here, all, scene, scope, open, onToggle, onPick, onSelect, pinned, drag }: RowProps) {
  const every = all.map((l) => l.id);
  // Made outside vibes: no lights of its own (no home) to switch, just muted or not; nothing about its lights here.
  const external = !layer.instance && !layer.adding;
  // The lights it's on: none for one made outside vibes, which says nothing of its lights.
  const on = external ? [] : litOf(layer, every);
  const switchable = changeable(layer) && !going;
  // Under the pointer, its lights pointed out on the map; clicked, selected (not one made outside vibes).
  const pointsOut = usePointsOut(() => on);
  const pick = (e: MouseEvent) => onPick(e.altKey ? "remove" : e.shiftKey ? "add" : "replace");
  const off = external ? layer.muted : on.length === 0;
  // Deleted, till you save: just its head, its name grey and crossed out, Restore where its switch was.
  if (going) {
    return (
      <li ref={drag?.ref} style={drag?.style} className="layer shader-row going">
        <div className="layer-rail">
          <ShaderNode layer={layer} lights={all} hollow />
        </div>
        <div className="layer-head">
          <span className="layer-text">
            <span className="layer-name" title={layer.name}>
              <span className="layer-name-text">{layer.name}</span>
              {changed && <ChangesMark changed={changed} here={here} onSelect={onSelect} />}
            </span>
          </span>
          <button className="quiet layer-keep" onClick={() => drafts.keep(layer.key)} aria-label={`Restore ${layer.name}`}>
            Restore
          </button>
          {/* Nothing to open: the quiet dot in the chevron's place, still its handle to drag it by. */}
          {drag ? (
            <button className="layer-chevron layer-handle layer-end" {...drag.handle} aria-label={`Move ${layer.name} (drag)`} />
          ) : (
            <span className="layer-chevron layer-end" aria-hidden="true" />
          )}
        </div>
      </li>
    );
  }
  return (
    <li
      ref={drag?.ref}
      style={drag?.style}
      className={["layer shader-row", open && "open", going && "going", off && "off", drag?.dragging && "dragging"].filter(Boolean).join(" ")}
      // Opened, its head pins above the list as it scrolls up past the top (pinned.ts).
      data-pin={open && !pinned ? layer.key : undefined}
    >
      <div className="layer-rail">
        <ShaderNode layer={layer} lights={all} hollow={off || going || !inPreview(layer)} />
      </div>
      {/* All of its head selects its lights, but its own buttons; by keyboard, its name, the button for it. One made outside vibes has no lights to select. */}
      <div
        className={external ? "layer-head" : "layer-head toggle"}
        onClick={external ? undefined : (e) => !(e.target as Element).closest("button, [role=radiogroup]") && pick(e)}
        {...(external ? {} : pointsOut)}
      >
        <span className="layer-text">
          <span className="layer-name" title={layer.name}>
            {external ? (
              <span className="layer-name-text">{layer.name}</span>
            ) : (
              <button className="layer-name-button" aria-label={`${layer.name}, select its lights`} onClick={pick}>
                {layer.name}
              </button>
            )}
            {changed && <ChangesMark changed={changed} here={here} onSelect={onSelect} />}
          </span>
          <span className="layer-meta">{external ? "External" : on.length === 0 ? "No lights" : domainWords(on, all, isBaseColor(layer.key))}</span>
        </span>
        {switchable && <ShaderSwitch layer={layer} selected={scope} all={all} />}
        {/* Clicked, it opens and shuts the row; dragged (one that can move), it moves it in the stack. */}
        <button
          className={drag ? "layer-chevron layer-handle" : "layer-chevron"}
          {...drag?.handle}
          aria-expanded={open}
          aria-label={open ? `Close ${layer.name}` : `Open ${layer.name}`}
          onClick={onToggle}
        >
          <ChevronUpIcon />
        </button>
      </div>
      {!pinned && (
        <Reveal open={open}>
          <SidebarDetails>
            <Sections layer={layer} on={on} scene={scene} all={all} />
          </SidebarDetails>
        </Reveal>
      )}
    </li>
  );
}

/** The lights with these ids, of all of them. */
function lightsOf(ids: readonly number[], all: LightInfo[]): LightInfo[] {
  const of = new Set(ids);
  return all.filter((l) => of.has(l.id));
}

/**
 * The commit a sketch's layer runs (or will, once it's in): "head" while that's
 * its branch's latest, else its short hash. Nothing, before there's a build.
 */
function SketchCommit({ layer }: { layer: Layer }) {
  const sketchId = layer.instance?.sketchId ?? layer.adding?.sketchId ?? layer.sketch?.id ?? "";
  const branch = layer.instance?.branch ?? layer.adding?.branch ?? "main";
  const latest = useBranchHead(sketchId, branch);
  const commit = layer.adding ? (layer.adding.build?.commit ?? "") : (layer.instance?.commit ?? layer.sketch?.commit ?? "");
  if (!commit) return null;
  // An instance knows its branch's head; one you're adding (or any other), the sketch's main as last fetched.
  const head = layer.instance ? layer.instance.head : latest;
  return <span className="mono">{head === commit ? "head" : commit.slice(0, 7)}</span>;
}

/**
 * A sketch's layer that's behind, over its actions: your editor has changes
 * main hasn't (files not committed, commits not pushed), and/or its branch
 * has commits it isn't running. One callout either way, and one Update doing
 * all of it: your changes committed and pushed to main (POST …/publish, as
 * adding a sketch with them does), then, for one in the room, its branch's
 * latest built and put in (POST /api/instances/<id>/update). While that new
 * build's on its way, it says so.
 */
function NewChanges({ layer }: { layer: Layer }) {
  const sketchId = layer.instance?.sketchId ?? layer.adding?.sketchId ?? layer.sketch?.id ?? null;
  const changes = useSketchChanges(sketchId).data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const instance = layer.adding ? null : layer.instance;
  const unpushed = !!changes && !("unknown" in changes) && (changes.files > 0 || changes.commits > 0);
  const updating = instance?.next?.state === "building";
  const behind = !!instance && instance.head !== null && instance.head !== instance.commit && !updating;
  if (!sketchId || (!unpushed && !behind && !updating)) return null;
  const update = async () => {
    setBusy(true);
    setError(null);
    try {
      if (unpushed) {
        await request("POST", `/api/sketches/${encodeURIComponent(sketchId)}/publish`, {});
        // Main's head and your changes, both changed.
        await queryClient.invalidateQueries({ queryKey: ["sketches", sketchId] });
      }
      if (instance) await request("POST", `/api/instances/${instance.id}/update`, {});
      await invalidateScene();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const text = error ? `Couldn't update: ${error}` : updating ? `Updating to ${instance!.next!.commit.slice(0, 7)}…` : "This sketch is behind";
  return (
    <div className="sketch-behind" role="note">
      <span className="sketch-behind-text">{text}</span>
      {!updating && (
        <button className="quiet shader-action" disabled={busy} onClick={() => void update()}>
          {busy ? "Updating…" : "Update"}
        </button>
      )}
    </div>
  );
}


/** What a layer opens to: the lights it's on (no section of their own), then its Sketch (sketchSectionOf). */
function Sections({ layer, on, scene, all }: { layer: Layer; on: number[]; scene: Scene; all: LightInfo[] }) {
  // Made outside vibes: no lights of its own to show, just what SketchSection says of it.
  const outside = !layer.instance && !layer.adding;
  return (
    <>
      {/* Its lights, each kind on a line in their colors, straight under its head. */}
      {!outside && (on.length > 0 ? <LightsSummary lights={lightsOf(on, all)} /> : <span className="domain-empty">No lights</span>)}
      {sketchSectionOf(layer, scene, all)}
    </>
  );
}

/**
 * A layer's Sketch: what can be done to it (opening its code, cloning it,
 * updating it, deleting it), in the layers panel's row, and on a phone the
 * selection's. Always "Sketch", vibes' own sketches too (cloning them,
 * taking them out); the base Tone has none (it can't be deleted or moved).
 * A shader made outside vibes has its own, External: just its Delete. One
 * on its way in, opened or let go. Null for one with nothing to show. (A
 * plain function, no hooks, so a caller can tell when there's none.)
 */
export function sketchSectionOf(layer: Layer, scene: Scene, all: readonly LightInfo[]): ReactNode | null {
  const ids = all.map((l) => l.id);
  const coming = (layer.stage === "building" || layer.stage === "failed") && layer.instance;
  // One of vibes' own (shared/default-sketches.ts: a Tone, a Transition): its code's vibes', so nothing to open or update, just clone or take out.
  const base = isBaseColor(layer.key);
  const builtIn = defaultSketch(layer.adding?.sketchId ?? layer.instance?.sketchId ?? layer.sketch?.id);
  const isSketch = !builtIn && (layer.sketch !== null || layer.adding !== null || coming);
  const outside = !isSketch && !builtIn && !layer.instance;
  if (outside) {
    return (
      <SidebarSection title="External" subtitle={`Made outside vibes${layer.by ? `, by ${layer.by}` : ""}: it's only muted or not.`}>
        <div className="shader-actions">
          <RemoveShader layer={layer} />
        </div>
      </SidebarSection>
    );
  }
  if (builtIn) {
    if (base) return null;
    return (
      <SidebarSection title="Sketch">
        <div className="shader-actions">
          <CloneShader layer={layer} scene={scene} all={ids} />
          {layer.adding ? <AddingActions adding={layer.adding} /> : coming ? <ComingActions instance={layer.instance!} /> : <RemoveShader layer={layer} />}
        </div>
      </SidebarSection>
    );
  }
  if (!isSketch) return null;
  return (
    <SidebarSection title="Sketch" actions={<SketchCommit layer={layer} />}>
      {/* One field: whether it's behind, then what's done to the sketch, together. */}
      <div className="sketch-field">
        <NewChanges layer={layer} />
        <div className="shader-actions">
          {layer.adding ? (
            <>
              <CloneShader layer={layer} scene={scene} all={ids} />
              <AddingActions adding={layer.adding} />
            </>
          ) : coming ? (
            <ComingActions instance={layer.instance!} />
          ) : (
            <>
              {layer.sketch && <OpenCode sketch={layer.sketch} />}
              <CloneShader layer={layer} scene={scene} all={ids} />
              <RemoveShader layer={layer} />
            </>
          )}
        </div>
      </div>
    </SidebarSection>
  );
}
