"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import RemoveMember from "./RemoveMember";
import { MembersView } from "@/features/recorrido/ConvivenciaViews";
import type { EstadoRecurso, IntegranteArriendoDto } from "@/features/recorrido/types";

type Rental = { id_arriendo: number };

export default function MemberDirectory({ rentalId }: { rentalId?: string }) {
  const [state, setState] = useState<EstadoRecurso<IntegranteArriendoDto[]>>({ status: "loading" });
  const [notice, setNotice] = useState("");
  const [canRemove, setCanRemove] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [resolvedRentalId, setResolvedRentalId] = useState<string | null>(rentalId ?? null);
  const [emptyMessage, setEmptyMessage] = useState("Aún no hay integrantes residentes.");
  const [loadingMore, setLoadingMore] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    void (async () => {
      try {
        let id = rentalId;
        if (!id) {
          const response = await fetch("/web-api/arriendos/mio", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
          if (response.status === 404) { setEmptyMessage("Aún no tienes un arriendo activo."); throw Object.assign(new Error(), { empty: true }); }
          if (!response.ok) throw new Error("No pudimos cargar tu arriendo. Intenta nuevamente.");
          const rental = await response.json() as Rental;
          id = String(rental.id_arriendo);
        }
        if (!/^[1-9][0-9]{0,9}$/.test(id)) throw new Error("Identificador de arriendo inválido.");
        if (live) setResolvedRentalId(id);
        const response = await fetch(`/web-api/arriendos/${id}/integrantes?activos=true`, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (response.status === 403) { if (live) setState({ status: "forbidden" }); return; }
        if (response.status === 404) { setEmptyMessage("No se encontró un arriendo disponible."); throw Object.assign(new Error(), { empty: true }); }
        if (!response.ok || !payload || !Array.isArray(payload.items) ||
            !(payload.siguiente_cursor === null || typeof payload.siguiente_cursor === "string")) throw new Error("No pudimos cargar la lista de integrantes. Intenta nuevamente.");
        if (live) {
          setState(payload.items.length ? { status: "ready", data: payload.items } : { status: "empty" });
          setCursor(payload.siguiente_cursor);
          setCanRemove(payload.puede_retirar === true);
        }
      } catch (error) {
        if (live && !controller.signal.aborted) {
          const empty = Boolean(error && typeof error === "object" && "empty" in error);
          setState(empty ? { status: "empty" } : { status: "error", message: error instanceof Error ? error.message : "No pudimos cargar la lista de integrantes." });
        }
      }
    })();
    return () => { live = false; controller.abort(); };
  }, [rentalId, version]);

  async function more() {
    if (!cursor || loadingMore || state.status !== "ready") return;
    setLoadingMore(true);
    try {
      const query = new URLSearchParams({ cursor, activos: "true" });
      if (!resolvedRentalId) throw new Error();
      const response = await fetch(`/web-api/arriendos/${resolvedRentalId}/integrantes?${query}`, { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !Array.isArray(payload.items) || !(payload.siguiente_cursor === null || typeof payload.siguiente_cursor === "string")) throw new Error();
      setState(current => current.status === "ready" ? { status: "ready", data: [...current.data, ...payload.items] } : current);
      setCursor(payload.siguiente_cursor);
    } catch {
      setState({ status: "error", message: "No pudimos cargar más integrantes. Intenta nuevamente." });
    } finally { setLoadingMore(false); }
  }

  function retry() {
    setState({ status: "loading" });
    setCursor(null);
    setEmptyMessage("Aún no hay integrantes residentes.");
    setVersion(value => value + 1);
  }

  return <main>
    <PageHeader title="Integrantes" description="Responsable de convivencia e integrantes activos del arriendo." />
    <p><Link href={rentalId ? `/mi-arriendo/${rentalId}` : "/mi-arriendo"}>Volver al arriendo</Link></p>
    {notice ? <p role="status">{notice}</p> : null}
    <MembersView state={state} emptyTitle={emptyMessage} />
    {canRemove && resolvedRentalId && state.status === "ready" ? <RemoveMember rentalId={resolvedRentalId} members={state.data} onRemoved={message => { setNotice(message); retry(); }} /> : null}
    {state.status === "error" ? <Button variant="secondary" onClick={retry}>Reintentar</Button> : null}
    {cursor && state.status === "ready" ? <Button variant="secondary" disabled={loadingMore} onClick={() => void more()}>{loadingMore ? "Cargando…" : "Más integrantes"}</Button> : null}
  </main>;
}
