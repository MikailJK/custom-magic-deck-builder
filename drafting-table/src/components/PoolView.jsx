import { Plus } from "lucide-react";
import FilterBar from "./FilterBar";
import CardGrid from "./CardGrid";

export default function PoolView({ filters, setFilters, cards, allTags, onAdd, onOpenDetail, isGuest = false, isAdmin = false }) {
  return (
    <div>
      {isGuest && (
        <div className="dt-banner dt-banner-info">
          You're browsing the public card collection. Feel free to look around, try the card form, and build decks. Nothing is saved until you sign in.
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>{cards.length} card{cards.length === 1 ? "" : "s"} in the pool</p>
        <button className="dt-btn dt-btn-primary" onClick={onAdd}><Plus size={16} />Add card</button>
      </div>
      <FilterBar filters={filters} setFilters={setFilters} allTags={allTags} showPublicFilter={isAdmin} />
      <CardGrid
        cards={cards} onOpen={onOpenDetail} showPublic={isAdmin}
        emptyTitle="No cards match yet"
        emptyBody={isGuest ? "Try clearing the filters above." : "Add your first custom card, or clear the filters above."}
      />
    </div>
  );
}
