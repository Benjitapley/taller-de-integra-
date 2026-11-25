"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Card from "@/components/ui/Card";
import styles from "./recorrido.module.css";
import { MembersView } from "@/features/recorrido/ConvivenciaViews";
import type { EstadoRecurso, IntegranteArriendoDto } from "@/features/recorrido/types";

type Rental = { id_arriendo: number };

export default function MemberDirectory({ rentalId }: { rentalId?: string }) {
  const [state, setState] = useState<EstadoRecurso<IntegranteArriendoDto[]>>({ status: "loading" });
  const [cursor, setCursor] = useState<string | null>(null);
  const [resolvedRentalId, setResolvedRentalId] = useState<string | null>(rentalId ?? null);
  const [emptyMessage, setEmptyMessage] = useState("Aún no hay integrantes residentes.");
  const [loadingMore, setLoadingMore] = useState(false);
  const [version, setVersion] = useState(0);
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [selected, setSelected] = useState<IntegranteArriendoDto | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

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
        const detail = await fetch(`/web-api/arriendos/${id}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (live) setCanWithdraw(detail.ok && (await detail.json()).puede_retirar === true);
        const response = await fetch(`/web-api/arriendos/${id}/integrantes?activos=true`, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (response.status === 403) { if (live) { setState({ status: "forbidden" }); setSelected(null); setCanWithdraw(false); } return; }
        if (response.status === 404) { setEmptyMessage("No se encontró un arriendo disponible."); throw Object.assign(new Error(), { empty: true }); }
        if (!response.ok || !payload || !Array.isArray(payload.items) ||
            !(payload.siguiente_cursor === null || typeof payload.siguiente_cursor === "string")) throw new Error("No pudimos cargar la lista de integrantes. Intenta nuevamente.");
        if (live) {
          setState(payload.items.length ? { status: "ready", data: payload.items } : { status: "empty" });
          setCursor(payload.siguiente_cursor);
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
      if ([401, 403, 404].includes(response.status)) { setState({ status: "forbidden" }); setSelected(null); setCanWithdraw(false); setCursor(null); return; }
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

  async function withdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canWithdraw || !reason.trim() || !confirmed || savingRef.current) return;
    savingRef.current = true; setSaving(true); setActionError("");
    try {
      const response = await fetch(`/web-api/arriendos/${resolvedRentalId}/expulsiones`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" },
        body: JSON.stringify({ id_usuario: selected.id_usuario, motivo: reason.trim(), confirmo: confirmed }),
      });
      const result = await response.json();
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status)) { setCanWithdraw(false); setSelected(null); retry(); }
        throw new Error(result.detail || "No pudimos confirmar el retiro. Reintenta con el mismo integrante.");
      }
      setNotice(`Integrante retirado. Cupos disponibles: ${result.cupos_disponibles}.${result.estado === "Finalizado" ? " El arriendo finalizó; la publicación se cierra sin reabrirse." : ""}${result.sincronizacion_pendiente ? " La actualización de la publicación y los avisos está pendiente; se reintentará automáticamente." : ""}`);
      setSelected(null); setReason(""); setConfirmed(false); retry();
    } catch (error) { setActionError(error instanceof Error ? error.message : "No pudimos confirmar el retiro. Actualiza o reintenta."); }
    finally { savingRef.current = false; setSaving(false); }
  }

  return <main>
    <PageHeader title="Integrantes" description="Responsable de convivencia e integrantes activos del arriendo." />
    <p><Link href={rentalId ? `/mi-arriendo/${rentalId}` : "/mi-arriendo"}>Volver al arriendo</Link></p>
    {notice ? <Card><p role="status">{notice}</p></Card> : null}
    {actionError && !selected ? <p role="alert">{actionError}</p> : null}
    <MembersView state={state} emptyTitle={emptyMessage} onWithdraw={canWithdraw ? member => { setSelected(member); setReason(""); setConfirmed(false); setActionError(""); } : undefined} />
    {canWithdraw && selected ? <Modal open onClose={() => { if (!saving) setSelected(null); }} title="Retirar integrante" surfaceClassName={styles.taskModalSurface}>
      <form className={styles.taskForm} onSubmit={withdraw}>
        <p>Retirar a {selected?.nombre || `Integrante #${selected?.id_usuario}`} revoca su acceso al chat, incluido el historial, y a las tareas. Sus tareas pendientes quedarán sin asignar.</p>
        <p>Si es el último integrante, el arriendo finalizará y la publicación se cerrará.</p>
        <label htmlFor="withdraw-reason">Motivo del retiro</label>
        <textarea id="withdraw-reason" value={reason} onChange={event => setReason(event.target.value)} required maxLength={500} disabled={saving} />
        <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required disabled={saving} /> Confirmo que quiero retirar a este integrante.</label>
        {actionError ? <p role="alert">{actionError}</p> : null}
        <div className={styles.modalActions}><Button variant="secondary" disabled={saving} onClick={() => setSelected(null)}>Cancelar</Button><Button type="submit" disabled={saving || !confirmed || !reason.trim()}>{saving ? "Retirando…" : "Retirar integrante"}</Button></div>
      </form>
    </Modal> : null}
    {state.status === "error" ? <Button variant="secondary" onClick={retry}>Reintentar</Button> : null}
    {cursor && state.status === "ready" ? <Button variant="secondary" disabled={loadingMore} onClick={() => void more()}>{loadingMore ? "Cargando…" : "Más integrantes"}</Button> : null}
  </main>;
}
