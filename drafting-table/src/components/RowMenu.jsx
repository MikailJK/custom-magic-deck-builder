import { useRef, useEffect } from "react";
import { ChevronDown, Plus, Minus, ArrowRight, ArrowLeft, X } from "lucide-react";
import QtyValue from "./QtyValue";

// Collapses a text row's per-card actions into one button so the card name gets
// the rest of the width. The trigger doubles as the quantity readout, which is
// why there is no separate stepper on the row.
// Open state is owned by the deck editor so that only one row's menu can be open
// at a time, and so hovering a different row can close this one.
export default function RowMenu({ open, onOpenChange, qty, max, board, disableIncrement, onSetQty, onMoveBoard, onRemove }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) onOpenChange(false);
    };
    const onKey = (e) => { if (e.key === "Escape") onOpenChange(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const run = (action) => { onOpenChange(false); action(); };
  const toMaybe = board === "main";

  return (
    <div className="dt-menu" ref={wrapRef}>
      <button
        type="button" className="dt-btn dt-menu-trigger"
        onClick={() => onOpenChange(!open)}
        aria-haspopup="menu" aria-expanded={open} title={`${qty} in this list — card actions`}
      >
        {qty}
        <ChevronDown size={11} />
      </button>

      {open && (
        <div className="dt-menu-panel" role="menu">
          <div className="dt-menu-qty">
            <span>Quantity</span>
            <QtyValue qty={qty} min={0} max={max} onChange={onSetQty} />
          </div>
          <div className="dt-menu-sep" />
          <button
            type="button" role="menuitem" className="dt-menu-item"
            disabled={disableIncrement || qty >= max}
            onClick={() => run(() => onSetQty(qty + 1))}
          >
            <Plus size={12} /> Add a copy
          </button>
          <button
            type="button" role="menuitem" className="dt-menu-item"
            disabled={qty <= 1}
            onClick={() => run(() => onSetQty(qty - 1))}
          >
            <Minus size={12} /> Remove a copy
          </button>
          <div className="dt-menu-sep" />
          <button
            type="button" role="menuitem" className="dt-menu-item"
            onClick={() => run(onMoveBoard)}
          >
            {toMaybe ? <ArrowRight size={12} /> : <ArrowLeft size={12} />}
            {toMaybe ? "Move to maybe board" : "Move to deck"}
          </button>
          <button
            type="button" role="menuitem" className="dt-menu-item dt-menu-item-danger"
            onClick={() => run(onRemove)}
          >
            <X size={12} /> Remove all copies
          </button>
        </div>
      )}
    </div>
  );
}
