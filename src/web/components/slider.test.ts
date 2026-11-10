import { describe, expect, it } from "vitest";
import { moved, pressTarget } from "./Slider.tsx";

// A 200px track from x=100, 0 to 100: a value's knob center is at 100 + 2 * value.
const at = (x: number, lo: number, hi: number, more: { dy?: number; knobRadius?: number } = {}) =>
  pressTarget({ x, trackLeft: 100, trackWidth: 200, lo, hi, min: 0, max: 100, single: lo === hi, knobRadius: 11, ...more });

describe("pressTarget", () => {
  it("takes the low knob when the press is on it", () => {
    expect(at(140, 20, 80)).toBe("lo");
    expect(at(150, 20, 80)).toBe("lo");
    expect(at(140, 20, 80, { dy: 8 })).toBe("lo");
  });

  it("takes the high knob when the press is on it", () => {
    expect(at(260, 20, 80)).toBe("hi");
    expect(at(252, 20, 80)).toBe("hi");
  });

  it("sets every light when the press is on the track between the knobs", () => {
    expect(at(200, 20, 80)).toBe("one");
    expect(at(152, 20, 80)).toBe("one");
  });

  it("sets every light when the press is beyond either end", () => {
    expect(at(100, 20, 80)).toBe("one");
    expect(at(90, 20, 80)).toBe("one");
    expect(at(300, 20, 80)).toBe("one");
    expect(at(310, 20, 80)).toBe("one");
  });

  it("sets every light when the press is above or below a knob, past its circle", () => {
    expect(at(140, 20, 80, { dy: 12 })).toBe("one");
  });

  it("takes the nearer knob where they overlap, the high one from their midpoint on", () => {
    // Knobs at 200 and 210.
    expect(at(198, 50, 55)).toBe("lo");
    expect(at(204, 50, 55)).toBe("lo");
    expect(at(205, 50, 55)).toBe("hi");
    expect(at(212, 50, 55)).toBe("hi");
  });

  it("puts knobs past the track's ends at its ends", () => {
    expect(at(100, -10, 50)).toBe("lo");
    expect(at(300, 50, 120)).toBe("hi");
  });

  it("with the lights at one value, any press sets every light", () => {
    expect(at(200, 50, 50)).toBe("one");
    expect(at(120, 50, 50)).toBe("one");
  });
});

describe("moved", () => {
  it("one: sets every light to the value", () => {
    expect(moved("one", [10, 40, 70], 55)).toEqual({ next: [55, 55, 55], which: [0, 1, 2] });
  });

  it("lo: clamps the lights it passes, and takes the lowest along", () => {
    expect(moved("lo", [10, 40, 70], 50)).toEqual({ next: [50, 50, 70], which: [0, 1] });
    expect(moved("lo", [10, 40, 70], 5)).toEqual({ next: [5, 40, 70], which: [0] });
  });

  it("hi: clamps the lights it passes, and takes the highest along", () => {
    expect(moved("hi", [10, 40, 70], 30)).toEqual({ next: [10, 30, 30], which: [1, 2] });
    expect(moved("hi", [10, 40, 70], 90)).toEqual({ next: [10, 40, 90], which: [2] });
  });
});
