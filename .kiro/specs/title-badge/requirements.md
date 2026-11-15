# The staff badge (author 2026-11-15): the account as the menu's last card

Today the signed-in account is a chip at the top right of the title page (`accountChip` in
`src/ui/title/view.ts`: the email + 退出登录, or 游客身份 + 注册 / 登录). The author: 「用户登录以后的信息
能不能不放在右上角。在菜单最后加一个卡：用户账号，左边默认配一个主角的 look，就像一个工牌。点进去以后可以
log out，换头像。」 So: the chip goes; the menu's last entry is a **staff badge** (工牌) — portrait on the
left, the name beside it — and clicking it opens the badge large, where the player can change the
look and log out.

Strings (Claude, already in `content/strings/{zh,en}.json`): `badge.company` (未来智能),
`badge.role` (技术 · 居家办公), `badge.guest` (游客), `badge.open` (aria label: 工牌), `badge.look`
(换一个形象); existing: `auth.logout`, `auth.upgrade`, `auth.signedAs` ({email}), `auth.guestHint`,
`title.back`. A missing string is a question, never invented.

## 1. The badge in the menu (`view.ts` `menu()`, `title.css`)

- After 制作, the menu's last item: `<button class="title-badge" data-action="badge-open"
  aria-label="badge.open">`. It is the same 260 px width as the menu's words but drawn as a
  badge, not an outlined word: a paper-cream card (the settings panel's paper), a thin rule, the
  **portrait at the left** (56 px square, the player picture `/player/<PORTRAIT_FILES[look]>.png`,
  `object-fit: cover`, rounded 4 px), and at the right two lines: the **name** (a user: the email's
  part before `@`; a guest: `badge.guest`) in the menu's letter-spacing, and under it
  `badge.company` small. A short lanyard loop drawn above the card in CSS (two 2 px lines meeting
  at a ring) so it reads as a badge hanging — no image file.
- Hover / focus: the card lifts 2 px (shadow), no inversion.
- Shown only when `m.account` is `user` or `guest` (the states the chip showed), on the menu screen.
  The chip at the top right (`accountChip`, `.title-account`) is removed with its CSS.

## 2. The badge open (`view.ts`, a new `badgeCard(m)`)

A `title-card` like the question card (`role="dialog"`, Esc / click outside / 返回 close it):

- Left: the portrait large (the question card's `.title-pick .big` size), with ‹ › under it
  (`data-action="badge-turn" data-by="-1|1"`) cycling the three portraits in `PORTRAITS` order, the
  label `title.pick.n` under them as the question card does. Every turn **writes the look at once**
  (below) — no 保存 button.
- Right, top to bottom: the name large, `badge.company` · `badge.role` on one line, then for a user
  `auth.signedAs` with the email; for a guest `auth.guestHint`.
- Bottom: a user gets `auth.logout` (`data-action="auth-logout"`, the existing handler: the card
  closes with it since the account becomes `none`); a guest gets `auth.upgrade`
  (`data-action="auth-upgrade"`, existing). And `title.back` (`data-action="badge-close"`).
- Model: `TitleModel.badgeOpen: boolean` (initial false); `badge-open` / `badge-close` actions;
  `screen` stays `"menu"` (the menu is behind the card, `inert` while it is open, as the question
  card does). `toMenu` closes it.

## 3. The look (`model.ts`, `mount.ts`, `src/main.ts`)

- `TitleModel.look: Portrait` (initial `"p1"`). The title reads it on mount from a new dep
  `look?: { readonly read: () => Portrait | null; readonly write: (p: Portrait) => void }` — the
  same shape as `kuroMemory`. `badge-turn` sets `model.look` and calls `write`.
- `main.ts` wires it to the profile like the Kurogotchi memory: read `readProfile(storage)?.look`
  (a string in `PORTRAITS`, else null) through a new `readLook` in `src/ui/collection.ts`; write
  through `profile.writeLook(p)` — add it to the profile writer beside `writeKurogotchi` (the key
  `look` in the profile data; `mergeProfile` in `src/ui/profile-sync.ts` keeps the cloud's when both
  are set, else whichever exists).
- **The look is the default for a new run**: the question card's portrait pick starts from
  `m.look` instead of `"p1"` (`NO_ANSWERS.portrait` stays the type's default; `initialTitle` or the
  mount sets `answers.portrait = look` when the card opens). Changing it on the question card does
  not write back — that pick is this run's; the badge is the profile's.
- No picture asset is new: the three `/player/*.png` are the looks.

## Tests (`tests/title.test.ts`, `tests/title-auth.test.ts`)

- The menu ends with the badge for a user (name = the email's local part) and for a guest
  (`badge.guest`); no badge for `none` / `checking` / `offline` / `gate`; no `.title-account` anywhere.
- `badge-open` prints the card; `badge-turn` cycles `look` and calls `write` with it; Esc and
  `badge-close` close it; `auth-logout` closes it (account `none`, gate rules unchanged).
- The question card's portrait starts from the stored look.
- `readLook` / `mergeProfile` with `look`.
- Snapshots carrying the menu refresh (markup-only); say so in the log.

## Not in this spec
New portraits (the three are the set); the gate card; the settings panel.
