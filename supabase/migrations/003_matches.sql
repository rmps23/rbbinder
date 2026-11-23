-- Match history (RiftAtlas replays). Run once in the Supabase SQL editor.
-- Only adds a table; safe to run more than once.

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  replay_id text not null,
  -- the deck of yours that was played; the list itself is kept in the summary
  deck_id uuid references public.decks(id) on delete set null,
  played_at timestamptz not null,
  summary jsonb not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- A replay counts once per user, however often it's imported.
create unique index if not exists matches_user_replay_key on public.matches (user_id, replay_id);
create index if not exists matches_user_played_idx on public.matches (user_id, played_at desc);

-- No policies: only the server (service role) reads and writes, like the other tables.
alter table public.matches enable row level security;
