import { useState } from "react";
import { Upload, X, Sparkles, Info } from "lucide-react";
import Modal from "./Modal";
import { CARD_TYPES, RARITIES, MANA_COLORS } from "../constants";
import { isValidManaCost, manaCostCmc, manaCostColors } from "../lib/mana";
import { resizeImageFile } from "../lib/image";
import { uploadImageToR2 } from "../lib/r2";
import { scanCardImage, parseOcrResults } from "../lib/ocr";
import { fetchHellfallCard, buildImportPatch } from "../lib/hellfall";

const scanLabels = {
  name: "Reading the name…",
  typeLine: "Reading the type line…",
  rulesText: "Reading the rules text…",
  pt: "Reading power/toughness…",
};

function emptyFace(source) {
  return {
    name: source?.name || "",
    manaCost: source?.mana_cost || "",
    cmc: source?.cmc ?? 0,
    colors: source?.colors || [],
    type: source?.type || "Creature",
    subtype: source?.subtype || "",
    rarity: source?.rarity || "Common",
    power: source?.power || "",
    toughness: source?.toughness || "",
    text: source?.rules_text || "",
    flavorText: source?.flavor_text || "",
    tagsText: (source?.tags || []).join(", "),
    previewUrl: source?.image_url || "",
  };
}

function faceToSavePayload(face, addedBy) {
  return {
    name: face.name.trim(),
    manaCost: face.manaCost.trim(),
    cmc: Number(face.cmc) || 0,
    colors: face.colors,
    type: face.type,
    subtype: face.subtype.trim(),
    rarity: face.rarity,
    power: face.power,
    toughness: face.toughness,
    text: face.text,
    flavorText: face.flavorText,
    tags: Array.from(new Set(face.tagsText.split(",").map((t) => t.trim()).filter(Boolean))),
    addedBy,
  };
}

