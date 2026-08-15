"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "voxpilot:recent-instant-calls";
const MAX_RECENT = 5;

export type RecentInstantCall = {
  url: string;
  createdAt: string;
};

function isRecentInstantCall(value: unknown): value is RecentInstantCall {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.url === "string" && typeof entry.createdAt === "string";
}

function readRecent(): RecentInstantCall[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentInstantCall).slice(0, MAX_RECENT);
  } catch {
    // Corrupt or inaccessible localStorage should never break the feature - it just
    // behaves as if there's no history yet.
    return [];
  }
}

/**
 * Optional localStorage-backed history of recently generated instant call links.
 * Purely a client-side convenience - no server/database persistence.
 */
export function useRecentInstantCalls() {
  const [recent, setRecent] = useState<RecentInstantCall[]>([]);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  const addRecent = useCallback((url: string) => {
    const next = [
      { url, createdAt: new Date().toISOString() },
      ...readRecent().filter((entry) => entry.url !== url),
    ].slice(0, MAX_RECENT);

    setRecent(next);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private browsing / storage quota - the dialog still works, it just won't
        // remember this link for next time.
      }
    }
  }, []);

  return { recent, addRecent };
}
