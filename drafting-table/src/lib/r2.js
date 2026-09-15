import { supabase } from "../supabaseClient";

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Not signed in");
  return data.session.access_token;
}

async function requestUploadUrl(filename, contentType) {
  const token = await getAccessToken();
  const res = await fetch("/api/r2-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ filename, contentType }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Could not get an upload URL");
  }
  return res.json();
}

// Uploads a Blob to R2 via a short-lived presigned URL and returns the
// resulting public URL to store in the database.
export async function uploadImageToR2(blob) {
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const filename = `cards/${crypto.randomUUID()}.${ext}`;
  const { uploadUrl, publicUrl } = await requestUploadUrl(filename, blob.type);
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": blob.type },
    body: blob,
  });
  if (!putRes.ok) throw new Error("Upload to storage failed");
  return publicUrl;
}
