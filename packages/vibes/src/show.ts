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
//
// And the tempo, once someone sets one (tapped in, typed, or a MIDI clock):
// show.beat counts beats, running on whether the piece plays or not, and
// show.bar bars (4 beats), so a sketch can move on the music:
//
//   const beat = show.beat;
//   export const update = sketch((here) => color.hsl(0, 0, 1 - (beat(here) % 1)));

import { field, type Field } from "./field.ts";
import { heardClock, wantShow } from "./param.ts";
import { BEATS_PER_BAR, clockAt } from "./wire.ts";

export interface Show {
  /** Where the piece is, in seconds. */
  readonly time: Field<number>;
  /** Whether the show clock is running. */
  readonly playing: Field<boolean>;
  /** Beats gone by on the show's tempo, counting up smoothly (0.5 is halfway to the next); 0 with no tempo set. */
  readonly beat: Field<number>;
  /** Bars gone by (4 beats each), counting up smoothly. */
  readonly bar: Field<number>;
  /** The tempo, in beats a minute; 0 with none set. */
  readonly bpm: Field<number>;
}

const time = field(({ now }) => clockAt(heardClock(), now)?.t ?? 0);
const playing = field(() => heardClock()?.playing ?? false);
const beat = field(({ now }) => clockAt(heardClock(), now)?.beat ?? 0);
const bar = field(({ now }) => (clockAt(heardClock(), now)?.beat ?? 0) / BEATS_PER_BAR);
const bpm = field(() => heardClock()?.bpm ?? 0);

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
  get beat() {
    wantShow();
    return beat;
  },
  get bar() {
    wantShow();
    return bar;
  },
  get bpm() {
    wantShow();
    return bpm;
  },
};
