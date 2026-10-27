"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Calls a module's embed API with the screen's token, swapping in the fresh
 * token the API hands back before the old one expires.
 */
export function useEmbedApi(initialToken: string) {
  const token = useRef(initialToken);
  return useCallback(async <T = Record<string, unknown>>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${token.current}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { nextToken?: string | null; error?: string };
    if (json.nextToken) token.current = json.nextToken;
    if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
    return json as T;
  }, []);
}

/** Load data now and every `everyMs`, pausing while the tab is hidden. */
export function usePolling<T>(load: () => Promise<T>, everyMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const refresh = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load");
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, everyMs);
    return () => clearInterval(timer);
  }, [refresh, everyMs]);
  return { data, error, refresh };
}
