"use client";

import { useSyncExternalStore } from "react";

import {
  buildAuthPagePath,
  getAuthNavigationContext,
  type AuthNavigationContext,
} from "./return-route";

function subscribeToLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

function getSearchSnapshot() {
  return window.location.search;
}

function getServerSearchSnapshot() {
  return "";
}

function getLocationSnapshot() {
  return `${window.location.pathname}${window.location.search}`;
}

function getServerLocationSnapshot() {
  return "/";
}

export function useAuthNavigationContext(): AuthNavigationContext {
  const search = useSyncExternalStore(
    subscribeToLocation,
    getSearchSnapshot,
    getServerSearchSnapshot,
  );

  return getAuthNavigationContext(search);
}

export function useCurrentLoginHref(): string {
  const returnPath = useSyncExternalStore(
    subscribeToLocation,
    getLocationSnapshot,
    getServerLocationSnapshot,
  );

  return buildAuthPagePath("/login/", returnPath);
}
