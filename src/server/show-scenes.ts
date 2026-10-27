// The show's scenes, one set for the room, kept in vibes' database. A scene
// is the shaders it has on, by vibes' key, each with its knobs as they were
// when it was loaded (its pool's values; none, for one with no pool: left as
// they are): one, for now, as loading one puts it in place of the scene's
// last. Made empty, and loaded, from any browser (over the room socket,
// api.ts), and told to every browser. A sketch from the library is put in
// the room (switched off) to be loaded, so firing never waits on a build.
//
// Fired, it comes in as the show's cue mode says, for everyone: at once; at
// the next downbeat of its tempo (one fired meanwhile stands in for one
// waiting); or blended in. Then it's made from the live state as it is then
// (firingOf, in shared/show-scenes.ts, which a browser previewing one uses
// too) as updates (updates.ts), as a page's would be: its knobs, then which
// shaders are on. Blended (land), the sketches coming in are switched on at
// none of them showing, then every one in the scene shows more and more,
// and every one going out less and less, over a moment, down each one's
// stream (params.ts); then those are switched off, all of them showing again
// for next time. A shader with no stream (not a sketch, or one too old)
// cuts. Which was fired last is kept in memory only: a vibes that starts
// over has fired none.

import { randomUUID } from "node:crypto";
import type { Op, Pool } from "../shared/live.ts";
import { cleanValue } from "../shared/params.ts";
import { firingOf, knobsOf, mutesOf } from "../shared/show-scenes.ts";
import type { CueMode, Person, ScenePatch, Shader, ShaderKey, ShowScene, ShowScenes } from "../shared/vibes.ts";
import type { Db } from "./db.ts";

// A run of changes to one scene from one person is one entry in the history.
const LOG_WINDOW_MS = 15_000;

/** The room as the live state has it: its shaders, top first, and their pools. */
export interface Room {
  shaders: Shader[];
  pools: Record<string, Pool>;
}

/** The first "Scene n" not taken. */
function nextName(scenes: ShowScene[]): string {
  const taken = new Set(scenes.map((s) => s.name));
  let n = 1;
  while (taken.has(`Scene ${n}`)) n++;
  return `Scene ${n}`;
}

/** Each sketch's level, down its pool's stream (params.ts): false if it has none. */
export interface Levels {
  linked(pool: string): boolean;
  level(pool: string, to: number, ms: number): boolean;
}

