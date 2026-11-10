// Some lights (a shader's domain), said in a few words, by the groups of
// lights people know them by (tags.ts: the places, then the tags): "All
// lights", "Presentation Space", "Turing and Sammet", "Presentation Space,
// Dave, Kitchen, Dining Room, Couches, and 4 more lights", or just "12
// lights" when no group fits inside them. Only the
// lights shaders can light count (not the old bulbs, which are only on or
// off): a group's those of its lights, so one with old bulbs in it still
// fits a domain that has all of its others.

import type { LightInfo } from "../shared/arclamp.ts";
import { isBinary } from "../shared/fixtures.ts";
import { groupRank, inMainSpace, inSideRooms, tagLabel } from "../shared/tags.ts";
import { count } from "./words.ts";

interface Group {
  key: string;
  label: string;
  ids: number[];
}

type Light = Pick<LightInfo, "id" | "tags" | "type">;

/** Whether shaders can light it: any light but an old bulb. */
export const shadeable = (l: Pick<LightInfo, "type">) => !isBinary(l.type);

/** Every group of these lights: the places (each only where it's part of them, not all of them) and the tags. */
function groupsOf(all: readonly Light[]): Group[] {
  const byTag = new Map<string, number[]>();
  for (const l of all) for (const t of l.tags ?? []) byTag.set(t, [...(byTag.get(t) ?? []), l.id]);
  const place = (key: string, label: string, ids: number[]): Group[] => (ids.length > 0 && ids.length < all.length ? [{ key, label, ids }] : []);
  return [
    ...place("*main", "Main Space", all.filter((l) => inMainSpace(l.tags)).map((l) => l.id)),
    ...place("*side", "Side Rooms", all.filter((l) => inSideRooms(l.tags)).map((l) => l.id)),
    ...[...byTag].map(([tag, ids]) => ({ key: tag, label: tagLabel(tag), ids })),
  ];
}

/**
 * These lights in words: every group wholly inside them, in the order the
 * groups are offered (tags.ts' GROUP_ORDER, as the chips are: a place before
 * its parts, so one named takes its parts with it), each only if it adds
 * some not already said; and whatever's left as "N more lights".
 */
export function domainWords(domain: readonly number[], every: readonly Light[]): string {
  const all = every.filter(shadeable);
  const capable = new Set(all.map((l) => l.id));
  const ids = domain.filter((id) => capable.has(id));
  if (ids.length === 0) return "No lights";
  const these = new Set(ids);
  if (all.every((l) => these.has(l.id))) return "All lights";
  const inside = groupsOf(all)
    .filter((g) => g.ids.every((id) => these.has(id)))
    .sort((a, b) => groupRank(a.key) - groupRank(b.key) || a.label.localeCompare(b.label));
  const said = new Set<number>();
  const named: string[] = [];
  for (const g of inside) {
    if (g.ids.every((id) => said.has(id))) continue;
    named.push(g.label);
    g.ids.forEach((id) => said.add(id));
  }
  const rest = ids.length - said.size;
  if (named.length === 0) return count(rest, "light");
  const parts = rest === 0 ? named : [...named, `${rest} more ${rest === 1 ? "light" : "lights"}`];
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}
