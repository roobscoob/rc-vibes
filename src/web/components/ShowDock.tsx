// The show, docked along the bottom of the map (in show mode): the show
// clock's transport, its tempo, and the scenes (show-scenes.ts on the
// server), one set for the room. Folded, it's one bar: the transport, the
// tempo, and a button to fire each scene. Opened, the scenes side by side, a
// card each, and beside them the knobs of the scene picked: its sketch's
// params, as the scene has them.
//
// A scene is one sketch, for now, on its section: the lights that sketch
// lights (its home). Each scene's card has its number, its name,
// its sketch and section (clicked, SceneSource picks another: one in the
// room, with its knobs as they are then, or one from the library, which goes
// into the room first, switched off, on the lights selected, or every light,
// so it's built by the time it's fired), and fire.
//
// Fired, a scene switches on its sketch, with its knobs, and everything else
// off, as the cue mode says, for everyone: at once (Cut), at once on the
// next downbeat (its button blinks while it waits), or blended over a beat
// (Fade). In live mode that's the room, and the number keys fire scenes too;
// otherwise it's pending edits, previewed on the map until Apply. Held with
// Shift (a fire button, or a number key), a scene is momentary: in at once,
// and out again when let go, back to the scene before. Turning a scene's
// knob keeps it in the scene, and, for the scene fired last, turns it in the
// room too (as an edit, so live mode or Apply).
//
// The MIDI button maps a controller, as Ableton does: in map mode, scenes,
// knobs, play, Tap and Sync light up; click one, then press or turn
// something on the controller (midi-settings.ts).

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { LightInfo } from "../../shared/arclamp.ts";
import { pathOf } from "../../shared/live.ts";
import { appliesTo, cleanValue, type ClockPatch, type HeardClock, type ParamValue } from "../../shared/params.ts";
import { firingOf, knobsOf, mutesOf } from "../../shared/show-scenes.ts";
import type { CueMode, Shader, ShowScene } from "../../shared/vibes.ts";
import { currentDraft, drafts, pendingCount, useDraft } from "../draft.ts";
import { CloseIcon } from "../icons.tsx";
import { currentScene, sendUpdate, type Scene } from "../scene.ts";
import { hasMidi } from "../midi.ts";
import { midi, useMidiSettings, useShowMidi } from "../midi-settings.ts";
import { useLiveMode } from "../settings.ts";
import { fireScene, sayScene, useShowScenes } from "../show-scenes.ts";
import { AddSketch } from "./AddSketch.tsx";
import { ColorParam } from "./ColorParam.tsx";
import { ParamControl } from "./ParamControl.tsx";
import { Segmented } from "./Segmented.tsx";
import { Mappable } from "./Mappable.tsx";
import { syncTempo, tapTempo, Tempo } from "./Tempo.tsx";
import { Transport } from "./Transport.tsx";

// A knob turned from a controller is kept in the scene fired at most this often.
const KEEP_MS = 150;
/** How many the number keys fire, from the first. */
const KEYS = 9;
const OPEN_KEY = "vibes.showDock";

const MODES: { value: CueMode; label: string }[] = [
  { value: "cut", label: "Cut" },
  { value: "downbeat", label: "Downbeat" },
  { value: "fade", label: "Fade" },
];
const MODE_NOTES: Record<CueMode, string> = {
  cut: "Scenes come in at once",
  downbeat: "Scenes come in on the next downbeat (a bar's first beat; at once with no tempo)",
  fade: "Scenes blend in over a beat",
};

const savedOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
};

/** What's on in the room now, as a scene: to go back to after a momentary one. */
const sceneOfRoom = (room: Scene): ShowScene => ({
  id: "",
  name: "",
  shaders: Object.fromEntries(room.shaders.filter((s) => !s.muted && s.stage !== "failed").map((s) => [s.key, knobsOf(s, room.pools)])),
  by: { id: "", name: "" },
  at: 0,
});

/** A scene's sketch, as the room has it (null: none loaded, or it's gone from the room). */
const sketchOf = (scene: ShowScene, room: Scene): Shader | null => room.shaders.find((s) => Object.hasOwn(scene.shaders, s.key)) ?? null;

