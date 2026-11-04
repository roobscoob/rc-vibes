---
name: vibes
description: A dark room, seen from above. The map is the interface; the controls float over it on frosted glass.
colors:
  void: "#070708"
  glass: "rgb(24 23 21 / 0.6)"
  glass-strong: "rgb(22 21 20 / 0.9)"
  solid: "#161514"
  solid-2: "#1f1e1c"
  edge: "rgb(255 250 240 / 0.09)"
  line: "rgb(255 250 240 / 0.07)"
  line-2: "rgb(255 250 240 / 0.13)"
  fill: "rgb(255 250 240 / 0.045)"
  fill-2: "rgb(255 250 240 / 0.085)"
  fill-3: "rgb(255 250 240 / 0.14)"
  well: "rgb(0 0 0 / 0.26)"
  ink: "#f5f1ea"
  ink-2: "rgb(245 241 234 / 0.74)"
  mute: "rgb(245 241 234 / 0.52)"
  faint: "rgb(245 241 234 / 0.3)"
  on-ink: "#141311"
  bad: "#ff7d6b"
  warn: "#f5c066"
  sim: "#ff9fa8"
  focus: "#8fb9ff"
  focus-ink: "#0b1424"
  plan-line: "#302e2b"
  plan-text: "#57534e"
typography:
  display:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(72px, 13vw, 128px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.05em"
  headline:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 550
    lineHeight: 1.5
  hint:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Space Mono, ui-monospace, Menlo, monospace"
    fontSize: "10.5px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.09em"
  mono:
    fontFamily: "Space Mono, ui-monospace, Menlo, monospace"
    fontWeight: 400
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\""
rounded:
  inner: "9px"
  control: "10px"
  well: "12px"
  panel: "18px"
  pill: "999px"
spacing:
  tight: "6px"
  snug: "8px"
  cozy: "10px"
  gap: "12px"
  panel-x: "18px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "#ffffff"
    textColor: "{colors.on-ink}"
  button-quiet:
    backgroundColor: "{colors.fill-2}"
    textColor: "{colors.ink-2}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "32px"
  button-quiet-hover:
    backgroundColor: "{colors.fill-3}"
    textColor: "{colors.ink}"
  icon-button:
    textColor: "{colors.mute}"
    rounded: "{rounded.inner}"
    size: "30px"
  icon-button-hover:
    backgroundColor: "{colors.fill-2}"
    textColor: "{colors.ink}"
  button-save-lit:
    backgroundColor: "{colors.sim}"
    textColor: "#2a0d11"
    rounded: "{rounded.control}"
  chip:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "28px"
  chip-hover:
    backgroundColor: "{colors.fill-2}"
  chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
  chip-glass:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "34px"
  segmented:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.well}"
    padding: "3px"
  segmented-option:
    textColor: "{colors.mute}"
    typography: "{typography.control}"
    rounded: "{rounded.inner}"
    padding: "0 14px"
    height: "28px"
  segmented-thumb:
    backgroundColor: "{colors.fill-3}"
    rounded: "{rounded.inner}"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  switch:
    backgroundColor: "{colors.fill-3}"
    rounded: "{rounded.pill}"
    width: "36px"
    height: "22px"
  switch-on:
    backgroundColor: "{colors.ink}"
  menu-panel:
    backgroundColor: "{colors.solid-2}"
    rounded: "14px"
    padding: "6px"
  menu-item:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.inner}"
    padding: "8px 10px"
  menu-item-hover:
    backgroundColor: "{colors.fill-2}"
    textColor: "{colors.ink}"
  tooltip:
    backgroundColor: "{colors.glass-strong}"
    textColor: "{colors.ink}"
    rounded: "11px"
    padding: "8px 11px"
  banner-info:
    backgroundColor: "rgb(30 29 27 / 0.8)"
    textColor: "{colors.ink-2}"
    padding: "8px 16px"
    height: "38px"
  banner-warn:
    backgroundColor: "rgb(60 47 22 / 0.8)"
    textColor: "{colors.ink-2}"
    padding: "8px 16px"
  banner-bad:
    backgroundColor: "rgb(66 26 22 / 0.8)"
    textColor: "{colors.ink-2}"
    padding: "8px 16px"
  sidebar:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    width: "360px"
---

# Design System: vibes

## Overview

**Creative North Star: "A dark room, seen from above"**

vibes draws the room from above, each light a glow in the color it's making, and the map is always the whole window, at every size. Everything else floats over it, as on Google Maps: banners along the top, tag chips and the account under them, floors and zoom bottom right, glass sidebars along the left and right edges. The controls sit on frosted glass so the room's own light glows through them.

