"use client";
import { useEffect } from "react";

/** El servidor posee el refresh; el navegador solo solicita renovación con CSRF. */
export default function SessionRenewal() {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function schedule() {
      try {
        const response = await fetch("/web-api/auth/sesion", { cache: "no-store" });
        if (!response.ok || stopped) return;
        const value = await response.json();
        if (typeof value.expires_in !== "number") return;
        timer = setTimeout(async () => {
          if (stopped) return;
          const renewed = await fetch("/web-api/auth/renovar", { method: "POST", headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" }, body: "{}" }).catch(() => null);
          if (renewed?.ok && !stopped) void schedule();
        }, Math.max(1000, (value.expires_in - 30) * 1000));
      } catch { /* Los errores reales se presentan en la operación de la página. */ }
    }
    void schedule();
    return () => { stopped = true; clearTimeout(timer); };
  }, []);
  return null;
}
