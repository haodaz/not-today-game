# backend — tasks

- [ ] T1. Migration `supabase/migrations/0001_init.sql` (tables, RLS), `supabase/config.toml`.
- [ ] T2. Pure shared modules `supabase/functions/_shared/kuro/` (turns, prompt, judgement, llm).
- [ ] T3. `scripts/bundle-kuro-content.ts` + `npm run bundle:kuro` → `supabase/functions/kuro-chat/content.ts`.
- [ ] T4. The function `supabase/functions/kuro-chat/index.ts` (Deno).
- [ ] T5. Client `src/net/supabase.ts` (lazy supabase-js, anonymous sign-in on 开始, invoke with timeout), `src/net/sync.ts`; push on lie-down / every 20 events; no-op without env.
- [ ] T6. Tests (FR5) with mocks; kiro-log with the secrets and the SQL path.
