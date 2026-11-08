-- profile sync (2026-11-09): the cross-run profile (endings reached, finished runs, objects and
-- photos first seen, the Kurogotchi's memory, hints seen) mirrors to the cloud so it follows the
-- account (anonymous, or bound to an email). Local is merged with the cloud copy on sign-in and
-- pushed after every change. RLS: the "own profile" policy already covers the row.
alter table public.profiles
  add column if not exists data jsonb not null default '{}'::jsonb,
  add column if not exists data_updated_at timestamptz;
