// The show's timeline (shared/show-timeline.ts): its blocks, kept here,
// saved, and in the live tree (timeline/blocks). Pages change them
// (timeline/blocks/<id>, made by updates.ts), each change made at once,
// whatever the mode: the timeline is the room's, never a pending edit. Each
// is told to every page (the tree) and to the timeline playing (onChange),
// and noted in the history, a run of changes from one person as one entry.
//
// A block is put there whole (dragged, it's put again where it's dropped).
// It holds a scene there is; a scene taken away later leaves its blocks
// holding nothing (they play nothing) till they're taken away too.

import type { Op } from "../shared/live.ts";
import { MAX_BEATS, MAX_BLOCKS, MAX_ROWS, NO_TIMELINE, type Block, type BlockOp, type Timeline } from "../shared/show-timeline.ts";
import type { Me } from "../shared/vibes.ts";
import type { Db } from "./db.ts";
import type { ScenesSource } from "./scenes.ts";
import { Refused } from "./shaders.ts";

// A run of changes from one person is one entry in the history.
const LOG_WINDOW_MS = 15_000;

interface Deps {
  db: Pick<Db, "blocks" | "saveBlock" | "removeBlock" | "logCoalesced">;
  /** Changes to the live tree (live.ts). */
  publish: (ops: Op[]) => void;
  scenes: Pick<ScenesSource, "get">;
  /** Told each time a block changes: for the timeline playing (timeline-player.ts). */
  onChange?: () => void;
  now?: () => number;
}

export function createShowTimeline({ db, publish, scenes, onChange = () => {}, now = Date.now }: Deps) {
  const blocks = new Map<string, Block>();
  for (const { id, ...b } of db.blocks()) blocks.set(id, b);

  const tree = (): Timeline => (blocks.size === 0 ? NO_TIMELINE : { blocks: Object.fromEntries(blocks) });

  return {
    tree,

    /** Something done to the timeline, by `user`: made, saved and told to everyone; Refused if it isn't one vibes can make. */
    act(o: BlockOp, user: Me) {
      if (o.op === "remove") {
        // Two pages taking it away at once: the second has nothing to do.
        if (!blocks.delete(o.id)) return;
        db.removeBlock(o.id);
        publish([[`timeline/blocks/${o.id}`]]);
      } else {
        if (!scenes.get(o.scene)) throw new Refused(404, "no_such_scene", "there's no such scene");
        if (!(Number.isInteger(o.row) && o.row >= 0 && o.row < MAX_ROWS)) throw new Refused(400, "bad_row", `a block's on one of ${MAX_ROWS} rows`);
        if (!(o.start >= 0 && o.end > o.start && o.end <= MAX_BEATS)) throw new Refused(400, "bad_span", `a block ends after it starts, within ${MAX_BEATS / 4} bars`);
        if (!blocks.has(o.id) && blocks.size >= MAX_BLOCKS) throw new Refused(400, "too_many_blocks", `the timeline holds ${MAX_BLOCKS} blocks`);
        const b: Block = { scene: o.scene, row: o.row, start: o.start, end: o.end, by: { id: user.id, name: user.name }, at: now() };
        blocks.set(o.id, b);
        db.saveBlock(o.id, b);
        publish([[`timeline/blocks/${o.id}`, b]]);
      }
      onChange();
      db.logCoalesced({ user, action: "timeline.change", detail: { do: o.op } }, LOG_WINDOW_MS, (last) => last?.do === o.op);
    },
  };
}

export type ShowTimeline = ReturnType<typeof createShowTimeline>;
