import { describe, expect, it } from "vitest";
import { controlsOf, heardAs, midi, midiSettings, sameTarget, type Control, type MidiTarget } from "./midi-settings.ts";

describe("MIDI mappings", () => {
  const intro: MidiTarget = { kind: "fire", scene: "intro" };
  const speed: MidiTarget = { kind: "knob", key: "k", name: "speed" };
  const mappings = { "note:1:36": intro, "cc:1:7": speed, "cc:2:7": speed } as Record<Control, MidiTarget>;

  it("says which controls each target has, as their badges do", () => {
    expect(controlsOf(intro, mappings)).toEqual(["N36"]);
    expect(controlsOf(speed, mappings)).toEqual(["CC7", "2/CC7"]);
    expect(controlsOf({ kind: "tap" }, mappings)).toEqual([]);
  });

  it("knows a target by what it is, not which object", () => {
    expect(sameTarget({ kind: "knob", key: "k", name: "speed" }, speed)).toBe(true);
    expect(sameTarget({ kind: "fire", scene: "verse" }, intro)).toBe(false);
  });

  it("turns MIDI on with map mode, and picking waits for a control; off, map mode goes too", () => {
    midi.setMapping(true);
    expect(midiSettings()).toMatchObject({ on: true, mapping: true, picked: null });
    midi.pick(intro);
    expect(midiSettings().picked).toEqual(intro);
    midi.setOn(false);
    expect(midiSettings()).toMatchObject({ on: false, mapping: false, picked: null });
  });
});

describe("a message heard", () => {
  const blink: MidiTarget = { kind: "knob", key: "k", name: "blink" };
  const intro: MidiTarget = { kind: "fire", scene: "intro" };
  const mappings = { "note:1:40": blink, "cc:1:20": blink, "note:1:36": intro, "cc:1:21": intro } as Record<Control, MidiTarget>;

  it("presses a knob a pad's mapped to (an on-or-off one is flipped), and turns one a control change is", () => {
    expect(heardAs(0x90, 40, 100, 0, mappings)).toEqual({ control: "note:1:40", target: blink, does: "press" });
    expect(heardAs(0xb0, 20, 64, 0, mappings)).toEqual({ control: "cc:1:20", target: blink, does: "turn" });
  });

  it("presses a button on a note, or on a control change going up past halfway, and not on a note let go", () => {
    expect(heardAs(0x90, 36, 1, 0, mappings)?.does).toBe("press");
    expect(heardAs(0x90, 36, 0, 0, mappings)).toBeNull();
    expect(heardAs(0x80, 36, 0, 0, mappings)).toBeNull();
    expect(heardAs(0xb0, 21, 100, 10, mappings)?.does).toBe("press");
    expect(heardAs(0xb0, 21, 110, 100, mappings)?.does).toBeNull();
  });

  it("knows the channel, and says nothing's mapped to a control that isn't", () => {
    expect(heardAs(0x91, 40, 100, 0, mappings)).toEqual({ control: "note:2:40", target: undefined, does: null });
  });
});