The only color on screen should be the lights. The interface stays in warm neutrals (off-white ink at a few strengths over near-black) and gets out of their way. The few hues the UI does use are signals with one job each: red for something wrong or live, amber for a warning or admin mode, pink for unsaved edits, blue for a layer in focus. Nothing shows while all is well; degraded states are banners across the top.

It is dark only. `color-scheme: dark` is set on `:root` and there is no light theme. Density is high and the type is small (13.5px body, 12.5px controls), in the manner of a tool used up close rather than a page read from across the room.

**Key Characteristics:**
- The map fills the window; all chrome floats over it and the map keeps clear of it through `--inset-*` properties it reads back.
- Frosted glass (`blur(22px) saturate(1.5)`) over anything floating on the map; solid warm greys for menus and pages off the map.
- Warm off-white ink at four alpha steps; warm-white fills and hairlines at three.
- Hue is reserved for the lights and four single-purpose signals.
- Small, dense type: Hanken Grotesk for words, Space Mono for numbers and captions.
- Corners nest: an inner curve is the outer one minus the padding between them.

## Colors

Warm near-black and warm off-white, with four signal hues and nothing decorative.

### Primary
- **Lamp Ink** (`ink`): the one strong neutral. Body text, titles, and the fill of anything that's on: the primary button, a chosen chip, a switch. Pure white (`#fff`) appears only as its hover.

### Secondary
- **Unsaved Pink** (`sim`): pending edits, the simulated preview. The unsaved asterisk beside a title, the lit save button (with a glow built from `--sim-glow`, `255 159 168`), the previewing badge on a layer.
- **Focus Blue** (`focus`, dark text `focus-ink`): a layer's lights alone in focus, or its domain being edited. Fills the Focus and Edit buttons while on, lights the active layer's name with a soft text glow, and rings the map's window with an inset glow and vignette. It is cool on purpose, so it never reads as a light. It is not the keyboard focus ring (see Components).

### Tertiary
- **Ember Red** (`bad`): errors and live mode. Error text, the bad and live banners, a failed save, a menu item that deletes (on hover only).
- **Lamp Amber** (`warn`): warnings and admin mode. The warn and admin banners, the edit-lights tool on hover, late latency, editor changes not yet on main.

### Neutral
- **Void** (`void`): the page and map ground behind everything.
- **Smoked Glass** (`glass`, 60%) and **Dense Glass** (`glass-strong`, 90%): floating surfaces over the map. Glass for sidebars, toolbars, zoom; dense glass for the account avatar, tooltips, the look card, dialogs.
- **Solid** (`solid`) and **Solid Raised** (`solid-2`): opaque surfaces off the map. Sketch pages' bar, menu panels, card menus.
- **Warm Hairlines** (`edge`, `line`, `line-2`): 1px rings and dividers in warm white at 9%, 7% and 13%. `edge` rims glass; `line` divides rows; `line-2` rims menus and inputs.
- **Warm Fills** (`fill`, `fill-2`, `fill-3`): 4.5%, 8.5% and 14% warm white for resting, hovered and raised controls.
- **Well** (`well`): 26% black, recessed tracks and inputs.
- **Ink steps** (`ink-2` 74%, `mute` 52%, `faint` 30%): secondary text, captions and resting icons, disabled and placeholder text.
- **On Ink** (`on-ink`): text and knobs on an ink fill.
- **Plan Line / Plan Text** (`plan-line`, `plan-text`): the floor plan's strokes and labels, drawn quietly under the lights.

### Named Rules
**The Only-the-Lights Rule.** The only color on screen should be the lights. Interface surfaces, text and borders stay in the warm neutrals; a hue appears only when it signals something.

**The One Job Rule.** Each signal hue means one thing: red wrong or live, amber warning or admin, pink unsaved, blue focus. Don't borrow one for decoration or for a different meaning.

**The Warm White Rule.** Translucent whites are warm (`255 250 240`), never pure grey, so fills and hairlines sit in the same light as the ink.

## Typography

**Display Font:** Hanken Grotesk Variable (with ui-sans-serif, system-ui)
**Body Font:** Hanken Grotesk Variable
**Label/Mono Font:** Space Mono (with ui-monospace, Menlo), 400 and 700 only

**Character:** A compact grotesk carries everything that's words, using the variable axis for in-between weights (550, 650, 750). Space Mono carries numbers, counts and small uppercase captions, with tabular figures so values don't jitter.

### Hierarchy
- **Display** (800, clamp(72px, 13vw, 128px), 1): the wordmark on the login page only, with a warm text glow.
- **Headline** (750, 21px, 1.2, -0.03em): a sidebar's title ("Layers", "No lights selected").
- **Title** (800, 17px, 1, -0.035em): the wordmark in bars.
- **Body** (400, 13.5px, 1.5): the default for everything.
- **Control** (550, 12.5px): buttons, chips, segmented options, banners. Primary buttons and emphasis go to 650.
- **Hint** (400, 12px, 1.5): hints, error text, tooltips.
- **Label** (400, 10.5px, 0.09em, uppercase, Space Mono): captions over a group of controls ("DOMAIN"), in `mute`.
- **Mono** (400, Space Mono, tabular): counts, values, scale bar, floor numbers.

