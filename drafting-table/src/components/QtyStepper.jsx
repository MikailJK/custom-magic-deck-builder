import { Minus, Plus } from "lucide-react";
import QtyValue from "./QtyValue";

export default function QtyStepper({ qty, min = 0, max = 99, onChange, size = 13, disableIncrement }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
      <button
        type="button" className="dt-btn dt-qty-btn"
        onClick={() => onChange(qty - 1)} disabled={qty <= min} title="Remove one copy"
      >
        <Minus size={size - 2} />
      </button>
      <QtyValue qty={qty} min={min} max={max} onChange={onChange} />
      <button
        type="button" className="dt-btn dt-qty-btn"
        onClick={() => onChange(qty + 1)} disabled={qty >= max || disableIncrement} title="Add one copy"
      >
        <Plus size={size - 2} />
      </button>
    </div>
  );
}
