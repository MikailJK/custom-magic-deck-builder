#!/usr/bin/env node
/**
 * Pulls card data from hellfall.skeleton.club search URLs and card permalinks.
 *
 * The site is a client-rendered SPA: it loads its entire card database as a
 * static JSON file and filters it in the browser using Scryfall-style query
 * syntax (q=/unique=/as= params). This script does the same filtering
 * server-side instead of scraping rendered HTML.
 *
 * Two URL shapes are supported:
 *   https://hellfall.skeleton.club/?q=...&unique=...    search results - filtered against the catalog
 *   https://hellfall.skeleton.club/card/<hcid>          single-card permalink - looked up directly by hcid
 *
 * Usage:
 *   node scripts/scrape-hellfall.mjs "<hellfall URL or raw query>" [options]
 *
 * Options (must be typed literally, e.g. --out cards.json - do not include the [] shown here):
 *   --out <file>       Write results as JSON to this file (default: stdout)
 *   --images <dir>     Download each matching card's image into this directory
 *   --unique <mode>    Override unique mode: cards | prints | art (default: from URL, else "cards")
 *   --no-cache         Force re-download of the catalog instead of using the cached copy
 *
 * Supported query syntax (a useful subset of Scryfall's, not the full grammar):
 *   bare words          substring match against name, type_line, and oracle_text (AND'd together)
 *   "quoted phrase"     treated as one bare term
 *   -term               negates a bare term or field filter
 *   t:/type:<text>      substring match against type_line
 *   o:/oracle:<text>    substring match against oracle_text
 *   c:<wubrg>           card colors include all given letters; c:m multicolor, c:c colorless
 *   id:<wubrg>          color identity includes all given letters
 *   pow:/tou:/mv:<cmp>  numeric compare on power/toughness/mana_value, e.g. pow>=4, mv=3, tou<2
 *   is:<tag>            matches an entry in the card's tags/base_tags list
 *   name:/n:<text>      substring match against name only
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const CATALOG_URL = 'https://storage.googleapis.com/hellfall-489004-hellfall-catalog/catalog.json';
const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_PATH = path.join(CACHE_DIR, 'hellfall-catalog.json');
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--images') args.images = argv[++i];
    else if (a === '--unique') args.unique = argv[++i];
    else if (a === '--no-cache') args.noCache = true;
    else {
      if (a.startsWith('-') || a.includes('--')) {
        console.error(`Warning: unrecognized option "${a}" - treating it as a plain argument. Flags must be typed without the [] shown in --help, e.g. --out cards.json`);
      }
      args._.push(a);
    }
  }
  return args;
}

// A search page looks like https://hellfall.skeleton.club/?q=...&unique=...
// A single-card permalink looks like https://hellfall.skeleton.club/card/<hcid>
// and has no query string to parse - it must be looked up by hcid directly.
function parseInput(input) {
  try {
    const url = new URL(input);
    const cardMatch = url.pathname.match(/\/card\/([^/]+)/);
    if (cardMatch) {
      return { kind: 'card', hcid: decodeURIComponent(cardMatch[1]) };
    }
    return {
      kind: 'search',
      q: url.searchParams.get('q') ?? '',
      unique: url.searchParams.get('unique') ?? 'cards',
    };
  } catch {
    return { kind: 'search', q: input, unique: 'cards' };
  }
}

async function loadCatalog(noCache) {
  if (!noCache) {
    try {
      const stat = await fs.stat(CACHE_PATH);
      if (Date.now() - stat.mtimeMs < CACHE_MAX_AGE_MS) {
        const cached = await fs.readFile(CACHE_PATH, 'utf-8');
        return JSON.parse(cached).data;
      }
    } catch {
      // no cache yet, fall through to download
    }
  }

  console.error(`Downloading catalog from ${CATALOG_URL} ...`);
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`Failed to fetch catalog: ${res.status} ${res.statusText}`);
  const text = await res.text();

  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CACHE_PATH, text, 'utf-8');

  return JSON.parse(text).data;
}

// --- Query tokenizing/parsing -------------------------------------------

function tokenize(q) {
  const tokens = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(q)) !== null) {
    tokens.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return tokens;
}

const FIELD_RE = /^(-)?([a-zA-Z]+):(.+)$/;
const CMP_RE = /^(>=|<=|!=|>|<|=)?(.+)$/;

function compare(cardValue, cmpToken) {
  const match = CMP_RE.exec(cmpToken);
  const op = match[1] ?? '=';
  const rawTarget = match[2];
  const target = Number(rawTarget);
  const value = Number(cardValue);

  if (Number.isNaN(target) || Number.isNaN(value)) {
    // Non-numeric power/toughness (e.g. "*") - fall back to string equality.
    return String(cardValue ?? '').toLowerCase() === rawTarget.toLowerCase();
  }

  switch (op) {
    case '>=': return value >= target;
    case '<=': return value <= target;
    case '!=': return value !== target;
    case '>': return value > target;
    case '<': return value < target;
    default: return value === target;
  }
}

function buildPredicate(tokens) {
  const clauses = tokens.map((token) => {
    const fieldMatch = FIELD_RE.exec(token);
    if (!fieldMatch) {
      const negate = token.startsWith('-') && token.length > 1;
      const term = (negate ? token.slice(1) : token).toLowerCase();
      const test = (card) =>
        (card.name ?? '').toLowerCase().includes(term) ||
        (card.type_line ?? '').toLowerCase().includes(term) ||
        (card.oracle_text ?? '').toLowerCase().includes(term);
      return negate ? (card) => !test(card) : test;
    }

    const [, neg, rawField, value] = fieldMatch;
    const field = rawField.toLowerCase();
    const negate = neg === '-';
    let test;

    if (field === 't' || field === 'type') {
      const v = value.toLowerCase();
      test = (card) => (card.type_line ?? '').toLowerCase().includes(v);
    } else if (field === 'o' || field === 'oracle' || field === 'fo') {
      const v = value.toLowerCase();
      test = (card) => (card.oracle_text ?? '').toLowerCase().includes(v);
    } else if (field === 'name' || field === 'n') {
      const v = value.toLowerCase();
      test = (card) => (card.name ?? '').toLowerCase().includes(v);
    } else if (field === 'c' || field === 'color') {
      const v = value.toLowerCase();
      test = (card) => {
        const colors = (card.colors ?? []).map((c) => c.toLowerCase());
        if (v === 'm') return colors.length > 1;
        if (v === 'c') return colors.length === 0;
        return v.split('').every((letter) => colors.includes(letter));
      };
    } else if (field === 'id' || field === 'identity') {
      const v = value.toLowerCase();
      test = (card) => {
        const identity = (card.color_identity ?? []).map((c) => c.toLowerCase());
        if (v === 'c') return identity.length === 0;
        return v.split('').every((letter) => identity.includes(letter));
      };
    } else if (field === 'pow' || field === 'power') {
      test = (card) => compare(card.power, value);
    } else if (field === 'tou' || field === 'toughness') {
      test = (card) => compare(card.toughness, value);
    } else if (field === 'mv' || field === 'cmc') {
      test = (card) => compare(card.mana_value, value);
    } else if (field === 'is') {
      const v = value.toLowerCase();
      test = (card) => {
        const tags = [...(card.tags ?? []), ...(card.base_tags ?? [])].map((t) => t.toLowerCase());
        return tags.some((t) => t.includes(v));
      };
    } else {
      // Unknown field prefix - ignore it rather than mis-filter.
      console.error(`Warning: unsupported query field "${rawField}:" - ignoring this term`);
      test = () => true;
    }

    return negate ? (card) => !test(card) : test;
  });

  return (card) => clauses.every((clause) => clause(card));
}

// --- Dedup ---------------------------------------------------------------

function dedupe(cards, mode) {
  if (mode === 'prints') return cards;

  const seen = new Set();
  const keyFor = mode === 'art' ? (c) => c.image ?? c.id : (c) => c.oracle_id ?? c.name;
  const out = [];
  for (const card of cards) {
    const key = keyFor(card);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(card);
  }
  return out;
}

// --- Image download --------------------------------------------------------

function sanitizeFilename(name) {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

async function downloadImages(cards, dir, concurrency = 5) {
  await fs.mkdir(dir, { recursive: true });
  let index = 0;

  async function worker() {
    while (index < cards.length) {
      const card = cards[index++];
      if (!card.image) continue;
      try {
        const res = await fetch(card.image);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const contentType = res.headers.get('content-type') ?? '';
        const ext = contentType.includes('png') ? 'png' : 'jpg';
        const filename = `${sanitizeFilename(card.name)}.${ext}`;
        const buf = Buffer.from(await res.arrayBuffer());
        await fs.writeFile(path.join(dir, filename), buf);
        console.error(`Saved image: ${filename}`);
      } catch (err) {
        console.error(`Failed to download image for "${card.name}": ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
}

// --- Main ------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args._[0];
  if (!input) {
    console.error('Usage: node scripts/scrape-hellfall.mjs "<hellfall search URL or query>" [--out file.json] [--images dir]');
    process.exit(1);
  }

  const parsed = parseInput(input);
  const catalog = await loadCatalog(args.noCache);

  let matched;
  if (parsed.kind === 'card') {
    matched = catalog.filter((card) => card.hcid === parsed.hcid);
    console.error(`Card permalink hcid=${parsed.hcid}  ->  ${matched.length} match(es)`);
    if (matched.length === 0) {
      console.error(`No card found with hcid "${parsed.hcid}". It may not be in the current catalog snapshot - try --no-cache to refresh it.`);
    }
  } else {
    const unique = args.unique ?? parsed.unique ?? 'cards';
    const predicate = buildPredicate(tokenize(parsed.q));
    matched = dedupe(catalog.filter(predicate), unique);
    console.error(`Query: ${JSON.stringify(parsed.q)}  unique=${unique}  ->  ${matched.length} match(es)`);
  }

  const results = matched.map((card) => ({
    name: card.name,
    mana_cost: card.mana_cost ?? '',
    type_line: card.type_line,
    oracle_text: card.oracle_text ?? '',
    power: card.power ?? null,
    toughness: card.toughness ?? null,
    image: card.image ?? null,
  }));

  const json = JSON.stringify(results, null, 2);
  if (args.out) {
    await fs.writeFile(args.out, json, 'utf-8');
    console.error(`Wrote ${results.length} card(s) to ${args.out}`);
  } else {
    console.log(json);
  }

  if (args.images) {
    await downloadImages(matched, args.images);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
