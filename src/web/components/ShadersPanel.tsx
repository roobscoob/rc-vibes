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
// Off takes it off them all, On puts it on them all. With some
// selected, it's about them; while it's on for some of them, both sides are
// lit, with how many of them each is ("12 off · 5 on"): On is on for all
// of them, taking any outside its home in, and Off is off for all of them.

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type MouseEvent } from "react";
import type { LightInfo } from "../../shared/arclamp.ts";
import { queryClient, request, useBranchHead, useSketchChanges, useStatus } from "../api.ts";
import { invalidateScene } from "../scene.ts";
import { focusLayer } from "../focus.ts";
import { useStuckHeads } from "../stuck.ts";
import {
  changeable,
  changesByLayer,
  drafts,
  layerOf,
  layersOf,
  removedOf,
  reorderWithin,
  onFor,
  muteFor,
  selectionSwitch,
  switchEverywhere,
  switchFor,
  useDraft,
  type Layer,
  type ShaderPatch,
  type SwitchState,
} from "../draft.ts";
import { domainWords, shadeable } from "../domain-words.ts";
import { ChevronUpIcon, CodeIcon, PlusIcon } from "../icons.tsx";
import { useLights, useScene, type Scene } from "../scene.ts";
import { isBaseColor } from "../../shared/base-color.ts";
import { defaultSketch } from "../../shared/default-sketches.ts";
import { AddSketch } from "./AddSketch.tsx";
import { reorderAnnouncements, reorderInstructions } from "./layer-announcements.ts";
import { Reveal } from "./Reveal.tsx";
import { Segmented } from "./Segmented.tsx";
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
  const body = useRef<HTMLDivElement>(null);
  useStuckHeads(body);
  // The switches are about the selection (the lights shaders can light), if there is one; with none, about each shader.
  const capable = here.filter(shadeable);
  const chosen = capable.filter((l) => selected.has(l.id)).map((l) => l.id);
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

  return (
    <Sidebar
      side="left"
      label="Layers"
      head="Layers"
      bodyRef={body}
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
              const props: RowProps = {
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
                onSwitch: (patch) => drafts.patchShader(layer.key, patch),
                onSelect,
              };
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
  /** The selected lights its switch is about; null, it's about the whole shader. */
  scope: readonly number[] | null;
  open: boolean;
  onToggle: () => void;
  /** Its head clicked: its lights on this floor selected (shift: added; alt: taken out), or, with none here, nothing selected. */
  onPick: (mode: SelectMode) => void;
  /** Its switch pressed: the edit that makes. */
  onSwitch: (patch: ShaderPatch) => void;
  /** Lights selected from its asterisk. */
  onSelect: (ids: number[], mode: SelectMode) => void;
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

/** The lights a shader's switched on for (onFor), of these. */
const litOf = (layer: Layer, ids: readonly number[]) => ids.filter(onFor(layer));

/**
 * A sketch's switch, as LayerSwitch shows it, and the edit switching it on
 * or off makes (its mask: draft.ts' switchFor): about the selection (scope),
 * or with none, the whole sketch: off masks it off every light, on puts it
 * on every light shaders can light (`capable`), its home grown to take them
 * all in.
 */
function switchOf(
  layer: Layer,
  scope: readonly number[] | null,
  every: readonly number[],
  capable: readonly number[],
): { state: SwitchState; on: number; off: number; press: (on: boolean) => ShaderPatch } {
  if (scope) {
    const s = selectionSwitch(layer, scope);
    return { state: s.state, on: s.on, off: s.of - s.on, press: (on) => switchFor(layer, scope, on, every) };
  }
  const lit = litOf(layer, every).length;
  return { state: lit > 0 ? "on" : "off", on: lit, off: 0, press: (on) => (on ? switchFor(layer, capable, true, every) : switchEverywhere(layer, false, every)) };
}

function ShaderRow({ layer, going, changed, here, all, scene, scope, open, onToggle, onPick, onSwitch, onSelect, drag }: RowProps) {
  const every = all.map((l) => l.id);
  // Made outside vibes: no lights of its own (no home) to switch, just muted or not; nothing about its lights here.
  const external = !layer.instance && !layer.adding;
  // The lights it's on: none for one made outside vibes, which says nothing of its lights.
  const on = external ? [] : litOf(layer, every);
  const switchable = changeable(layer) && !going;
  const sw = switchable && !external ? switchOf(layer, scope, every, all.filter(shadeable).map((l) => l.id)) : null;
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
          <span className="layer-meta">{external ? "External" : on.length === 0 ? "No lights" : domainWords(on, all)}</span>
        </span>
        {switchable && external && <MuteSwitch name={layer.name} muted={layer.muted} onSwitch={(to) => onSwitch(muteFor(to))} />}
        {sw && (
          <LayerSwitch
            name={layer.name}
            state={sw.state}
            on={sw.on}
            off={sw.off}
            scoped={scope !== null}
            onSwitch={(to) => onSwitch(sw.press(to))}
          />
        )}
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
      <Reveal open={open}>
        <SidebarDetails>
          <Sections layer={layer} on={on} scene={scene} all={all} />
        </SidebarDetails>
      </Reveal>
    </li>
  );
}

