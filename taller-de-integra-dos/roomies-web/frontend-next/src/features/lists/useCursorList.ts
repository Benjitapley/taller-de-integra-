"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applicationRequest, ApplicationRequestError } from "../publicaciones/application-client";

type Page<T> = { items: T[]; siguiente_cursor: string | null };
type State<T> = { path: string; items: T[]; cursor: string | null; loading: boolean; loaded: boolean; error: string };
const empty = <T,>(path: string): State<T> => ({ path, items: [], cursor: null, loading: true, loaded: false, error: "" });

/** Server cursors only. A new query cancels the old request and discards its private rows. */
export function useCursorList<T>(path: string, identify: (item: T) => number, enabled = true) {
  const [state, setState] = useState<State<T>>(() => empty(path));
  const active = useRef<AbortController | null>(null);
  const failed = useRef<string | null>(null);
  const visited = useRef(new Set<string>());
  const fetchPage = useCallback(async (next: string | null = null) => {
    if (active.current || !enabled) return;
    const controller = new AbortController();
    active.current = controller;
    failed.current = next;
    setState(previous => ({ ...(previous.path === path ? previous : empty<T>(path)), loading: true, error: "" }));
    try {
      const url = new URL(path, window.location.origin);
      if (next) url.searchParams.set("cursor", next);
      const page = await applicationRequest<Page<T>>(url.pathname + url.search, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!Array.isArray(page.items) || !(page.siguiente_cursor === null || typeof page.siguiente_cursor === "string" && page.siguiente_cursor.length > 0) ||
          page.items.some(item => !Number.isSafeInteger(identify(item)) || identify(item) < 1) ||
          (page.siguiente_cursor !== null && (page.siguiente_cursor === next || (next !== null && visited.current.has(page.siguiente_cursor))))) throw new Error();
      if (!next) visited.current.clear();
      if (next) visited.current.add(next);
      setState(previous => {
        const rows = new Map((next && previous.path === path ? previous.items : []).map(item => [identify(item), item]));
        for (const item of page.items) rows.set(identify(item), item);
        return { path, items: [...rows.values()], cursor: page.siguiente_cursor, loading: false, loaded: true, error: "" };
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      const denied = error instanceof ApplicationRequestError && [401, 403, 404].includes(error.status);
      setState(previous => ({ ...(denied || previous.path !== path ? empty<T>(path) : previous), loading: false,
        error: error instanceof ApplicationRequestError ? error.message : "No se pudo cargar la lista. Intenta nuevamente." }));
    } finally { if (active.current === controller) active.current = null; }
  }, [enabled, identify, path]);

  useEffect(() => {
    failed.current = null; visited.current.clear();
    if (enabled) void fetchPage();
    return () => { active.current?.abort(); active.current = null; };
  }, [enabled, fetchPage]);

  const setItems = useCallback((update: T[] | ((previous: T[]) => T[])) => {
    setState(previous => ({ ...previous, items: typeof update === "function" ? update(previous.items) : update }));
  }, []);
  const current = state.path === path && enabled ? state : empty<T>(path);
  return { ...current, setItems, load: fetchPage, retryLoad: () => fetchPage(failed.current) };
}
