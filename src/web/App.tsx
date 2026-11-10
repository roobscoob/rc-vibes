import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LightInfo, Rail } from "../shared/arclamp.ts";
import { isBinary } from "../shared/fixtures.ts";
import { inMainSpace } from "../shared/tags.ts";
import { useAddingBuilds } from "./adding.ts";
import { RequestError, useMe, useStreetViews } from "./api.ts";
import { useLights, useScene, type Scene } from "./scene.ts";
import { applyDraft, drafts, layersOf, pendingCount, templateOf, useDraft, type Draft } from "./draft.ts";
import { setLiveStuck } from "./unsaved.ts";
import { useHint } from "./hint.ts";
import { Banners } from "./components/Banners.tsx";
import { ColorPreview } from "./components/ColorPreview.tsx";
import { Login } from "./components/Login.tsx";
import { RoomMap } from "./components/RoomMap.tsx";
import { leavingFor, selectionWith, type SelectMode } from "./selection.ts";
import { IdlePanel, SelectionPanel, type Saving } from "./components/SelectionPanel.tsx";
import { ShadersPanel } from "./components/ShadersPanel.tsx";
import { UserMenu } from "./components/UserMenu.tsx";
import { FLOORS } from "./floors.ts";
import { setShowingRoom, useLiveStream } from "./live.ts";
import { useNarrow } from "./narrow.ts";
import { ROOM_TONE, SAVED, usePeek } from "./peek.ts";
import { othersByLight, useOthers, useSharePresence } from "./presence.ts";
import { savedFloor, saveFloor, useLiveMode, useShowMode } from "./settings.ts";
import { useSimulation } from "./sim.ts";
import { navigate, usePath, useQueryParam } from "./route.ts";
import { SplitHandle, StreetView } from "./components/StreetView.tsx";
import { ScenesDrawer } from "./components/ScenesDrawer.tsx";
import { SketchPages } from "./sketches/SketchPages.tsx";

const NO_RAILS: Rail[] = [];
const NO_LIGHTS: ReadonlySet<number> = new Set();
const NO_SCENE: Scene = { shaders: [], roomtone: null, pools: {} };

export function App() {
  const me = useMe();
  const path = usePath();
  // Still trying (see useMe), but say so, in case it's for a while. Checked
  // before pending: a query that's retrying is still pending.
  if (me.isError || me.failureCount > 0) return <Unreachable error={me.error ?? me.failureReason} trying={!me.isError} retry={() => void me.refetch()} />;
  if (me.isPending) return <div className="splash" />;
  if (!me.data) return <Login />;
  // A sketch's own page (its editor); the library is a dialog on the room's page.
  return /^\/sketches\/[^/]+/.test(path) ? <SketchPages path={path} /> : <Shell />;
}

function Unreachable({ error, trying, retry }: { error: Error | null; trying: boolean; retry: () => void }) {
  return (
    <main className="splash splash-unreachable">
      <p>
        {/* vibes answered, but not well: it was reached. What it said is for its log, not for here. */}
        {error instanceof RequestError ? "vibes is having trouble." : "Couldn't reach vibes."}
        {trying ? " Trying again…" : ""}
      </p>
      <button onClick={retry}>Try now</button>
    </main>
  );
}

