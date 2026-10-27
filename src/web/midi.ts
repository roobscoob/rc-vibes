// MIDI in this browser (Web MIDI): one access for the page, asked for when
// something first listens, and every message from every input (ones plugged
// in later too) told to each listener, and which devices are plugged in. The
// show's MIDI (MidiMenu.tsx) listens alongside anything else.

const listeners = new Set<(data: Uint8Array) => void>();
const deviceListeners = new Set<(names: string[]) => void>();
let access: Promise<MIDIAccess> | null = null;
let devices: string[] = [];

export const hasMidi = () => "requestMIDIAccess" in navigator;

function heard(e: Event) {
  const data = (e as MIDIMessageEvent).data;
  if (data) for (const l of listeners) l(data);
}

function connect(): Promise<MIDIAccess> {
  access ??= navigator.requestMIDIAccess().then((a) => {
    const on = new Set<MIDIInput>();
    const listen = () => {
      for (const input of a.inputs.values()) {
        if (on.has(input)) continue;
        on.add(input);
        input.addEventListener("midimessage", heard);
      }
      devices = [...a.inputs.values()].filter((i) => i.state === "connected").map((i) => i.name ?? "MIDI device");
      for (const l of deviceListeners) l(devices);
    };
    a.addEventListener("statechange", listen);
    listen();
    return a;
  });
  // Refused: asked again next time.
  access.catch(() => {
    access = null;
  });
  return access;
}

/** Told the MIDI devices plugged in (their names), now and as they come and go, once something's listening. Returns a way to stop. */
export function onMidiDevices(listener: (names: string[]) => void): () => void {
  deviceListeners.add(listener);
  listener(devices);
  return () => {
    deviceListeners.delete(listener);
  };
}

/** Hears every MIDI message, once this browser lets it; rejects if it won't. Returns a way to stop. */
export async function listenMidi(listener: (data: Uint8Array) => void): Promise<() => void> {
  await connect();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
