export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Resizes/compresses an uploaded file down to a max dimension and returns
// both a Blob (for uploading) and a data URL (for an instant local preview).
export async function resizeImageFile(file, maxDim, quality) {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImageEl(dataUrl);
  let { width, height } = img;
  if (width > height) {
    if (width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
  } else if (height > maxDim) {
    width = Math.round((width * maxDim) / height); height = maxDim;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#141210";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const previewUrl = canvas.toDataURL("image/jpeg", quality);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return { blob, previewUrl, width, height };
}
