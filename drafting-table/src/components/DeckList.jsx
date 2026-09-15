import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export default function DeckList({ decks, onCreate, onOpen, onDelete }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [format, setFormat] = useState("Deck");

  const submit = async () => {
    if (!name.trim()) return;
    const deck = await onCreate(name, format);
    setCreating(false);
    setName("");
    setFormat("Deck");
    onOpen(deck.id);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>{decks.length} deck{decks.length === 1 ? "" : "s"} &amp; cubes</p>
        <button className="dt-btn dt-btn-primary" onClick={() => setCreating(true)}><Plus size={16} />New deck / cube</button>
      </div>

      {creating && (
        <div className="dt-panel" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Name</label>
            <input
              className="dt-input" autoFocus value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) submit(); }}
              placeholder="e.g. Budget Reanimator, Summer Cube"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Format</label>
            <select className="dt-select" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="Deck">Deck</option>
              <option value="Cube">Cube</option>
            </select>
          </div>
          <button type="button" className="dt-btn dt-btn-primary" disabled={!name.trim()} onClick={submit}>Create</button>
          <button type="button" className="dt-btn" onClick={() => setCreating(false)}>Cancel</button>
        </div>
      )}

      {decks.length === 0 && !creating ? (
        <div className="dt-panel" style={{ padding: 40, textAlign: "center" }}>
          <p className="dt-brand" style={{ fontSize: 18, margin: "0 0 6px" }}>No decks or cubes yet</p>
          <p style={{ fontSize: 14, color: "var(--text-dim)", margin: 0 }}>Start one to begin pulling cards from the pool.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {decks.map((d) => (
            <div key={d.id} className="dt-panel" style={{ padding: 16, cursor: "pointer" }} onClick={() => onOpen(d.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="dt-brand" style={{ fontSize: 17 }}>{d.name}</span>
                <button
                  className="dt-btn dt-btn-icon"
                  onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${d.name}"? This can't be undone.`)) onDelete(d.id); }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                <span className="dt-chip">{d.format}</span>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{d.cardCount} card{d.cardCount === 1 ? "" : "s"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
