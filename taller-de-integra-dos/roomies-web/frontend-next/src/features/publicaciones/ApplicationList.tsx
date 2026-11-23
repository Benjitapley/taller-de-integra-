"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { applicationRequest, ApplicationRequestError } from "./application-client";
import type { Application, CursorPage } from "./application-contract";
export function useCursorList<T>(path: string, identify: (item: T) => number, enabled = true) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const activeRequest = useRef<AbortController | null>(null);
  const failedCursor = useRef<string | null>(null);
  const fetchPage = useCallback((next: string | null = null) => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const url = new URL(path, window.location.origin);
    if (next) url.searchParams.set("cursor", next);
    return applicationRequest<CursorPage<T>>(url.pathname + url.search, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setItems(previous => {
        const rows = new Map((next ? previous : []).map(item => [identify(item), item]));
        for (const item of result.items) rows.set(identify(item), item);
        return [...rows.values()];
      });
      setCursor(result.siguiente_cursor === next ? null : result.siguiente_cursor);
      setLoaded(true);
      setError("");
    }).catch(failure => {
      if (!controller.signal.aborted) {
        if (failure instanceof ApplicationRequestError && [401,403,404].includes(failure.status)) { setItems([]); setCursor(null); setLoaded(false); }
        failedCursor.current = next;
        setError(failure instanceof ApplicationRequestError ? failure.message : "No se pudo cargar la lista. Intenta nuevamente.");
      }
    }).finally(() => {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    });
  }, [identify, path]);

  useEffect(() => {
    if (enabled) void fetchPage();
    return () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [enabled, fetchPage]);

  function load(next: string | null = null) {
    if (activeRequest.current) return;
    setLoading(true);
    setError("");
    return fetchPage(next);
  }
  return { items, setItems, cursor, loading, loaded, error, load, retryLoad: () => load(failedCursor.current) };
}


export const applicationId = (application: Application) => application.id_postulacion;
