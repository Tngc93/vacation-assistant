"use client";

import { useSyncExternalStore } from "react";
import { OFFLINE_ATTRIBUTE } from "@/lib/pwa/sw";

function subscribeToNetwork(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const neverChanges = () => () => {};

/** Whether the browser has a network; the server and the first render say yes. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeToNetwork, () => navigator.onLine, () => true);
}

/** Whether the service worker answered this page from its cache because the network failed (public/sw.js). */
export function useServedFromCache(): boolean {
  return useSyncExternalStore(neverChanges, () => document.documentElement.hasAttribute(OFFLINE_ATTRIBUTE), () => false);
}

/** Offline, or showing a saved copy: what the page shows may not be current. */
export function useOffline(): boolean {
  const online = useOnline();
  const fromCache = useServedFromCache();
  return !online || fromCache;
}
