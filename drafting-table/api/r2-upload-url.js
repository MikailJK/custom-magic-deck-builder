import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

// This runs server-side only (a Vercel serverless function), which is why the
// R2 credentials below are safe here but must never be prefixed with VITE_
// or referenced from src/ — that would bundle them into the public browser code.
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Require a real, currently-valid Supabase session before minting an
  // upload URL — otherwise anyone who finds this endpoint could fill your
  // bucket (and run up usage) without ever signing in.
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

  const { filename, contentType } = req.body || {};
  if (!filename || !contentType) {
    res.status(400).json({ error: "filename and contentType are required" });
    return;
  }
  // Keep uploads confined to a predictable prefix and extension, since the
  // filename otherwise comes from the client.
  const safeName = filename.replace(/[^a-zA-Z0-9/_.-]/g, "");
  if (!safeName.startsWith("cards/")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  try {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: safeName,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${safeName}`;
    res.status(200).json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error("r2-upload-url error", err);
    res.status(500).json({ error: "Could not create an upload URL" });
  }
}
