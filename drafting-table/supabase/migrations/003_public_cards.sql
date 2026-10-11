-- Migration 003 — public cards and the guest view.
-- Run once in your Supabase project's SQL editor. Safe to re-run.
--
-- Signed-out visitors can read cards an admin has marked public, and nothing
-- else: decks and deck_cards keep their authenticated-only policies, so a
-- guest's decks only ever live in their browser tab.

alter table cards add column if not exists is_public boolean not null default false;

-- Who may mark cards public. Rows are added by hand here in the SQL editor -
-- there is deliberately no insert policy, so nobody can promote themselves.
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table admins enable row level security;
drop policy if exists "read own admin row" on admins;
create policy "read own admin row" on admins for select using (user_id = auth.uid());

-- To make yourself an admin, find your id under Authentication > Users and run:
-- insert into admins (user_id) values ('<your-user-id>') on conflict do nothing;

-- A back face carries no flag of its own; it's public when its front is. The
-- lookup runs as the function owner so the policy below doesn't recurse into
-- the cards policies.
create or replace function card_is_public(card_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_public from cards where id = card_id), false);
$$;

drop policy if exists "anon read public cards" on cards;
create policy "anon read public cards" on cards for select to anon
  using (is_public or (not is_front and card_is_public(linked_card_id)));

-- Non-admins can still edit public cards, but can never change the flag itself.
create or replace function guard_card_is_public() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    if tg_op = 'INSERT' then
      new.is_public := false;
    else
      new.is_public := old.is_public;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cards_guard_is_public on cards;
create trigger cards_guard_is_public before insert or update on cards
  for each row execute function guard_card_is_public();

create index if not exists idx_cards_is_public on cards(is_public) where is_public;
