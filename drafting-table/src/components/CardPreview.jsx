const WIDTH = 240;
const HEIGHT = Math.round((WIDTH * 7) / 5);

// A single floating preview layer, rendered once at the page level so it is
// never clipped by a scrolling column.
export default function CardPreview({ preview }) {
  if (!preview?.card) return null;
  const url = preview.card.image_url || preview.card.thumb_url;
  if (!url) return null;

  const left = Math.max(12, Math.min(preview.x + 20, window.innerWidth - WIDTH - 12));
  const top = Math.max(12, Math.min(preview.y - HEIGHT / 2, window.innerHeight - HEIGHT - 12));

  return (
    <div style={{ position: "fixed", left, top, width: WIDTH, zIndex: 80, pointerEvents: "none" }}>
      <img
        src={url} alt=""
        style={{
          width: "100%", display: "block", borderRadius: 10,
          border: "1px solid var(--border)", boxShadow: "0 14px 36px rgba(0,0,0,.6)",
        }}
      />
    </div>
  );
}
