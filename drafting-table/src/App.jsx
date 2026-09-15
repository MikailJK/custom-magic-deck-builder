import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { emptyFilters } from "./constants";
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

  const [tab, setTab] = useState("pool");
  const [filters, setFilters] = useState(emptyFilters);

  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [detailCard, setDetailCard] = useState(null);

  const [activeDeckId, setActiveDeckId] = useState(null);
  const [activeDeck, setActiveDeck] = useState(null);
  const [deckLoading, setDeckLoading] = useState(false);

  // Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load shared data once signed in
  useEffect(() => {
    if (!session) return;
    (async () => {
      setBooting(true);
      try {
        const [cardRows, deckRows] = await Promise.all([db.fetchCards(), db.fetchDecks()]);
        setCards(cardRows);
        setDecks(deckRows);
      } catch (e) {
        console.error("Failed to load data", e);
      }
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
    await db.saveCard(cardPatch, editingCard?.id || null);
    await refreshCards();
    setCardFormOpen(false);
  }

  async function handleDeleteCard(id) {
    await db.deleteCard(id);
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

  async function openDeck(id) {
    setActiveDeckId(id);
    setDeckLoading(true);
    try {
      setActiveDeck(await db.fetchDeck(id));
    } finally {
      setDeckLoading(false);
    }
  }

  async function handleDeleteDeck(id) {
    await db.deleteDeck(id);
    await refreshDecks();
    if (activeDeckId === id) { setActiveDeckId(null); setActiveDeck(null); }
  }

  async function handleRenameDeck(name) {
    await db.renameDeck(activeDeck.id, name);
    setActiveDeck((d) => ({ ...d, name }));
    await refreshDecks();
  }

  async function handleAddToDeck(cardId) {
    const existing = activeDeck.cards.find((c) => c.cardId === cardId);
    const nextQty = activeDeck.format === "Cube" ? 1 : Math.min(99, (existing?.qty || 0) + 1);
    if (activeDeck.format === "Cube" && existing) return;
    await db.setDeckCardQty(activeDeck.id, cardId, nextQty);
    setActiveDeck((d) => {
      const cards2 = existing
        ? d.cards.map((c) => (c.cardId === cardId ? { ...c, qty: nextQty } : c))
        : [...d.cards, { cardId, qty: nextQty }];
      return { ...d, cards: cards2 };
    });
    refreshDecks();
  }

  async function handleDecrementDeckCard(cardId) {
    const existing = activeDeck.cards.find((c) => c.cardId === cardId);
    if (!existing) return;
    const nextQty = existing.qty - 1;
    await db.setDeckCardQty(activeDeck.id, cardId, nextQty);
    setActiveDeck((d) => ({
      ...d,
      cards: nextQty <= 0 ? d.cards.filter((c) => c.cardId !== cardId) : d.cards.map((c) => (c.cardId === cardId ? { ...c, qty: nextQty } : c)),
    }));
    refreshDecks();
  }

  async function handleRemoveFromDeck(cardId) {
    await db.setDeckCardQty(activeDeck.id, cardId, 0);
    setActiveDeck((d) => ({ ...d, cards: d.cards.filter((c) => c.cardId !== cardId) }));
    refreshDecks();
  }

  if (session === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p className="dt-loading">Loading…</p></div>;
  }
  if (!session) {
    return <Auth />;
  }
  if (booting) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p className="dt-loading">Loading the drafting table…</p></div>;
  }

  return (
    <div>
      <Header tab={tab} setTab={setTab} profileName={profileName} />
      <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
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
              deck={activeDeck} cardsById={cardsById}
              filters={filters} setFilters={setFilters} allTags={allTags} filteredCards={filteredCards}
              onAdd={handleAddToDeck} onDecrement={handleDecrementDeckCard} onRemove={handleRemoveFromDeck}
              onRename={handleRenameDeck}
              onBack={() => { setActiveDeckId(null); setActiveDeck(null); }}
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
              handleDeleteCard(detailCard.id);
            }
          }}
        />
      )}
    </div>
  );
}
