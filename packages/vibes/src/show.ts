// show: the show clock, as vibes runs it: where the piece is, in seconds, and
// whether it's running. One clock for the room, so every sketch that follows
// it agrees where the piece is, and it's started, stopped and moved from
// vibes (and from the preview, to rehearse any part). A piece is then
// sections by time:
//
//   const t = show.time;
//   export const update = sketch((here) => (t(here) < 40 ? intro(here) : verse(here)));
//
// It comes on the stream from vibes, as params' values do (param.ts): once
// it's set, on connect, and each time it changes. Between, time runs on from
// the last word at the frame's clock, so it's smooth, and the same for every
// light of a frame. Before vibes has said, it's 0, stopped.

import { field, type Field } from "./field.ts";
import { heardClock, wantShow } from "./param.ts";
import { clockAt } from "./wire.ts";

export interface Show {
  /** Where the piece is, in seconds. */
  readonly time: Field<number>;
  /** Whether the show clock is running. */
  readonly playing: Field<boolean>;
}

const time = field(({ now }) => clockAt(heardClock(), now)?.t ?? 0);
const playing = field(() => heardClock()?.playing ?? false);

/** The show clock. Reading either field notes that the sketch follows it (the preview then has a transport). */
export const show: Show = {
  get time() {
    wantShow();
    return time;
  },
  get playing() {
    wantShow();
    return playing;
  },
};
