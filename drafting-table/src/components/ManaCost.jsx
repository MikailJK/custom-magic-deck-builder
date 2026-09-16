import { COLOR_HEX } from "../constants";
import { parseManaCost } from "../lib/mana";

// Renders a cost string as its symbols: "1BB" becomes a generic 1 followed by
// two black pips. A hybrid pip is one circle split between its two colors.
export default function ManaCost({ value, size = 15 }) {
  const tokens = parseManaCost(value);
  if (tokens.length === 0) return null;

  return (
    <span className="dt-manacost">
      {tokens.map((token, i) => {
        const style = { width: size, height: size, fontSize: Math.round(size * 0.6) };

        if (token.kind === "hybrid") {
          const [a, b] = token.colors;
          return (
            <span
              key={i} className="dt-pip" title={token.text}
              style={{ ...style, background: `linear-gradient(135deg, ${COLOR_HEX[a]} 0 50%, ${COLOR_HEX[b]} 50% 100%)` }}
            />
          );
        }
        if (token.kind === "color") {
          return (
            <span key={i} className="dt-pip" style={{ ...style, background: COLOR_HEX[token.colors[0]] }}>
              {token.text}
            </span>
          );
        }
        return (
          <span key={i} className="dt-pip dt-pip-generic" style={style}>
            {token.text}
          </span>
        );
      })}
    </span>
  );
}
