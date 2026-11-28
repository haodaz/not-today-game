# hichat-polish: four small things in Hi信 (the home chat app)

Author, 2026-11-28 (ledger #188–#198). Today Hi信 gained faces for everyone, Dad's own chat, the clients' project groups and 朋友圈 (Moments) with photographs. Four pieces of plumbing are left. They are independent: do them in order, commit after each if you like.

Scope for Kiro: card type, views, CSS, session state, tests. **No sentence is written by Kiro**: every string is given below, verbatim. Do not edit any other text in `content/` (the chat lines live in `script/tools/inject-*.mjs` and `script/tools/gen-feed.mjs`, which are Claude's; only the one change in R1 is yours).

Read first: `src/world/desktop/messages/cards.ts` (the card types and their markup), `src/state/replies/table.ts` (card parsing and the zh / en twin check, `cardShape`), `src/world/desktop/messages/view.ts` (`feedPost`, `wxRow`, the feed row), `src/world/desktop/messages/feed.ts`, `tests/feed.test.ts`, `tests/father-chat.test.ts`.

## R1 · A transfer card (Dad's 2,000)

Before: on days 1 and 10 Dad's chat (`father`) opens with a plain text bubble 「[转账] 2000 元」.
After: it is a transfer card, as in WeChat.

- New card type `transfer` in the reply tables: `{ "type": "transfer", "amount": "2000.00" }`. The loader accepts it and rejects any other key; `amount` is a string matching `^\d+\.\d{2}$`. The twin check compares type and amount.
- Markup (in the bubble, where other cards go): an orange card (`#f9a23b`), a white circle with two opposed arrows on the left, the amount `¥2000.00` in white, and one line under it; a thin footer line with the app's name.
- State by time, no player action: on the day it arrives the line under the amount is `card.transfer.pending`; when the transcript shows it from any **later** day, the card is paler (opacity about 0.6) and the line is `card.transfer.returned`. (The player never accepts it. Dad's next-day message already says the money came back.)
- Clicking the card does nothing (no action, no cursor change).
- The chat list preview for such a message is `card.transfer.preview` (the same way `[图片]` previews an image card).
- Strings (zh / en), add to `content/strings/`:
  - `card.transfer.pending`: 「转账给你」 / "Transfer to you"
  - `card.transfer.returned`: 「已被退还」 / "Returned"
  - `card.transfer.footer`: 「喂信转账」 / "Hichat Transfer"
  - `card.transfer.preview`: 「[转账]」 / "[Transfer]"
- Content (the one content change of this spec): in `script/tools/inject-father-chat.mjs`, the `TRANSFER` constant's first line gets the card on both languages (`card: { type: "transfer", amount: "2000.00" }` on the incoming item; keep its `text` as it is, it remains the fallback and the transcript's raw text), then run the script. Days 1 and 10 change in `content/replies/day-01.json`, `day-10.json` and their `en/` twins, nowhere else.

## R2 · A photograph opens large

Before: the photographs in 朋友圈 (`img.fp-photo`) and the image cards in chats (`img.c-image`) cannot be looked at closely.
After: a click on either opens it large over the app's window; a click anywhere, or Esc, closes it.

- Session only (`session.photoOpen: string | null`, the picture's `src`); nothing is logged; it closes when the app or the conversation changes.
- The overlay sits inside the Hi信 / 汀汀 window (not the whole screen): a dark veil (`rgba(0,0,0,.82)`), the picture centred, `max-width: 86%`, `max-height: 86%`, `object-fit: contain`. No caption, no buttons.
- An image card that has no `src` (the grey placeholder with its alt text) does not open.
- Keyboard: the pictures are focusable buttons; Enter opens, Esc closes and returns focus.
- Reduced motion: no fade.

## R3 · 朋友圈 shows a dot when there is something new

Before: the 朋友圈 row in Hi信's list never shows anything.
After: a small red dot (no number; the existing `.dot` look of `wx-row`, empty) on the row's icon when `feedAt(day, time, locale)` holds a post newer than the last time the column was open.

- Session only: `session.feedSeen: { day: number; t: string } | null`, set to the newest shown post's day and time whenever the column is rendered open. A post is new when its (day, t) is later than that; with `null`, any post of today is new.
- The dot does not count toward the Hi信 badge in the dock (the feed has no unread count; keep `badge` as it is).

## R4 · 「离开屏幕」 keeps its size

Seen 2026-11-28 in a short window (the app's Browser pane, about 800 × 497): the vertical 「离开屏幕」 pill at the left edge of the screen view, while it is the guided target, is drawn about twice its normal width and height and covers half of the chat list; at 800 × 600 it has its normal size. In English ("Leave the screen", vertical) it is worse.

- Find the cause (the guidance ring's scale, a `vh`/`vw` unit, or the stage's fit) and make the pill the same size relative to the stage at every window size, guided or not. The ring may pulse; the pill itself must not grow over the app's window.
- Add a test at the level the cause lives (a CSS-free unit test if it is computed, else a DOM test of the class / style that is applied).

## What must keep working

- `npm test` and `npx tsc --noEmit` green before each commit. Update snapshots only where the diff is exactly the new markup of these four items, and say so in the commit.
- The headless walk (`script/tools/auto-day-shoot.mjs`) needs no change: none of the four is on a required path.
- The zh / en twin checks of the reply tables and of `content/feed.json` stay strict.

## Not in this spec

- Any chat line, post, caption or name (Claude's).
- The pictures themselves (`public/npc/wx/`, `public/msgs/feed/`): do not regenerate or resize them.
- 换一件 (the coat by the door) and the code-built room.
