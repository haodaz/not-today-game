-- NOT TODAY — backend spec FR2. Four tables; Row Level Security: a user reads and writes only
-- their own rows. The local save (nt_run) is the source of truth; `runs` is its mirror.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  -- The title page's answers, as the run's `names` event has them. Never prompt material:
  -- they reach Kuro only as the {login} token the client fills in.
  names jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.runs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  version int not null,
  events jsonb not null default '[]'::jsonb,
  day int not null default 1,
  san int,
  ended text,
  -- backend FR4: on a conflict the local run wins; the cloud copy it replaced is kept here.
  conflict_of jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists runs_user_id on public.runs (user_id);

create table if not exists public.kuro_memory (
  run_id uuid primary key references public.runs (id) on delete cascade,
  -- [{day, who: "player" | "kuro", text, offline?}], the last 24 entries.
  turns jsonb not null default '[]'::jsonb,
  summary text not null default '' check (char_length(summary) <= 600),
  updated_at timestamptz not null default now()
);

create table if not exists public.judgement (
  run_id uuid not null references public.runs (id) on delete cascade,
  day int not null check (day >= 1),
  truth int not null check (truth between -2 and 2),
  "values" int not null check ("values" between -2 and 2),
  bond int not null check (bond between -2 and 2),
  -- [{eventId, note}], every eventId an `ev<index>` of the run's log.
  evidence jsonb not null default '[]'::jsonb,
  -- The affinity change the client folded for this day.
  delta int,
  primary key (run_id, day)
);

alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.kuro_memory enable row level security;
alter table public.judgement enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "own runs" on public.runs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own run's memory" on public.kuro_memory
  for all
  using (exists (select 1 from public.runs r where r.id = run_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.runs r where r.id = run_id and r.user_id = auth.uid()));

create policy "own run's judgement" on public.judgement
  for all
  using (exists (select 1 from public.runs r where r.id = run_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.runs r where r.id = run_id and r.user_id = auth.uid()));
