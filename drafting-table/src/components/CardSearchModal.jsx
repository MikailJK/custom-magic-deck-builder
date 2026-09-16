import { useState, useMemo, useEffect, useRef } from "react";
import { Search, X, Plus } from "lucide-react";
import Modal from "./Modal";
import ManaCost from "./ManaCost";
import { MANA_COLORS, CARD_TYPES } from "../constants";

export default function CardSearchModal({
  cards, entriesByKey, isCube, onAdd, onClose, onOpenDetail, onPreview, onPreviewEnd,
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [colors, setColors] = useState([]);
  const [destination, setDestination] = useState("main");
  const [searchRules, setSearchRules] = useState(false);
  const [addQty, setAddQty] = useState({});
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (q) {
        const fields = [c.name, c.type, c.subtype, (c.tags || []).join(" ")];
        if (searchRules) fields.push(c.rules_text);
        if (!fields.filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
      }
      if (type !== "All" && c.type !== type) return false;
      if (colors.length) {
        const cc = c.colors || [];
        if (!colors.every((col) => cc.includes(col))) return false;
      }
      return true;
    });
  }, [cards, query, type, colors, searchRules]);

  const toggleColor = (key) =>
    setColors((cs) => (cs.includes(key) ? cs.filter((c) => c !== key) : [...cs, key]));

  return (
    <Modal onClose={onClose} width={640}>
      <div className="dt-addcards">
        <header className="dt-addcards-head">
          <h2 className="dt-brand dt-addcards-title">Add cards</h2>
          <button type="button" className="dt-btn dt-btn-icon" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </header>

        <div className="dt-addcards-controls">
          <div className="dt-search-wrap">
            <Search size={15} className="dt-search-icon" />
            <input
              ref={searchRef} className="dt-input dt-search-input" placeholder="Search the pool…"
              value={query} onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="dt-addcards-filters">
            <select className="dt-select dt-addcards-type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="All">All types</option>
              {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="dt-addcards-pips">
              {MANA_COLORS.map((c) => (
                <button
                  key={c.key} type="button" className="dt-pip-toggle"
                  style={colors.includes(c.key) ? { background: c.hex, color: "#211A0D", borderColor: c.hex } : {}}
                  onClick={() => toggleColor(c.key)} title={c.label}
                >
                  {c.key}
                </button>
              ))}
            </div>
            <label className="dt-check" title="Also match text in the card's rules box">
              <input
                type="checkbox" checked={searchRules}
                onChange={(e) => setSearchRules(e.target.checked)}
              />
              Rules text
            </label>
          </div>

          <div className="dt-segmented" role="group" aria-label="Add destination">
            <button
              type="button" className={`dt-segment${destination === "main" ? " active" : ""}`}
              onClick={() => setDestination("main")}
            >
              Add to deck
            </button>
            <button
              type="button" className={`dt-segment${destination === "maybe" ? " active" : ""}`}
              onClick={() => setDestination("maybe")}
            >
              Add to maybe
            </button>
          </div>
        </div>

        <div className="dt-addcards-results dt-scroll">
          {results.length === 0 && <p className="dt-addcards-empty">No cards match that search.</p>}
          {results.map((card) => {
            const inMain = entriesByKey[`main:${card.id}`]?.qty || 0;
            const inMaybe = entriesByKey[`maybe:${card.id}`]?.qty || 0;
            const qty = addQty[card.id] || 1;
            const blocked = isCube && (destination === "main" ? inMain : inMaybe) > 0;

            return (
              <div
                key={card.id} className="dt-addcards-row"
                onMouseEnter={(e) => onPreview(card, e)}
                onMouseMove={(e) => onPreview(card, e)}
                onMouseLeave={onPreviewEnd}
              >
                <button type="button" className="dt-card-thumb" onClick={() => onOpenDetail(card)} title="Open card">
                  {card.thumb_url ? <img src={card.thumb_url} alt="" /> : null}
                </button>

                <div className="dt-addcards-row-body">
                  <button type="button" className="dt-deck-row-name" onClick={() => onOpenDetail(card)}>
                    {card.name}
                  </button>
                  <span className="dt-deck-row-cost">
                    <ManaCost value={card.mana_cost} size={14} />
                    <span className="dt-deck-row-type">{card.type || "—"}</span>
                  </span>
                  {(inMain > 0 || inMaybe > 0) && (
                    <span className="dt-in-deck">
                      {inMain > 0 && `In deck: ${inMain}`}
                      {inMain > 0 && inMaybe > 0 && " · "}
                      {inMaybe > 0 && `Maybe: ${inMaybe}`}
                    </span>
                  )}
                </div>

                {!isCube && (
                  <select
                    className="dt-select dt-add-qty" value={qty}
                    onChange={(e) => setAddQty((m) => ({ ...m, [card.id]: Number(e.target.value) }))}
                    title="Copies to add"
                  >
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}
                <button
                  type="button" className="dt-btn dt-btn-primary dt-add-btn"
                  disabled={blocked}
                  onClick={() => onAdd(card.id, destination, isCube ? 1 : qty)}
                  title={blocked ? "Already in this cube" : `Add ${qty} to ${destination === "main" ? "deck" : "maybe board"}`}
                >
                  <Plus size={13} /> Add
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
