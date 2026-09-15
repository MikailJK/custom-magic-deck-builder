import { COLOR_HEX } from "../constants";

export default function ManaPips({ colors, size = 20 }) {
  if (!colors || colors.length === 0) return <span className="dt-chip">Colorless</span>;
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {colors.map((c) => (
        <span key={c} className="dt-pip" style={{ background: COLOR_HEX[c], width: size, height: size, fontSize: size * 0.5 }}>
          {c}
        </span>
      ))}
    </div>
  );
}
