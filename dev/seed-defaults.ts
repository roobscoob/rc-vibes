// vibes' own sketches (shared/default-sketches.ts: Tone, Transition,
// Rainbow) put in the room, each on a different part of it, to try the
// layers panel with sketches vibes manages: homes, switching, the domain in
// words. Each one's build is vibes' own (no repo to build); each goes in on
// its home with a pool of its own for its params. Needs vibes running with
// sketches on (SKETCHES=1, BOX_RUNNER=local does without Docker, and
// VIBES_SIGNING_KEY) and dev login (VIBES_DEV_LOGIN=1).
//
//   node --env-file=.env dev/seed-defaults.ts

import WebSocket from "ws";
import { DEFAULT_SKETCHES } from "../src/shared/default-sketches.ts";
import { isBaseColor } from "../src/shared/base-color.ts";

const base = `http://127.0.0.1:${process.env.PORT ?? "8787"}`;
const origin = "http://localhost:5173";

interface Build {
  id: string;
  state: "building" | "built" | "failed";
  error: string | null;
}
interface Light {
  id: number;
  type: string;
  tags: string[] | null;
}

// What goes in, bottom up: a default sketch (by its entry) on the lights with any of these tags (none: every light).
const SEEDS: { entry: string; tags: string[] }[] = [
  { entry: "tone", tags: ["couches", "dave"] },
  { entry: "tone", tags: ["turing", "sammet"] },
  { entry: "transition", tags: ["presentation-space"] },
  { entry: "transition", tags: ["kitchen", "dining-room", "lobby"] },
  { entry: "rainbow", tags: ["presentation-space", "couches", "dining-room", "kitchen", "dave", "lobby"] },
  { entry: "rainbow", tags: ["hopper", "ritchie"] },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let res = await fetch(`${base}/auth/dev-login`, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify({ name: "seed" }) });
  if (!res.ok) throw new Error(`dev login failed (${res.status}): is vibes running with VIBES_DEV_LOGIN=1?`);
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0]!;
  const headers = { cookie, origin, "content-type": "application/json" };
  const api = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text}`);
    return (text ? JSON.parse(text) : undefined) as T;
  };

  const status = await api<{ sketches: boolean }>("GET", "/api/status");
  if (!status.sketches) throw new Error("sketches are off: set SKETCHES=1 (and BOX_RUNNER=local without Docker)");
  // Shaders light the color lights (not the old bulbs).
  const lights = (await api<{ lights: Light[] }>("GET", "/api/lights")).lights.filter((l) => !l.type.startsWith("relay"));
  const every = lights.map((l) => l.id);

  // Each default sketch's build (vibes makes it; asking is enough), waited for.
  const builds = new Map<string, Build>();
  for (const s of DEFAULT_SKETCHES) {
    if (isBaseColor(s.id)) continue;
    let build = await api<Build>("POST", `/api/sketches/${s.id}/builds`, {});
    while (build.state === "building") {
      await sleep(1000);
      build = await api<Build>("GET", `/api/sketches/${s.id}/builds/${build.id}`);
    }
    if (build.state !== "built") throw new Error(`${s.name} didn't build: ${build.error}`);
    builds.set(s.entry, build);
  }
  // The Tone (the base Tone's sketch) is built too, by vibes as it starts; asking again finds it.
  const tone = DEFAULT_SKETCHES.find((s) => s.entry === "tone")!;
  builds.set("tone", await api<Build>("POST", `/api/sketches/${tone.id}/builds`, {}));

  const ops = SEEDS.flatMap(({ entry, tags }, i) => {
    const sketch = DEFAULT_SKETCHES.find((s) => s.entry === entry)!;
    const want = new Set(tags);
    const home = tags.length === 0 ? every : lights.filter((l) => (l.tags ?? []).some((t) => want.has(t))).map((l) => l.id);
    if (home.length === 0) return [];
    const inHome = new Set(home);
    return [
      [
        `shaders/+default-${i}`,
        { sketch: sketch.id, branch: "main", build: builds.get(entry)!.id, home, muted: false, mask: every.filter((id) => !inHome.has(id)), pool: crypto.randomUUID() },
      ],
    ];
  });

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`${base.replace(/^http/, "ws")}/api/scene/ws`, { headers: { cookie, origin } });
    ws.on("open", () => ws.send(JSON.stringify({ type: "hello", rev: null })));
    ws.on("message", (data) => {
      const m = JSON.parse(data.toString()) as { type: string; made?: Record<string, string>; error?: string };
      if (m.type === "state") ws.send(JSON.stringify({ type: "update", id: "seed-defaults", note: "Seeded vibes' own sketches", ops }));
      else if (m.type === "done") {
        for (const [i, { entry, tags }] of SEEDS.entries()) {
          const made = m.made?.[`+default-${i}`];
          if (made) console.log(`in the room: ${entry} on ${tags.join(", ") || "every light"} (${made})`);
        }
        ws.close();
        resolve();
      } else if (m.type === "error" || m.error) {
        ws.close();
        reject(new Error(`vibes said ${JSON.stringify(m)}`));
      }
    });
    ws.on("error", reject);
  });
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
