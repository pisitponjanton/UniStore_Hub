"use client";

import {
  useCallback,
  useLayoutEffect,
  useState,
} from "react";

interface ErrorSummaryFocusRequest {
  elementId: string;
  sequence: number;
}

export function useErrorSummaryFocus() {
  const [request, setRequest] =
    useState<ErrorSummaryFocusRequest | null>(null);

  useLayoutEffect(() => {
    if (!request) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(request.elementId)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [request]);

  return useCallback((elementId: string) => {
    setRequest((current) => ({
      elementId,
      sequence: (current?.sequence ?? 0) + 1,
    }));
  }, []);
}
