"use client";

import { useEffect } from "react";

/** On narrow screens the details live after a long queue in DOM order.
 * Reveal and focus them only after an explicit item selection succeeds. */
export function useRevealSelectedQueueDetail(selectedId: string | null, elementId: string) {
  useEffect(() => {
    if (!selectedId || typeof window.matchMedia !== "function"
        || !window.matchMedia("(max-width: 880px)").matches) return;
    const element = document.getElementById(elementId);
    if (!element) return;
    element.scrollIntoView?.({ block: "start", behavior: "auto" });
    element.focus({ preventScroll: true });
  }, [selectedId, elementId]);
}