### Named Rules
**The Two Weights Rule.** Space Mono comes in 400 and 700 only: mono text keeps to those. In-between weights are for Hanken Grotesk.

## Layout

The map is the base of everything and always the whole window (`100dvh`, overflow hidden). On a wide screen two glass sidebars stand over its edges, top to bottom: layers on the left (300px) and the selection on the right (360px), each with a 1px `edge` hairline toward the map. Above the map, the HUD row (banners, then chips and avatars) and below it the show dock; floors and zoom are a stack bottom right. The map reads `--inset-top/right/bottom/left` (registered as `<length>` so they compute to pixels) and keeps what it fits clear of whatever floats over each side.

Banners take their own row above everything, full width, centered text.

Spacing is tight and literal. `--gap` (12px) is the one token: the margin between floating chrome and the window edge or a sidebar. Inside components, 6px, 8px and 10px are the common gaps; sidebar content is inset 18px.

**Narrow (max-width: 800px, matching `narrow.ts`):** the left sidebar goes away, the map gets its whole width, and the selection becomes a sheet up from the bottom (20px top corners) that rests at one of three heights. `pointer: coarse` grows hit areas (tracks to 44px to touch) without changing the mouse layout. `prefers-reduced-motion` turns animation off.

### Named Rules
**The Map Is the Interface Rule.** Nothing pushes the map aside or shrinks it. New controls float over it, and the map is told to keep clear through an inset rather than resized.

## Elevation & Depth

Depth comes from translucency first and shadow second. Floating chrome is glass: a 60% or 90% warm-dark fill with `blur(22px) saturate(1.5)` behind it, rimmed by an inset 1px `edge` ring and a faint inset top highlight, lifted by one large soft shadow. Off the map, surfaces are opaque greys (`solid`, `solid-2`) with a `line-2` ring. Recessed things (tracks, inputs) sit in a 26% black well. Signals glow rather than lift: banner dots, the lit save button, the focus ring round the map's window.

### Shadow Vocabulary
- **Float** (`--float`, `0 18px 48px rgb(0 0 0 / 0.42)`): every glass surface over the map.
- **Glass rim** (`inset 0 0 0 1px var(--edge), inset 0 1px 0 rgb(255 255 255 / 0.03)`): paired with float on glass.
- **Chip lift** (`0 2px 8px rgb(0 0 0 / 0.35)`): small glass pills in the HUD (tag chips, avatars).
- **Menu drop** (`inset 0 0 0 1px var(--line-2), 0 20px 50px rgb(0 0 0 / 0.55)`): menus and card menus on solid ground.
- **Signal glow** (`0 0 12px` at 45% plus `0 0 2px` at 60% of the signal color): the lit save button, the layer-mode icon. On hover it grows to 18px/60% and 3px/80%.

### Named Rules
**The Glass Over the Map Rule.** Anything floating over the map is glass, so the room's light shows through it. Solid surfaces are for things off the map or on a panel's own ground.

## Shapes

Soft, rounded rectangles for controls and full pills for chips and switches; nothing sharp except the sidebars and banners, which run edge to edge. Corners nest: a control inside a track is the track's radius minus the padding between them (a 12px segmented track with 3px padding holds 9px options; the show dock's pills and corners are each the curve inside plus the space between). The main steps are 9px for inner controls and menu items, 10px for buttons and inputs, 12px for tracks and small floating groups, 18px (`--radius`) for dialogs and drawer sheets, and 999px for pills. Round things (knobs, dots, avatars) are 50%.

Hairlines are 1px rings drawn with `box-shadow: inset 0 0 0 1px`, not borders, so they don't change size.

### Named Rules
**The Nested Corners Rule.** An inner radius is the outer radius minus the gap between them, so curves run alongside each other.

## Components

### Buttons
Quiet by default; the strongest thing a button can do is turn ink-white.
- **Shape:** gently rounded (10px), 32px tall.
- **Quiet (unclassed buttons and `.quiet`):** `fill-2` with `ink-2` text, weight 550, 14px side padding. Hover goes to `fill-3` and `ink`.
- **Primary:** an `ink` fill with `on-ink` text, weight 650; hover goes to pure white, press scales to 0.98.
- **Icon button:** 30px square, 9px corners, `mute` icon on nothing; hover fills `fill-2` and lights the icon to `ink`.
- **Save (lit):** the `sim` pink fill with dark text and a pink signal glow; it pulses while saving and turns `bad` red if the save failed.
- **Disabled:** 40% opacity.
- **Transitions:** background and color over 0.15s.

