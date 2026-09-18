import { ImageOff, X, Pencil, Trash2 } from "lucide-react";
import Modal from "./Modal";
import ManaPips from "./ManaPips";
import { RARITY_HEX } from "../constants";

function FaceBlock({ face, rounded }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 220px) 1fr", flex: 1, minWidth: 0 }}>
      <div style={{ background: "var(--panel2)", borderRadius: rounded, overflow: "hidden", aspectRatio: "5 / 7", alignSelf: "start", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {face.image_url
          ? <img src={face.image_url} alt={face.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <ImageOff size={32} color="var(--text-dim)" />}
      </div>
      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <h2 className="dt-brand" style={{ fontSize: 21, margin: 0 }}>{face.name}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <ManaPips colors={face.colors} />
          {face.mana_cost && <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{face.mana_cost}</span>}
          <span className="dt-chip" style={{ color: RARITY_HEX[face.rarity] }}>{face.rarity}</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>
          {face.type}{face.subtype ? ` — ${face.subtype}` : ""}
          {face.power ? ` · ${face.power}/${face.toughness}` : ""}
        </p>
        {face.rules_text && <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" }}>{face.rules_text}</p>}
        {face.flavor_text && <p style={{ fontSize: 13, fontStyle: "italic", color: "var(--text-dim)", margin: 0 }}>{face.flavor_text}</p>}
        {face.tags && face.tags.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {face.tags.map((t) => <span key={t} className="dt-chip">{t}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CardDetail({ card, onClose, onEdit, onDelete }) {
  const hasBack = !!card.back;

  return (
    <Modal onClose={onClose} width={hasBack ? 880 : 620}>
      <div style={{ padding: "14px 18px 0", display: "flex", justifyContent: "flex-end" }}>
        <button className="dt-btn dt-btn-icon" onClick={onClose}><X size={16} /></button>
      </div>
      <div style={{ display: "flex" }}>
        <FaceBlock face={card} rounded="14px 0 0 14px" />
        {hasBack && (
          <>
            <div style={{ width: 1, background: "var(--border)" }} />
            <FaceBlock face={card.back} rounded="0 14px 14px 0" />
          </>
        )}
      </div>
      <div style={{ padding: "0 22px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
          Added by {card.added_by || "unknown"}{card.created_at ? ` · ${new Date(card.created_at).toLocaleDateString()}` : ""}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="dt-btn" onClick={onEdit}><Pencil size={14} />Edit</button>
          <button className="dt-btn dt-btn-danger" onClick={onDelete}><Trash2 size={14} />Delete</button>
        </div>
      </div>
    </Modal>
  );
}
