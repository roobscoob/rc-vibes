import { describe, expect, it } from "vitest";
import { domainWords } from "./domain-words.ts";

// Couches 1–3 (and an old bulb, 9), Dave 4–5, Turing 6, Sammet 7, an untagged light 8.
const bulb = (id: number, tags: string[]) => ({ id, tags, type: "br30" });
const all = [
  bulb(1, ["couches"]),
  bulb(2, ["couches"]),
  bulb(3, ["couches"]),
  bulb(4, ["dave"]),
  bulb(5, ["dave"]),
  bulb(6, ["turing"]),
  bulb(7, ["sammet"]),
  bulb(8, []),
  { id: 9, tags: ["couches"], type: "relay" },
];

describe("a domain in words", () => {
  it("says all, or none", () => {
    expect(domainWords([1, 2, 3, 4, 5, 6, 7, 8], all)).toBe("All lights");
    expect(domainWords([], all)).toBe("No lights");
  });

  it("names the group it is", () => {
    expect(domainWords([1, 2, 3], all)).toBe("Couches");
  });

  it("names a place over its parts", () => {
    expect(domainWords([1, 2, 3, 4, 5], all)).toBe("Main Space");
    expect(domainWords([6, 7], all)).toBe("Side Rooms");
  });

  it("names two groups", () => {
    expect(domainWords([4, 5, 6], all)).toBe("Dave and Turing");
  });

  it("counts what's left as lights", () => {
    expect(domainWords([1, 2, 3, 8], all)).toBe("Couches and 1 more light");
    expect(domainWords([1, 2, 3, 4, 5, 6, 8], all)).toBe("Main Space, Turing, and 1 more light");
    expect(domainWords([1, 2, 4, 6], all)).toBe("Turing and 3 more lights");
  });

  it("leaves the old bulbs out, of the domain and its groups", () => {
    expect(domainWords([1, 2, 3, 9], all)).toBe("Couches");
    expect(domainWords([9], all)).toBe("No lights");
  });

  it("names every group inside it, in the chips' order", () => {
    expect(domainWords([1, 2, 3, 4, 5, 6, 7, 8].filter((id) => id !== 8), all)).toBe("Main Space and Side Rooms");
    expect(domainWords([1, 2, 3, 4, 5, 7], all)).toBe("Main Space and Sammet");
    expect(domainWords([1, 2, 3, 4, 5, 7, 8], all)).toBe("Main Space, Sammet, and 1 more light");
    expect(domainWords([1, 2, 3, 6, 7, 8], all)).toBe("Couches, Side Rooms, and 1 more light");
  });

  it("is just a count with no group inside it", () => {
    expect(domainWords([1, 4], all)).toBe("2 lights");
    expect(domainWords([8], all)).toBe("1 light");
  });
});
