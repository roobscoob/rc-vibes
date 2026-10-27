// The show's MIDI, set up in the account menu while show mode's on
// (midi-settings.ts says what each does): on or off, with the devices it
// hears; the pads, learned or forgotten; and following a MIDI clock.

import { useEffect, useState } from "react";
import { hasMidi, onMidiDevices } from "../midi.ts";
import { midi, useMidiSettings } from "../midi-settings.ts";

export function MidiSettings() {
  const { on, first, following, learning, error } = useMidiSettings();
  const [devices, setDevices] = useState<string[]>([]);
  useEffect(() => onMidiDevices(setDevices), []);
  if (!hasMidi()) return null;
  const heard = error ? `Couldn't: ${error}` : !on ? "A controller's pads fire scenes, and a MIDI clock can set the tempo." : devices.length === 0 ? "On, but no MIDI devices plugged in." : `Hearing ${devices.join(", ")}.`;
  const pads = learning ? "Press the pad for scene 1…" : first === null ? "Not learned yet." : `Pad ${first} fires scene 1, the ones above it the next scenes.`;
  return (
    <>
      <label className="menu-switch">
        <input type="checkbox" checked={on} onChange={(e) => midi.setOn(e.target.checked)} />
        <span>
          MIDI
          <small>{heard}</small>
        </span>
      </label>
      {on && (
        <>
          <div className="menu-field menu-indent">
            <span>
              Pads
              <small>{pads}</small>
            </span>
            <div className="midi-actions">
              <button className="dock-quiet" onClick={() => midi.setLearning(!learning)}>
                {learning ? "Cancel" : first === null ? "Learn" : "Learn again"}
              </button>
              {first !== null && !learning && (
                <button className="dock-quiet" onClick={() => midi.setFirst(null)}>
                  Forget
                </button>
              )}
            </div>
          </div>
          <label className="menu-switch menu-indent">
            <input type="checkbox" checked={following} onChange={(e) => midi.setFollowing(e.target.checked)} />
            <span>
              Follow MIDI clock
              <small>Its tempo sets the show's, and its Start is the downbeat.</small>
            </span>
          </label>
        </>
      )}
    </>
  );
}
