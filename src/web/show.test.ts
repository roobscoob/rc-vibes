import { describe, expect, it, vi } from "vitest";
import type { ClockPatch, ShowClock } from "../shared/params.ts";

// What vibes says of the clock, and what it's asked.
let told: (clock: ShowClock) => void = () => {};
const said: ClockPatch[] = [];
vi.mock("./scene.ts", () => ({
  onClock: vi.fn((l: (clock: ShowClock) => void) => {
    told = l;
    return () => {};
  }),
  sayClock: vi.fn((patch: ClockPatch) => said.push(patch)),
}));
// useSyncExternalStore outside React: its snapshot is the store itself.
vi.mock("react", () => ({ useSyncExternalStore: (_s: unknown, snapshot: () => unknown) => snapshot() }));

const { setClock, useClock } = await import("./show.ts");

describe("the show clock in the browser", () => {
  it("keeps it as vibes last said it, with when, and asks vibes for changes", () => {
    vi.useFakeTimers({ now: 10_000 });
    try {
      expect(useClock()).toBeNull();
      told({ playing: true, t: 42 });
      expect(useClock()).toEqual({ playing: true, t: 42, at: 10_000 });
      setClock({ playing: false });
      setClock({ t: 0 });
      expect(said).toEqual([{ playing: false }, { t: 0 }]);
      // Nothing changes here until vibes says so.
      expect(useClock()).toEqual({ playing: true, t: 42, at: 10_000 });
    } finally {
      vi.useRealTimers();
    }
  });
});