/** Where a shader lights: the whole room, or how many lights. */
function sectionOf(shader: Shader, all: number): string {
  const n = shader.instance?.home.length ?? shader.footprint.length;
  return n === 0 ? "" : n >= all ? "whole room" : `${n} lights`;
}

interface Props {
  /** The room as vibes has it. */
  live: Scene;
  /** Every light (for the knobs), and where a sketch from the library goes in: the lights selected (some), or every light. */
  lights: LightInfo[];
  home: number[];
  clock: HeardClock | null;
  onClock: (patch: ClockPatch) => void;
  /** Its height, as it changes, for the map to keep clear of. */
  onHeight: (px: number) => void;
}

export function ShowDock({ live, lights, home, clock, onClock, onHeight }: Props) {
  const { scenes, fired, queued, mode } = useShowScenes();
  const liveMode = useLiveMode();
  const draft = useDraft();
  const [open, setOpenState] = useState(savedOpen);
  const setOpen = (to: boolean) => {
    setOpenState(to);
    try {
      localStorage.setItem(OPEN_KEY, to ? "1" : "0");
    } catch {
      // Kept for now only.
    }
  };
  const [error, setError] = useState<string | null>(null);
  // The scene previewed, out of live mode, till its edits are applied or dropped.
  const [previewing, setPreviewing] = useState<string | null>(null);
  const pending = pendingCount(live, draft);
  useEffect(() => {
    if (pending === 0) setPreviewing(null);
  }, [pending]);
  // The scene whose knobs show (its row, clicked); the one fired, till one is; and the one whose sketch is being picked.
  const [picked, setPicked] = useState<string | null>(null);
  const shown = scenes.find((s) => s.id === (picked ?? fired)) ?? scenes[0] ?? null;
  const [sourcing, setSourcing] = useState<string | null>(null);

  const dock = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = dock.current!;
    const measure = () => onHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      onHeight(0);
    };
  }, [onHeight]);

  const fail = (scene: ShowScene) => (err: unknown) => {
    // Another fired before it landed: that's no error.
    if (!(err as Error).message.startsWith("another scene was fired")) setError(`Couldn't fire ${scene.name}: ${(err as Error).message}`);
  };
  const fire = (scene: ShowScene | undefined) => {
    if (!scene) return;
    setError(null);
    if (!liveMode) {
      drafts.previewScene(scene, live);
      setPreviewing(scene.id);
      return;
    }
    fireScene(scene.id).catch(fail(scene));
  };

  // A momentary scene, held: in at once, and when let go, back to the scene fired before (or the room as it was).
  const held = useRef<{ back: string | null; room: ShowScene; landed: Promise<unknown>; code: string | null } | null>(null);
  const hold = (scene: ShowScene, code: string | null) => {
    if (held.current) return;
    setError(null);
    held.current = { back: fired, room: sceneOfRoom(currentScene() ?? live), landed: fireScene(scene.id, { cut: true }).catch(fail(scene)), code };
  };
  const letGo = () => {
    const h = held.current;
    if (!h) return;
    held.current = null;
    void h.landed.then(() => {
      if (h.back && scenes.some((s) => s.id === h.back)) return fireScene(h.back, { cut: true });
      const now = currentScene();
      if (!now) return;
      const { knobs, off, on } = firingOf(h.room, now.shaders, now.pools);
      return sendUpdate([...knobs, ...mutesOf(off, true), ...mutesOf(on, false)]);
    });
  };
  // MIDI: what a mapped control does (midi-settings.ts). A knob turned turns
  // its sketch's knob in the room, on every light it's for, across its range,
  // and the scene fired keeps it (if it's that scene's sketch).
  const { mapping } = useMidiSettings();
  const keeping = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; set: [number, ParamValue | null][] }>());
  const turnKnob = (key: string, name: string, x: number) => {
    const s = live.shaders.find((sh) => sh.key === key);
    const spec = s?.pool ? live.pools[s.pool]?.declared?.find((p) => p.name === name) : undefined;
    if (!s || !spec || spec.kind === "color") return;
    const v = spec.kind === "toggle" ? x >= 0.5 : Math.min(spec.max, spec.min + Math.round((x * (spec.max - spec.min)) / spec.step) * spec.step);
    const reach = new Set(s.instance?.home ?? s.footprint);
    const changes = lights.filter((l) => reach.has(l.id) && appliesTo(spec, l)).map((l): [number, ParamValue] => [l.id, v]);
    drafts.setParam(key, name, changes);
    const scene = scenes.find((sc) => sc.id === fired);
    if (!scene || !Object.hasOwn(scene.shaders, key)) return;
    const k = `${scene.id}/${key}/${name}`;
    const was = keeping.current.get(k);
    if (was) {
      was.set = changes;
      return;
    }
    const entry = {
      set: changes as [number, ParamValue | null][],
      timer: setTimeout(() => {
        keeping.current.delete(k);
        sayScene({ op: "param", scene: scene.id, key, name, set: entry.set });
      }, KEEP_MS),
    };
    keeping.current.set(k, entry);
  };
  // A knob pressed (a pad on an on-or-off one): flipped from what the room has, or will once what's pending is in.
  const flipKnob = (key: string, name: string) => {
    const s = live.shaders.find((sh) => sh.key === key);
    const pool = s?.pool ? live.pools[s.pool] : undefined;
    const spec = pool?.declared?.find((p) => p.name === name);
    if (!s || !pool || spec?.kind !== "toggle") return;
    const reach = new Set(s.instance?.home ?? s.footprint);
    const first = lights.find((l) => reach.has(l.id) && appliesTo(spec, l));
    if (!first) return;
    // Pending: its value, or (null) back to the default.
    const pending = currentDraft().edits[key]?.params?.[name]?.[String(first.id)];
    const now = pending === null ? spec.default : pending !== undefined ? pending : (cleanValue(spec, pool.values[name]?.[String(first.id)]) ?? spec.default);
    turnKnob(key, name, now === true ? 0 : 1);
  };
  useShowMidi({
    clock,
    onClock,
    press(t) {
      if (t.kind === "fire") fire(scenes.find((s) => s.id === t.scene));
      else if (t.kind === "knob") flipKnob(t.key, t.name);
      else if (t.kind === "play") onClock({ playing: !(clock?.playing ?? false) });
      else if (t.kind === "tap") tapTempo(clock, onClock);
      else if (t.kind === "sync") syncTempo(clock, onClock);
    },
    turn: (t, x) => turnKnob(t.key, t.name, x),
  });
  // Escape leaves map mode.
  useEffect(() => {
    if (!mapping) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") midi.setMapping(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mapping]);
  const latest = useRef({ scenes, liveMode, fire, hold, letGo });
  latest.current = { scenes, liveMode, fire, hold, letGo };

  // In live mode, the number keys fire scenes (Shift held: momentary), unless they're being typed somewhere.
  useEffect(() => {
    const down = (e: globalThis.KeyboardEvent) => {
      const n = /^Digit([1-9])$/.exec(e.code)?.[1];
      const l = latest.current;
      if (!n || !l.liveMode || e.repeat || e.metaKey || e.ctrlKey || e.altKey || Number(n) > KEYS) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable], .cm-editor, dialog")) return;
      const scene = l.scenes[Number(n) - 1];
      if (!scene) return;
      e.preventDefault();
      if (e.shiftKey) l.hold(scene, e.code);
      else l.fire(scene);
    };
    const up = (e: globalThis.KeyboardEvent) => {
      if (held.current?.code === e.code) latest.current.letGo();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // A fire button pressed with Shift, in live mode: held till the pointer's let go, wherever it is.
  const pressFire = (scene: ShowScene) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (!e.shiftKey || !liveMode || e.button !== 0) return;
    e.preventDefault();
    hold(scene, null);
    window.addEventListener("pointerup", () => latest.current.letGo(), { once: true });
  };
  const clickFire = (scene: ShowScene) => (e: { shiftKey: boolean; stopPropagation(): void }) => {
    e.stopPropagation();
    if (!(e.shiftKey && liveMode)) fire(scene);
  };

  const stateOf = (id: string) => (previewing === id ? "previewing" : fired === id && previewing === null ? "fired" : undefined);
  const classOf = (s: ShowScene) => [stateOf(s.id), queued === s.id && "queued", Object.keys(s.shaders).length === 0 && "empty"].filter(Boolean).join(" ");
  const fireTitle = (s: ShowScene, n: number) =>
    queued === s.id
      ? `${s.name} comes in on the next downbeat`
      : liveMode
        ? `Fire ${s.name}${n <= KEYS ? ` (${n})` : ""}; with Shift held, just while it's held`
        : `Preview ${s.name} (Apply sends it to the room; in live mode it fires straight in)`;
  // A new scene: its sketch picked next, once vibes has made it.
  const making = useRef<number | null>(null);
  const create = () => {
    making.current = scenes.length;
    sayScene({ op: "create" });
  };
  useEffect(() => {
    if (making.current === null || scenes.length <= making.current) return;
    making.current = null;
    const made = scenes[scenes.length - 1]!;
    setPicked(made.id);
    setSourcing(made.id);
  }, [scenes]);

  return (
    <section ref={dock} className={`show-dock${open ? " open" : ""}`} aria-label="The show">
      <header className="dock-bar">
        <Transport clock={clock} onSet={onClock} />
        <Tempo clock={clock} onSet={onClock} />
        {open ? (
          <>
            <span className="dock-mode" title={MODE_NOTES[mode]}>
              <Segmented label="How scenes come in" options={MODES} value={mode} onChange={(to) => sayScene({ op: "mode", to })} />
            </span>
            <span className="dock-spacer" />
          </>
        ) : (
          <div className="dock-fires" role="group" aria-label="Scenes">
            {scenes.map((s, i) => (
              <Mappable key={s.id} target={{ kind: "fire", scene: s.id }} label={`Fire ${s.name}`}>
                <button className={`dock-fire ${classOf(s)}`} onClick={clickFire(s)} onPointerDown={pressFire(s)} title={fireTitle(s, i + 1)}>
                  <span className="mono">{i + 1}</span> {s.name}
                </button>
              </Mappable>
            ))}
            {scenes.length === 0 && (
              <button className="dock-quiet" onClick={() => setOpen(true)}>
                + Scenes
              </button>
            )}
          </div>
        )}
        {hasMidi() && (
          <button
            className={`dock-midi${mapping ? " on" : ""}`}
            onClick={() => midi.setMapping(!mapping)}
            aria-pressed={mapping}
            title={mapping ? "Map mode: click something, then press or turn a control on your controller (right-click to unmap; Escape to finish)" : "Map MIDI: a controller's pads and knobs to scenes, knobs, play, Tap and Sync"}
          >
            MIDI
          </button>
        )}
        <button className="dock-toggle" onClick={() => setOpen(!open)} aria-expanded={open} title={open ? "Fold the show away" : "Open the show: the scenes and their knobs"}>
          {open ? "⌄" : "⌃"}
        </button>
      </header>
      {error && (
        <p className="dock-error" title={error}>
          {error}
        </p>
      )}
      {open && (
        <div className="dock-body">
          <ol className="cue-list" aria-label="Scenes">
            {scenes.map((s, i) => {
              const sketch = sketchOf(s, live);
              const gone = !sketch && Object.keys(s.shaders).length > 0;
              return (
                <li key={s.id} className={`cue ${classOf(s)}${shown?.id === s.id ? " picked" : ""}`} onClick={() => setPicked(s.id)}>
                  <Mappable block target={{ kind: "fire", scene: s.id }} label={`Fire ${s.name}`}>
                  <div className="cue-top">
                    <span className="cue-n mono">{i + 1}</span>
                    <span className="cue-name" title={`${s.name}, by ${s.by.name}`}>
                      {s.name}
                    </span>
                  </div>
                  <button
                    className={`cue-source${sketch ? "" : " none"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPicked(s.id);
                      setSourcing(s.id);
                    }}
                    title={sketch ? `${sketch.name}: pick another sketch, rename, or delete` : "Pick its sketch"}
                  >
                    <span className="cue-sketch">{sketch?.name ?? (gone ? "Gone from the room" : "Pick a sketch…")}</span>
                    {sketch && <small>{sectionOf(sketch, lights.length)}</small>}
                  </button>
                  <button
                    className="cue-fire"
                    onClick={clickFire(s)}
                    onPointerDown={pressFire(s)}
                    aria-pressed={stateOf(s.id) !== undefined}
                    title={fireTitle(s, i + 1)}
                  >
                    {liveMode ? "▶" : "◐"}
                  </button>
                  </Mappable>
                </li>
              );
            })}
            <li className="cue-new">
              <button onClick={create} title="A new scene: then pick its sketch">
                + Scene
              </button>
            </li>
          </ol>
          {shown && <SceneKnobs scene={shown} live={live} lights={lights} inRoom={fired === shown.id} onSource={() => setSourcing(shown.id)} />}
        </div>
      )}
      <SceneSource scene={scenes.find((s) => s.id === sourcing) ?? null} room={live} home={home} all={lights.map((l) => l.id)} onClose={() => setSourcing(null)} />
    </section>
  );
}

/** A scene's knobs: its sketch's params, as the scene has them (or the room, for ones it hasn't saved), a column each. */
function SceneKnobs({ scene, live, lights, inRoom, onSource }: { scene: ShowScene; live: Scene; lights: LightInfo[]; inRoom: boolean; onSource: () => void }) {
  const s = sketchOf(scene, live);
  if (!s) {
    return (
      <div className="dock-knobs">
        <p className="muted">
          {scene.name} has no sketch yet.{" "}
          <button className="dock-link" onClick={onSource}>
            Pick one
          </button>
        </p>
      </div>
    );
  }
  const kept = scene.shaders[s.key] ?? null;
  const pool = s.pool ? live.pools[s.pool] : undefined;
  const reach = new Set(s.instance?.home ?? s.footprint);
  const declared = pool?.declared ?? [];
  return (
    <div className="dock-knobs">
      <header className="dock-knobs-head">
        <h3>{s.name}</h3>
        {s.instance && (
          <a className="dock-quiet" href={`/sketches/${encodeURIComponent(s.instance.sketchId)}`} target="_blank" rel="noreferrer" title="Its code, in its editor: push, and it's built again into the room">
            Code ↗
          </a>
        )}
        <span className="muted">
          {scene.name} · {inRoom ? "in the room: a knob turns it there too" : "a knob's kept for when it's fired"}
        </span>
      </header>
      {declared.length === 0 && <p className="muted">{s.instance ? "No knobs (or it hasn't said what they are yet)." : "Not a sketch's, so no knobs."}</p>}
      <div className="dock-params">
        {declared.map((spec) => {
          const theirs = lights.filter((l) => reach.has(l.id) && appliesTo(spec, l));
          if (theirs.length === 0) return null;
          // As the scene keeps it, or the room has it, for one it hasn't kept.
          const byLight = kept && Object.hasOwn(kept, spec.name) ? kept[spec.name] : pool?.values[spec.name];
          const onChange = (changes: readonly [number, ParamValue | null][]) => {
            sayScene({ op: "param", scene: scene.id, key: s.key, name: spec.name, set: [...changes] });
            if (inRoom) drafts.setParam(s.key, spec.name, changes);
          };
          const control = (
            <ParamControl
              key={spec.name}
              spec={spec}
              lights={theirs}
              values={theirs.map((l) => cleanValue(spec, byLight?.[String(l.id)]) ?? spec.default)}
              onChange={onChange}
              colorPicker={ColorParam}
            />
          );
          // A controller's knob can turn any but a color.
          return spec.kind === "color" ? (
            control
          ) : (
            <Mappable key={spec.name} block target={{ kind: "knob", key: s.key, name: spec.name }} label={`${s.name}: ${spec.label}`}>
              {control}
            </Mappable>
          );
        })}
      </div>
    </div>
  );
}

interface SourceProps {
  scene: ShowScene | null;
  room: Scene;
  /** Where a sketch from the library goes in: the lights selected, or every light. */
  home: number[];
  all: number[];
  onClose: () => void;
}

/** A scene's sketch, picked: one in the room, or one from the library; and its name, and deleting it. */
function SceneSource({ scene, room, home, all, onClose }: SourceProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [naming, setNaming] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = scene?.id ?? null;

  useEffect(() => {
    const d = dialog.current!;
    if (id && !d.open) {
      setNaming(scene!.name);
      setDeleting(false);
      setError(null);
      d.showModal();
    } else if (!id && d.open) d.close();
    // Only as it opens and shuts (or another opens).
  }, [id]);

  const rename = () => {
    const to = naming.trim().slice(0, 60);
    if (scene && to && to !== scene.name) sayScene({ op: "rename", scene: scene.id, name: to });
    else if (scene) setNaming(scene.name);
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  };

  const loadSketch = async (sketch: { id: string; name: string }) => {
    if (!scene) return;
    setPicking(false);
    setError(null);
    setLoading(sketch.name);
    const key = `+${crypto.randomUUID()}`;
    const homeSet = new Set(home);
    try {
      const made = await sendUpdate([[pathOf("shaders", key), { sketch: sketch.id, branch: "main", home, muted: true, mask: all.filter((id) => !homeSet.has(id)) }]]);
      if (made[key]) {
        sayScene({ op: "load", scene: scene.id, key: made[key] });
        onClose();
      }
    } catch (err) {
      setError(`Couldn't load ${sketch.name}: ${(err as Error).message}`);
    } finally {
      setLoading(null);
    }
  };

  const sketches = room.shaders.filter((s) => s.stage !== "failed");
  const everywhere = home.length >= all.length;

  return (
    <dialog
      ref={dialog}
      className="add-sketch scene-dialog"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
      aria-label={scene ? `${scene.name}: its sketch` : "A scene's sketch"}
    >
      {scene && (
        <div className="add-sketch-card scene-dialog-card">
          <header className="add-sketch-head">
            <input className="scene-dialog-name" value={naming} maxLength={60} onChange={(e) => setNaming(e.target.value)} onBlur={rename} onKeyDown={key} aria-label="Scene name" />
            <button className="icon-button" onClick={onClose} aria-label="Close" title="Close">
              <CloseIcon />
            </button>
          </header>

          <section className="scene-dialog-section">
            <h3>Its sketch, from the room</h3>
            <p className="muted">Each lights its own section. Picked, it's loaded with its knobs as they are now.</p>
            <ul className="scene-dialog-list">
              {sketches.map((s) => {
                const on = Object.hasOwn(scene.shaders, s.key);
                return (
                  <li key={s.key} className={on ? "on" : undefined}>
                    <button
                      className="scene-dialog-pick"
                      onClick={() => {
                        if (!on) sayScene({ op: "load", scene: scene.id, key: s.key });
                        onClose();
                      }}
                    >
                      <span>{s.name}</span>
                      <small className="muted">
                        {sectionOf(s, all.length)}
                        {s.muted ? " · off now" : " · on now"}
                      </small>
                      {on && <span className="scene-dialog-check">✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="scene-dialog-section">
            <h3>Or from the library</h3>
            <p className="muted">{everywhere ? "It goes in on every light. For one part of the room, select those lights on the map first." : `It goes in on the ${home.length} lights you've selected, switched off till the scene's fired.`}</p>
            <div>
              <button className="scene-dialog-chip library" onClick={() => setPicking(true)} disabled={loading !== null}>
                {loading ? `Putting ${loading} in…` : "Pick from the library…"}
              </button>
            </div>
            {error && <p className="dock-error">{error}</p>}
          </section>

          <footer className="scene-dialog-foot">
            <button className="scene-dialog-quiet" onClick={() => sayScene({ op: "knobs", scene: scene.id })} disabled={Object.keys(scene.shaders).length === 0} title="Its sketch's knobs, kept again as the room has them now">
              Save knobs as they are now
            </button>
            <span className="dock-spacer" />
            {deleting ? (
              <button
                className="scene-dialog-quiet bad"
                onClick={() => {
                  sayScene({ op: "remove", scene: scene.id });
                  onClose();
                }}
              >
                Delete {scene.name} for everyone
              </button>
            ) : (
              <button className="scene-dialog-quiet" onClick={() => setDeleting(true)}>
                Delete…
              </button>
            )}
          </footer>
        </div>
      )}
      <AddSketch open={picking} lights={home.length} onPick={(sketch) => void loadSketch(sketch)} onClose={() => setPicking(false)} />
    </dialog>
  );
}
