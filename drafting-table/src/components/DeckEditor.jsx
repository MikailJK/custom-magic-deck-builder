import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import DeckBoard from "./DeckBoard";
import DeckStats from "./DeckStats";
import CardSearchModal from "./CardSearchModal";
import CardPreview from "./CardPreview";
import useCoarsePointer from "../lib/useCoarsePointer";
import usePersistentState from "../lib/usePersistentState";
import { GROUP_MODES, SORT_MODES, VIEW_MODES, UNCATEGORIZED } from "../constants";

const isMode = (modes) => (value) => modes.some((m) => m.key === value);

export default function DeckEditor({
  deck, cards, cardsById, onBack, onOpenCardDetail,
  onAddCard, onSetQty, onRemove, onMoveBoard, onSetCategory,
  onRename, onSetTarget, onAddColumn, onRenameColumn, onDeleteColumn,
}) {
  const [nameDraft, setNameDraft] = useState(deck.name);
  const [activeBoard, setActiveBoard] = useState("main");
  const [groupBy, setGroupBy] = usePersistentState("dt.deck.groupBy", "type", isMode(GROUP_MODES));
  const [sortBy, setSortBy] = usePersistentState("dt.deck.sortBy", "name", isMode(SORT_MODES));
  const [viewMode, setViewMode] = usePersistentState("dt.deck.viewMode", "stacks", isMode(VIEW_MODES));
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [boardDropTarget, setBoardDropTarget] = useState(null);
  const [newColumn, setNewColumn] = useState(null);
  const [preview, setPreview] = useState(null);
  const [openMenuKey, setOpenMenuKey] = useState(null);

  const coarsePointer = useCoarsePointer();
  const dragEnabled = !coarsePointer;
  const isCube = deck.format === "Cube";

  useEffect(() => setNameDraft(deck.name), [deck.id, deck.name]);

  const entries = useMemo(
    () => deck.cards.map((e) => ({ ...e, card: cardsById[e.cardId] })),
    [deck.cards, cardsById]
  );
  const mainEntries = useMemo(() => entries.filter((e) => e.board === "main"), [entries]);
  const maybeEntries = useMemo(() => entries.filter((e) => e.board === "maybe"), [entries]);
  const entriesByKey = useMemo(
    () => Object.fromEntries(entries.map((e) => [`${e.board}:${e.cardId}`, e])),
    [entries]
  );

  const mainCount = mainEntries.reduce((a, e) => a + e.qty, 0);
  const maybeCount = maybeEntries.reduce((a, e) => a + e.qty, 0);

  const collapsePrefix = `${activeBoard}:${groupBy}:`;
  const boardCollapsed = useMemo(() => {
    const out = new Set();
    collapsed.forEach((k) => { if (k.startsWith(collapsePrefix)) out.add(k.slice(collapsePrefix.length)); });
    return out;
  }, [collapsed, collapsePrefix]);

  const toggleCollapse = (key) =>
    setCollapsed((s) => {
      const next = new Set(s);
      const full = collapsePrefix + key;
      if (next.has(full)) next.delete(full); else next.add(full);
      return next;
    });

  const showPreview = (card, e) => {
    if (coarsePointer || dragging) return;
    setPreview({ card, x: e.clientX, y: e.clientY });
  };
  const hidePreview = () => setPreview(null);

  // Opening a row menu drops the floating preview so it can't sit over the menu.
  const handleMenuOpenChange = (rowKey, next) => {
    setOpenMenuKey(next ? rowKey : null);
    setPreview(null);
  };

  // Mouse events stop firing once a drag starts, so the hover preview would
  // otherwise hang around under the cursor for the whole drag.
  const handleDragging = (entry) => {
    if (entry) setPreview(null);
    setDragging(entry);
  };

  const commitNewColumn = () => {
    const name = (newColumn || "").trim();
    setNewColumn(null);
    if (name && name !== UNCATEGORIZED && !deck.categories.includes(name)) onAddColumn(name);
  };

  const handleDropOnBoard = (board) => {
    setBoardDropTarget(null);
    if (dragging && dragging.board !== board) onMoveBoard(dragging.cardId, dragging.board);
    setDragging(null);
  };

  const rowProps = {
    onSetQty: (entry, qty) => onSetQty(entry.cardId, entry.board, qty),
    onRemove: (entry) => onRemove(entry.cardId, entry.board),
    onMoveBoard: (entry) => onMoveBoard(entry.cardId, entry.board),
    onSetCategory: (entry, category) => onSetCategory(entry.cardId, entry.board, category),
    onOpenDetail: onOpenCardDetail,
    onPreview: showPreview,
    onPreviewEnd: hidePreview,
  };

  const boardTab = (board, label, count) => (
    <button
      type="button"
      className={`dt-board-tab${activeBoard === board ? " active" : ""}${boardDropTarget === board ? " dt-board-tab-drop" : ""}`}
      onClick={() => setActiveBoard(board)}
      onDragOver={dragEnabled && dragging && dragging.board !== board
        ? (e) => { e.preventDefault(); setBoardDropTarget(board); } : undefined}
      onDragLeave={() => setBoardDropTarget((t) => (t === board ? null : t))}
      onDrop={dragEnabled && dragging ? (e) => { e.preventDefault(); handleDropOnBoard(board); } : undefined}
    >
      {label} <span className="dt-board-tab-count">{count}</span>
    </button>
  );

  return (
    <div>
      <div className="dt-deck-header">
        <button className="dt-btn dt-btn-icon" onClick={onBack} title="Back to decks"><ArrowLeft size={16} /></button>
        <input
          className="dt-brand dt-deck-name" value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => { if (nameDraft.trim() && nameDraft !== deck.name) onRename(nameDraft.trim()); }}
        />
        <span className="dt-chip">{deck.format}</span>
        <span className="dt-deck-total">{mainCount} / {deck.targetSize}</span>
        <button type="button" className="dt-btn dt-btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add cards
        </button>
      </div>

      <div className="dt-deck-toolbar">
        <div className="dt-board-tabs">
          {boardTab("main", "Deck", mainCount)}
          {boardTab("maybe", "Maybe board", maybeCount)}
        </div>

        <div className="dt-toolbar-right">
          <label className="dt-toolbar-field">
            Group
            <select className="dt-select" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              {GROUP_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
          <label className="dt-toolbar-field">
            Sort
            <select className="dt-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              {SORT_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
          <label className="dt-toolbar-field">
            View as
            <select className="dt-select" value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
              {VIEW_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
          {groupBy === "category" && (
            newColumn === null ? (
              <button type="button" className="dt-btn" onClick={() => setNewColumn("")}>
                <Plus size={13} /> New column
              </button>
            ) : (
              <input
                autoFocus className="dt-input dt-new-column" placeholder="Column name"
                value={newColumn} onChange={(e) => setNewColumn(e.target.value)}
                onBlur={commitNewColumn}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitNewColumn();
                  if (e.key === "Escape") setNewColumn(null);
                }}
              />
            )
          )}
        </div>
      </div>

      {activeBoard === "maybe" && (
        <p className="dt-maybe-note">
          A scratchpad for cards you are considering — nothing here counts toward deck size or the stats.
        </p>
      )}

      <div className="dt-deck-cols">
        <DeckBoard
          entries={activeBoard === "main" ? mainEntries : maybeEntries}
          groupBy={groupBy} sortBy={sortBy} viewMode={viewMode}
          categories={deck.categories} isCube={isCube}
          dragEnabled={dragEnabled} dragging={dragging} setDragging={handleDragging}
          collapsed={boardCollapsed} onToggleCollapse={toggleCollapse}
          openMenuKey={openMenuKey} onMenuOpenChange={handleMenuOpenChange}
          onDropOnColumn={(category) => {
            if (dragging) onSetCategory(dragging.cardId, dragging.board, category);
            setDragging(null);
          }}
          onRenameColumn={onRenameColumn}
          onDeleteColumn={onDeleteColumn}
          emptyMessage={activeBoard === "main"
            ? "No cards yet — use “Add cards” to pull from the pool."
            : "Nothing on the maybe board yet."}
          {...rowProps}
        />

        <div className="dt-deck-rail">
          <DeckStats entries={mainEntries} targetSize={deck.targetSize} onTargetChange={onSetTarget} />
        </div>
      </div>

      {addOpen && (
        <CardSearchModal
          cards={cards} entriesByKey={entriesByKey} isCube={isCube}
          onAdd={onAddCard} onClose={() => setAddOpen(false)}
          onOpenDetail={onOpenCardDetail} onPreview={showPreview} onPreviewEnd={hidePreview}
        />
      )}

      <CardPreview preview={preview} />
    </div>
  );
}
