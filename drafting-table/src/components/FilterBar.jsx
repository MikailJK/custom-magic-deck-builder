import { Search, X, Flag } from "lucide-react";
import { MANA_COLORS, CARD_TYPES, RARITIES, emptyFilters } from "../constants";

export default function FilterBar({ filters, setFilters, allTags }) {
  const toggleColor = (key) => {
    setFilters((f) => {
      const has = f.colors.includes(key);
      return { ...f, colors: has ? f.colors.filter((c) => c !== key) : [...f.colors, key] };
    });
  };

  const hasActiveFilters =
    filters.text || filters.colors.length || filters.type !== "All" || filters.rarity !== "All" || filters.tag !== "All" || filters.needsReview;

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
      <div style={{ position: "relative", minWidth: 200, flex: "1 1 200px" }}>
        <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-dim)" }} />
        <input
          className="dt-input" style={{ paddingLeft: 32 }} placeholder="Search name, type, tag…"
          value={filters.text} onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
        />
      </div>
      {hasActiveFilters && (
        <button type="button" className="dt-btn dt-btn-icon" onClick={() => setFilters(emptyFilters)} title="Clear filters">
          <X size={15} />
        </button>
      )}
      <div style={{ display: "flex", gap: 4 }}>
        {MANA_COLORS.map((c) => (
          <button
            key={c.key} type="button" className="dt-pip-toggle"
            style={filters.colors.includes(c.key) ? { background: c.hex, color: "#211A0D", borderColor: c.hex } : {}}
            onClick={() => toggleColor(c.key)} title={c.label}
          >
            {c.key}
          </button>
        ))}
        <button
          type="button" className="dt-pip-toggle"
          style={filters.colors.includes("C") ? { background: "var(--text-dim)", color: "#211A0D", borderColor: "var(--text-dim)" } : {}}
          onClick={() => toggleColor("C")} title="Colorless"
        >
          C
        </button>
      </div>
      <select className="dt-select" style={{ width: "auto" }} value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
        <option value="All">All types</option>
        {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <select className="dt-select" style={{ width: "auto" }} value={filters.rarity} onChange={(e) => setFilters((f) => ({ ...f, rarity: e.target.value }))}>
        <option value="All">All rarities</option>
        {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <button
        type="button" className="dt-btn"
        style={filters.needsReview ? { borderColor: "#E5484D", color: "#E5484D" } : {}}
        onClick={() => setFilters((f) => ({ ...f, needsReview: !f.needsReview }))}
        aria-pressed={filters.needsReview} title="Show only cards that need review"
      >
        <Flag size={14} fill={filters.needsReview ? "#E5484D" : "none"} />Needs review
      </button>
      {allTags.length > 0 && (
        <select className="dt-select" style={{ width: "auto" }} value={filters.tag} onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))}>
          <option value="All">All tags</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
    </div>
  );
}
