// The timeline's keys (Timeline.tsx), for a block reached with Tab: the
// arrows move it a beat (a bar with Shift), Up and Down from row to row; with
// Alt, Left and Right move its end instead, making it shorter or longer. Each
// kept on the timeline, as a drag is.

import { BEATS_PER_BAR } from "../../shared/show.ts";
import { MAX_BEATS, MAX_ROWS, type Block } from "../../shared/show-timeline.ts";

export type Span = Pick<Block, "row" | "start" | "end">;

/** Where a key pressed on a block puts it; null if the key isn't one of these, or it's already as far as it goes. */
export function keyMove(key: string, mods: { shift: boolean; alt: boolean }, b: Span): Span | null {
  const by = mods.shift ? BEATS_PER_BAR : 1;
  const len = b.end - b.start;
  let next: Span;
  if (mods.alt && (key === "ArrowLeft" || key === "ArrowRight")) {
    next = { ...b, end: Math.max(b.start + 1, Math.min(MAX_BEATS, b.end + (key === "ArrowLeft" ? -by : by))) };
  } else if (key === "ArrowLeft" || key === "ArrowRight") {
    const start = Math.min(MAX_BEATS - len, Math.max(0, b.start + (key === "ArrowLeft" ? -by : by)));
    next = { ...b, start, end: start + len };
  } else if (key === "ArrowUp" || key === "ArrowDown") {
    next = { ...b, row: Math.min(MAX_ROWS - 1, Math.max(0, b.row + (key === "ArrowUp" ? -1 : 1))) };
  } else return null;
  return next.row === b.row && next.start === b.start && next.end === b.end ? null : next;
}

/** The first row with nothing on it from `start` up to `end`; null if every row has. */
export function freeRow(blocks: Span[], start: number, end: number): number | null {
  for (let row = 0; row < MAX_ROWS; row++) {
    if (!blocks.some((b) => b.row === row && b.start < end && start < b.end)) return row;
  }
  return null;
}
