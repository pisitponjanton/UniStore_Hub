"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Move keyboard focus to a completed server filter's feedback.
 * Only filter/clear actions call announceCompletion; initial GETs, list pagination
 * and unrelated payment/pickup mutations must not steal focus.
 */
export function useQueueFilterFeedback(filtering: boolean, inlineError: string | null) {
  const [revision, setRevision] = useState(0);
  const successRef = useRef<HTMLParagraphElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!revision || filtering) return;
    const target = inlineError ? errorRef.current : successRef.current;
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [revision, filtering, inlineError]);

  return {
    successRef,
    errorRef,
    announceCompletion: () => setRevision(value => value + 1),
  };
}
