"use client";

import { useEffect, type ReactNode } from "react";

import { authSession } from "./session";

export function SessionBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    void authSession.restore();
  }, []);

  return children;
}