### Chips
- **Style:** a full pill, 28px tall, `fill` with a `line` ring and `ink-2` text at 12.5px/500. Over the map they become glass (34px, chip lift) and scroll sideways with the row's end faded out.
- **State:** on is an `ink` fill with `on-ink` text and no ring; clicking an on chip lets it go. A count rides inside in mono `mute`.

### Segmented controls
- A recessed `well` track (12px, 3px padding, `line` ring) of equal-width options; unselected options have no fill of their own. A raised `fill-3` thumb (9px, small drop shadow and top highlight) slides to the chosen one over 0.24s. Option text is `mute`, `ink` when chosen or hovered. The floor switch is the glass variant of the same control.

### Sliders and switches
- **Slider:** a 10px pill track (its background set by the field) with a 1px inner ring, and a 20px white thumb with a dark ring and drop shadow. Mixed values show as a white-outlined band between two 16px knobs. End labels in 11px `faint`.
- **Switch:** 36 by 22px pill in `fill-3` with a 16px `ink` knob; on fills `ink` and the knob turns `on-ink`, sliding with `--ease-out`. Mixed puts the knob halfway.

### Inputs / Fields
- **Style:** `well` fill, 1px `line-2` border, 10px corners, 7px 12px padding.
- **Focus:** the border brightens to `mute`; no outline.
- Fields put the name (a mono label) and the current value (mono, `ink`) on one line over the control.

### Menus and popovers
- **Menu panel:** `solid-2`, 14px corners, 6px padding, the menu drop shadow, at least 270px wide; pops in from 4px away at 0.98 scale over 0.16s, from below when the button sits along the bottom.
- **Items:** 9px corners, `ink-2` text, hover `fill-2` and `ink`. Destructive items stay neutral until pointed at, then turn `bad` on a dark red tint.
- **Card menu:** the same idea as a native popover, slightly tighter (12px corners, 5px padding, 32px items).

### Tooltips
- Dense glass, 11px corners, 8px 11px padding, 12px text; a title line and a value in `ink-2` at 11.5px. Never takes the pointer.

### Banners
- Full-width rows across the top of the whole site, at least 38px, centered 12.5px text in `ink-2` with the cause in bold in the signal color, behind a 7px dot. Tinted dark glass per kind with a 1px bottom line in its color: bad (red), warn (amber), info (neutral), live (red, steady dot), admin (amber, steady dot). The bad and warn dots glow and breathe; the mode dots stay steady, since nothing's wrong.

### Sidebars
- Full-height glass columns, edge to edge, with a 1px `edge` hairline toward the map. A head with a 21px/750 title and its actions, then a body whose blocks meet edge to edge, each with its own padding and a `line` under it. On a phone the right one is a bottom sheet.

### Focus
- Keyboard focus is a 2px warm white ring (`rgb(255 250 242 / 0.7)`) 2px out, 6px corners, everywhere. Focus blue is a mode color, not this ring.

### Map window in layer mode
- While a layer is in focus or its domain is edited, the map's window (between the sidebars) gets a 1.5px inset ring in `focus` at 70%, two soft inset blue glows, and a 1% blue wash; the HUD shows a pill saying whose.

## Do's and Don'ts

### Do:
- **Do** keep the map the whole window and float new controls over it, telling the map to keep clear through `--inset-*`.
- **Do** put anything floating over the map on glass: `--glass` or `--glass-strong`, `--blur`, the glass rim and `--float`.
- **Do** use the warm neutral tokens (`ink` steps, `fill` steps, `line` steps) for everything that isn't a signal.
- **Do** report degraded states as a banner across the top, and show nothing while all is well.
- **Do** use `sim` pink for anything about unsaved or simulated changes, and `focus` blue for a layer in focus or being edited.
- **Do** keep mono text at 400 or 700, and use Space Mono for numbers and uppercase captions.
- **Do** nest corners: inner radius equals outer radius minus the padding.
- **Do** ease movement with `--ease-out` (`cubic-bezier(0.22, 0.8, 0.24, 1)`), 0.15s for color and 0.2 to 0.36s for things that move.

### Don't:
- **Don't** add color to the interface for its own sake: the only color on screen should be the lights.
- **Don't** give a signal hue a second meaning (no blue links, no pink highlights, no amber decoration).
- **Don't** use pure grey or pure white translucents for fills and hairlines; they're warm white.
- **Don't** add a light theme or light surfaces; vibes is dark only.
- **Don't** resize or push the map to make room for a control.
- **Don't** use the focus blue as the keyboard focus ring.