function Shell() {
  const lights = useLights();
  const scene = useScene();
  useLiveStream(lights.data);
  // Streetview, from the camera in the address (?view=), beside the map.
  const streetView = useQueryParam("view");
  const cameras = useStreetViews().data;
  const openStreetView = useCallback((id: string) => navigate(`${location.pathname}?view=${encodeURIComponent(id)}`), []);
  const closeStreetView = useCallback(() => {
    navigate(location.pathname);
  }, []);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [floor, setFloor] = useState<number>(initialFloor);
  // Every light: everything below takes its lights from here.
  const all = useMemo(() => lights.data?.lights ?? [], [lights.data]);
  // Once the lights are here, the main space is what's selected to start with (on this floor, if any of it's here).
  const started = useRef(false);
  // That start, kept to tell it from a selection made by hand: only those are anyone else's business.
  const startedWith = useRef<ReadonlySet<number> | null>(null);
  useEffect(() => {
    if (started.current || all.length === 0) return;
    started.current = true;
    const start = new Set(all.filter((l) => l.coords?.floor === floor && inMainSpace(l.tags)).map((l) => l.id));
    startedWith.current = start;
    setSelected(start);
  }, [all, floor]);

  // Pending edits put vibes in simulated mode: the map shows the preview of
  // them until they're saved (the panel's save button). So does peeking at a
  // stop on the panel's rail, with every shader above it set aside. In live mode
  // there's no preview: edits go to the room as they're made, what's pending
  // sent again each time it changes, without waiting for the last send to
  // land (vibes makes what comes while it's busy together, the latest
  // winning: updates.ts), so the room keeps up with a drag. Only a failed
  // send leaves them pending, to save again by hand.
  const draft = useDraft();
  const live = scene.data ?? NO_SCENE;
  const pending = scene.data ? pendingCount(live, draft) : 0;
  const peeking = usePeek();
  const liveMode = useLiveMode();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const onSave = useCallback(() => {
    setSaving(true);
    setSaveError(null);
    applyDraft(live)
      .catch((err: Error) => setSaveError(err.message))
      .finally(() => setSaving(false));
  }, [live]);
  const onDiscard = useCallback(() => {
    setSaveError(null);
    drafts.discard();
  }, []);
  const save: Saving = { pending, saving, error: saveError, onSave, onDiscard };
  // The draft last sent: sent again once it's changed.
  const lastSent = useRef<Draft | null>(null);
  useEffect(() => {
    // After a failed send, it waits for a save by hand rather than trying again and again.
    if (!liveMode || pending === 0 || saveError || draft === lastSent.current) return;
    lastSent.current = draft;
    applyDraft(live).catch((err: Error) => setSaveError(err.message));
  }, [liveMode, pending, draft, live, saveError]);
  // Nothing pending, or live mode switched, starts clean.
  useEffect(() => {
    if (pending === 0) setSaveError(null);
  }, [pending]);
  useEffect(() => {
    setSaveError(null);
    lastSent.current = null;
  }, [liveMode]);
  // Live mode's sending failed: the panels show what's pending again (unsaved.ts), to save by hand.
  useEffect(() => setLiveStuck(liveMode && saveError !== null), [liveMode, saveError]);
  const previewing = pending > 0 && (!liveMode || saveError !== null);
  // Peeking at the saved pipeline (the discard button): the room's own frames, the preview kept running behind them.
  const peekingSaved = peeking === SAVED;
  useEffect(() => setShowingRoom(peekingSaved), [peekingSaved]);
  const simulated = previewing || (peeking !== null && !peekingSaved);
  const simInputs = useMemo(() => {
    // Each is previewed once its script's here: a sketch being added, once it's built.
    const layers = layersOf(live, draft).filter((l) => l.script !== "");
    // Peeking at a stop: the light as it leaves there, so everything above it (the stack is top first) is set aside.
    const above =
      peeking === null || peeking === SAVED
        ? 0
        : peeking === ROOM_TONE
          ? layers.length
          : Math.max(
              0,
              layers.findIndex((l) => l.key === peeking),
            );
    // Every layer runs; the simulation sets those above aside just for what the map shows (the rail's stops show them all).
    return { lights: all, layers, template: templateOf(live, draft), peekAbove: above };
  }, [all, live, draft, peeking]);
  // Their builds, asked for and watched.
  useAddingBuilds();
  useSimulation(simulated, simInputs);

  // Only the lights on the floor you're looking at can be selected, and so
  // changed. Switching floors lets go of the selection.
  const onFloor = useMemo(() => all.filter((l) => l.coords?.floor === floor), [all, floor]);
  const here = onFloor;
  // Lights on no floor's plan yet, waiting in the drawer.
  const anyUnplaced = useMemo(() => all.some((l) => !l.coords), [all]);
  const selectedHere = useMemo(() => selectedAmong(selected, here), [here, selected]);
  // Who else is here: where you are, for them; what they've selected on this floor, for the map.
  // Not the selection everyone starts with, though, which would ring the whole main space for each of them.
  const selectedOnFloor = useMemo(() => selectedAmong(selected, onFloor), [onFloor, selected]);
  useSharePresence(floor, selected === startedWith.current ? NO_LIGHTS : selectedOnFloor);
  const others = useOthers();
  const othersHere = useMemo(() => othersByLight(others), [others]);
  // The selected lights that make a color (not the old bulbs, just on or off): what the look card shows.
  const colorLights = here.filter((l) => selectedHere.has(l.id) && !isBinary(l.type));

  const showFloor = (id: number) => {
    setFloor(id);
    setSelected(new Set());
    saveFloor(String(id));
  };

  const select = useCallback((ids: number[], mode: SelectMode) => {
    setSelected((prev) => selectionWith(prev, ids, mode));
  }, []);

  // Nothing moves the map but you: selecting (from either panel), focus,
  // streetview opening and closing all leave it where it is.
  // Lights pointed out from either panel (a layer's row, an unsaved changes
  // asterisk, a group's chip: hint.ts; null with none): hovered on the map,
  // as if under the pointer there, and the selected lights a click on it
  // would let go of about to be let go of (selection.ts' rings). Those are
  // what it says, if it says (a chip's click adds its lights, or takes them
  // out); else all but its own, as a click selecting just them would. Such a
  // click on just what's selected here already changes nothing: then there's
  // nothing to show.
  const hint = useHint();
  const hinted = useMemo(() => {
    if (!hint) return null;
    if (hint.leaving) return hint.ids;
    const mine = here.filter((l) => hint.ids.has(l.id));
    const picked = mine.length > 0 && mine.length === selectedHere.size && mine.every((l) => selectedHere.has(l.id));
    return picked ? null : hint.ids;
  }, [hint, here, selectedHere]);
  const leaving = useMemo(() => {
    if (!hinted) return NO_LIGHTS;
    return hint?.leaving ? new Set([...hint.leaving].filter((id) => selectedHere.has(id))) : leavingFor(selectedHere, hinted);
  }, [hint, hinted, selectedHere]);

  // A camera on another floor shows that floor.
  const cameraFloor = cameras?.find((c) => c.id === streetView)?.floor;
  useEffect(() => {
    if (cameraFloor !== undefined && cameraFloor !== floor) showFloor(cameraFloor);
    // Only when the camera (or where it is) changes, not whenever the floor does.
  }, [streetView, cameraFloor]);

  // Escape lets go of the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The map's own overlays (Move lights, the pending changes) sit under the
  // HUD, so it hands them its height as --hud-h. Measured before the first
  // paint, so the map's first fit already leaves room for it.
  const app = useRef<HTMLDivElement>(null);
  // Under the banners: what streetview splits.
  const body = useRef<HTMLDivElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const measure = () => app.current!.style.setProperty("--hud-h", `${hud.current!.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(hud.current!);
    return () => observer.disconnect();
  }, []);
  // The scenes drawer along the bottom, likewise (--dock-h): the map's own along the bottom go above it.
  const dockHeight = useCallback((px: number) => {
    app.current?.style.setProperty("--dock-h", px > 0 ? `calc(${px}px + var(--gap))` : "0px");
  }, []);

  // Banners about degraded states run across the top of the whole screen,
  // over nothing: everything else is under them. On a wide screen, two
  // panels stand beside the map (not over it): the shaders in the room on
  // the left, and on the right what's selected (or, with nothing, the groups
  // to select). Between them the map is the base of everything, and all else
  // floats over it. Along its top, the HUD: on a floor with no lights yet, a
  // note saying so, and the account on the right. Floors, zoom and the rest
  // are the map's own. On a phone only the selection shows, as a sheet up
  // from the bottom while anything's selected; what it looks like is a card
  // over the map (not on a phone). Along the map's bottom, the scenes drawer
  // (ScenesDrawer.tsx), with the show's clock above them while a show's on (a
  // show starts from the account menu).
  const hasSelection = selectedHere.size > 0;
  const narrow = useNarrow();
  // The scenes drawer, only in show mode (the account menu's).
  const showMode = useShowMode();
  // With streetview open, the room from its camera takes one side and the map
  // (everything above, in its pane) the other, split as last dragged.
  return (
    <div className={`app${hasSelection ? " has-selection" : ""}${streetView ? " in-streetview" : ""}`} ref={app}>
      <Banners />
      <div className="app-body" ref={body}>
        {streetView && <StreetView id={streetView} onClose={closeStreetView} />}
        {streetView && <SplitHandle app={body} />}
        <div className="map-pane">
          {!narrow && <ShadersPanel here={here} selected={selectedHere} onSelect={select} />}
          <div className="map-stage">
            <main className="stage">
              {lights.error ? (
                <p className="map-error">Couldn't load the lights: {lights.error.message}</p>
              ) : (
                <RoomMap
                  lights={all}
                  rails={lights.data?.rails ?? NO_RAILS}
                  floor={floor}
                  onFloor={showFloor}
                  changed={lights.data?.changed ?? 0}
                  selected={selectedHere}
                  onSelect={select}
                  others={othersHere}
                  hinted={hinted ?? NO_LIGHTS}
                  leaving={leaving}
                  look={hasSelection && !narrow && colorLights.length > 0 && <ColorPreview lights={colorLights} />}
                  onStreetView={openStreetView}
                  streetView={streetView}
                />
              )}
            </main>
            {/* The scenes drawer (ScenesDrawer.tsx), along the map's bottom between the sidebars, in show mode. */}
            {showMode && <ScenesDrawer onHeight={dockHeight} />}
            <div className="hud" ref={hud}>
              <div className="hud-bar">
                {lights.data && onFloor.length === 0 && (
                  <p className="map-note">
                    No lights on floor {floor} yet.{anyUnplaced ? " Drag them in from the drawer." : ""}
                  </p>
                )}
                <UserMenu />
              </div>
            </div>
          </div>
          {hasSelection ? (
            <SelectionPanel floor={floor} here={here} selected={selectedHere} save={save} onSelect={select} />
          ) : (
            !narrow && <IdlePanel here={here} selected={selectedHere} onSelect={select} save={save} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Of the selection, the ones among these lights. */
function selectedAmong(selected: ReadonlySet<number>, lights: readonly LightInfo[]): Set<number> {
  const ids = new Set(lights.map((l) => l.id));
  return new Set([...selected].filter((id) => ids.has(id)));
}

/** The floor to show until you pick another: the 4th, where the lights are. */
const DEFAULT_FLOOR = 4;

function initialFloor(): number {
  const n = Number(savedFloor());
  return FLOORS.some((f) => f.id === n) ? n : DEFAULT_FLOOR;
}