export function createShowScenes(db: Db, now: () => number = Date.now, levels: Levels | null = null) {
  let scenes = db.showScenes();
  let fired: string | null = null;
  let mode: CueMode = "cut";
  // A scene fired that's waiting for its beat: which, and what's to happen if another stands in for it.
  let queued: { id: string; timer: ReturnType<typeof setTimeout>; dropped: () => void } | null = null;
  // The sketches a blend's taking out, switched off once it's done (unless another scene's fired first).
  let settling: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(scenes: ShowScenes) => void>();
  const current = (): ShowScenes => ({ scenes, fired, queued: queued?.id ?? null, mode });
  const tell = () => {
    const is = current();
    for (const l of listeners) l(is);
  };
  const save = (scene: ShowScene) => {
    db.saveShowScene(scene);
    scenes = db.showScenes();
  };

  return {
    current,

    /** A scene made or changed (ScenePatch) by `user`, in this room (for its knobs); told to everyone. The scene, or null if there's no such one. */
    change(patch: ScenePatch, room: Room, user: Person): ShowScene | null {
      if (patch.op === "mode") {
        mode = patch.to;
        tell();
        return null;
      }
      const was = patch.op === "create" ? null : (scenes.find((s) => s.id === patch.scene) ?? null);
      if (!was && patch.op !== "create") return null;
      if (patch.op === "remove") {
        db.removeShowScene(was!.id);
        scenes = scenes.filter((s) => s.id !== was!.id);
        if (fired === was!.id) fired = null;
        db.log({ user, action: "show.unscene", detail: { scene: was!.name } });
        tell();
        return was;
      }
      const base: Pick<ShowScene, "id" | "name" | "shaders"> = was ?? { id: randomUUID(), name: nextName(scenes), shaders: {} };
      // A shader's knobs as the room has them; one not there keeps what the scene had.
      const knobs = (key: string) => {
        const s = room.shaders.find((x) => x.key === key);
        return s ? knobsOf(s, room.pools) : (base.shaders[key] ?? null);
      };
      let shadersOf = base.shaders;
      let name = base.name;
      if (patch.op === "rename") name = patch.name;
      // A scene is one sketch, for now: loading one puts it in place of what it had.
      if (patch.op === "load") shadersOf = { [patch.key]: knobs(patch.key) };
      if (patch.op === "unload") {
        const { [patch.key]: _, ...rest } = base.shaders;
        shadersOf = rest;
      }
      if (patch.op === "knobs") shadersOf = Object.fromEntries(Object.keys(base.shaders).map((k) => [k, knobs(k)]));
      if (patch.op === "param") {
        // One of its shader's knobs, as its sketch declares it now; one it hadn't kept starts from the room's.
        const shader = room.shaders.find((s) => s.key === patch.key);
        const pool = shader?.pool ? room.pools[shader.pool] : undefined;
        const spec = pool?.declared?.find((p) => p.name === patch.name);
        if (!spec || !Object.hasOwn(base.shaders, patch.key)) return null;
        const kept = base.shaders[patch.key] ?? {};
        const values = { ...(Object.hasOwn(kept, patch.name) ? kept[patch.name] : pool!.values[patch.name]) };
        for (const [light, v] of patch.set) {
          const clean = v === null ? null : cleanValue(spec, v);
          if (clean === null) delete values[String(light)];
          else values[String(light)] = clean;
        }
        shadersOf = { ...base.shaders, [patch.key]: { ...kept, [patch.name]: values } };
      }
      const scene: ShowScene = { id: base.id, name, shaders: shadersOf, by: { id: user.id, name: user.name }, at: now() };
      save(scene);
      db.logCoalesced({ user, action: "show.scene", detail: { scene: scene.name, shaders: Object.keys(scene.shaders).length } }, LOG_WINDOW_MS, (last) => last?.scene === was?.name);
      tell();
      return scene;
    },

    /**
     * A scene fired, to land in `wait` ms (on its beat): `go` then, unless
     * another's fired first (then `dropped`). At once with no wait. Told to
     * everyone while it waits. False if there's no such scene.
     */
    queue(id: string, wait: number, go: () => void, dropped: () => void): boolean {
      if (!scenes.some((s) => s.id === id)) return false;
      if (queued) {
        clearTimeout(queued.timer);
        queued.dropped();
        queued = null;
      }
      if (wait <= 0) {
        tell();
        go();
        return true;
      }
      const timer = setTimeout(() => {
        queued = null;
        go();
      }, wait);
      queued = { id, timer, dropped };
      tell();
      return true;
    },

    /** How scenes fired come in now. */
    mode: () => mode,

    /**
     * A scene fired by `user`, made in this room, blended over `blend` ms (0
     * cuts): what it added (as an update says), or null if there's no such
     * scene. `make` makes changes as a page's update is made.
     */
    async land(id: string, room: Room, user: Person, blend: number, make: (ops: Op[]) => Promise<Record<string, ShaderKey>>): Promise<Record<string, ShaderKey> | null> {
      const scene = scenes.find((s) => s.id === id);
      if (!scene) return null;
      fired = id;
      db.log({ user, action: "show.fire", detail: { scene: scene.name } });
      tell();
      if (settling) clearTimeout(settling);
      settling = null;
      const { knobs, off, on, stay } = firingOf(scene, room.shaders, room.pools);
      const poolOf = new Map(room.shaders.map((s) => [s.key, s.pool]));
      const streamed = (key: ShaderKey) => {
        const pool = poolOf.get(key);
        return blend > 0 && !!pool && (levels?.linked(pool) ?? false);
      };
      const level = (key: ShaderKey, to: number, ms: number) => levels?.level(poolOf.get(key)!, to, ms);
      const fading = off.filter(streamed);
      // Coming in: its knobs first; then on at none of it, then up.
      if (knobs.length > 0) await make(knobs);
      for (const k of on) if (streamed(k)) level(k, 0, 0);
      const made = await make([...mutesOf(off.filter((k) => !fading.includes(k)), true), ...mutesOf(on, false)]);
      for (const k of [...on, ...stay]) if (streamed(k)) level(k, 1, blend);
      for (const k of fading) level(k, 0, blend);
      if (fading.length > 0) {
        settling = setTimeout(() => {
          settling = null;
          void make(mutesOf(fading, true))
            .then(() => {
              for (const k of fading) level(k, 1, 0);
            })
            .catch((err: unknown) => console.error(err));
        }, blend);
      }
      return made;
    },

    /** Told the scenes each time they change, or one's fired. */
    subscribe(listener: (scenes: ShowScenes) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type ShowScenesSource = ReturnType<typeof createShowScenes>;
