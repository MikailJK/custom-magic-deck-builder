-- Run this once in your Supabase project's SQL editor (Database > SQL Editor > New query).
-- Sets up the tables, and Row Level Security policies that require a signed-in
-- user for any read or write. Sign-up itself is what gates who gets in — see
-- the README for how to invite-only your friend group instead of open sign-up.

create extension if not exists "pgcrypto";

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mana_cost text default '',
  cmc integer default 0,
  colors text[] default '{}',
  type text default 'Creature',
  subtype text default '',
  rarity text default 'Common',
  power text default '',
  toughness text default '',
  rules_text text default '',
  flavor_text text default '',
  tags text[] default '{}',
  image_url text,
  thumb_url text,
  added_by text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- A double-faced card is two rows cross-linked by linked_card_id; is_front
  -- decides which one shows up in the pool/search/deck-building.
  linked_card_id uuid references cards(id) on delete set null,
  is_front boolean not null default true,
  -- Shown to signed-out visitors. Only admins can change it (see the trigger below).
  is_public boolean not null default false
);

-- Who may mark cards public. Rows are added by hand in the SQL editor.
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists decks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  format text not null default 'Deck' check (format in ('Deck', 'Cube')),
  -- Ordered list of the deck's custom column names. Cards point at one by name;
  -- nothing about columns is written back to the shared card pool.
  categories text[] not null default '{}',
  target_size integer not null default 40,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists deck_cards (
  deck_id uuid not null references decks(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  qty integer not null default 1 check (qty > 0),
  board text not null default 'main' check (board in ('main', 'maybe')),
  category text,
  -- Board is part of the key so a card can sit on the deck and the maybeboard at once.
  primary key (deck_id, card_id, board)
);

alter table cards enable row level security;
alter table decks enable row level security;
alter table deck_cards enable row level security;

-- Any signed-in user (i.e. anyone with an account in this project) can read
-- and write everything. This is the "shared with my friend group" model —
-- the boundary is "has an account," not per-row ownership.
create policy "authenticated read cards" on cards for select using (auth.role() = 'authenticated');
create policy "authenticated write cards" on cards for insert with check (auth.role() = 'authenticated');
create policy "authenticated update cards" on cards for update using (auth.role() = 'authenticated');
create policy "authenticated delete cards" on cards for delete using (auth.role() = 'authenticated');

create policy "authenticated read decks" on decks for select using (auth.role() = 'authenticated');
create policy "authenticated write decks" on decks for insert with check (auth.role() = 'authenticated');
create policy "authenticated update decks" on decks for update using (auth.role() = 'authenticated');
create policy "authenticated delete decks" on decks for delete using (auth.role() = 'authenticated');

create policy "authenticated read deck_cards" on deck_cards for select using (auth.role() = 'authenticated');
create policy "authenticated write deck_cards" on deck_cards for insert with check (auth.role() = 'authenticated');
create policy "authenticated update deck_cards" on deck_cards for update using (auth.role() = 'authenticated');
create policy "authenticated delete deck_cards" on deck_cards for delete using (auth.role() = 'authenticated');

-- Public guest view: signed-out visitors can read public cards (and the back
-- faces of public cards) and nothing else.
alter table admins enable row level security;
create policy "read own admin row" on admins for select using (user_id = auth.uid());

create or replace function card_is_public(card_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_public from cards where id = card_id), false);
$$;

create policy "anon read public cards" on cards for select to anon
  using (is_public or (not is_front and card_is_public(linked_card_id)));

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

create trigger cards_guard_is_public before insert or update on cards
  for each row execute function guard_card_is_public();

create index if not exists idx_cards_is_public on cards(is_public) where is_public;
create index if not exists idx_deck_cards_deck on deck_cards(deck_id);
create index if not exists idx_deck_cards_deck_board on deck_cards(deck_id, board);
create index if not exists idx_cards_name on cards(name);
create index if not exists idx_cards_linked_card_id on cards(linked_card_id);
