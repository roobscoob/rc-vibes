// The show's MIDI, in the account menu while show mode's on: on or off (and
// which devices it hears), and following a MIDI clock. What a controller's
// controls do is mapped in the dock (its MIDI button: midi-settings.ts).

import { useEffect, useState } from "react";
import { hasMidi, onMidiDevices } from "../midi.ts";
import { midi, useMidiSettings } from "../midi-settings.ts";

export function MidiSettings() {
  const { on, following, mappings, error } = useMidiSettings();
  const [devices, setDevices] = useState<string[]>([]);
  useEffect(() => onMidiDevices(setDevices), []);
  if (!hasMidi()) return null;
  const mapped = Object.keys(mappings).length;
  const status = error ? `Couldn't: ${error}` : !on ? "Off" : devices.length === 0 ? "No devices plugged in" : devices.join(", ");
  return (
    <>
      <label className="menu-switch">
        <input type="checkbox" checked={on} onChange={(e) => midi.setOn(e.target.checked)} />
        <span>
          MIDI
          <small>{status}</small>
        </span>
      </label>
      {on && (
        <label className="menu-switch menu-indent">
          <input type="checkbox" checked={following} onChange={(e) => midi.setFollowing(e.target.checked)} />
          <span>
            Follow MIDI clock
          </span>
        </label>
      )}
      {on && mapped > 0 && (
        <div className="menu-indent midi-actions">
          <button className="dock-quiet" onClick={() => midi.forgetAll()}>
            Forget {mapped === 1 ? "1 mapping" : `${mapped} mappings`}
          </button>
        </div>
      )}
    </>
  );
}
