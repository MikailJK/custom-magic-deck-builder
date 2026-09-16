-- Migration 001 — maybeboard, custom deck columns, and per-deck target size.
-- Run once in your Supabase project's SQL editor. Safe to re-run.

alter table deck_cards add column if not exists board text not null default 'main';
alter table deck_cards add column if not exists category text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'deck_cards_board_check') then
    alter table deck_cards add constraint deck_cards_board_check check (board in ('main', 'maybe'));
  end if;
end $$;

-- The same card can now sit on both the deck and the maybeboard at once, so the
-- board has to become part of the primary key.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'deck_cards_pkey' and conrelid = 'deck_cards'::regclass
  ) and not exists (
    select 1
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = 'deck_cards'::regclass and i.indisprimary and a.attname = 'board'
  ) then
    alter table deck_cards drop constraint deck_cards_pkey;
    alter table deck_cards add constraint deck_cards_pkey primary key (deck_id, card_id, board);
  end if;
end $$;

-- Custom columns are just an ordered list of names on the deck; a deck_card
-- points at one by name. Nothing is written back to the shared card pool.
alter table decks add column if not exists categories text[] not null default '{}';
alter table decks add column if not exists target_size integer not null default 40;

create index if not exists idx_deck_cards_deck_board on deck_cards(deck_id, board);
