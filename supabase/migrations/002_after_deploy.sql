-- Run AFTER the multi-user code is deployed and the admin has signed in once
-- (so every old row has an owner). Lets several users own the same card in bulk.

-- Anything still without an owner can't be reached by anyone: check first.
--   select count(*) from public.bulk where user_id is null;
--   select count(*) from public.binders where user_id is null;
--   select count(*) from public.decks where user_id is null;

do $$
begin
  if exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.bulk'::regclass and c.contype = 'p' and a.attname = 'card_id'
  ) then
    alter table public.bulk drop constraint bulk_pkey;
    alter table public.bulk add constraint bulk_pkey primary key (id);
  end if;
end $$;
