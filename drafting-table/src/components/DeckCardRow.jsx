import { GripVertical } from "lucide-react";
import RowMenu from "./RowMenu";
import ManaCost from "./ManaCost";
import { UNCATEGORIZED } from "../constants";

export default function DeckCardRow({
  entry, categories, groupBy, draggable, isCube, openMenuKey, onMenuOpenChange,
  onSetQty, onRemove, onMoveBoard, onSetCategory, onOpenDetail, onPreview, onPreviewEnd, onDragStart,
}) {
  const { card, board, qty } = entry;
  const max = isCube ? 1 : 99;
  const rowKey = `${board}:${entry.cardId}`;
  const menuOpen = openMenuKey === rowKey;

  // The menu panel is a child of the row, so pointing at it never fires the
  // row's mouseleave — without this the preview would hang over the menu.
  const handleHover = (e) => {
    if (openMenuKey && openMenuKey !== rowKey) onMenuOpenChange(rowKey, false);
    if (card && !menuOpen) onPreview(card, e);
  };

  return (
    <div
      className="dt-deck-row"
      // Dragging is suspended while the menu is open, otherwise a small mouse
      // movement while clicking a menu item starts a drag instead.
      draggable={draggable && !menuOpen}
      onDragStart={draggable ? (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", entry.cardId);
        onDragStart(entry);
      } : undefined}
      onDragEnd={draggable ? () => onDragStart(null) : undefined}
      onMouseEnter={handleHover}
      onMouseMove={handleHover}
      onMouseLeave={onPreviewEnd}
    >
      {draggable && <GripVertical size={13} className="dt-grip" />}

      <div className="dt-deck-row-body">
        <div className="dt-deck-row-top">
          <button
            type="button" className="dt-deck-row-name"
            onClick={() => card && onOpenDetail(card)}
            style={card ? undefined : { color: "var(--text-dim)", fontStyle: "italic" }}
          >
            {card ? card.name : "Removed card"}
          </button>
          <RowMenu
            open={menuOpen} onOpenChange={(next) => onMenuOpenChange(rowKey, next)}
            qty={qty} max={max} board={board} disableIncrement={isCube}
            onSetQty={(next) => onSetQty(entry, next)}
            onMoveBoard={() => onMoveBoard(entry)}
            onRemove={() => onRemove(entry)}
          />
        </div>

        <div className="dt-deck-row-meta">
          <span className="dt-deck-row-cost">
            <ManaCost value={card?.mana_cost} size={14} />
            <span className="dt-deck-row-type">{card?.type || "—"}</span>
          </span>
          {groupBy === "category" && (
            <select
              className="dt-select dt-deck-row-select"
              value={entry.category || ""}
              onChange={(e) => onSetCategory(entry, e.target.value || null)}
              title="Move to column"
            >
              <option value="">{UNCATEGORIZED}</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
