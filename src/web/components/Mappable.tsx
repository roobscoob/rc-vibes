// A control that MIDI can be mapped to (midi-settings.ts). Out of map mode,
// just the control. In it, the control's covered and lit: clicked, it's
// picked, for the next control pressed or turned on the controller to be its
// mapping; right-clicked, its mappings are forgotten. Its mappings show on it.

import type { ReactNode } from "react";
import { controlsOf, midi, sameTarget, useMidiSettings, type MidiTarget } from "../midi-settings.ts";

interface Props {
  target: MidiTarget;
  /** What it's called, for the cover's label ("Fire Intro"). */
  label: string;
  /** Laid out as a block (a card, a knob's row), not in a line of buttons. */
  block?: boolean;
  children: ReactNode;
}

export function Mappable({ target, label, block = false, children }: Props) {
  const { mapping, picked, mappings } = useMidiSettings();
  if (!mapping) return <>{children}</>;
  const controls = controlsOf(target, mappings);
  const isPicked = picked !== null && sameTarget(picked, target);
  return (
    <span className={`mappable${block ? " block" : ""}${isPicked ? " picked" : ""}${controls.length > 0 ? " mapped" : ""}`}>
      {children}
      <button
        className="mappable-cover"
        onClick={(e) => {
          e.stopPropagation();
          midi.pick(target);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          midi.forget(target);
        }}
        aria-pressed={isPicked}
        aria-label={`Map MIDI to ${label}`}
        title={isPicked ? `Press or turn something on your controller for ${label}` : controls.length > 0 ? `${label}: ${controls.join(", ")} (right-click to unmap)` : `Map ${label}`}
      >
        {controls.length > 0 && <span className="mappable-badge mono">{controls.join(" ")}</span>}
      </button>
    </span>
  );
}
