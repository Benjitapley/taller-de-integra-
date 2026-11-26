"use client";

import { useEffect, useState } from "react";
import type { ArriendoDto } from "@/features/recorrido/types";

/** Revalida al volver a la pestaña y durante una sesión abierta. Nunca persiste datos privados. */
export function useActiveRental() {
  const [rental, setRental] = useState<ArriendoDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "denied" | "error">("loading");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let controller: AbortController | undefined;
    let live = true;
    let checking = false;
    async function load() {
      if (checking) return;
      checking = true;
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const response = await fetch("/web-api/arriendos/mio", { credentials: "same-origin", cache: "no-store", signal });
        if (!live || signal.aborted) return;
        if ([401, 403, 404].includes(response.status)) {
          setRental(null);
          setStatus(response.status === 404 ? "empty" : "denied");
          return;
        }
        if (!response.ok) throw new Error();
        const data = await response.json() as ArriendoDto;
        if (!live || signal.aborted) return;
        if (data?.estado === "Finalizado") { setRental(null); setStatus("empty"); return; }
        if (!Number.isSafeInteger(data?.id_arriendo) || data.id_arriendo < 1 ||
            !Number.isSafeInteger(data.id_publicacion) || data.id_publicacion < 1 || data.estado !== "Activo" ||
            ![data.cupos_totales, data.integrantes_activos, data.cupos_disponibles].every(value => Number.isSafeInteger(value) && value >= 0) ||
            data.integrantes_activos + data.cupos_disponibles !== data.cupos_totales) throw new Error();
        setRental(data);
        setStatus("ready");
      } catch {
        if (live && !signal.aborted) { setRental(null); setStatus("error"); }
      } finally {
        checking = false;
      }
    }
    const focus = () => { if (document.visibilityState === "visible") void load(); };
    void load();
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    const interval = window.setInterval(focus, 5_000);
    return () => {
      live = false;
      controller?.abort();
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
      window.clearInterval(interval);
    };
  }, [version]);

  function retry() { setRental(null); setStatus("loading"); setVersion(value => value + 1); }
  return { rental, status, retry };
}
