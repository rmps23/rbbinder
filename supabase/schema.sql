-- Run this once in the Supabase SQL editor for your project.
-- Replaces the old single-binder "collection" table with:
--   - cards/sets: the card catalog, populated by the "Sincronizar cartas"
--     button on the dashboard (POST /api/cards/sync) instead of a local file.
--   - binders: user-named binders (e.g. "Coleção principal", "Trade binder").
--   - binder_cards: how many copies of each card live in each binder.
--   - bulk: repeated cards available for trade, separate from any binder.
--
-- If you already ran the previous version of this file, drop the old table
-- first: `drop table if exists public.collection;`

create table if not exists public.cards (
  id text primary key,
  set_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.sets (
  id text primary key,
  name text not null,
  card_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.binders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  layout text not null default '3x3',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.binder_cards (
  binder_id uuid not null references public.binders(id) on delete cascade,
  card_id text not null references public.cards(id) on delete cascade,
  qty integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (binder_id, card_id)
);

create table if not exists public.bulk (
  card_id text primary key references public.cards(id) on delete cascade,
  qty integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Row Level Security is enabled with no policies: only the server-side
-- service role key (used in the Next.js API routes) can read/write these
-- tables. The browser never talks to Supabase directly.
alter table public.cards enable row level security;
alter table public.sets enable row level security;
alter table public.binders enable row level security;
alter table public.binder_cards enable row level security;
alter table public.bulk enable row level security;
