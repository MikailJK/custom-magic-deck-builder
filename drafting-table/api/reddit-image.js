import { createClient } from "@supabase/supabase-js";

// Server-side only. The browser can't call Reddit or read i.redd.it images
// cross-origin, so this looks up a post through Reddit's official API (app-only
// OAuth - unauthenticated requests from cloud IPs like Vercel's get blocked),
// downloads its image, and hands the bytes back. It's gated behind a signed-in
// session the same way r2-upload-url.js is, so it can't be used as an open proxy.
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const REDDIT_HOSTS = new Set(["reddit.com", "www.reddit.com", "old.reddit.com", "np.reddit.com", "m.reddit.com"]);
// Images are only ever downloaded from Reddit's own CDN, so the URL a user
// pastes can never point this server at an arbitrary host.
const IMAGE_HOSTS = new Set(["i.redd.it", "preview.redd.it", "external-preview.redd.it"]);
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 4 * 1024 * 1024; // Vercel caps a function response at 4.5MB
const TIMEOUT_MS = 10000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const userAgent = () => process.env.REDDIT_USER_AGENT || "drafting-table/1.0";

let tokenCache = { token: null, expiresAt: 0 };

async function getRedditToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const { REDDIT_CLIENT_ID: id, REDDIT_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) {
    throw new HttpError(500, "Reddit import isn't set up on the server (missing REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET).");
  }
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(),
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new HttpError(502, `Reddit rejected the server's credentials (${res.status}).`);
  const json = await res.json();
  if (!json.access_token) throw new HttpError(502, "Reddit didn't return an access token.");
  // Refresh a minute early so a token never expires mid-request.
  tokenCache = { token: json.access_token, expiresAt: Date.now() + Math.max(0, (json.expires_in || 3600) - 60) * 1000 };
  return tokenCache.token;
}

const isAllowedImage = (raw) => {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && IMAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
};

// Reddit HTML-escapes URLs in some payloads; raw_json=1 avoids it but this
// keeps a stray "&amp;" from breaking a signed preview URL.
const unescapeUrl = (raw) => (raw || "").replace(/&amp;/g, "&");

// What a pasted link points at: a direct CDN image, a post id, or a share link
// (/r/sub/s/xyz) that has to be resolved to a post first.
function parseInput(raw) {
  let url;
  try {
    url = new URL((raw || "").trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();

  if (IMAGE_HOSTS.has(host)) return { kind: "image", imageUrl: url.toString() };

  if (host === "redd.it") {
    const id = url.pathname.split("/")[1];
    return /^[a-z0-9]+$/i.test(id || "") ? { kind: "post", id } : null;
  }
  if (!REDDIT_HOSTS.has(host)) return null;

  const post = url.pathname.match(/\/(?:comments|gallery)\/([a-z0-9]+)/i);
  if (post) return { kind: "post", id: post[1] };
  const share = url.pathname.match(/^\/(?:r|u|user)\/[^/]+\/s\/[^/]+/i);
  if (share) return { kind: "share", path: share[0] };
  return null;
}

// Only the path of the share link is used and the host is always Reddit's, so
// the pasted URL can't redirect the server anywhere else. The authenticated
// request comes first because plain reddit.com requests from Vercel get blocked.
async function resolveShareLink(path, token) {
  const attempts = [
    [`https://oauth.reddit.com${path}`, { Authorization: `Bearer ${token}` }],
    [`https://www.reddit.com${path}`, {}],
  ];
  for (const [url, headers] of attempts) {
    try {
      const res = await fetch(url, {
        redirect: "manual",
        headers: { "User-Agent": userAgent(), ...headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      res.body?.cancel?.();
      const match = (res.headers.get("location") || "").match(/\/comments\/([a-z0-9]+)/i);
      if (match) return match[1];
    } catch (err) {
      console.error("reddit-image: share link attempt failed", url, err);
    }
  }
  throw new HttpError(422, "Couldn't open that share link. Open the post and copy the link from the address bar, or save the image and upload it.");
}

// Gallery first image, then the linked image, then the preview, then the same
// again on the original post when this is a crosspost.
function imageFromPost(post) {
  if (post.is_gallery && post.gallery_data?.items?.length) {
    const meta = post.media_metadata?.[post.gallery_data.items[0].media_id];
    const url = unescapeUrl(meta?.s?.u);
    if (meta?.status !== "failed" && isAllowedImage(url)) return url;
  }
  const linked = unescapeUrl(post.url_overridden_by_dest);
  if (isAllowedImage(linked)) return linked;
  const preview = unescapeUrl(post.preview?.images?.[0]?.source?.url);
  if (isAllowedImage(preview)) return preview;
  const parent = post.crosspost_parent_list?.[0];
  return parent ? imageFromPost(parent) : null;
}

async function findPostImage(id, token) {
  const res = await fetch(`https://oauth.reddit.com/api/info?id=t3_${id}&raw_json=1`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": userAgent() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 429) throw new HttpError(502, "Reddit is rate-limiting requests right now. Try again in a minute.");
  if (!res.ok) throw new HttpError(502, `Reddit lookup failed (${res.status}).`);
  const post = (await res.json())?.data?.children?.[0]?.data;
  if (!post) throw new HttpError(404, "Couldn't find that Reddit post. It may be removed or private.");
  const image = imageFromPost(post);
  if (!image) throw new HttpError(422, "That post doesn't have an image (text and video posts aren't supported).");
  return image;
}

async function downloadImage(url) {
  const res = await fetch(url, {
    redirect: "manual",
    headers: { "User-Agent": userAgent() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new HttpError(502, `Couldn't download the image from Reddit (${res.status}).`);
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!IMAGE_TYPES.includes(type)) throw new HttpError(415, "That link doesn't point to a supported image.");
  const tooBig = new HttpError(413, "That image is too large to import (max 4MB). Save it and upload it instead.");
  if (Number(res.headers.get("content-length")) > MAX_BYTES) throw tooBig;

  const chunks = [];
  let total = 0;
  for await (const chunk of res.body) {
    total += chunk.length;
    if (total > MAX_BYTES) throw tooBig;
    chunks.push(chunk);
  }
  return { type, bytes: Buffer.concat(chunks) };
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

  const target = parseInput((req.query.url || "").toString());
  if (!target) {
    res.status(400).json({ error: "That doesn't look like a Reddit post link." });
    return;
  }

  try {
    let imageUrl = target.imageUrl;
    if (!imageUrl) {
      const redditToken = await getRedditToken();
      const postId = target.kind === "share" ? await resolveShareLink(target.path, redditToken) : target.id;
      imageUrl = await findPostImage(postId, redditToken);
    }
    const { type, bytes } = await downloadImage(imageUrl);
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).send(bytes);
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("reddit-image error", err);
    res.status(502).json({ error: "Couldn't reach Reddit." });
  }
}
