"use client";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";

export default function MemberAccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "allowed" | "denied" | "error">("loading");
  const [rentalId, setRentalId] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let checking = false;
    async function check() {
      if (checking || controller.signal.aborted) return;
      checking = true;
      try {
        const response = await fetch("/web-api/arriendos/mio", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (controller.signal.aborted) return;
        if ([401, 403, 404].includes(response.status)) { setRentalId(null); setState("denied"); return; }
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!Number.isSafeInteger(data?.id_arriendo) || data.id_arriendo < 1) throw new Error();
        if (data.estado !== "Activo") { setRentalId(null); setState("denied"); return; }
        setRentalId(data.id_arriendo); setState("allowed");
      } catch { if (!controller.signal.aborted) { setRentalId(null); setState("error"); } }
      finally { checking = false; }
    }
    const refresh = () => { if (document.visibilityState === "visible") void check(); };
    void check();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  if (state === "loading") return <main><Card><p role="status">Verificando acceso al arriendo…</p></Card></main>;
  if (state === "denied") return <main><Card><h1>Acceso no disponible</h1><p>El chat, su historial y las tareas son privados para integrantes activos del arriendo.</p><Link href="/mi-arriendo">Volver a Mi arriendo</Link></Card></main>;
  if (state === "error") return <main><Card><p role="alert">No pudimos verificar tu acceso al arriendo. Reintentando…</p></Card></main>;
  return <Fragment key={rentalId}>{children}</Fragment>;
}
