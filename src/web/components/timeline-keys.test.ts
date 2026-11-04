import { describe, expect, it } from "vitest";
import { BEATS_PER_BAR } from "../../shared/show.ts";
import { MAX_BEATS, MAX_ROWS } from "../../shared/show-timeline.ts";
import { freeRow, keyMove } from "./timeline-keys.ts";

const plain = { shift: false, alt: false };
const shift = { shift: true, alt: false };
const alt = { shift: false, alt: true };
const b = { row: 1, start: 8, end: 24 };

describe("keyMove", () => {
  it("moves a block a beat, or a bar with Shift, keeping its length", () => {
    expect(keyMove("ArrowRight", plain, b)).toEqual({ row: 1, start: 9, end: 25 });
    expect(keyMove("ArrowLeft", plain, b)).toEqual({ row: 1, start: 7, end: 23 });
    expect(keyMove("ArrowRight", shift, b)).toEqual({ row: 1, start: 8 + BEATS_PER_BAR, end: 24 + BEATS_PER_BAR });
  });

  it("moves it from row to row", () => {
    expect(keyMove("ArrowUp", plain, b)).toEqual({ row: 0, start: 8, end: 24 });
    expect(keyMove("ArrowDown", plain, b)).toEqual({ row: 2, start: 8, end: 24 });
  });

  it("moves its end with Alt, never past its start", () => {
    expect(keyMove("ArrowRight", alt, b)).toEqual({ row: 1, start: 8, end: 25 });
    expect(keyMove("ArrowLeft", { shift: true, alt: true }, b)).toEqual({ row: 1, start: 8, end: 24 - BEATS_PER_BAR });
    expect(keyMove("ArrowLeft", alt, { row: 0, start: 3, end: 4 })).toBeNull();
  });

  it("stops at the timeline's edges", () => {
    expect(keyMove("ArrowLeft", shift, { row: 0, start: 2, end: 6 })).toEqual({ row: 0, start: 0, end: 4 });
    expect(keyMove("ArrowLeft", plain, { row: 0, start: 0, end: 4 })).toBeNull();
    expect(keyMove("ArrowUp", plain, { row: 0, start: 0, end: 4 })).toBeNull();
    expect(keyMove("ArrowDown", plain, { row: MAX_ROWS - 1, start: 0, end: 4 })).toBeNull();
    expect(keyMove("ArrowRight", plain, { row: 0, start: MAX_BEATS - 4, end: MAX_BEATS })).toBeNull();
  });

  it("leaves other keys alone", () => {
    expect(keyMove("Enter", plain, b)).toBeNull();
    expect(keyMove("ArrowUp", alt, b)).toEqual({ row: 0, start: 8, end: 24 });
  });
});

describe("freeRow", () => {
  it("finds the first row with nothing there", () => {
    expect(freeRow([], 0, 16)).toBe(0);
    expect(freeRow([{ row: 0, start: 0, end: 16 }], 8, 24)).toBe(1);
    expect(freeRow([{ row: 0, start: 0, end: 16 }], 16, 32)).toBe(0);
  });

  it("gives up with every row taken", () => {
    const full = Array.from({ length: MAX_ROWS }, (_, row) => ({ row, start: 0, end: 8 }));
    expect(freeRow(full, 4, 12)).toBeNull();
  });
});
