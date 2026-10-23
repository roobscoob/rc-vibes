import { describe, expect, it } from "vitest";
import { createShowClock } from "./show.ts";

describe("the show clock", () => {
  it("runs on from when it was set while it plays, stands while it's stopped, and tells everyone each time", () => {
    let now = 1000;
    const show = createShowClock(() => now);
    const told: { t: number; playing: boolean }[] = [];
    const unsubscribe = show.subscribe((c) => told.push(c));
    expect(show.current()).toBeNull();
    expect(show.set({ playing: true })).toEqual({ t: 0, playing: true });
    now = 3500;
    expect(show.current()).toEqual({ t: 2.5, playing: true });
    expect(show.set({ t: 10 })).toEqual({ t: 10, playing: true });
    now = 4500;
    show.set({ playing: false });
    now = 9000;
    expect(show.current()).toEqual({ t: 11, playing: false });
    show.set({ t: -5 });
    expect(show.current()).toEqual({ t: 0, playing: false });
    expect(told).toEqual([
      { t: 0, playing: true },
      { t: 10, playing: true },
      { t: 11, playing: false },
      { t: 0, playing: false },
    ]);
    unsubscribe();
    show.set({ playing: true });
    expect(told).toHaveLength(4);
  });
});
