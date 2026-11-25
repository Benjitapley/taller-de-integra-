"use client";

import { useEffect, useState, type ReactNode } from "react";
import Card from "@/components/ui/Card";

export default function MemberAccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "allowed" | "denied" | "error">("loading");
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const check = () => { void fetch("/web-api/arriendos/mio", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(response => {
        if (!active) return;
        if ([401, 403, 404].includes(response.status)) { setState("denied"); return; }
        if (!response.ok) throw new Error();
        return response.json().then(data => {
          if (!Number.isSafeInteger(data?.id_arriendo) || data.id_arriendo < 1 || data.estado !== "Activo") throw new Error();
          if (active) setState("allowed");
        });
      }).catch(() => { if (!controller.signal.aborted) setState("error"); }); };
    const refresh = () => { if (document.visibilityState === "visible") check(); };
    check();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; controller.abort(); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  if (state === "loading") return <main><Card><p role="status">Verificando acceso al arriendo…</p></Card></main>;
  if (state === "denied") return <main><Card><h1>Acceso no disponible</h1><p>El chat y las tareas son privados para integrantes activos del arriendo.</p></Card></main>;
  if (state === "error") return <main><Card><p role="alert">No pudimos verificar tu acceso al arriendo. Intenta nuevamente.</p></Card></main>;
  return children;
}
