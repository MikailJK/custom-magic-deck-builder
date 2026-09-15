import { createWorker } from "tesseract.js";
import { loadImageEl } from "./image";
import { CARD_TYPES } from "../constants";

// Rough proportions of a standard Magic-style card frame, as fractions of
// the full image (x, y, width, height). Tuned for the classic black-bordered
// template — homebrew cards with very different layouts will read less
// accurately, since this crops before running OCR on each piece separately.
const CARD_OCR_REGIONS = {
  name: { x: 0.06, y: 0.03, w: 0.8, h: 0.085 },
  typeLine: { x: 0.06, y: 0.575, w: 0.8, h: 0.055 },
  rulesText: { x: 0.07, y: 0.635, w: 0.8, h: 0.24 },
  pt: { x: 0.64, y: 0.89, w: 0.3, h: 0.075 },
};

function cropRegionDataUrl(imageEl, region) {
  const sx = Math.round(imageEl.width * region.x);
  const sy = Math.round(imageEl.height * region.y);
  const sw = Math.round(imageEl.width * region.w);
  const sh = Math.round(imageEl.height * region.h);
  const scale = Math.max(1, Math.round(260 / Math.max(1, sh)));
  const canvas = document.createElement("canvas");
  canvas.width = sw * scale;
  canvas.height = sh * scale;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(imageEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

// Scans an already-loaded image (a data URL or a same-origin/CORS-friendly
// URL) region by region and returns the raw OCR text per region.
export async function scanCardImage(imageSrc, onProgress) {
  const img = await loadImageEl(imageSrc);
  const worker = await createWorker("eng");
  const results = {};
  try {
    for (const key of Object.keys(CARD_OCR_REGIONS)) {
      onProgress?.(key);
      const crop = cropRegionDataUrl(img, CARD_OCR_REGIONS[key]);
      const { data } = await worker.recognize(crop);
      results[key] = (data?.text || "").trim();
    }
  } finally {
    await worker.terminate();
  }
  return results;
}

// Turns raw per-region OCR text into a partial card-form patch. Mana cost
// and colors are deliberately left out — those are icon symbols on most
// card templates, not real text, so OCR can't read them reliably.
export function parseOcrResults(results) {
  const patch = {};
  if (results.name) {
    const firstLine = results.name.split("\n").map((l) => l.trim()).filter(Boolean)[0];
    if (firstLine) patch.name = firstLine;
  }
  if (results.typeLine) {
    const line = results.typeLine.replace(/\n/g, " ").trim();
    const parts = line.split(/[—-]/);
    const mainPart = (parts[0] || "").trim();
    const subPart = parts.slice(1).join(" ").trim();
    const matched = CARD_TYPES.find((t) => mainPart.toLowerCase().includes(t.toLowerCase()));
    if (matched) patch.type = matched;
    if (subPart) patch.subtype = subPart;
  }
  if (results.rulesText) {
    const cleaned = results.rulesText.replace(/\n{2,}/g, "\n").trim();
    if (cleaned) patch.text = cleaned;
  }
  if (results.pt) {
    const m = results.pt.match(/(\d+)\s*\/\s*(\d+)/);
    if (m) { patch.power = m[1]; patch.toughness = m[2]; }
  }
  return patch;
}
