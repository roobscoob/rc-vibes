import { describe, expect, it } from "vitest";
import type { Active, Over } from "@dnd-kit/core";
import { reorderAnnouncements } from "./layer-announcements.ts";

const names: Record<string, string> = { rclamp_3: "Aurora", rclamp_4: "Drift", rclamp_5: "Pulse" };
const say = reorderAnnouncements(["rclamp_3", "rclamp_4", "rclamp_5"], (key) => names[key]!);
const active = (id: string) => ({ id }) as Active;
const over = (id: string) => ({ id }) as Over;

describe("reorderAnnouncements", () => {
  it("says the layer by its name and position, never its key", () => {
    const heard = [
      say.onDragStart({ active: active("rclamp_4") }),
      say.onDragOver({ active: active("rclamp_4"), over: over("rclamp_5") }),
      say.onDragEnd({ active: active("rclamp_4"), over: over("rclamp_5") }),
    ];
    expect(heard).toEqual(["Picked up Drift, at position 2 of 3.", "Drift is at position 3 of 3.", "Dropped Drift at position 3 of 3."]);
    for (const line of heard) expect(line).not.toMatch(/rclamp/);
  });

  it("says it stayed put when dropped where it was, or off the list", () => {
    expect(say.onDragEnd({ active: active("rclamp_3"), over: over("rclamp_3") })).toBe("Dropped Aurora, still at position 1 of 3.");
    expect(say.onDragEnd({ active: active("rclamp_3"), over: null })).toBe("Dropped Aurora, still at position 1 of 3.");
  });

  it("says where it went back to when cancelled", () => {
    expect(say.onDragCancel({ active: active("rclamp_5"), over: over("rclamp_3") })).toBe("Put Pulse back, at position 3 of 3.");
  });

  it("says nothing while it's over no layer", () => {
    expect(say.onDragOver({ active: active("rclamp_5"), over: null })).toBeUndefined();
  });
});
