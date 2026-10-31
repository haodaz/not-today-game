# backend — tasks

- [x] T1. Migration `supabase/migrations/0001_init.sql` (tables, RLS), `supabase/config.toml`.
- [x] T2. Pure shared modules `supabase/functions/_shared/kuro/` (types, turns, prompt, judgement, llm, handler).
- [x] T3. `scripts/bundle-kuro-content.ts` + `npm run bundle:kuro` → `supabase/functions/kuro-chat/content.ts` (not generated here: run it before deploying).
- [x] T4. The function `supabase/functions/kuro-chat/index.ts` (Deno; thin wiring around `handler.ts`).
- [x] T5. Client `src/net/supabase.ts` (lazy supabase-js, anonymous sign-in on 开始, invoke with timeout), `src/net/sync.ts`; push on lie-down / every 20 events; pull on 继续; no-op without env.
- [x] T6. Tests (tests/backend.test.ts) with a mocked model; kiro-log with the secrets and the SQL path.
- [x] 绑定邮箱 in the settings panel (game and title): row model, markup, `net.bindEmail` (updateUser for the anonymous session, signInWithOtp without one), mocked-client tests (`tests/email.test.ts`).
- [x] 绑定邮箱: `auth.onAuthStateChange` listener (once per client). Opening the link binds the email and re-renders the row in the game and on the title page (`onEmailChange`).
