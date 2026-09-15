import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Minus, Plus, X } from "lucide-react";
import FilterBar from "./FilterBar";
import ManaPips from "./ManaPips";
import ManaCurveChart from "./ManaCurveChart";
import { MANA_COLORS, TYPE_ORDER } from "../constants";

export default function DeckEditor({
  deck, cardsById, filters, setFilters, allTags, filteredCards,
  onAdd, onDecrement, onRemove, onRename, onBack, onOpenCardDetail,
}) {
  const [nameDraft, setNameDraft] = useState(deck.name);
  useEffect(() => setNameDraft(deck.name), [deck.id]);

  const totalCount = deck.cards.reduce((a, c) => a + c.qty, 0);

  const curveData = useMemo(() => {
    const buckets = [0, 1, 2, 3, 4, 5, 6, 7];
    const counts = Object.fromEntries(buckets.map((b) => [b, 0]));
    deck.cards.forEach((entry) => {
      const card = cardsById[entry.cardId];
      if (!card || card.type === "Land") return;
      const cmc = Math.min(7, Math.max(0, card.cmc || 0));
      counts[cmc] += entry.qty;
    });
    return buckets.map((b) => ({ cmc: b === 7 ? "7+" : String(b), count: counts[b] }));
  }, [deck.cards, cardsById]);

  const colorCounts = useMemo(() => {
    const counts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    deck.cards.forEach((entry) => {
      const card = cardsById[entry.cardId];
      if (!card) return;
      (card.colors || []).forEach((c) => { if (counts[c] !== undefined) counts[c] += entry.qty; });
    });
    return counts;
  }, [deck.cards, cardsById]);

  const grouped = useMemo(() => {
    const groups = {};
    deck.cards.forEach((entry) => {
      const card = cardsById[entry.cardId];
      const type = card ? card.type : "Removed card";
      if (!groups[type]) groups[type] = [];
      groups[type].push({ ...entry, card });
    });
    const keys = [...TYPE_ORDER.filter((t) => groups[t]), ...Object.keys(groups).filter((k) => !TYPE_ORDER.includes(k))];
    return keys.map((type) => ({ type, entries: groups[type].sort((a, b) => (a.card?.name || "").localeCompare(b.card?.name || "")) }));
  }, [deck.cards, cardsById]);

  const deckCardIds = useMemo(() => new Set(deck.cards.map((c) => c.cardId)), [deck.cards]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <button className="dt-btn dt-btn-icon" onClick={onBack}><ArrowLeft size={16} /></button>
        <input
          className="dt-brand" value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => { if (nameDraft.trim() && nameDraft !== deck.name) onRename(nameDraft.trim()); }}
          style={{ fontSize: 22, background: "transparent", border: "none", color: "var(--text)", borderBottom: "1px solid transparent", outlineOffset: 2 }}
          onFocus={(e) => (e.target.style.borderBottomColor = "var(--border)")}
        />
        <span className="dt-chip">{deck.format}</span>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "0 0 18px 40px" }}>{totalCount} card{totalCount === 1 ? "" : "s"}</p>

      <div className="dt-deck-cols" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20, alignItems: "start" }}>
        <div>
          <FilterBar filters={filters} setFilters={setFilters} allTags={allTags} />
          <div className="dt-scroll" style={{ maxHeight: 560, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
            {filteredCards.length === 0 && (
              <div className="dt-panel" style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", fontSize: 14 }}>
                No cards in the pool match these filters.
              </div>
            )}
            {filteredCards.map((c) => {
              const inDeck = deck.cards.find((e) => e.cardId === c.id);
              return (
                <div key={c.id} className="dt-card-row">
                  <div style={{ width: 36, height: 50, borderRadius: 4, overflow: "hidden", background: "var(--panel2)", flexShrink: 0, cursor: "pointer" }} onClick={() => onOpenCardDetail(c)}>
                    {c.thumb_url ? <img src={c.thumb_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onOpenCardDetail(c)}>
                    <div style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{c.type}</div>
                  </div>
                  <ManaPips colors={c.colors} size={16} />
                  {inDeck && deck.format !== "Cube" && (
                    <>
                      <button className="dt-btn dt-btn-icon" onClick={() => onDecrement(c.id)}><Minus size={13} /></button>
                      <span style={{ minWidth: 16, textAlign: "center", fontSize: 13 }}>{inDeck.qty}</span>
                    </>
                  )}
                  <button
                    className="dt-btn dt-btn-icon" onClick={() => onAdd(c.id)}
                    disabled={deck.format === "Cube" && deckCardIds.has(c.id)}
                  >
                    <Plus size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 12 }}>
          <div className="dt-panel" style={{ padding: 16 }}>
            <p className="dt-brand" style={{ fontSize: 14, margin: "0 0 10px" }}>Mana curve</p>
            <ManaCurveChart data={curveData} />
          </div>
          <div className="dt-panel" style={{ padding: 16 }}>
            <p className="dt-brand" style={{ fontSize: 14, margin: "0 0 10px" }}>Color balance</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {MANA_COLORS.map((c) => (
                <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="dt-pip" style={{ background: c.hex, width: 18, height: 18, fontSize: 9 }}>{c.key}</span>
                  <div style={{ flex: 1, background: "var(--panel2)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                    <div style={{ width: `${totalCount ? (colorCounts[c.key] / totalCount) * 100 : 0}%`, background: c.hex, height: "100%" }} />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-dim)", width: 18, textAlign: "right" }}>{colorCounts[c.key]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="dt-panel" style={{ padding: 16 }}>
            <p className="dt-brand" style={{ fontSize: 14, margin: "0 0 10px" }}>Build</p>
            {deck.cards.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>Add cards from the pool on the left to start building.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {grouped.map((g) => (
                  <div key={g.type}>
                    <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: ".04em" }}>
                      {g.type} · {g.entries.reduce((a, e) => a + e.qty, 0)}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {g.entries.map((e) => (
                        <div key={e.cardId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                          <span style={{ color: "var(--text-dim)", minWidth: 18 }}>{e.qty}×</span>
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: e.card ? "var(--text)" : "var(--text-dim)", fontStyle: e.card ? "normal" : "italic" }}>
                            {e.card ? e.card.name : "Removed card"}
                          </span>
                          <button className="dt-btn dt-btn-icon" onClick={() => onRemove(e.cardId)}><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
