import { supabase } from "../supabaseClient";
import { CARD_TYPES } from "../constants";
import { isValidManaCost, manaCostCmc, manaCostColors } from "./mana";

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Not signed in");
  return data.session.access_token;
}

// Accepts either a bare id ("6593") or a full permalink
// (https://hellfall.skeleton.club/card/6593) and returns the id.
export function extractHellfallId(input) {
  const raw = (input || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/card\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  } catch {
    return raw;
  }
}

export async function fetchHellfallCard(idOrUrl) {
  const id = extractHellfallId(idOrUrl);
  if (!id) throw new Error("Enter a Hellfall card id or URL, e.g. 6593 or https://hellfall.skeleton.club/card/6593");

  const token = await getAccessToken();
  const res = await fetch(`/api/hellfall-card?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Hellfall lookup failed (${res.status})`);
  }
  return res.json();
}

// Hellfall/Scryfall-style mana costs look like "{2}{W}{W}" - this app's
// mana cost input is the compact "2WW" form (see lib/mana.js).
export function convertManaCost(raw) {
  if (!raw) return "";
  const tokens = [...raw.matchAll(/\{([^}]+)\}/g)].map((m) => m[1].toUpperCase());
  return tokens.join("");
}

// Same approach as the OCR type-line parser in lib/ocr.js: the part before
// the dash is searched for a known card type (checking CARD_TYPES in order,
// so "Artifact Creature" resolves to "Creature"), everything after is the
// subtype.
export function splitTypeLine(typeLine) {
  const line = (typeLine || "").replace(/\n/g, " ").trim();
  const parts = line.split(/[—-]/);
  const mainPart = (parts[0] || "").trim();
  const subtype = parts.slice(1).join(" ").trim();
  const type = CARD_TYPES.find((t) => mainPart.toLowerCase().includes(t.toLowerCase())) || null;
  return { type, subtype };
}

// Hellfall can carry power/toughness as a computed float (e.g. 2.3333333333333335)
// rather than a whole number - round those to the nearest integer, but leave
// non-numeric placeholders like "*", "X", or "1+*" untouched.
function roundStat(value) {
  if (value == null) return null;
  const str = String(value).trim();
  if (str === "") return str;
  const num = Number(str);
  return Number.isFinite(num) ? String(Math.round(num)) : str;
}

// Maps a /api/hellfall-card response onto the CardForm field patch, and
// reports which fields it couldn't confidently fill in so the caller can
// tell the user what still needs a manual look.
export function buildImportPatch(card) {
  const patch = {};
  const warnings = [];

  if (card.name) patch.name = card.name;

  const manaCost = convertManaCost(card.mana_cost);
  if (manaCost && isValidManaCost(manaCost)) {
    patch.manaCost = manaCost;
    patch.cmc = manaCostCmc(manaCost);
    patch.colors = manaCostColors(manaCost);
  } else if (card.mana_cost) {
    warnings.push("mana cost");
  }

  const { type, subtype } = splitTypeLine(card.type_line);
  if (type) patch.type = type;
  else if (card.type_line) warnings.push("type");
  if (subtype) patch.subtype = subtype;

  if (card.power != null) patch.power = roundStat(card.power);
  if (card.toughness != null) patch.toughness = roundStat(card.toughness);
  if (card.oracle_text) patch.text = card.oracle_text;
  if (card.flavor_text) patch.flavorText = card.flavor_text;

  if (!card.image) warnings.push("image");

  return { patch, warnings };
}