/**
 * Whether a shader's on, as Off · On (the old bulbs' switch, Field.tsx's):
 * for the selection, or with none, at all. On for some of the selected
 * lights, its highlight stretches over both sides, each with how many lights it is ("12 off ·
 * 5 on"); either sets all of them.
 */
function LayerSwitch({
  name,
  state,
  on,
  off,
  scoped,
  onSwitch,
}: {
  name: string;
  state: SwitchState;
  on: number;
  off: number;
  scoped: boolean;
  onSwitch: (on: boolean) => void;
}) {
  const mixed = state === "mixed";
  return (
    <Segmented
      className={mixed ? "layer-switch mixed" : "layer-switch"}
      all={mixed}
      label={scoped ? `${name}, on the selected lights` : name}
      options={[
        { value: "off", label: mixed ? `${off} off` : "Off" },
        { value: "on", label: mixed ? `${on} on` : "On" },
      ]}
      value={mixed ? null : state}
      onChange={(v) => onSwitch(v === "on")}
    />
  );
}

/** One made outside vibes, muted or not (the only way it goes on and off): Mute · Unmute. */
function MuteSwitch({ name, muted, onSwitch }: { name: string; muted: boolean; onSwitch: (on: boolean) => void }) {
  return (
    <Segmented
      className="layer-switch"
      label={name}
      options={[
        { value: "mute", label: "Mute" },
        { value: "unmute", label: "Unmute" },
      ]}
      value={muted ? "mute" : "unmute"}
      onChange={(v) => onSwitch(v === "unmute")}
    />
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


/**
 * What a layer opens to: the lights it's on (no section of their own), then,
 * if it's a sketch's (vibes' own included), its Sketch (opening it, cloning
 * it, updating it, and deleting it). The base Tone has no Sketch section,
 * and can't be deleted or moved. A shader made outside vibes has no Domain (vibes doesn't
 * say which lights it's on), just its Delete. One on its way in, opened
 * or let go.
 */
function Sections({ layer, on, scene, all }: { layer: Layer; on: number[]; scene: Scene; all: LightInfo[] }) {
  const ids = all.map((l) => l.id);
  const coming = (layer.stage === "building" || layer.stage === "failed") && layer.instance;
  // One of vibes' own (shared/default-sketches.ts: a Tone, a Transition): its code's vibes', so nothing to open or update, just clone or take out.
  const base = isBaseColor(layer.key);
  const builtIn = defaultSketch(layer.adding?.sketchId ?? layer.instance?.sketchId ?? layer.sketch?.id);
  // A sketch's (in the room, on its way, or being added): it has a Sketch section. One of vibes' own, or a shader made outside vibes, hasn't.
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
  return (
    <>
      {/* Its lights, each kind on a line in their colors, straight under its head. */}
      {on.length > 0 ? <LightsSummary lights={lightsOf(on, all)} /> : <span className="domain-empty">No lights</span>}
      {/* One of vibes' own sketches: its Sketch (cloning it, taking it out). Not the base Tone's, which is just its lights. */}
      {builtIn && !base && (
        <SidebarSection title="Sketch">
          <div className="shader-actions">
            <CloneShader layer={layer} scene={scene} all={ids} />
            {layer.adding ? <AddingActions adding={layer.adding} /> : coming ? <ComingActions instance={layer.instance!} /> : <RemoveShader layer={layer} />}
          </div>
        </SidebarSection>
      )}
      {isSketch && (
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
      )}
    </>
  );
}
