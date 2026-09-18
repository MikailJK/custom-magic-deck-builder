import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";
import { emptyFilters, needsReview } from "./constants";
import * as db from "./lib/db";
import Auth from "./components/Auth";
import Header from "./components/Header";
import PoolView from "./components/PoolView";
import DeckList from "./components/DeckList";
import DeckEditor from "./components/DeckEditor";
import CardForm from "./components/CardForm";
import CardDetail from "./components/CardDetail";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [booting, setBooting] = useState(true);

  const [cards, setCards] = useState([]);
  const [decks, setDecks] = useState([]);
  const [loadError, setLoadError] = useState("");

  const [tab, setTab] = useState("pool");
  const [filters, setFilters] = useState(emptyFilters);

  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [detailCard, setDetailCard] = useState(null);

  const [activeDeckId, setActiveDeckId] = useState(null);
  const [activeDeck, setActiveDeck] = useState(null);
  const [deckLoading, setDeckLoading] = useState(false);
  // Deck edits are applied optimistically and can land faster than React
  // re-renders (holding Add in the search drawer), so reads go through a ref
  // that every handler updates synchronously before it awaits the write.
  const activeDeckRef = useRef(null);

  // Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load shared data once signed in. Cards and decks are settled independently
  // so a failure on one does not leave the other silently empty.
  useEffect(() => {
    if (!session) return;
    (async () => {
      setBooting(true);
      const [cardResult, deckResult] = await Promise.allSettled([db.fetchCards(), db.fetchDecks()]);
      if (cardResult.status === "fulfilled") setCards(cardResult.value);
      if (deckResult.status === "fulfilled") setDecks(deckResult.value);

      const failures = [];
      if (cardResult.status === "rejected") failures.push(["the card pool", cardResult.reason]);
      if (deckResult.status === "rejected") failures.push(["your decks", deckResult.reason]);
      failures.forEach(([what, reason]) => console.error(`Failed to load ${what}`, reason));
      setLoadError(
        failures.length
          ? `Couldn't load ${failures.map(([what]) => what).join(" or ")}: ${failures[0][1]?.message || "unknown error"}`
          : ""
      );
      setBooting(false);
    })();
  }, [session]);

  const profileName = session?.user?.user_metadata?.display_name || session?.user?.email || "";

  const cardsById = useMemo(() => {
    const map = {};
    for (const c of cards) map[c.id] = c;
    return map;
  }, [cards]);

  const allTags = useMemo(() => {
    const s = new Set();
    cards.forEach((c) => (c.tags || []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [cards]);

  const filteredCards = useMemo(() => {
    return cards
      .filter((c) => {
        if (filters.text) {
          const t = filters.text.toLowerCase();
          const hay = `${c.name} ${c.type || ""} ${(c.tags || []).join(" ")}`.toLowerCase();
          if (!hay.includes(t)) return false;
        }
        if (filters.colors.length > 0) {
          const cc = c.colors || [];
          if (filters.colors.includes("C")) { if (cc.length !== 0) return false; }
          else if (!filters.colors.every((col) => cc.includes(col))) return false;
        }
        if (filters.type !== "All" && c.type !== filters.type) return false;
        if (filters.rarity !== "All" && c.rarity !== filters.rarity) return false;
        if (filters.tag !== "All" && !(c.tags || []).includes(filters.tag)) return false;
        if (filters.needsReview && !needsReview(c)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cards, filters]);

  async function refreshCards() {
    setCards(await db.fetchCards());
  }
  async function refreshDecks() {
    setDecks(await db.fetchDecks());
  }

  async function handleSaveCard(cardPatch) {
    await db.saveCard(cardPatch, editingCard?.id || null, editingCard?.back?.id || null);
    await refreshCards();
    setCardFormOpen(false);
  }

  async function handleDeleteCard(id, backId) {
    await db.deleteCard(id, backId);
    await refreshCards();
    setDetailCard(null);
  }

  async function openCardDetail(cardSummary) {
    setDetailCard(cardsById[cardSummary.id] || cardSummary);
  }

  async function handleCreateDeck(name, format) {
    const deck = await db.createDeck(name, format);
    await refreshDecks();
    return deck;
  }

  function setDeck(deck) {
    activeDeckRef.current = deck;
    setActiveDeck(deck);
  }

  function applyDeck(updater) {
    setDeck(updater(activeDeckRef.current));
  }

  // Optimistic edits would silently drift from the database if a write failed,
  // so a failure pulls the deck back from the server instead.
  async function commitDeck(write) {
    try {
      await write();
      refreshDecks();
    } catch (e) {
      console.error("Deck update failed", e);
      const id = activeDeckRef.current?.id;
      if (id) setDeck(await db.fetchDeck(id));
    }
  }

  async function openDeck(id) {
    setActiveDeckId(id);
    setDeckLoading(true);
    try {
      setDeck(await db.fetchDeck(id));
    } finally {
      setDeckLoading(false);
    }
  }

  function closeDeck() {
    setActiveDeckId(null);
    setDeck(null);
  }

  async function handleDeleteDeck(id) {
    await db.deleteDeck(id);
    await refreshDecks();
    if (activeDeckId === id) closeDeck();
  }

  async function handleRenameDeck(name) {
    applyDeck((d) => ({ ...d, name }));
    await commitDeck(() => db.renameDeck(activeDeckRef.current.id, name));
  }

  const findEntry = (deck, cardId, board) =>
    deck.cards.find((c) => c.cardId === cardId && c.board === board);

  async function handleSetDeckCardQty(cardId, board, qty) {
    const deck = activeDeckRef.current;
    const capped = deck.format === "Cube" ? Math.min(1, qty) : Math.min(99, qty);
    const existing = findEntry(deck, cardId, board);
    applyDeck((d) => ({
      ...d,
      cards: capped <= 0
        ? d.cards.filter((c) => !(c.cardId === cardId && c.board === board))
        : existing
          ? d.cards.map((c) => (c.cardId === cardId && c.board === board ? { ...c, qty: capped } : c))
          : [...d.cards, { cardId, qty: capped, board, category: null }],
    }));
    await commitDeck(() => db.setDeckCardQty(deck.id, cardId, board, capped));
  }

  async function handleAddToDeck(cardId, board = "main", qty = 1) {
    const deck = activeDeckRef.current;
    const existing = findEntry(deck, cardId, board);
    if (deck.format === "Cube" && existing) return;
    const nextQty = deck.format === "Cube" ? 1 : Math.min(99, (existing?.qty || 0) + qty);
    await handleSetDeckCardQty(cardId, board, nextQty);
  }

  // One copy of each card that isn't already on the board.
  async function handleAddManyToDeck(cardIds, board = "main") {
    const deck = activeDeckRef.current;
    const fresh = cardIds.filter((id) => !findEntry(deck, id, board));
    if (!fresh.length) return;
    applyDeck((d) => ({
      ...d,
      cards: [...d.cards, ...fresh.map((cardId) => ({ cardId, qty: 1, board, category: null }))],
    }));
    await commitDeck(() => db.addDeckCards(deck.id, fresh, board));
  }

  async function handleRemoveFromDeck(cardId, board = "main") {
    await handleSetDeckCardQty(cardId, board, 0);
  }

  async function handleMoveDeckCardBoard(cardId, fromBoard) {
    const deck = activeDeckRef.current;
    const toBoard = fromBoard === "main" ? "maybe" : "main";
    const source = findEntry(deck, cardId, fromBoard);
    if (!source) return;
    const target = findEntry(deck, cardId, toBoard);
    const mergedQty = deck.format === "Cube" ? 1 : Math.min(99, (target?.qty || 0) + source.qty);
    const category = target?.category ?? source.category ?? null;
    applyDeck((d) => ({
      ...d,
      cards: [
        ...d.cards.filter((c) => c.cardId !== cardId || (c.board !== fromBoard && c.board !== toBoard)),
        { cardId, qty: mergedQty, board: toBoard, category },
      ],
    }));
    await commitDeck(() => db.moveDeckCard(deck.id, cardId, fromBoard, toBoard, mergedQty, category));
  }

  async function handleSetDeckCardCategory(cardId, board, category) {
    const deck = activeDeckRef.current;
    applyDeck((d) => ({
      ...d,
      cards: d.cards.map((c) => (c.cardId === cardId && c.board === board ? { ...c, category } : c)),
    }));
    await commitDeck(() => db.setDeckCardCategory(deck.id, cardId, board, category));
  }

  async function handleSetDeckTarget(targetSize) {
    const deck = activeDeckRef.current;
    applyDeck((d) => ({ ...d, targetSize }));
    await commitDeck(() => db.updateDeck(deck.id, { target_size: targetSize }));
  }

  async function handleAddColumn(name) {
    const deck = activeDeckRef.current;
    const categories = [...deck.categories, name];
    applyDeck((d) => ({ ...d, categories }));
    await commitDeck(() => db.updateDeck(deck.id, { categories }));
  }

  async function handleRenameColumn(from, to) {
    const deck = activeDeckRef.current;
    if (deck.categories.includes(to)) return;
    const categories = deck.categories.map((c) => (c === from ? to : c));
    applyDeck((d) => ({
      ...d,
      categories,
      cards: d.cards.map((c) => (c.category === from ? { ...c, category: to } : c)),
    }));
    await commitDeck(async () => {
      await db.renameDeckCategory(deck.id, from, to);
      await db.updateDeck(deck.id, { categories });
    });
  }

  async function handleDeleteColumn(name) {
    const deck = activeDeckRef.current;
    const held = deck.cards.filter((c) => c.category === name).length;
    if (held > 0 && !window.confirm(`Delete the "${name}" column? Its ${held} card${held === 1 ? "" : "s"} stay in the deck and become uncategorized.`)) {
      return;
    }
    const categories = deck.categories.filter((c) => c !== name);
    applyDeck((d) => ({
      ...d,
      categories,
      cards: d.cards.map((c) => (c.category === name ? { ...c, category: null } : c)),
    }));
    await commitDeck(async () => {
      await db.clearDeckCategory(deck.id, name);
      await db.updateDeck(deck.id, { categories });
    });
  }

  if (session === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p className="dt-loading">Loading…</p></div>;
  }
  if (!session) {
    return <Auth />;
  }
  if (booting) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p className="dt-loading">Loading Barnky Deck…</p></div>;
  }

  return (
    <div>
      <Header tab={tab} setTab={setTab} profileName={profileName} />
      <main className="dt-main">
        {loadError && <div className="dt-banner">{loadError}</div>}
        {tab === "pool" && (
          <PoolView
            filters={filters} setFilters={setFilters} cards={filteredCards} allTags={allTags}
            onAdd={() => { setEditingCard(null); setCardFormOpen(true); }}
            onOpenDetail={openCardDetail}
          />
        )}
        {tab === "decks" && !activeDeckId && (
          <DeckList decks={decks} onCreate={handleCreateDeck} onOpen={openDeck} onDelete={handleDeleteDeck} />
        )}
        {tab === "decks" && activeDeckId && (
          deckLoading || !activeDeck ? <p className="dt-loading">Opening deck…</p> : (
            <DeckEditor
              deck={activeDeck} cards={cards} cardsById={cardsById}
              onAddCard={handleAddToDeck} onAddMany={handleAddManyToDeck} onSetQty={handleSetDeckCardQty} onRemove={handleRemoveFromDeck}
              onMoveBoard={handleMoveDeckCardBoard} onSetCategory={handleSetDeckCardCategory}
              onRename={handleRenameDeck} onSetTarget={handleSetDeckTarget}
              onAddColumn={handleAddColumn} onRenameColumn={handleRenameColumn} onDeleteColumn={handleDeleteColumn}
              onBack={closeDeck}
              onOpenCardDetail={openCardDetail}
            />
          )
        )}
      </main>

      {cardFormOpen && (
        <CardForm
          initial={editingCard}
          profileName={profileName}
          existingCards={cards}
          onCancel={() => setCardFormOpen(false)}
          onSave={handleSaveCard}
        />
      )}

      {detailCard && (
        <CardDetail
          card={detailCard}
          onClose={() => setDetailCard(null)}
          onEdit={() => { setEditingCard(detailCard); setDetailCard(null); setCardFormOpen(true); }}
          onDelete={() => {
            if (window.confirm(`Remove "${detailCard.name}" from the card pool? This can't be undone.`)) {
              handleDeleteCard(detailCard.id, detailCard.back?.id);
            }
          }}
        />
      )}
    </div>
  );
}
