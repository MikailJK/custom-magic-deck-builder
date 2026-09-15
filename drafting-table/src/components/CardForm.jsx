import { useState } from "react";
import { Upload, X, Sparkles } from "lucide-react";
import Modal from "./Modal";
import { CARD_TYPES, RARITIES, MANA_COLORS } from "../constants";
import { resizeImageFile } from "../lib/image";
import { uploadImageToR2 } from "../lib/r2";
import { scanCardImage, parseOcrResults } from "../lib/ocr";

const scanLabels = {
  name: "Reading the name…",
  typeLine: "Reading the type line…",
  rulesText: "Reading the rules text…",
  pt: "Reading power/toughness…",
};

// Letters allowed in a mana cost, plus at most one contiguous run of digits
// (e.g. "2WU" and "WU2" are valid, "2W3" is not — two separate number groups).
const MANA_COST_RE = /^[WUBRGX]*(\d+)?[WUBRGX]*$/;

const isValidManaCost = (value) => MANA_COST_RE.test(value);

const computeCmc = (value) => {
  const match = value.match(/\d+/);
  const numeric = match ? parseInt(match[0], 10) : 0;
  const symbolPips = (value.match(/[WUBRG]/g) || []).length;
  return numeric + symbolPips;
};

const computeColors = (value) => MANA_COLORS.map((c) => c.key).filter((key) => value.includes(key));

