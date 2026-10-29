import { beforeEach, describe, expect, it } from "vitest";
import type { Op } from "../shared/live.ts";
import { MAX_BEATS, MAX_ROWS, type BlockOp } from "../shared/show-timeline.ts";
import type { Me } from "../shared/vibes.ts";
import { openDb, type Db } from "./db.ts";
import { Refused } from "./shaders.ts";
import { createShowTimeline } from "./show-timeline.ts";

const ada: Me = { id: "rc:1", name: "Ada", dev: false };
const S = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-0000000000b1";

describe("the show's timeline, as vibes keeps it", () => {
  let db: Db;
  let published: Op[];
  let changes: number;
  const make = () =>
    createShowTimeline({ db, publish: (ops) => published.push(...ops), scenes: { get: (id) => (id === S ? ({} as never) : undefined) }, onChange: () => changes++, now: () => 5 });
  const refused = (o: BlockOp) => {
    try {
      make().act(o, ada);
      return null;
    } catch (err) {
      return err instanceof Refused ? err.code : "thrown";
    }
  };

  beforeEach(() => {
    db = openDb(":memory:");
    published = [];
    changes = 0;
  });

  it("puts a block there whole, told to everyone and the timeline playing, saved, and in the history; and takes it away", async () => {
    const timeline = make();
    timeline.act({ op: "put", id: B, scene: S, row: 1, start: 0, end: 16 }, ada);
    timeline.act({ op: "put", id: B, scene: S, row: 0, start: 4, end: 20 }, ada);
    const block = { scene: S, row: 0, start: 4, end: 20, by: { id: ada.id, name: ada.name }, at: 5 };
    expect(timeline.tree()).toEqual({ blocks: { [B]: block } });
    expect(published.at(-1)).toEqual([`timeline/blocks/${B}`, block]);
    expect(changes).toBe(2);
    // vibes starts again: still there.
    expect(make().tree()).toEqual(timeline.tree());
    timeline.act({ op: "remove", id: B }, ada);
    expect(published.at(-1)).toEqual([`timeline/blocks/${B}`]);
    expect(make().tree()).toEqual({ blocks: {} });
    // Two taking it away at once: the second has nothing to do.
    published = [];
    timeline.act({ op: "remove", id: B }, ada);
    expect(published).toEqual([]);
    expect((await db.activity(10)).map((a) => [a.action, a.detail])).toEqual([
      ["timeline.change", { do: "remove" }],
      ["timeline.change", { do: "put" }],
    ]);
  });

  it("refuses a block holding no scene there is, off the rows, or not after its start within the timeline", () => {
    const put = (more: Partial<BlockOp & { op: "put" }>): BlockOp => ({ op: "put", id: B, scene: S, row: 0, start: 0, end: 4, ...more });
    expect(refused(put({ scene: "00000000-0000-4000-8000-000000000009" }))).toBe("no_such_scene");
    expect(refused(put({ row: MAX_ROWS }))).toBe("bad_row");
    expect(refused(put({ row: -1 }))).toBe("bad_row");
    expect(refused(put({ start: 4, end: 4 }))).toBe("bad_span");
    expect(refused(put({ start: -1 }))).toBe("bad_span");
    expect(refused(put({ end: MAX_BEATS + 1 }))).toBe("bad_span");
    expect(published).toEqual([]);
  });
});