// The full set of fields for one face of a card - used once for the front,
// and again, identically, for the back when the card is double-faced.
function CardFaceFields({
  idPrefix, value, onChange, duplicateName, validManaCost,
  imgBusy, onFile, showScan, scanState, onScan,
}) {
  const toggleColor = (key) =>
    onChange((f) => ({ ...f, colors: f.colors.includes(key) ? f.colors.filter((c) => c !== key) : [...f.colors, key] }));

  const handleManaCostChange = (e) => {
    const manaCost = e.target.value.toUpperCase();
    onChange((f) => ({
      ...f,
      manaCost,
      cmc: isValidManaCost(manaCost) ? manaCostCmc(manaCost) : f.cmc,
      colors: isValidManaCost(manaCost) ? manaCostColors(manaCost) : f.colors,
    }));
  };

  const imageInputId = `dt-card-image-${idPrefix}`;

  return (
    <>
      <div style={{ padding: 22, display: "grid", gridTemplateColumns: "minmax(0, 150px) 1fr", gap: 20 }}>
        <div>
          <label
            htmlFor={imageInputId}
            style={{ display: "block", aspectRatio: "5/7", background: "var(--panel2)", border: "1px dashed var(--border)", borderRadius: 8, cursor: "pointer", overflow: "hidden", position: "relative" }}
          >
            {value.previewUrl
              ? <img src={value.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--text-dim)", fontSize: 12, textAlign: "center", padding: 8 }}>
                  <Upload size={20} />
                  <span>{imgBusy ? "Processing…" : "Upload image"}</span>
                </div>
              )}
          </label>
          <input id={imageInputId} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onFile(e.target.files?.[0])} />

          {showScan && (
            <>
              <button
                type="button" className="dt-btn"
                style={{ width: "100%", justifyContent: "center", marginTop: 8, fontSize: 12, padding: "6px 8px" }}
                onClick={onScan}
                disabled={!value.previewUrl || scanState.status === "loading" || scanState.status === "scanning"}
              >
                <Sparkles size={13} />
                {scanState.status === "loading" || scanState.status === "scanning" ? "Scanning…" : "Scan card for text"}
              </button>
              {scanState.message && (
                <p style={{ fontSize: 11, lineHeight: 1.4, marginTop: 6, color: scanState.status === "error" ? "#E9A79B" : "var(--text-dim)" }}>
                  {scanState.message}
                </p>
              )}
            </>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Name</label>
            <input
              className="dt-input" autoFocus={idPrefix === "front"}
              value={value.name} onChange={(e) => onChange((f) => ({ ...f, name: e.target.value }))} placeholder="Card name"
            />
            {duplicateName && (
              <p style={{ fontSize: 11, lineHeight: 1.4, marginTop: 4, color: "#E9A79B" }}>
                A card named "{value.name.trim()}" already exists in the pool.
              </p>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                Mana cost
                <Info
                  size={12}
                  style={{ cursor: "help" }}
                  title={'Use W, U, B, R, G, X and a single number, e.g. "2WU". For hybrid mana, separate two colors with a slash, e.g. "W/B" — it counts as 1 pip but gives the card both color identities.'}
                />
              </label>
              <input className="dt-input" value={value.manaCost} onChange={handleManaCostChange} placeholder="e.g. 2W/BU" />
              {!validManaCost && (
                <p style={{ fontSize: 11, lineHeight: 1.4, marginTop: 4, color: "#E9A79B" }}>
                  Use only W, U, B, R, G, X, a single number, and hybrid pips like "W/B", e.g. "2W/BU".
                </p>
              )}
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>CMC</label>
              <input className="dt-input" type="number" min="0" value={value.cmc} onChange={(e) => onChange((f) => ({ ...f, cmc: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Colors</label>
            <div style={{ display: "flex", gap: 6 }}>
              {MANA_COLORS.map((c) => (
                <button
                  key={c.key} type="button" className="dt-pip-toggle"
                  style={value.colors.includes(c.key) ? { background: c.hex, color: "#211A0D", borderColor: c.hex } : {}}
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
          <select className="dt-select" value={value.type} onChange={(e) => onChange((f) => ({ ...f, type: e.target.value }))}>
            {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Subtype</label>
          <input className="dt-input" value={value.subtype} onChange={(e) => onChange((f) => ({ ...f, subtype: e.target.value }))} placeholder="e.g. Elf Wizard" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Rarity</label>
          <select className="dt-select" value={value.rarity} onChange={(e) => onChange((f) => ({ ...f, rarity: e.target.value }))}>
            {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {value.type === "Creature" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Power</label>
              <input className="dt-input" value={value.power} onChange={(e) => onChange((f) => ({ ...f, power: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Toughness</label>
              <input className="dt-input" value={value.toughness} onChange={(e) => onChange((f) => ({ ...f, toughness: e.target.value }))} />
            </div>
          </div>
        )}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Rules text</label>
          <textarea className="dt-textarea" rows={3} value={value.text} onChange={(e) => onChange((f) => ({ ...f, text: e.target.value }))} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Flavor text</label>
          <textarea className="dt-textarea" rows={2} value={value.flavorText} onChange={(e) => onChange((f) => ({ ...f, flavorText: e.target.value }))} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Tags</label>
          <input className="dt-input" value={value.tagsText} onChange={(e) => onChange((f) => ({ ...f, tagsText: e.target.value }))} placeholder="Comma separated, e.g. Removal, Aggro" />
        </div>
      </div>
    </>
  );
}

export default function CardForm({ initial, profileName, existingCards, onCancel, onSave }) {
  const [form, setForm] = useState(() => emptyFace(initial));
  const [isDoubleFaced, setIsDoubleFaced] = useState(!!initial?.back);
  const [back, setBack] = useState(() => emptyFace(initial?.back));

  const [imageBlobs, setImageBlobs] = useState(null); // { full, thumb } — only set when a new image is chosen
  const [backImageBlobs, setBackImageBlobs] = useState(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [backImgBusy, setBackImgBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocr, setOcr] = useState({ status: "idle", message: "" });
  const [hellfallId, setHellfallId] = useState("");
  const [hellfallImport, setHellfallImport] = useState({ status: "idle", message: "" });

  const isDuplicateName = (name, ownId) => {
    const n = name.trim().toLowerCase();
    if (!n) return false;
    return (existingCards || []).some((c) => c.id !== ownId && c.name.trim().toLowerCase() === n);
  };
  const duplicateName = isDuplicateName(form.name, initial?.id);
  const backDuplicateName = isDoubleFaced && isDuplicateName(back.name, initial?.back?.id);
  const validManaCost = isValidManaCost(form.manaCost);
  const backValidManaCost = !isDoubleFaced || isValidManaCost(back.manaCost);
  const canSave = form.name.trim() && !duplicateName && validManaCost
    && (!isDoubleFaced || (back.name.trim() && !backDuplicateName && backValidManaCost));

  const resizeAndStore = async (file, setBlobs, setPreviewUrl, setBusy) => {
    if (!file) return;
    setBusy(true);
    try {
      const [full, thumb] = await Promise.all([
        resizeImageFile(file, 900, 0.85),
        resizeImageFile(file, 400, 0.8),
      ]);
      setBlobs({ full: full.blob, thumb: thumb.blob });
      setPreviewUrl(full.previewUrl);
    } catch (e) {
      console.error(e);
    }
    setBusy(false);
  };

  const handleFile = async (file) => {
    setOcr({ status: "idle", message: "" });
    await resizeAndStore(file, setImageBlobs, (url) => setForm((f) => ({ ...f, previewUrl: url })), setImgBusy);
  };

  const handleBackFile = async (file) => {
    await resizeAndStore(file, setBackImageBlobs, (url) => setBack((b) => ({ ...b, previewUrl: url })), setBackImgBusy);
  };

  const handleImportFromHellfall = async () => {
    if (!hellfallId.trim()) return;
    setHellfallImport({ status: "loading", message: "Looking up card…" });
    try {
      const card = await fetchHellfallCard(hellfallId);
      const { patch, warnings } = buildImportPatch(card);
      setForm((f) => ({ ...f, ...patch }));
      if (card.image) {
        const blob = await (await fetch(card.image)).blob();
        await handleFile(blob);
      }

      let allWarnings = warnings;
      if (card.back) {
        setIsDoubleFaced(true);
        const backResult = buildImportPatch(card.back);
        setBack((b) => ({ ...b, ...backResult.patch }));
        if (card.back.image) {
          const backBlob = await (await fetch(card.back.image)).blob();
          await handleBackFile(backBlob);
        }
        allWarnings = [...warnings, ...backResult.warnings.map((w) => `back ${w}`)];
      }

      setHellfallImport({
        status: "done",
        message: allWarnings.length
          ? `Imported "${card.name}" — double-check ${allWarnings.join(", ")} before saving.`
          : `Imported "${card.name}" — review the fields below before saving.`,
      });
    } catch (e) {
      setHellfallImport({ status: "error", message: e.message || "Couldn't import that card." });
    }
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
    if (!canSave) return;
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

      let backPayload = null;
      if (isDoubleFaced) {
        let backImageUrl = initial?.back?.image_url || null;
        let backThumbUrl = initial?.back?.thumb_url || null;
        if (backImageBlobs) {
          [backImageUrl, backThumbUrl] = await Promise.all([
            uploadImageToR2(backImageBlobs.full),
            uploadImageToR2(backImageBlobs.thumb),
          ]);
        }
        backPayload = {
          ...faceToSavePayload(back, initial?.back?.added_by || profileName),
          imageUrl: backImageUrl,
          thumbUrl: backThumbUrl,
        };
      }

      await onSave({
        ...faceToSavePayload(form, initial?.added_by || profileName),
        imageUrl,
        thumbUrl,
        back: backPayload,
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

        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--text-dim)" }}>Import from Hellfall (optional)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="dt-input"
              style={{ flex: 1 }}
              value={hellfallId}
              onChange={(e) => setHellfallId(e.target.value)}
              placeholder="Card id or URL, e.g. 6593 or https://hellfall.skeleton.club/card/6593"
            />
            <button
              type="button" className="dt-btn"
              onClick={handleImportFromHellfall}
              disabled={!hellfallId.trim() || hellfallImport.status === "loading"}
            >
              {hellfallImport.status === "loading" ? "Importing…" : "Import"}
            </button>
          </div>
          {hellfallImport.message && (
            <p style={{ fontSize: 11, lineHeight: 1.4, color: hellfallImport.status === "error" ? "#E9A79B" : "var(--text-dim)" }}>
              {hellfallImport.message}
            </p>
          )}
        </div>

        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={isDoubleFaced} onChange={(e) => setIsDoubleFaced(e.target.checked)} />
            Double-Faced Card
          </label>
        </div>

        <CardFaceFields
          idPrefix="front"
          value={form}
          onChange={setForm}
          duplicateName={duplicateName}
          validManaCost={validManaCost}
          imgBusy={imgBusy}
          onFile={handleFile}
          showScan
          scanState={ocr}
          onScan={handleScan}
        />

        {isDoubleFaced && (
          <>
            <div style={{ padding: "0 22px 8px" }}>
              <p className="dt-brand" style={{ fontSize: 13, margin: 0, color: "var(--text-dim)" }}>Back face</p>
            </div>
            <CardFaceFields
              idPrefix="back"
              value={back}
              onChange={setBack}
              duplicateName={backDuplicateName}
              validManaCost={backValidManaCost}
              imgBusy={backImgBusy}
              onFile={handleBackFile}
              showScan={false}
            />
          </>
        )}

        <div style={{ padding: "16px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="dt-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="dt-btn dt-btn-primary" disabled={!canSave || saving} onClick={submit}>
            {saving ? "Saving…" : initial ? "Save changes" : "Add to pool"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
