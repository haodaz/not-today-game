# backend — requirements (Supabase)

Why a backend at all: Kuro's online chat needs an LLM key, and a key can never ship in the browser. Once a backend exists, it also keeps the player's run, Kuro's memory and the judgement log. Author decision 2026-11-01. The game must stay fully playable with no network (offline scripted Kuro, local saves).

## FR1. Identity without a sign-up page
- Supabase **anonymous sign-in** on first 开始; the player never sees a form. Optional "绑定邮箱" in the menu sends a magic link and upgrades the anonymous user; nothing else changes.
- Title-page variables (`names`) are stored in `profiles` and in the local `nt_profile`; local wins when offline.

## FR2. Tables (RLS: a user reads/writes only their own rows)
- `profiles(id, email?, names jsonb, created_at)`
- `runs(id, user_id, version int, events jsonb, day int, san int, ended text?, updated_at)` — the same shape as the local `nt_run`; local is the source of truth, cloud is a mirror written at every lie-down and every 20 events.
- `kuro_memory(run_id, turns jsonb, summary text, updated_at)`
- `judgement(run_id, day, truth, values, bond, evidence jsonb, delta int)` — one row per day; the credits read this in day order.
- Never store the login inputs as prompt material; `names` reach prompts only through the name variable, as voices.md says.

## FR3. Edge function `kuro-chat`
- Kuro has exactly three private sources, assembled per call in this order: (1) self: `content/kuro-profile.md` + the day's `kuro-days/day-NN.md` stance and idiom; (2) the player's background: `content/kuro-world.md` plus the slice of the event log the day's gate allows (see that file's "by day" section); (3) memory: `kuro_memory` turns + summary. Nothing else enters the prompt. The login inputs never do.
- Input: `{run_id, day, text}`. Server loads memory, the day's stance (`content/kuro-days/day-NN.md` bundled with the function), the allowed tools, the rubric; calls the LLM (provider and key in function secrets); returns `{reply, judgement?}`.
- Counts turns per run per day server-side: the sixth call returns the constant bedtime line and `turnsLeft: 0`.
- Writes memory and judgement rows; returns the reply raw. The decay filter runs on the client (pure, snapshot-tested).
- Timeout 20 s; on any error the client falls back to the offline scripted answer and marks the turn as offline in the log (so Kuro never "breaks").

## FR4. Client
- `src/net/supabase.ts` with env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; if missing, every call is a no-op and the game runs offline.
- Sync: push on lie-down and every 20 events; pull on boot if cloud is newer (by `updated_at` and version); conflicts: keep local, store cloud as `runs.conflict_of`.

## FR5. Tests
- Unit: sync decision table (local newer / cloud newer / same / offline). Edge function: turn counting and bedtime at the sixth call, with a mocked LLM.
