import { createClient } from "@supabase/supabase-js";

// This runs server-side only (a Vercel serverless function). Looking up a
// card means downloading the ~23MB Hellfall catalog and (usually) proxying
// an image fetch, so this is gated behind a signed-in session the same way
// r2-upload-url.js is - otherwise anyone who finds the endpoint could use it
// as a free bandwidth proxy.
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const CATALOG_URL = "https://storage.googleapis.com/hellfall-489004-hellfall-catalog/catalog.json";
const CATALOG_CACHE_MS = 60 * 60 * 1000; // 1h - kept in memory across warm invocations only

let catalogCache = { data: null, fetchedAt: 0 };

async function loadCatalog() {
  if (catalogCache.data && Date.now() - catalogCache.fetchedAt < CATALOG_CACHE_MS) {
    return catalogCache.data;
  }
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`Failed to fetch catalog: ${res.status}`);
  const json = await res.json();
  catalogCache = { data: json.data, fetchedAt: Date.now() };
  return catalogCache.data;
}

// Inlines the card image as a data URL so the browser never needs to fetch a
// cross-origin image directly - that would taint the canvas used to resize it.
async function imageToDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

// Transform/split/flip/aftermath/meld/mutate cards carry their real data in
// card_faces instead of the top-level fields - split-card faces in particular
// often have no image of their own (one printed image covers both halves),
// so fall back to the whole card's image in that case.
async function faceToResult(face, fallbackImage) {
  const imageUrl = face.image || fallbackImage;
  let image = null;
  if (imageUrl) {
    try {
      image = await imageToDataUrl(imageUrl);
    } catch (err) {
      console.error("hellfall-card: image fetch failed", err);
    }
  }
  return {
    name: face.name || "",
    mana_cost: face.mana_cost || "",
    type_line: face.type_line || "",
    oracle_text: face.oracle_text || "",
    flavor_text: face.flavor_text || "",
    power: face.power ?? null,
    toughness: face.toughness ?? null,
    image,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "Missing session token" });
    return;
  }
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  const id = (req.query.id || "").toString().trim();
  if (!id) {
    res.status(400).json({ error: 'Missing "id" query parameter' });
    return;
  }

  try {
    const catalog = await loadCatalog();
    const card = catalog.find((c) => c.hcid === id);
    if (!card) {
      res.status(404).json({ error: `No Hellfall card found with id "${id}"` });
      return;
    }

    const faces = card.card_faces && card.card_faces.length > 0 ? card.card_faces : [card];
    const front = await faceToResult(faces[0], card.image);
    const back = faces[1] ? await faceToResult(faces[1], card.image) : null;

    res.status(200).json({ hcid: card.hcid, ...front, back });
  } catch (err) {
    console.error("hellfall-card error", err);
    res.status(502).json({ error: "Couldn't reach the Hellfall catalog" });
  }
}
