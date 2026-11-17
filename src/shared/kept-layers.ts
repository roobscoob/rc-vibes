// vibes' own layers, in every room: the Base Tone at the bottom
// (base-color.ts) and Fade on top (fade.ts). vibes puts each in on every
// light, keeps it at its end of the stack, and puts it back when it's gone
// (server/kept-layer.ts). Their homes can't be moved and scenes don't switch
// them; they can be switched off, masked and set like any shader.

import type { ParamSpec } from "../../packages/vibes/src/wire.ts";
import { BASE_COLOR, BASE_COLOR_SPECS, BASE_TONE_NAME } from "./base-color.ts";
import { FADE, FADE_SPECS } from "./fade.ts";

export interface KeptLayer {
  /** What it's called, wherever it's shown. */
  name: string;
  sketch: string;
  instance: string;
  pool: string;
  /** Its params as declared, said ahead so its knobs are there from the start. */
  specs: ParamSpec[];
  /** The end of the stack it's kept at. */
  at: "bottom" | "top";
}

export const BASE_LAYER: KeptLayer = { ...BASE_COLOR, name: BASE_TONE_NAME, specs: BASE_COLOR_SPECS, at: "bottom" };
export const FADE_LAYER: KeptLayer = { ...FADE, specs: FADE_SPECS, at: "top" };

export const KEPT_LAYERS: readonly KeptLayer[] = [BASE_LAYER, FADE_LAYER];

/** The kept layer an instance is (by its id, or a layer's key), if it's one. */
export const keptLayer = (id: string | null | undefined) => KEPT_LAYERS.find((l) => l.instance === id);

/** Whether an instance is one of vibes' kept layers. */
export const isKept = (id: string | null | undefined) => keptLayer(id) !== undefined;
