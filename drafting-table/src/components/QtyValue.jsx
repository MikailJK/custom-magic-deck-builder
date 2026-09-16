import { useState, useRef, useEffect } from "react";

// The quantity as a number you can click and retype. Used on its own in a text
// row, and between the buttons of QtyStepper on the card tiles.
export default function QtyValue({ qty, min = 0, max = 99, onChange, title = "Click to type a quantity" }) {
  const [draft, setDraft] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (draft !== null) inputRef.current?.select();
  }, [draft]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    setDraft(null);
    if (!Number.isNaN(parsed) && parsed !== qty) onChange(Math.min(max, Math.max(min, parsed)));
  };

  if (draft === null) {
    return (
      <button type="button" className="dt-qty-value" onClick={() => setDraft(String(qty))} title={title}>
        {qty}
      </button>
    );
  }
  return (
    <input
      ref={inputRef} className="dt-qty-value dt-qty-input" type="text" inputMode="numeric"
      value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(null);
      }}
    />
  );
}
