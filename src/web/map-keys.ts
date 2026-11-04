// Moving between the map's lights with the arrow keys (RoomMap): from one
// light, the nearest that lies that way, within 45° either side of it. Being
// off the line counts double, so a row is walked along before stepping off it.

export type Direction = "left" | "right" | "up" | "down";

/** Each arrow key's direction on the plan (y grows down, as on the screen). */
export const ARROWS: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

const UNIT: Record<Direction, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

interface Spot {
  x: number;
  y: number;
}

/** The light to go to from `from`, going `dir`; null if there's none that way. */
export function nextLight<T extends Spot>(lights: readonly T[], from: Spot, dir: Direction): T | null {
  const [ux, uy] = UNIT[dir];
  let best: T | null = null;
  let bestScore = Infinity;
  for (const l of lights) {
    const dx = l.x - from.x;
    const dy = l.y - from.y;
    const along = dx * ux + dy * uy;
    const across = Math.abs(dx * uy - dy * ux);
    if (along <= 0 || across > along) continue;
    const score = along + 2 * across;
    if (score < bestScore) {
      best = l;
      bestScore = score;
    }
  }
  return best;
}

/** Where the keys start: the first of these that's selected, else the top-left light. */
export function firstLight<T extends Spot & { id: number }>(lights: readonly T[], selected: ReadonlySet<number>): T | null {
  const picked = lights.find((l) => selected.has(l.id));
  if (picked) return picked;
  let best: T | null = null;
  for (const l of lights) if (!best || l.y + l.x < best.y + best.x) best = l;
  return best;
}
