// A shader's switch, wherever its row is: the layers panel's (ShadersPanel.tsx),
// and on a phone, which has no layers panel, the selection's
// (SelectionPanel.tsx). A sketch from vibes is Off · On, by its mask alone:
// about the selected lights (those shaders can light: not the old bulbs), or
// with none, the whole sketch. With nothing selected, Off takes it off every
// light; On undoes a pending Off (back on the lights the room has it on), or
// else puts it on every light. With some selected, On is on for all of them
// (taking any outside its home in) and Off off for all of them; while it's on
// for some, one highlight stretches over both sides, with how many each is
// ("12 off · 5 on"). One made outside vibes is Mute · Unmute, its mute alone.
// Either is a pending edit.

import type { LightInfo } from "../../shared/arclamp.ts";
import { isBaseColor } from "../../shared/base-color.ts";
import { shadeable } from "../domain-words.ts";
import {
  drafts,
  muteFor,
  onFor,
  savedOnOf,
  selectionSwitch,
  switchEverywhere,
  switchFor,
  type Layer,
  type ShaderPatch,
  type SwitchState,
} from "../draft.ts";
import { Segmented } from "./Segmented.tsx";

/** The lights a shader's switched on for (onFor), of these. */
export const litOf = (layer: Layer, ids: readonly number[]) => ids.filter(onFor(layer));

/**
 * A sketch's switch, as LayerSwitch shows it, and the edit switching it on
 * or off makes (its mask: draft.ts' switchFor): about the selection (scope),
 * or with none, the whole sketch: off masks it off every light; on, if it
 * was only switched off by a pending edit, undoes that (back on the lights
 * the room has it on: savedOnOf), and otherwise puts it on every light
 * shaders can light (`capable`), its home grown to take them all in.
 */
function switchOf(
  layer: Layer,
  scope: readonly number[] | null,
  every: readonly number[],
  capable: readonly number[],
): { state: SwitchState; on: number; off: number; press: (on: boolean) => ShaderPatch } {
  if (scope) {
    const s = selectionSwitch(layer, scope);
    return { state: s.state, on: s.on, off: s.of - s.on, press: (on) => switchFor(layer, scope, on, every) };
  }
  const lit = litOf(layer, every).length;
  const press = (on: boolean): ShaderPatch => {
    if (!on) return switchEverywhere(layer, false, every);
    return savedOnOf(layer, every) ?? switchFor(layer, capable, true, every);
  };
  return { state: lit > 0 ? "on" : "off", on: lit, off: 0, press };
}

/**
 * A shader's switch: Off · On for a sketch from vibes (about the selected
 * lights it can light, or with none, the whole sketch), Mute · Unmute for one
 * made outside vibes. `selected`: the selected lights here (null, none);
 * `all`: every light. What a sketch can light: the lights shaders can (not
 * the old bulbs), or, for the base Tone, every light (it switches the old
 * bulbs on and off).
 */
export function ShaderSwitch({ layer, selected, all }: { layer: Layer; selected: readonly LightInfo[] | null; all: readonly LightInfo[] }) {
  const patch = (p: ShaderPatch) => drafts.patchShader(layer.key, p);
  if (!layer.instance && !layer.adding) return <MuteSwitch name={layer.name} muted={layer.muted} onSwitch={(to) => patch(muteFor(to))} />;
  const lightable = (l: LightInfo) => isBaseColor(layer.key) || shadeable(l);
  const scope = (selected ?? []).filter(lightable).map((l) => l.id);
  const sw = switchOf(
    layer,
    scope.length > 0 ? scope : null,
    all.map((l) => l.id),
    all.filter(lightable).map((l) => l.id),
  );
  return <LayerSwitch name={layer.name} state={sw.state} on={sw.on} off={sw.off} scoped={scope.length > 0} onSwitch={(to) => patch(sw.press(to))} />;
}

/**
 * Whether a shader's on, as Off · On (the old bulbs' switch, Field.tsx's):
 * for the selection, or with none, at all. On for some of the selected
 * lights, its highlight stretches over both sides, each with how many lights
 * it is ("12 off · 5 on"); either sets all of them.
 */
function LayerSwitch({
  name,
  state,
  on,
  off,
  scoped,
  onSwitch,
}: {
  name: string;
  state: SwitchState;
  on: number;
  off: number;
  scoped: boolean;
  onSwitch: (on: boolean) => void;
}) {
  const mixed = state === "mixed";
  return (
    <Segmented
      className={mixed ? "layer-switch mixed" : "layer-switch"}
      all={mixed}
      label={scoped ? `${name}, on the selected lights` : name}
      options={[
        { value: "off", label: mixed ? `${off} off` : "Off" },
        { value: "on", label: mixed ? `${on} on` : "On" },
      ]}
      value={mixed ? null : state}
      onChange={(v) => onSwitch(v === "on")}
    />
  );
}

/** One made outside vibes, muted or not (the only way it goes on and off): Mute · Unmute. */
function MuteSwitch({ name, muted, onSwitch }: { name: string; muted: boolean; onSwitch: (on: boolean) => void }) {
  return (
    <Segmented
      className="layer-switch"
      label={name}
      options={[
        { value: "mute", label: "Mute" },
        { value: "unmute", label: "Unmute" },
      ]}
      value={muted ? "mute" : "unmute"}
      onChange={(v) => onSwitch(v === "unmute")}
    />
  );
}
