import { useEffect, useState } from "react";

// Drag-and-drop and hover previews both need a mouse. On touch screens and
// narrow layouts we fall back to the buttons and dropdowns instead.
const QUERY = "(pointer: coarse), (max-width: 900px)";

export default function useCoarsePointer() {
  const [coarse, setCoarse] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e) => setCoarse(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return coarse;
}
