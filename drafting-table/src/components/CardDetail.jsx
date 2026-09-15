import { ImageOff, X, Pencil, Trash2 } from "lucide-react";
import Modal from "./Modal";
import ManaPips from "./ManaPips";
import { RARITY_HEX } from "../constants";

export default function CardDetail({ card, onClose, onEdit, onDelete }) {
  return (
    <Modal onClose={onClose} width={620}>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr" }}>
        <div style={{ background: "var(--panel2)", borderRadius: "14px 0 0 14px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {card.image_url
            ? <img src={card.image_url} alt={card.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <ImageOff size={32} color="var(--text-dim)" />}
        </div>
        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <h2 className="dt-brand" style={{ fontSize: 21, margin: 0 }}>{card.name}</h2>
            <button className="dt-btn dt-btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <ManaPips colors={card.colors} />
            {card.mana_cost && <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{card.mana_cost}</span>}
            <span className="dt-chip" style={{ color: RARITY_HEX[card.rarity] }}>{card.rarity}</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>
            {card.type}{card.subtype ? ` — ${card.subtype}` : ""}
            {card.power ? ` · ${card.power}/${card.toughness}` : ""}
          </p>
          {card.rules_text && <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" }}>{card.rules_text}</p>}
          {card.flavor_text && <p style={{ fontSize: 13, fontStyle: "italic", color: "var(--text-dim)", margin: 0 }}>{card.flavor_text}</p>}
          {card.tags && card.tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {card.tags.map((t) => <span key={t} className="dt-chip">{t}</span>)}
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "auto 0 0" }}>
            Added by {card.added_by || "unknown"}{card.created_at ? ` · ${new Date(card.created_at).toLocaleDateString()}` : ""}
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button className="dt-btn" onClick={onEdit}><Pencil size={14} />Edit</button>
            <button className="dt-btn dt-btn-danger" onClick={onDelete}><Trash2 size={14} />Delete</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
