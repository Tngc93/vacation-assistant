"use client";

import { useMemo, useSyncExternalStore } from "react";
import { connectionSnapshot, loadConnection, subscribeConnection } from "@/lib/ai/keyStore";

const serverSnapshot = () => null;

/** The saved AI connection, re-read whenever storage changes (this tab or another); null on the server. */
export function useAiConnection() {
  const snapshot = useSyncExternalStore(subscribeConnection, connectionSnapshot, serverSnapshot);
  return useMemo(() => (snapshot ? loadConnection() : null), [snapshot]);
}
