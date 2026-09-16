import { MANA_COLORS } from "../constants";

const COLORS = MANA_COLORS.map((c) => c.key).join("");

// A pip is one colored/X letter, or a hybrid pair joined by a slash ("W/B"),
// which costs one mana but grants both colors. A cost is any run of pips with
// at most one contiguous group of digits: "2WU", "WU2" and "2W/BU" are valid,
// "2W3" is not.
const PIP = `(?:[${COLORS}]\\/[${COLORS}]|[${COLORS}X])`;
const MANA_COST_RE = new RegExp(`^${PIP}*(\\d+)?${PIP}*$`);
const TOKEN_RE = new RegExp(`${PIP}|\\d+`, "g");

export const isValidManaCost = (value) => MANA_COST_RE.test(value);

// Splits a cost into ordered tokens, left to right, for rendering.
export function parseManaCost(value) {
  const tokens = (value || "").toUpperCase().match(TOKEN_RE) || [];
  return tokens.map((text) => {
    if (/^\d+$/.test(text)) return { kind: "generic", text };
    if (text === "X") return { kind: "x", text };
    if (text.includes("/")) return { kind: "hybrid", text, colors: text.split("/") };
    return { kind: "color", text, colors: [text] };
  });
}

// X contributes nothing until it is paid, and a hybrid pip counts once.
export function manaCostCmc(value) {
  return parseManaCost(value).reduce((total, token) => {
    if (token.kind === "generic") return total + parseInt(token.text, 10);
    if (token.kind === "x") return total;
    return total + 1;
  }, 0);
}

export function manaCostColors(value) {
  const found = new Set();
  parseManaCost(value).forEach((token) => (token.colors || []).forEach((c) => found.add(c)));
  return MANA_COLORS.map((c) => c.key).filter((key) => found.has(key));
}
