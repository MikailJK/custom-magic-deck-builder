import { supabase } from "../supabaseClient";

// --- Cards ---

export async function fetchCards() {
  const { data, error } = await supabase.from("cards").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function fetchCard(id) {
  const { data, error } = await supabase.from("cards").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function saveCard(card, existingId) {
  const row = {
    name: card.name,
    mana_cost: card.manaCost,
    cmc: card.cmc,
    colors: card.colors,
    type: card.type,
    subtype: card.subtype,
    rarity: card.rarity,
    power: card.power,
    toughness: card.toughness,
    rules_text: card.text,
    flavor_text: card.flavorText,
    tags: card.tags,
    image_url: card.imageUrl,
    thumb_url: card.thumbUrl,
    added_by: card.addedBy,
    updated_at: new Date().toISOString(),
  };
  if (existingId) {
    const { data, error } = await supabase.from("cards").update(row).eq("id", existingId).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from("cards").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCard(id) {
  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) throw error;
}

// --- Decks ---

export async function fetchDecks() {
  const { data: decks, error } = await supabase.from("decks").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  const { data: deckCards, error: dcError } = await supabase.from("deck_cards").select("deck_id, qty");
  if (dcError) throw dcError;
  const counts = {};
  (deckCards || []).forEach((dc) => { counts[dc.deck_id] = (counts[dc.deck_id] || 0) + dc.qty; });
  return decks.map((d) => ({ ...d, cardCount: counts[d.id] || 0 }));
}

export async function fetchDeck(deckId) {
  const { data: deck, error } = await supabase.from("decks").select("*").eq("id", deckId).single();
  if (error) throw error;
  const { data: deckCards, error: dcError } = await supabase.from("deck_cards").select("card_id, qty").eq("deck_id", deckId);
  if (dcError) throw dcError;
  return { ...deck, cards: (deckCards || []).map((dc) => ({ cardId: dc.card_id, qty: dc.qty })) };
}

export async function createDeck(name, format) {
  const { data, error } = await supabase.from("decks").insert({ name, format }).select().single();
  if (error) throw error;
  return data;
}

export async function renameDeck(deckId, name) {
  const { error } = await supabase.from("decks").update({ name, updated_at: new Date().toISOString() }).eq("id", deckId);
  if (error) throw error;
}

export async function deleteDeck(deckId) {
  const { error } = await supabase.from("decks").delete().eq("id", deckId);
  if (error) throw error;
}

export async function setDeckCardQty(deckId, cardId, qty) {
  if (qty <= 0) {
    const { error } = await supabase.from("deck_cards").delete().eq("deck_id", deckId).eq("card_id", cardId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("deck_cards").upsert({ deck_id: deckId, card_id: cardId, qty });
    if (error) throw error;
  }
  await supabase.from("decks").update({ updated_at: new Date().toISOString() }).eq("id", deckId);
}