export default function CardForm({ initial, profileName, existingCards, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name || "",
    manaCost: initial?.mana_cost || "",
    cmc: initial?.cmc ?? 0,
    colors: initial?.colors || [],
    type: initial?.type || "Creature",
    subtype: initial?.subtype || "",
    rarity: initial?.rarity || "Common",
    power: initial?.power || "",
    toughness: initial?.toughness || "",
    text: initial?.rules_text || "",
    flavorText: initial?.flavor_text || "",
    tagsText: (initial?.tags || []).join(", "),
    previewUrl: initial?.image_url || "",
  }));
  const [imageBlobs, setImageBlobs] = useState(null); // { full, thumb } — only set when a new image is chosen
  const [imgBusy, setImgBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocr, setOcr] = useState({ status: "idle", message: "" });

  const duplicateName = (() => {
    const name = form.name.trim().toLowerCase();
    if (!name) return false;
    return (existingCards || []).some(
      (c) => c.id !== initial?.id && c.name.trim().toLowerCase() === name
    );
  })();

  const validManaCost = isValidManaCost(form.manaCost);

  const toggleColor = (key) =>
    setForm((f) => ({ ...f, colors: f.colors.includes(key) ? f.colors.filter((c) => c !== key) : [...f.colors, key] }));

  const handleManaCostChange = (e) => {
    const manaCost = e.target.value.toUpperCase();
    setForm((f) => ({
      ...f,
      manaCost,
      cmc: isValidManaCost(manaCost) ? computeCmc(manaCost) : f.cmc,
      colors: isValidManaCost(manaCost) ? computeColors(manaCost) : f.colors,
    }));
  };

  const handleFile = async (file) => {
    if (!file) return;
    setImgBusy(true);
    setOcr({ status: "idle", message: "" });
    try {
      const [full, thumb] = await Promise.all([
        resizeImageFile(file, 900, 0.85),
        resizeImageFile(file, 400, 0.8),
      ]);
      setImageBlobs({ full: full.blob, thumb: thumb.blob });
      setForm((f) => ({ ...f, previewUrl: full.previewUrl }));
    } catch (e) {
      console.error(e);
    }
    setImgBusy(false);
  };

  const handleScan = async () => {
    if (!form.previewUrl) return;
    setOcr({ status: "loading", message: "Reading the card image…" });
    try {
      const results = await scanCardImage(form.previewUrl, (key) =>
        setOcr({ status: "scanning", message: scanLabels[key] || "Reading…" })
      );
      const patch = parseOcrResults(results);
      if (Object.keys(patch).length === 0) {
        setOcr({ status: "error", message: "Couldn't make out any text on this image — try the fields manually." });
      } else {
        setForm((f) => ({ ...f, ...patch }));
        setOcr({ status: "done", message: "Auto-filled from the image below — double-check it, and mana cost/colors still need your input." });
      }
    } catch (e) {
      setOcr({ status: "error", message: `OCR failed (${e.message || "unknown error"}). You can still fill in fields manually.` });
    }
  };

  const submit = async () => {
    if (!form.name.trim() || duplicateName || !validManaCost) return;
    setSaving(true);
    try {
      let imageUrl = initial?.image_url || null;
      let thumbUrl = initial?.thumb_url || null;
      if (imageBlobs) {
        [imageUrl, thumbUrl] = await Promise.all([
          uploadImageToR2(imageBlobs.full),
          uploadImageToR2(imageBlobs.thumb),
        ]);
      }
      const tags = Array.from(new Set(form.tagsText.split(",").map((t) => t.trim()).filter(Boolean)));
      await onSave({
        name: form.name.trim(),
        manaCost: form.manaCost.trim(),
        cmc: Number(form.cmc) || 0,
        colors: form.colors,
        type: form.type,
        subtype: form.subtype.trim(),
        rarity: form.rarity,
        power: form.power,
        toughness: form.toughness,
        text: form.text,
        flavorText: form.flavorText,
        tags,
        imageUrl,
        thumbUrl,
        addedBy: initial?.added_by || profileName,
      });
    } catch (e) {
      console.error(e);
      alert(`Couldn't save this card: ${e.message || "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onCancel} width={640} closeOnOverlayClick={false}>
      <div className="dt-scroll" style={{ maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="dt-brand" style={{ fontSize: 19, margin: 0 }}>{initial ? "Edit card" : "Add a card"}</h2>
          <button type="button" className="dt-btn dt-btn-icon" onClick={onCancel}><X size={16} /></button>
        </div>

        <div style={{ padding: 22, display: "grid", gridTemplateColumns: "150px 1fr", gap: 20 }}>
          <div>
            <label
              htmlFor="dt-card-image"
              style={{ display: "block", aspectRatio: "5/7", background: "var(--panel2)", border: "1px dashed var(--border)", borderRadius: 8, cursor: "pointer", overflow: "hidden", position: "relative" }}
            >
              {form.previewUrl
                ? <img src={form.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--text-dim)", fontSize: 12, textAlign: "center", padding: 8 }}>
                    <Upload size={20} />
                    <span>{imgBusy ? "Processing…" : "Upload image"}</span>
                  </div>
                )}
            </label>
            <input id="dt-card-image" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />

            <button
              type="button" className="dt-btn"
              style={{ width: "100%", justifyContent: "center", marginTop: 8, fontSize: 12, padding: "6px 8px" }}
              onClick={handleScan}
              disabled={!form.previewUrl || ocr.status === "loading" || ocr.status === "scanning"}
            >
              <Sparkles size={13} />
              {ocr.status === "loading" || ocr.status === "scanning" ? "Scanning…" : "Scan card for text"}
            </button>
            {ocr.message && (
              <p style={{ fontSize: 11, lineHeight: 1.4, marginTop: 6, color: ocr.status === "error" ? "#E9A79B" : "var(--text-dim)" }}>
                {ocr.message}
              </p>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Name</label>
              <input className="dt-input" autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Card name" />
              {duplicateName && (
                <p style={{ fontSize: 11, lineHeight: 1.4, marginTop: 4, color: "#E9A79B" }}>
                  A card named "{form.name.trim()}" already exists in the pool.
                </p>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Mana cost</label>
                <input className="dt-input" value={form.manaCost} onChange={handleManaCostChange} placeholder="e.g. 2WU" />
                {!validManaCost && (
                  <p style={{ fontSize: 11, lineHeight: 1.4, marginTop: 4, color: "#E9A79B" }}>
                    Use only W, U, B, R, G, X and a single number, e.g. "2WU".
                  </p>
                )}
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>CMC</label>
                <input className="dt-input" type="number" min="0" value={form.cmc} onChange={(e) => setForm((f) => ({ ...f, cmc: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Colors</label>
              <div style={{ display: "flex", gap: 6 }}>
                {MANA_COLORS.map((c) => (
                  <button
                    key={c.key} type="button" className="dt-pip-toggle"
                    style={form.colors.includes(c.key) ? { background: c.hex, color: "#211A0D", borderColor: c.hex } : {}}
                    onClick={() => toggleColor(c.key)}
                  >
                    {c.key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "0 22px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Type</label>
            <select className="dt-select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Subtype</label>
            <input className="dt-input" value={form.subtype} onChange={(e) => setForm((f) => ({ ...f, subtype: e.target.value }))} placeholder="e.g. Elf Wizard" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Rarity</label>
            <select className="dt-select" value={form.rarity} onChange={(e) => setForm((f) => ({ ...f, rarity: e.target.value }))}>
              {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {form.type === "Creature" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Power</label>
                <input className="dt-input" value={form.power} onChange={(e) => setForm((f) => ({ ...f, power: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Toughness</label>
                <input className="dt-input" value={form.toughness} onChange={(e) => setForm((f) => ({ ...f, toughness: e.target.value }))} />
              </div>
            </div>
          )}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Rules text</label>
            <textarea className="dt-textarea" rows={3} value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Flavor text</label>
            <textarea className="dt-textarea" rows={2} value={form.flavorText} onChange={(e) => setForm((f) => ({ ...f, flavorText: e.target.value }))} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Tags</label>
            <input className="dt-input" value={form.tagsText} onChange={(e) => setForm((f) => ({ ...f, tagsText: e.target.value }))} placeholder="Comma separated, e.g. Removal, Aggro" />
          </div>
        </div>

        <div style={{ padding: "16px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="dt-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="dt-btn dt-btn-primary" disabled={!form.name.trim() || duplicateName || !validManaCost || saving} onClick={submit}>
            {saving ? "Saving…" : initial ? "Save changes" : "Add to pool"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
