import { describe, expect, it } from "vitest";
import { firstLight, nextLight } from "./map-keys.ts";

// Two rows of three, a metre apart, the second a little to the right.
const grid = [
  { id: 1, x: 0, y: 0 },
  { id: 2, x: 1000, y: 0 },
  { id: 3, x: 2000, y: 0 },
  { id: 4, x: 200, y: 1000 },
  { id: 5, x: 1200, y: 1000 },
  { id: 6, x: 2200, y: 1000 },
];
const at = (id: number) => grid.find((l) => l.id === id)!;

describe("nextLight", () => {
  it("walks along a row before stepping off it", () => {
    expect(nextLight(grid, at(1), "right")?.id).toBe(2);
    expect(nextLight(grid, at(2), "right")?.id).toBe(3);
    expect(nextLight(grid, at(2), "left")?.id).toBe(1);
  });

  it("steps to the nearest light in the next row", () => {
    expect(nextLight(grid, at(2), "down")?.id).toBe(5);
    expect(nextLight(grid, at(6), "up")?.id).toBe(3);
  });

  it("prefers a light on the line to a nearer one off it", () => {
    const off = { id: 7, x: 1000, y: 600 };
    const on = { id: 8, x: 1800, y: 0 };
    expect(nextLight([off, on], { x: 0, y: 0 }, "right")?.id).toBe(8);
  });

  it("finds nothing past the edge", () => {
    expect(nextLight(grid, at(3), "right")).toBeNull();
    expect(nextLight(grid, at(1), "up")).toBeNull();
  });
});

describe("firstLight", () => {
  it("starts at a selected light, else the top-left one", () => {
    expect(firstLight(grid, new Set([5]))?.id).toBe(5);
    expect(firstLight(grid, new Set())?.id).toBe(1);
  });
});
