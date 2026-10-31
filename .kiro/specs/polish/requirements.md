# polish — requirements

Source: `design/hud/motion.md` (author 2026-11-01) and the mocks `design/hud/held.html`,
`held-object.html` and `door.html`. This spec adds feel, not features. Game state, events and
content do not change.

## FR0. Rules
- Nothing pops. Every element comes from its place on screen and goes back to it.
- Durations and the easing are exactly those in motion.md: ease-out `cubic-bezier(.2,.8,.2,1)`;
  an exit is 30% faster than its entry unless motion.md gives the exit its own duration.
  Values motion.md does not give are listed once, in code, as chosen values (design P2).
- Motion survives re-renders. The DOM is rebuilt on every change, so an animation that is under
  way continues where it was, and nothing replays because of an unrelated change.
- No new features. Snapshot tests may change only for added classes (exception and reason: design P9).

## FR1. Phone and objects (held.html, held-object.html)
- Clicking the phone or an object on the desk bar dims the room to 55% (200ms). The item rises
  from its slot to the centre, tilted 3° (320ms), and its slot is empty while it's held.
- Phone: the screen flashes white once (120ms), then shows the delivery app inside the phone body.
- Object: its shell is centred and its own screen is a `<canvas>` at the channel's resolution,
  scaled by an integer factor, `image-rendering: pixelated`. An upgraded object's screen is
  smooth.
- Clicking outside the item (or pressing Esc) puts it down: it shrinks back into its slot along
  the same path and the room brightens again (220ms).

## FR2. Door (door.html)
- The six steps are listed faintly at top right. Only the current step is lit.
- Each click anywhere on the door scene moves exactly one step. Each step's text fades up into
  place.
- At `chainOpen` and `holding` the chain-door image fades in. While holding, only a shadow
  rises at the bottom; no hand is drawn.
- The sixth step (the bag on the desk corner) is shown. Today it's skipped (wart W1).

## FR3. Dialogue
- The box fades in (160ms) when it appears and fades out when it goes.
- Each line appears one character at a time, 18ms per character. Inner-voice lines are 1.5×
  slower. A line with a sound id plays the sound and starts its text 400ms later.
- A click (or Space / Enter) while a line is still revealing completes it. The next click
  advances.
- Choices: they fade in from bottom to top, 60ms apart, 160ms each, once the line above them
  is complete. The chosen one stays; the others fade out.
- The night's last line before lying down holds for 1.5s, then the day ends by itself.

## FR4. Checklist
- Ticking: the box fills (80ms), then a line strikes through. 400ms later the item folds up
  into 「已做 N 件」, and the count changes only then.
- A new item fades in and moves down 6px into place (240ms). An item with a sound enters 400ms
  after it (motion.md: the doorbell). The dialogue box it brings comes 300ms after that.
- Items written by someone else (`origin: "them"`) look exactly like the player's own. A test
  guards this.

## FR5. The rest of motion.md that exists today
- Room ↔ desktop: the room pushes in toward the monitor while the desktop grows from the
  monitor's place to full screen (400ms). Going back is the reverse.
- Left ↔ right monitor: a horizontal push (240ms). The other monitor's tab moves with it.
- Kuro's body: a 300ms crossfade between states, a 3s bob of ±3px, a 1.2s crawl. New lines in
  its small window come out of the body's corner. At night the small window glows on a 2s cycle.
  Bobbing and glowing don't restart on re-render.
- Shutdown: each monitor darkens (600ms), the right one 150ms before the left.
- Lying down: the room rises a little and goes black (800ms). The night's dialogue plays in the
  black. The next day fades in from white.

## Out of scope (named so they aren't forgotten)
- Object keys (1px press, the click sound), because objects have no keys yet (device-skeleton).
- Holding an object up to the gap at night (night-hand).
- The desk bar folding away at shutdown, leaving only the gap (night-hand: the gap isn't built yet).
- Kuro going busy → think before a small-window line (kuro-chat).
- The corridor light changing colour with the ring.
