-- Multi-user accounts (Supabase Auth). Run once in the Supabase SQL editor,
-- BEFORE deploying the code that uses it. Safe to run more than once.
--
-- What it does:
--   * binders, bulk and decks get an owner (user_id -> auth.users).
--     binder_cards belong to their binder, so they need no column of their own.
--   * bulk is keyed by (user_id, card_id) instead of card_id alone, so every
--     user can have their own copy count of the same card.
--   * Existing rows keep user_id = null until the admin (ADMIN_EMAILS) signs
--     in for the first time: the app then gives them all to that account.
--   * cards, sets and app_data stay shared by everyone.
--
-- The old app keeps working after this runs: nothing here removes anything
-- the old code uses. Run 002_after_deploy.sql once the new code is live.

-- ---------- backup (kept until you drop them yourself) ----------
create table if not exists public.backup_binders_20261115 as table public.binders;
create table if not exists public.backup_binder_cards_20261115 as table public.binder_cards;
create table if not exists public.backup_bulk_20261115 as table public.bulk;
create table if not exists public.backup_decks_20261115 as table public.decks;
alter table public.backup_binders_20261115 enable row level security;
alter table public.backup_binder_cards_20261115 enable row level security;
alter table public.backup_bulk_20261115 enable row level security;
alter table public.backup_decks_20261115 enable row level security;

-- ---------- owners ----------
alter table public.binders add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.decks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.bulk add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists binders_user_idx on public.binders (user_id);
create index if not exists decks_user_idx on public.decks (user_id);

-- ---------- bulk: one row per (user, card) ----------
-- Upserts now match on (user_id, card_id). The old primary key on card_id
-- stays until 002 runs (after the deploy), so the old code keeps working.
alter table public.bulk add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists bulk_user_card_key on public.bulk (user_id, card_id);
