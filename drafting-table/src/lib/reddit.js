import { supabase } from "../supabaseClient";

const REDDIT_HOST = /^((www|old|np|m)\.)?reddit\.com$|^redd\.it$|^(i|preview|external-preview)\.redd\.it$/i;

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Not signed in");
  return data.session.access_token;
}

// A Reddit post link (including the mobile app's /s/ share links) or a direct
// i.redd.it image link. Anything else falls through to the Hellfall import.
export function isRedditUrl(input) {
  try {
    const url = new URL((input || "").trim());
    return (url.protocol === "https:" || url.protocol === "http:") && REDDIT_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

// The server does the lookup and download (the browser can't read Reddit's
// images cross-origin) and returns the image bytes.
export async function fetchRedditImage(url) {
  const token = await getAccessToken();
  const res = await fetch(`/api/reddit-image?url=${encodeURIComponent(url.trim())}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Reddit import failed (${res.status})`);
  }
  return res.blob();
}
