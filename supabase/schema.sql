-- Safe to run in the Supabase SQL editor at any point - whether this is the
-- first time (creates everything fresh) or you already ran an older version
-- of this file (upgrades the tables in place, in order):
--   1. cards/sets: the card catalog, populated by the "Sync cards" button
--      on the dashboard (POST /api/cards/sync) instead of a local file.
--   2. binders: user-named binders (e.g. "Main collection", "Trade binder").
--   3. binder_cards: which card (if any) sits in each page slot/pocket of a
--      binder, like a real album - identified by a flat slot position.
--   4. bulk: repeated cards available for trade (normal/foil), separate
--      from any binder.

create extension if not exists pgcrypto;

-- Drop the very first, pre-binders single-table model, if it's still around.
drop table if exists public.collection;

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
  page_count integer not null default 2,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.binders add column if not exists page_count integer not null default 2;

-- binder_cards used to be keyed by card_id (one row per card per binder,
-- with a qty). It's now keyed by a flat slot position instead, so the same
-- card can occupy several slots. An old table in that shape has no
-- `position` column - drop it and start clean (nothing meaningful to
-- migrate: positions didn't exist yet).
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'binder_cards'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'binder_cards' and column_name = 'position'
  ) then
    drop table public.binder_cards;
  end if;
end $$;

create table if not exists public.binder_cards (
  binder_id uuid not null references public.binders(id) on delete cascade,
  position integer not null,
  card_id text not null references public.cards(id) on delete cascade,
  qty integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (binder_id, position)
);

-- bulk used to track a single `qty` column; it's now split into
-- normal_qty/foil_qty. Rename the old column instead of losing its data.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bulk' and column_name = 'qty'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bulk' and column_name = 'normal_qty'
  ) then
    alter table public.bulk rename column qty to normal_qty;
  end if;
end $$;

create table if not exists public.bulk (
  card_id text primary key references public.cards(id) on delete cascade,
  normal_qty integer not null default 0,
  foil_qty integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.bulk add column if not exists normal_qty integer not null default 0;
alter table public.bulk add column if not exists foil_qty integer not null default 0;

-- Row Level Security is enabled with no policies: only the server-side
-- service role key (used in the Next.js API routes) can read/write these
-- tables. The browser never talks to Supabase directly.
alter table public.cards enable row level security;
alter table public.sets enable row level security;
alter table public.binders enable row level security;
alter table public.binder_cards enable row level security;
alter table public.bulk enable row level security;
