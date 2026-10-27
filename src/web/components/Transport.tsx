// The transport: the show clock, to start, stop and set. On the map it's the
// room's, run by vibes (show.ts), the same for everyone; on the preview page
// it's the preview's own, to rehearse any part of a piece. Play can be
// mapped to a controller (midi-settings.ts).

import { useEffect, useReducer, useState, type KeyboardEvent } from "react";
import { clockAt, clockText, parseClockText, type ClockPatch, type HeardClock } from "../../shared/params.ts";
import { Mappable } from "./Mappable.tsx";

interface Props {
  /** The clock as last heard (null: never set, so 0, stopped). */
  clock: HeardClock | null;
  onSet: (patch: ClockPatch) => void;
}

export function Transport({ clock, onSet }: Props) {
  // Redrawn a few times a second while it runs, to show the time passing.
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!clock?.playing) return;
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [clock]);
  const now = clockAt(clock, Date.now()) ?? { playing: false, t: 0 };
  const [typed, setTyped] = useState<string | null>(null);

  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const t = parseClockText(typed ?? "");
      if (t !== null) onSet({ t });
      setTyped(null);
    }
    if (e.key === "Escape") setTyped(null);
  };

  return (
    <div className="transport" title="The show clock: every sketch that follows it agrees where the piece is">
<Mappable target={{ kind: "play" }} label="Play">
      <button className="transport-button" onClick={() => onSet({ playing: !now.playing })} aria-label={now.playing ? "Stop the show clock" : "Start the show clock"}>
        {now.playing ? "❚❚" : "▶"}
      </button>
      </Mappable>
      {typed === null ? (
        <button className="transport-time mono" onClick={() => setTyped(clockText(now.t))} title="Set the time (m:ss)">
          {clockText(now.t)}
        </button>
      ) : (
        <input className="transport-time mono" autoFocus value={typed} size={5} onChange={(e) => setTyped(e.target.value)} onKeyDown={key} onBlur={() => setTyped(null)} aria-label="The time, m:ss" />
      )}
      <button className="transport-button" onClick={() => onSet({ t: 0 })} aria-label="Back to the start" title="Back to the start">
        ⟲
      </button>
    </div>
  );
}
