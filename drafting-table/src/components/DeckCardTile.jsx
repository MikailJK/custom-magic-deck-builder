import { X, ArrowRight, ArrowLeft } from "lucide-react";
import QtyStepper from "./QtyStepper";
import { UNCATEGORIZED } from "../constants";

// The full card art, used by both the grid and the stacked views. In a stack the
// cards are pulled up over each other in CSS so only the title strip shows, and
// that strip is the only part left hoverable — which is exactly where the bar sits.
export default function DeckCardTile({
  entry, variant, categories, groupBy, draggable, isCube,
  onSetQty, onRemove, onMoveBoard, onSetCategory, onOpenDetail, onPreview, onPreviewEnd, onDragStart,
}) {
  const { card, board, qty } = entry;
  const image = card?.image_url || card?.thumb_url;
  const toMaybe = board === "main";
  const showColumnSelect = variant === "grid" && groupBy === "category";

  return (
    <div
      className={`dt-tile dt-tile-${variant}`}
      draggable={draggable}
      onDragStart={draggable ? (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", entry.cardId);
        onDragStart(entry);
      } : undefined}
      onDragEnd={draggable ? () => onDragStart(null) : undefined}
      onMouseEnter={card && onPreview ? (e) => onPreview(card, e) : undefined}
      onMouseMove={card && onPreview ? (e) => onPreview(card, e) : undefined}
      onMouseLeave={onPreview ? onPreviewEnd : undefined}
    >
      {image ? (
        <img
          className="dt-tile-img" src={image} alt={card.name}
          onClick={() => onOpenDetail(card)}
        />
      ) : (
        <div className="dt-tile-fallback" onClick={() => card && onOpenDetail(card)}>
          <span>{card ? card.name : "Removed card"}</span>
          {card && <span className="dt-tile-fallback-meta">{[card.mana_cost, card.type].filter(Boolean).join(" · ")}</span>}
        </div>
      )}

      <div className="dt-tile-bar">
        {/* A stack draws one card per copy, so the count is already visible, and a
            lone copy needs no badge anywhere — only a playset is worth marking. */}
        {variant !== "stack" && qty > 1 && <span className="dt-tile-qty">{qty}&times;</span>}
        <div className="dt-tile-actions">
          <QtyStepper
            qty={qty} min={0} max={isCube ? 1 : 99} disableIncrement={isCube}
            onChange={(next) => onSetQty(entry, next)}
          />
          {showColumnSelect && (
            <select
              className="dt-select dt-tile-select"
              value={entry.category || ""}
              onChange={(e) => onSetCategory(entry, e.target.value || null)}
              title="Move to column"
            >
              <option value="">{UNCATEGORIZED}</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <button
            type="button" className="dt-btn dt-btn-icon dt-row-action"
            onClick={() => onMoveBoard(entry)}
            title={toMaybe ? "Move to maybe board" : "Move to deck"}
          >
            {toMaybe ? <ArrowRight size={12} /> : <ArrowLeft size={12} />}
          </button>
          <button
            type="button" className="dt-btn dt-btn-icon dt-row-action"
            onClick={() => onRemove(entry)} title="Remove all copies"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
