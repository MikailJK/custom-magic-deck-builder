const WIDTH = 240;
const HEIGHT = Math.round((WIDTH * 7) / 5);
const GAP = 10;

// A single floating preview layer, rendered once at the page level so it is
// never clipped by a scrolling column. Double-faced cards show both images
// side by side.
export default function CardPreview({ preview }) {
  if (!preview?.card) return null;
  const frontUrl = preview.card.image_url || preview.card.thumb_url;
  const back = preview.card.back;
  const backUrl = back ? back.image_url || back.thumb_url : null;
  if (!frontUrl && !backUrl) return null;

  const totalWidth = backUrl ? WIDTH * 2 + GAP : WIDTH;
  const left = Math.max(12, Math.min(preview.x + 20, window.innerWidth - totalWidth - 12));
  const top = Math.max(12, Math.min(preview.y - HEIGHT / 2, window.innerHeight - HEIGHT - 12));

  const imgStyle = {
    width: WIDTH, display: "block", borderRadius: 10,
    border: "1px solid var(--border)", boxShadow: "0 14px 36px rgba(0,0,0,.6)",
  };

  return (
    <div style={{ position: "fixed", left, top, display: "flex", gap: GAP, zIndex: 80, pointerEvents: "none" }}>
      {frontUrl && <img src={frontUrl} alt="" style={imgStyle} />}
      {backUrl && <img src={backUrl} alt="" style={imgStyle} />}
    </div>
  );
}
