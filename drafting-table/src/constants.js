export const MANA_COLORS = [
  { key: "W", label: "White", hex: "#DCD3AE" },
  { key: "U", label: "Blue", hex: "#4A87B4" },
  { key: "B", label: "Black", hex: "#8E86A8" },
  { key: "R", label: "Red", hex: "#C1583B" },
  { key: "G", label: "Green", hex: "#5C8A54" },
];
export const COLOR_HEX = Object.fromEntries(MANA_COLORS.map((c) => [c.key, c.hex]));
export const CARD_TYPES = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land", "Battle"];
export const TYPE_ORDER = ["Creature", "Planeswalker", "Instant", "Sorcery", "Artifact", "Enchantment", "Battle", "Land"];
export const RARITIES = ["Common", "Uncommon", "Rare", "Mythic"];
export const RARITY_HEX = { Common: "#9C9689", Uncommon: "#7FA4B0", Rare: "#C8A24B", Mythic: "#C1583B" };

export const emptyFilters = { text: "", colors: [], type: "All", rarity: "All", tag: "All" };

export const DEFAULT_TARGET_SIZE = 40;
export const UNCATEGORIZED = "Uncategorized";
export const CURVE_CAP = 7; // costs at or above this share one "7+" bucket

export const GROUP_MODES = [
  { key: "type", label: "Type" },
  { key: "cost", label: "Cost" },
  { key: "category", label: "Category" },
];
export const SORT_MODES = [
  { key: "name", label: "Name" },
  { key: "cost", label: "Cost" },
];
export const VIEW_MODES = [
  { key: "stacks", label: "Stacks" },
  { key: "text", label: "Text" },
  { key: "grid", label: "Grid" },
];
