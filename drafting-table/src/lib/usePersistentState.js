import { useState, useEffect } from "react";

// View preferences belong to the person looking, not to the shared deck, so they
// live in the browser rather than the database. `isValid` guards against a value
// left behind by an older build — without it a stale key would leave a select
// showing nothing.
export default function usePersistentState(key, fallback, isValid) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) return fallback;
      const parsed = JSON.parse(stored);
      return isValid && !isValid(parsed) ? fallback : parsed;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Blocked or full storage (private windows) — the preference just won't stick.
    }
  }, [key, value]);

  return [value, setValue];
}
