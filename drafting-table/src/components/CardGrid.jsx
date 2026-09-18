import { ImageOff, Flag } from "lucide-react";
import ManaPips from "./ManaPips";
import { RARITY_HEX, needsReview } from "../constants";

function CardTile({ card, onOpen }) {
  return (
    <div className="dt-card-tile" onClick={() => onOpen(card)}>
      <div style={{ position: "relative", aspectRatio: "5/7", background: "var(--panel2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {card.thumb_url
          ? <img src={card.thumb_url} alt={card.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <ImageOff size={28} color="var(--text-dim)" />}
        {needsReview(card) && (
          <span
            title="Needs review"
            style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Flag size={12} color="#E5484D" fill="#E5484D" />
          </span>
        )}
      </div>
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "flex-start" }}>
          <span
            className="dt-brand"
            style={{
              fontSize: 14, lineHeight: 1.2, minWidth: 0,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {card.name}
          </span>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: RARITY_HEX[card.rarity], marginTop: 4, flexShrink: 0 }} title={card.rarity} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{card.type}{card.subtype ? ` — ${card.subtype}` : ""}</span>
          <ManaPips colors={card.colors} size={16} />
        </div>
      </div>
    </div>
  );
}

export default function CardGrid({ cards, onOpen, emptyTitle, emptyBody }) {
  if (cards.length === 0) {
    return (
      <div className="dt-panel" style={{ padding: 40, textAlign: "center" }}>
        <p className="dt-brand" style={{ fontSize: 18, margin: "0 0 6px" }}>{emptyTitle}</p>
        <p style={{ fontSize: 14, color: "var(--text-dim)", margin: 0 }}>{emptyBody}</p>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
      {cards.map((c) => <CardTile key={c.id} card={c} onOpen={onOpen} />)}
    </div>
  );
}
