import { supabase } from "../supabaseClient";
import { DEFAULT_TARGET_SIZE } from "../constants";

// --- Cards ---

export async function fetchCards() {
  const { data: fronts, error } = await supabase.from("cards").select("*").eq("is_front", true).order("name");
  if (error) throw error;
  if (fronts.length === 0) return fronts;

  // Back faces are ordinary cards too, but they never appear in the pool on
  // their own - fetch them once here and attach each to its front so the
  // rest of the app (search, grid, deck stats) never has to think about them.
  const frontIds = fronts.map((c) => c.id);
  const { data: backs, error: backError } = await supabase
    .from("cards").select("*").eq("is_front", false).in("linked_card_id", frontIds);
  if (backError) throw backError;
  const backByFrontId = Object.fromEntries((backs || []).map((b) => [b.linked_card_id, b]));
  return fronts.map((c) => (backByFrontId[c.id] ? { ...c, back: backByFrontId[c.id] } : c));
}

export async function fetchCard(id) {
  const { data, error } = await supabase.from("cards").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

function cardToRow(card, extra) {
  return {
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
    ...extra,
  };
}

export async function saveCard(card, existingId, existingBackId) {
  const row = cardToRow(card);
  let front;
  if (existingId) {
    const { data, error } = await supabase.from("cards").update(row).eq("id", existingId).select().single();
    if (error) throw error;
    front = data;
  } else {
    const { data, error } = await supabase.from("cards").insert(row).select().single();
    if (error) throw error;
    front = data;
  }

  if (card.back) {
    const backRow = cardToRow(card.back, { is_front: false, linked_card_id: front.id });
    if (existingBackId) {
      const { data, error } = await supabase.from("cards").update(backRow).eq("id", existingBackId).select().single();
      if (error) throw error;
      front.back = data;
    } else {
      const { data: back, error } = await supabase.from("cards").insert(backRow).select().single();
      if (error) throw error;
      const { error: linkError } = await supabase.from("cards").update({ linked_card_id: back.id }).eq("id", front.id);
      if (linkError) throw linkError;
      front.linked_card_id = back.id;
      front.back = back;
    }
  } else if (existingBackId) {
    // The toggle was turned off - drop the old back face and clear the link.
    const { error: deleteError } = await supabase.from("cards").delete().eq("id", existingBackId);
    if (deleteError) throw deleteError;
    const { error: unlinkError } = await supabase.from("cards").update({ linked_card_id: null }).eq("id", front.id);
    if (unlinkError) throw unlinkError;
    front.linked_card_id = null;
  }

  return front;
}

export async function deleteCard(id, backId) {
  if (backId) {
    const { error: backError } = await supabase.from("cards").delete().eq("id", backId);
    if (backError) throw backError;
  }
  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) throw error;
}

// --- Decks ---

export async function fetchDecks() {
  const { data: decks, error } = await supabase.from("decks").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  const { data: deckCards, error: dcError } = await supabase.from("deck_cards").select("deck_id, qty, board");
  if (dcError) throw dcError;
  // The maybeboard is a scratchpad — it never counts toward a deck's size.
  const counts = {};
  (deckCards || []).forEach((dc) => {
    if (dc.board !== "main") return;
    counts[dc.deck_id] = (counts[dc.deck_id] || 0) + dc.qty;
  });
  return decks.map((d) => ({ ...d, cardCount: counts[d.id] || 0 }));
}

export async function fetchDeck(deckId) {
  const { data: deck, error } = await supabase.from("decks").select("*").eq("id", deckId).single();
  if (error) throw error;
  const { data: deckCards, error: dcError } = await supabase
    .from("deck_cards").select("card_id, qty, board, category").eq("deck_id", deckId);
  if (dcError) throw dcError;
  return {
    ...deck,
    categories: deck.categories || [],
    targetSize: deck.target_size ?? DEFAULT_TARGET_SIZE,
    cards: (deckCards || []).map((dc) => ({
      cardId: dc.card_id,
      qty: dc.qty,
      board: dc.board || "main",
      category: dc.category || null,
    })),
  };
}

export async function createDeck(name, format) {
  const { data, error } = await supabase.from("decks").insert({ name, format }).select().single();
  if (error) throw error;
  return data;
}

async function touchDeck(deckId) {
  await supabase.from("decks").update({ updated_at: new Date().toISOString() }).eq("id", deckId);
}

export async function updateDeck(deckId, patch) {
  const { error } = await supabase
    .from("decks").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", deckId);
  if (error) throw error;
}

export async function renameDeck(deckId, name) {
  await updateDeck(deckId, { name });
}

export async function deleteDeck(deckId) {
  const { error } = await supabase.from("decks").delete().eq("id", deckId);
  if (error) throw error;
}

export async function setDeckCardQty(deckId, cardId, board, qty, category) {
  if (qty <= 0) {
    const { error } = await supabase
      .from("deck_cards").delete().eq("deck_id", deckId).eq("card_id", cardId).eq("board", board);
    if (error) throw error;
  } else {
    // Only the keys present here are written on conflict, so an upsert that
    // omits `category` leaves an existing column assignment alone.
    const row = { deck_id: deckId, card_id: cardId, board, qty };
    if (category !== undefined) row.category = category;
    const { error } = await supabase
      .from("deck_cards").upsert(row, { onConflict: "deck_id,card_id,board" });
    if (error) throw error;
  }
  await touchDeck(deckId);
}

// One copy of each card in a single request. Callers skip cards already on the
// board so an upsert never resets an existing quantity.
export async function addDeckCards(deckId, cardIds, board) {
  if (!cardIds.length) return;
  const rows = cardIds.map((cardId) => ({ deck_id: deckId, card_id: cardId, board, qty: 1 }));
  const { error } = await supabase
    .from("deck_cards").upsert(rows, { onConflict: "deck_id,card_id,board" });
  if (error) throw error;
  await touchDeck(deckId);
}

export async function setDeckCardCategory(deckId, cardId, board, category) {
  const { error } = await supabase
    .from("deck_cards").update({ category })
    .eq("deck_id", deckId).eq("card_id", cardId).eq("board", board);
  if (error) throw error;
  await touchDeck(deckId);
}

// Moves every copy across boards. `qty` is the merged total for the destination,
// since the card may already be sitting there.
export async function moveDeckCard(deckId, cardId, fromBoard, toBoard, qty, category) {
  const { error: delError } = await supabase
    .from("deck_cards").delete().eq("deck_id", deckId).eq("card_id", cardId).eq("board", fromBoard);
  if (delError) throw delError;
  const { error } = await supabase
    .from("deck_cards")
    .upsert({ deck_id: deckId, card_id: cardId, board: toBoard, qty, category: category ?? null }, { onConflict: "deck_id,card_id,board" });
  if (error) throw error;
  await touchDeck(deckId);
}

export async function renameDeckCategory(deckId, from, to) {
  const { error } = await supabase
    .from("deck_cards").update({ category: to }).eq("deck_id", deckId).eq("category", from);
  if (error) throw error;
}

export async function clearDeckCategory(deckId, name) {
  const { error } = await supabase
    .from("deck_cards").update({ category: null }).eq("deck_id", deckId).eq("category", name);
  if (error) throw error;
}
