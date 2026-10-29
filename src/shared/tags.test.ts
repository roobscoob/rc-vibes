import { describe, expect, it } from "vitest";
import { groupRank, inSideRooms, normalizeTag, sameTags, tagLabel } from "./tags.ts";

describe("normalizeTag", () => {
  it("lowercases and joins words with hyphens", () => {
    expect(normalizeTag("  Back Wall ")).toBe("back-wall");
    expect(normalizeTag("kitchen_2")).toBe("kitchen_2");
  });

  it("refuses what shaders couldn't easily match", () => {
    expect(normalizeTag("")).toBeNull();
    expect(normalizeTag("-lead")).toBeNull();
    expect(normalizeTag("café")).toBeNull();
    expect(normalizeTag("a".repeat(33))).toBeNull();
  });
});

describe("tagLabel", () => {
  it("reads a tag back as words", () => {
    expect(tagLabel("dining-room")).toBe("Dining Room");
    expect(tagLabel("presentation-space")).toBe("Presentation Space");
    expect(tagLabel("kitchen_2")).toBe("Kitchen 2");
    expect(tagLabel("dave")).toBe("Dave");
  });

  it("undoes what normalizeTag did to typed words", () => {
    expect(tagLabel(normalizeTag("Back Wall")!)).toBe("Back Wall");
  });
});

describe("sameTags", () => {
  it("ignores order, and treats none as empty", () => {
    expect(sameTags(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameTags(null, [])).toBe(true);
    expect(sameTags(["a"], ["a", "b"])).toBe(false);
  });
});

describe("the groups' order", () => {
  it("is the main space and its parts, then the side rooms and theirs; other tags after, by name", () => {
    const given = ["ritchie", "kitchen", "*side", "couches", "presentation-space", "turing", "dave", "*main", "dining-room", "lobby", "hopper", "sammet", "attic"];
    const sorted = [...given].sort((a, b) => groupRank(a) - groupRank(b) || a.localeCompare(b));
    expect(sorted).toEqual(["*main", "presentation-space", "lobby", "dave", "kitchen", "dining-room", "couches", "*side", "sammet", "hopper", "turing", "ritchie", "attic"]);
  });

  it("puts a light in the side rooms by any of their tags", () => {
    expect(inSideRooms(["turing"])).toBe(true);
    expect(inSideRooms(["kitchen"])).toBe(false);
    expect(inSideRooms(null)).toBe(false);
  });
});
