// The groups of lights on the floor you're looking at, as chips: All (every
// light here), then the places and tags in tags.ts' GROUP_ORDER: Main Space
// (the open floor) and its parts, then Side Rooms and theirs; any other tag
// after those, by name. Each is on (filled) while all its lights
// are selected: on adds its lights to the selection, off takes them out
// (every one of them, whatever else they're part of). Selected lights no
// chip that's on covers (picked on the map, or part of a tag) show as a
// count ahead of those, which lets go of just them. With a layer in focus,
// the lights here are just its (App.tsx), so the chips are just theirs.
//
// Under the pointer, a chip points out its lights on the map (hint.ts), and
// what its click would let go of: an on chip's own lights, the count's loose
// ones; an off chip only adds, so nothing.

import type { ReactNode } from "react";
import type { LightInfo } from "../../shared/arclamp.ts";
import { groupRank, inMainSpace, inSideRooms, tagLabel } from "../../shared/tags.ts";
import { usePointsOut } from "../hint.ts";
import type { SelectMode } from "../selection.ts";

interface Props {
  /** The lights on this floor: the only ones that can be selected. */
  lights: LightInfo[];
  selected: ReadonlySet<number>;
  onSelect: (ids: number[], mode: SelectMode) => void;
}

export function TagChips({ lights, selected, onSelect }: Props) {
  const byTag = new Map<string, number[]>();
  for (const l of lights) for (const t of l.tags ?? []) byTag.set(t, [...(byTag.get(t) ?? []), l.id]);
  const chipOf = (tag: string, label: string, ids: number[]) => ({ tag, label, ids, on: ids.length > 0 && ids.every((id) => selected.has(id)) });
  const tags = [...byTag].map(([tag, ids]) => chipOf(tag, tagLabel(tag), ids));
  // The places: the main space and the side rooms (each only where it's a part of what's here).
  const place = (key: string, label: string, ids: number[]) => (ids.length > 0 && ids.length < lights.length ? [chipOf(key, label, ids)] : []);
  const places = [
    ...place("*main", "Main Space", lights.filter((l) => inMainSpace(l.tags)).map((l) => l.id)),
    ...place("*side", "Side Rooms", lights.filter((l) => inSideRooms(l.tags)).map((l) => l.id)),
  ];
  // All first; then the rest in GROUP_ORDER (tags.ts), and any tag it doesn't name after those, by name.
  const chips = [
    chipOf("*", "All", lights.map((l) => l.id)),
    ...[...places, ...tags].sort((a, b) => groupRank(a.tag) - groupRank(b.tag) || a.label.localeCompare(b.label)),
  ];
  if (lights.length === 0 && selected.size === 0) return null;
  const covered = new Set(chips.filter((c) => c.on).flatMap((c) => c.ids));
  const loose = [...selected].filter((id) => !covered.has(id));

  return (
    <div className="tag-bar">
      <div className="tag-chips" role="group" aria-label="Select lights by tag">
        {loose.length > 0 && (
          <Chip on ids={loose} leaving={loose} onClick={() => onSelect([...covered], "replace")} label={`Let go of ${loose.length} selected`}>
            {loose.length} selected
          </Chip>
        )}
        {chips.map((chip) => (
          <Chip key={chip.tag} on={chip.on} pressed ids={chip.ids} leaving={chip.on ? chip.ids : []} onClick={() => onSelect(chip.ids, chip.on ? "remove" : "add")}>
            {chip.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** A chip: on or off; under the pointer, its lights pointed out on the map, and what its click would let go of. */
function Chip({
  on,
  pressed = false,
  ids,
  leaving,
  onClick,
  label,
  children,
}: {
  on: boolean;
  /** A toggle (it says whether it's on), not just a button. */
  pressed?: boolean;
  ids: readonly number[];
  leaving: readonly number[];
  onClick: () => void;
  label?: string;
  children: ReactNode;
}) {
  const pointsOut = usePointsOut(
    () => ids,
    () => leaving,
  );
  return (
    <button className={on ? "chip on" : "chip"} aria-pressed={pressed ? on : undefined} aria-label={label} onClick={onClick} {...pointsOut}>
      {children}
    </button>
  );
}
