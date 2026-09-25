-- Run this once in the Supabase SQL editor for your project.

create table if not exists public.collection (
  card_id text primary key,
  binder_qty integer not null default 0,
  bulk_qty integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Row Level Security is enabled with no policies: only the server-side
-- service role key (used in the Next.js API routes) can read/write this
-- table. The browser never talks to Supabase directly.
alter table public.collection enable row level security;
