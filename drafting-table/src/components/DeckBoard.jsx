import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import DeckCardRow from "./DeckCardRow";
import DeckCardTile from "./DeckCardTile";
import { groupEntries } from "../lib/deck";
import { UNCATEGORIZED } from "../constants";

export default function DeckBoard({
  entries, groupBy, sortBy, viewMode, categories, isCube,
  dragEnabled, dragging, setDragging, collapsed, onToggleCollapse,
  openMenuKey, onMenuOpenChange,
  onDropOnColumn, onRenameColumn, onDeleteColumn, emptyMessage, ...rowProps
}) {
  const [dropTarget, setDropTarget] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");

  const groups = useMemo(
    () => groupEntries(entries, groupBy, categories, sortBy),
    [entries, groupBy, categories, sortBy]
  );

  // Dropping only means something in column mode — type and cost groups are
  // derived from the card itself, so there is nothing to reassign.
  const canDrop = dragEnabled && groupBy === "category" && dragging;

  const commitRename = (from) => {
    const next = renameDraft.trim();
    setRenaming(null);
    if (next && next !== from && next !== UNCATEGORIZED) onRenameColumn(from, next);
  };

  // In column mode the empty columns are the point — they are the drop targets.
  const showEmptyState = entries.length === 0 && (groupBy !== "category" || categories.length === 0);
  if (showEmptyState) {
    return <div className="dt-panel dt-board-empty">{emptyMessage}</div>;
  }

  // Grid needs the full page width for a row of card art; the other two views
  // read better as narrow columns side by side.
  const { onPreview, onPreviewEnd, ...tileProps } = rowProps;

  const renderBody = (group) => {
    if (viewMode === "text") {
      return group.entries.map((entry) => (
        <DeckCardRow
          key={`${entry.board}:${entry.cardId}`}
          entry={entry} categories={categories} groupBy={groupBy}
          draggable={dragEnabled} isCube={isCube} onDragStart={setDragging}
          openMenuKey={openMenuKey} onMenuOpenChange={onMenuOpenChange}
          onPreview={onPreview} onPreviewEnd={onPreviewEnd} {...tileProps}
        />
      ));
    }
    if (viewMode === "stacks") {
      return (
        <div className="dt-stack">
          {/* Three copies are drawn as three cards, the way a pile looks on a table. */}
          {group.entries.flatMap((entry) =>
            Array.from({ length: entry.qty }, (_, copy) => (
              <DeckCardTile
                key={`${entry.board}:${entry.cardId}:${copy}`}
                entry={entry} variant="stack"
                categories={categories} groupBy={groupBy}
                draggable={dragEnabled} isCube={isCube} onDragStart={setDragging}
                onPreview={onPreview} onPreviewEnd={onPreviewEnd}
                {...tileProps}
              />
            ))
          )}
        </div>
      );
    }

    return (
      <div className="dt-card-grid">
        {group.entries.map((entry) => (
          <DeckCardTile
            key={`${entry.board}:${entry.cardId}`}
            entry={entry} variant="grid"
            categories={categories} groupBy={groupBy}
            draggable={dragEnabled} isCube={isCube} onDragStart={setDragging}
            // The grid already shows the art, so a floating copy of it adds nothing.
            {...tileProps}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={
      viewMode === "grid" ? "dt-board-sections"
        : `dt-board-grid${viewMode === "stacks" ? " is-stacks" : ""}`
    }>
      {groups.map((group) => {
        const isUncategorized = group.key === UNCATEGORIZED;
        const isCollapsed = collapsed.has(group.key);
        const isColumn = groupBy === "category";

        return (
          <section
            key={group.key}
            className={`dt-panel dt-group${dropTarget === group.key ? " dt-group-drop" : ""}`}
            onDragOver={canDrop ? (e) => { e.preventDefault(); setDropTarget(group.key); } : undefined}
            onDragLeave={canDrop ? () => setDropTarget((t) => (t === group.key ? null : t)) : undefined}
            onDrop={canDrop ? (e) => {
              e.preventDefault();
              setDropTarget(null);
              onDropOnColumn(isUncategorized ? null : group.key);
            } : undefined}
          >
            <header className="dt-group-head">
              <button
                type="button" className="dt-group-toggle" onClick={() => onToggleCollapse(group.key)}
                title={isCollapsed ? "Expand" : "Collapse"}
              >
                {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              </button>

              {renaming === group.key ? (
                <input
                  autoFocus className="dt-input dt-group-rename" value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={() => commitRename(group.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(group.key);
                    if (e.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="dt-group-title"
                  disabled={!isColumn || isUncategorized}
                  onClick={() => { setRenaming(group.key); setRenameDraft(group.key); }}
                  title={isColumn && !isUncategorized ? "Rename column" : undefined}
                >
                  {group.key}
                </button>
              )}

              <span className="dt-group-count">{group.count}</span>

              {isColumn && !isUncategorized && (
                <button
                  type="button" className="dt-btn dt-btn-icon dt-row-action"
                  onClick={() => onDeleteColumn(group.key)} title="Delete column"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </header>

            {!isCollapsed && (
              <div className="dt-group-body">
                {group.entries.length === 0 ? (
                  <p className="dt-group-placeholder">
                    {isColumn ? (dragEnabled ? "Drag cards here" : "No cards yet") : "Empty"}
                  </p>
                ) : renderBody(group)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
