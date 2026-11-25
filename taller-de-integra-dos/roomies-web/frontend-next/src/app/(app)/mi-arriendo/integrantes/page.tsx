"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { MembersView } from "@/features/recorrido/ConvivenciaViews";
import type { EstadoRecurso, IntegranteArriendoDto } from "@/features/recorrido/types";

type MemberPage = { items: IntegranteArriendoDto[]; siguiente_cursor: string | null };
type PageState = EstadoRecurso<IntegranteArriendoDto[]>;

export default function MembersPage() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [rentalId, setRentalId] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMore, setErrorMore] = useState("");
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    const requested = new URLSearchParams(window.location.search).get("arriendo");
    const rentalResponse = await fetch(requested ? `/web-api/arriendos/${encodeURIComponent(requested)}` : "/web-api/arriendos/mio", { cache: "no-store", signal });
    if (rentalResponse.status === 403) return { rentalId: null, forbidden: true as const };
    if (rentalResponse.status === 404) return { rentalId: null, page: null };
    if (!rentalResponse.ok) throw new Error("No pudimos consultar tu arriendo. Intenta nuevamente.");
    const rental = await rentalResponse.json();
    if (!Number.isSafeInteger(rental.id_arriendo) || rental.id_arriendo < 1) throw new Error("La respuesta de Mi arriendo no es válida.");
    const response = await fetch(`/web-api/arriendos/${rental.id_arriendo}/integrantes`, { cache: "no-store", signal });
    if (response.status === 403) return { rentalId: rental.id_arriendo, forbidden: true as const };
    if (!response.ok) throw new Error("No pudimos cargar los integrantes. Intenta nuevamente.");
    return { rentalId: rental.id_arriendo, page: await response.json() as MemberPage };
  }, []);

  const refresh = useCallback(() => {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setState({ status: "loading" });
    setCursor(null);
    setErrorMore("");
    void load(active.signal).then(result => {
      if (active.signal.aborted) return;
      setRentalId(result.rentalId);
      if ("forbidden" in result) { setState({ status: "forbidden" }); return; }
      if (!result.rentalId) { setState({ status: "empty" }); return; }
      const page = result.page;
      if (!page || !Array.isArray(page.items) || typeof page.siguiente_cursor !== "string" && page.siguiente_cursor !== null) throw new Error("No pudimos cargar los integrantes.");
      setCursor(page.siguiente_cursor);
      setState({ status: "ready", data: page.items });
    }).catch(error => {
      if (!active.signal.aborted) setState({ status: "error", message: error instanceof Error ? error.message : "No pudimos cargar los integrantes." });
    });
  }, [load]);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => { if (mounted) refresh(); });
    return () => { mounted = false; controller.current?.abort(); };
  }, [refresh]);

  async function loadMore() {
    if (!rentalId || !cursor || state.status !== "ready" || loadingMore) return;
    const active = new AbortController();
    controller.current?.abort();
    controller.current = active;
    setLoadingMore(true);
    setErrorMore("");
    try {
      const query = new URLSearchParams({ cursor });
      const response = await fetch(`/web-api/arriendos/${rentalId}/integrantes?${query}`, { cache: "no-store", signal: active.signal });
      const data = await response.json();
      if ([401, 403, 404].includes(response.status)) { setState({ status: "forbidden" }); setCursor(null); return; }
      if (!response.ok) throw new Error(data.detail || "No pudimos cargar más integrantes.");
      if (!Array.isArray(data.items) || (data.siguiente_cursor !== null && typeof data.siguiente_cursor !== "string")) throw new Error();
      if (!active.signal.aborted) {
        setState(current => current.status === "ready" ? { status: "ready", data: [...new Map([...current.data, ...data.items].map((item: IntegranteArriendoDto) => [item.id_usuario, item])).values()] } : current);
        setCursor(data.siguiente_cursor);
      }
    } catch (error) {
      if (!active.signal.aborted) setErrorMore(error instanceof Error ? error.message : "No pudimos cargar más integrantes.");
    } finally {
      if (!active.signal.aborted) setLoadingMore(false);
    }
  }

  return <main>
    <PageHeader title="Integrantes" description="Integrantes activos del arriendo." />
    <p><Link href="/mi-arriendo">Volver a Mi arriendo</Link></p>
    {state.status === "empty" ? <p>Aún no tienes un arriendo activo. <Link href="/mis-postulaciones">Revisa tus postulaciones</Link>.</p> : null}
    <MembersView state={state} />
    {state.status === "error" ? <Button onClick={refresh}>Reintentar</Button> : null}
    {state.status === "ready" && cursor ? <>
      {errorMore ? <p role="alert">{errorMore}</p> : null}
      <Button variant="secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Cargando…" : errorMore ? "Reintentar" : "Más integrantes"}</Button>
    </> : null}
  </main>;
}
