"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { publicationError, type PublicationError } from "./validation";
import PublicationErrorNotice from "./PublicationErrorNotice";

export default function ClosePublicationButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PublicationError | null>(null);
  async function close() {
    if (pending || !window.confirm("¿Cerrar este aviso? Se cancelarán las postulaciones pendientes. Los integrantes y las imágenes se conservarán.")) return;
    setPending(true); setError(null);
    try {
      const response = await fetch(`/web-api/publicaciones/${id}/cerrar`, { method: "PATCH", credentials: "same-origin",
        headers: { "X-Haycupo-CSRF": "1" }, signal: AbortSignal.timeout(15_000) });
      const saved = await response.json().catch(() => null);
      if (!response.ok) { setError(publicationError(response.status, saved)); return; }
      if (saved?.id_publicacion !== id || saved.estado !== "Cerrada") { setError(publicationError(503, null)); return; }
      router.refresh();
    } catch { setError(publicationError(503, null)); }
    finally { setPending(false); }
  }
  return <><Button variant="secondary" disabled={pending} onClick={() => void close()}>{pending ? "Cerrando…" : "Cerrar aviso"}</Button><PublicationErrorNotice error={error} /></>;
}
