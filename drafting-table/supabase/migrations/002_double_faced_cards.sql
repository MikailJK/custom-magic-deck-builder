-- Migration 002 — double-faced cards.
-- Run once in your Supabase project's SQL editor. Safe to re-run.
--
-- A double-faced card is two ordinary `cards` rows cross-linked by
-- linked_card_id. Both rows have every normal card field filled in
-- independently (mana cost, type, power/toughness, image, etc.) - only
-- is_front distinguishes which one shows up in the pool/search/deck-building,
-- and it's the back's linked front that determines where it's shown.

alter table cards add column if not exists linked_card_id uuid references cards(id) on delete set null;
alter table cards add column if not exists is_front boolean not null default true;

create index if not exists idx_cards_linked_card_id on cards(linked_card_id);
