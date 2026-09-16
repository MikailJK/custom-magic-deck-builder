import { TYPE_ORDER, UNCATEGORIZED, CURVE_CAP, MANA_COLORS } from "../constants";

export const COST_BUCKETS = [...Array(CURVE_CAP).keys()].map(String).concat(`${CURVE_CAP}+`);

export const costBucket = (card) => {
  const cmc = Math.max(0, card?.cmc || 0);
  return cmc >= CURVE_CAP ? `${CURVE_CAP}+` : String(cmc);
};

const groupKeyFor = (entry, groupBy) => {
  if (groupBy === "category") return entry.category || UNCATEGORIZED;
  if (groupBy === "cost") return entry.card ? costBucket(entry.card) : "—";
  return entry.card?.type || "Removed card";
};

const comparators = {
  name: (a, b) => (a.card?.name || "").localeCompare(b.card?.name || ""),
  cost: (a, b) =>
    (a.card?.cmc ?? 0) - (b.card?.cmc ?? 0) || (a.card?.name || "").localeCompare(b.card?.name || ""),
};

export function groupEntries(entries, groupBy, deckCategories, sortBy) {
  const groups = new Map();
  const ensure = (key) => {
    if (!groups.has(key)) groups.set(key, []);
    return groups.get(key);
  };

  // In column mode every column the user made stays visible even when empty,
  // so there is always somewhere to drop a card.
  if (groupBy === "category") {
    deckCategories.forEach(ensure);
    ensure(UNCATEGORIZED);
  }
  entries.forEach((e) => ensure(groupKeyFor(e, groupBy)).push(e));

  const present = [...groups.keys()];
  let keys;
  if (groupBy === "type") {
    keys = [...TYPE_ORDER.filter((t) => groups.has(t)), ...present.filter((k) => !TYPE_ORDER.includes(k))];
  } else if (groupBy === "cost") {
    keys = [...COST_BUCKETS.filter((c) => groups.has(c)), ...present.filter((k) => !COST_BUCKETS.includes(k))];
  } else {
    const known = new Set([...deckCategories, UNCATEGORIZED]);
    keys = [
      ...deckCategories.filter((c) => groups.has(c)),
      ...present.filter((k) => !known.has(k)), // a column deleted from under the card
      UNCATEGORIZED,
    ];
  }

  const sort = comparators[sortBy] || comparators.name;
  return keys.map((key) => {
    const sorted = [...groups.get(key)].sort(sort);
    return { key, entries: sorted, count: sorted.reduce((a, e) => a + e.qty, 0) };
  });
}

export function deckStats(entries) {
  const total = entries.reduce((a, e) => a + e.qty, 0);

  const curveCounts = Object.fromEntries(COST_BUCKETS.map((b) => [b, 0]));
  const colorCounts = Object.fromEntries(MANA_COLORS.map((c) => [c.key, 0]));
  const typeCounts = {};
  let colorless = 0;
  let nonLandCount = 0;
  let costSum = 0;

  entries.forEach(({ card, qty }) => {
    if (!card) return;
    const type = card.type || "Unknown";
    typeCounts[type] = (typeCounts[type] || 0) + qty;

    const colors = card.colors || [];
    if (colors.length === 0) colorless += qty;
    colors.forEach((c) => {
      if (colorCounts[c] !== undefined) colorCounts[c] += qty;
    });

    // Lands sit outside the curve and the average — they distort both.
    if (type === "Land") return;
    curveCounts[costBucket(card)] += qty;
    nonLandCount += qty;
    costSum += (card.cmc || 0) * qty;
  });

  const typeOrder = [
    ...TYPE_ORDER.filter((t) => typeCounts[t]),
    ...Object.keys(typeCounts).filter((t) => !TYPE_ORDER.includes(t)),
  ];

  return {
    total,
    curve: COST_BUCKETS.map((b) => ({ cmc: b, count: curveCounts[b] })),
    colorCounts,
    colorless,
    types: typeOrder.map((type) => ({ type, count: typeCounts[type] })),
    avgCost: nonLandCount ? costSum / nonLandCount : 0,
    nonLandCount,
  };
}
