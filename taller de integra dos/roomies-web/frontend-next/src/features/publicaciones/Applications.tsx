"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { acceptanceKey, ApplicationRequestError, applicationRequest, finishAcceptance, mutateApplication } from "./application-client";
import { confirmedRental, pendingAdmission, type Application, type CursorPage, type OwnerDecision } from "./application-contract";

function useCursorList<T>(path: string, identify: (item: T) => number, enabled = true) {
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

type Member = { id_usuario: number; nombre?: string; activo: boolean | null };
const memberId = (member: Member) => member.id_usuario;
const applicationId = (application: Application) => application.id_postulacion;

function RentalMembers({ rental }: { rental: number }) {
  const [show, setShow] = useState(false);
  const list = useCursorList<Member>(`/web-api/arriendos/${rental}/integrantes`, memberId, show);
  return <Card>
    <h2>Integrantes del arriendo</h2>
    <p>Consulta la lista de personas incorporadas al arriendo.</p>
    <Button variant="secondary" onClick={() => setShow(previous => !previous)}>{show ? "Ocultar integrantes" : "Ver integrantes"}</Button>
    {show && <>
      {(list.loading || (!list.loaded && !list.error)) && <p role="status">Cargando integrantes…</p>}
      {list.error && <p role="alert">{list.error}</p>}
      {list.loaded && !list.items.length && <p>No hay integrantes para mostrar.</p>}
      {list.items.length > 0 && <ul>{list.items.map(item => <li key={item.id_usuario}>{item.nombre || `Integrante ${item.id_usuario}`} · {item.activo === null ? "Estado no disponible" : item.activo ? "Activo" : "Retirado"}</li>)}</ul>}
      {list.cursor && !list.error && <Button disabled={list.loading} onClick={() => void list.load(list.cursor)}>Cargar más integrantes</Button>}
      {list.error && <Button disabled={list.loading} onClick={() => void list.retryLoad()}>Reintentar</Button>}
    </>}
  </Card>;
}

type Change = OwnerDecision | "Retiro";
type DecisionResponse = Application | { incorporacion_pendiente: true };

export default function Applications({ publication }: { publication?: number }) {
  const list = useCursorList<Application>(`/web-api/postulaciones${publication ? `?publicacion=${publication}` : ""}`, applicationId);
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const operation = useRef(false);
  const retry = useRef<{ intent: string; key: string } | null>(null);
  const rental = publication ? list.items.map(confirmedRental).find(Boolean) : null;

  function replace(item: Application) {
    list.setItems(previous => previous.map(row => row.id_postulacion === item.id_postulacion ? item : row));
  }

  async function recover(id: number) {
    try {
      const value = await applicationRequest<Application>(`/web-api/postulaciones?id=${id}`);
      replace(value);
      if (confirmedRental(value) || ["Rechazada", "Cancelada"].includes(value.estado)) finishAcceptance(id);
      return value;
    } catch {
      await list.load();
      return null;
    }
  }

  async function check(item: Application) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setProblem("");
    setNotice("");
    try {
      const value = await recover(item.id_postulacion);
      if (value && confirmedRental(value)) setNotice("La incorporación quedó confirmada.");
      else if (value) setNotice("Se consultó el estado actual de la postulación.");
      else setNotice("Se solicitó actualizar la lista. Revisa el estado que muestra la postulación.");
    } finally { operation.current = false; setBusy(false); }
  }

  async function decide(item: Application, decision: Change) {
    if (operation.current) return;
    const id = item.id_postulacion;
    const motivo = reasons[id]?.trim();
    if (decision === "Rechazada" && !motivo) { setProblem("Indica un motivo para rechazar."); return; }
    operation.current = true;
    setBusy(true);
    setProblem("");
    setNotice("");
    try {
      const intent = JSON.stringify([id, decision, decision === "Rechazada" ? motivo : null]);
      if (retry.current?.intent !== intent) {
        const create = () => crypto.randomUUID();
        retry.current = { intent, key: decision === "Aceptada" ? acceptanceKey(id, create) : create() };
      }
      const result = decision === "Retiro"
        ? await mutateApplication<DecisionResponse>("POST", { retiro: id }, retry.current.key)
        : await mutateApplication<DecisionResponse>("PATCH", { id, estado: decision, ...(decision === "Rechazada" ? { motivo } : {}) }, retry.current.key);
      if ("id_postulacion" in result) replace(result);
      else replace({ ...item, incorporacion_pendiente: true });
      if (decision !== "Aceptada") {
        retry.current = null;
        setNotice(decision === "Retiro" ? "Postulación retirada." : "Estado actualizado.");
      } else if ("id_postulacion" in result && confirmedRental(result)) {
        retry.current = null;
        finishAcceptance(id);
        setNotice("Incorporación confirmada.");
      } else {
        setNotice("La incorporación sigue pendiente de confirmación.");
        const value = await recover(id);
        if (value && confirmedRental(value)) setNotice("Incorporación confirmada.");
      }
    } catch (failure) {
      const expected = failure instanceof ApplicationRequestError && failure.status < 500;
      if (expected && failure.status !== 409) {
        setProblem(failure.message);
        return;
      }
      const current = await recover(id);
      if (decision === "Aceptada" && current && confirmedRental(current)) {
        retry.current = null;
        setNotice("La incorporación quedó confirmada al consultar el estado.");
      } else if (decision !== "Aceptada" && current?.estado === (decision === "Retiro" ? "Cancelada" : decision)) {
        retry.current = null;
        setNotice("El cambio quedó confirmado al consultar el estado.");
      } else {
        if (decision === "Aceptada" && expected && current?.estado === "Preseleccionada" && !pendingAdmission(current)) {
          finishAcceptance(id);
          retry.current = null;
        }
        setProblem(expected ? failure.message : "No se confirmó esta operación. Revisa el estado actualizado antes de repetirla.");
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  return <div style={{ display: "grid", gap: 16 }}>
    {(list.loading || (!list.loaded && !list.error)) && <p role="status">Cargando postulaciones…</p>}
    {list.error && <Card><p role="alert">{list.error}</p><Button disabled={list.loading || busy} onClick={() => void list.retryLoad()}>Reintentar</Button></Card>}
    {problem && <Card><p role="alert">{problem}</p></Card>}
    {notice && <p role="status">{notice}</p>}
    {list.loaded && !list.items.length && <Card><p>No hay postulaciones para mostrar.</p></Card>}
    {list.items.map(item => {
      const inProcess = pendingAdmission(item);
      const confirmed = confirmedRental(item);
      const open = item.estado === "Pendiente" || item.estado === "Preseleccionada";
      return <Card key={item.id_postulacion}>
        <h2>{publication ? item.nombre_postulante || `Postulación ${item.id_postulacion}` : item.titulo || "Publicación"}</h2>
        <p>Estado: {inProcess ? "Incorporación pendiente" : item.estado}</p>
        {item.motivo && <p>Motivo: {item.motivo}</p>}
        {inProcess && <p>La incorporación todavía no está confirmada.</p>}
        {!publication && confirmed && <p><Link href="/mi-arriendo">Ir a Mi arriendo</Link></p>}
        <p><Link href={`/publicaciones/${item.id_publicacion}`}>Ver publicación</Link></p>
        {inProcess && <Button variant="secondary" disabled={busy || list.loading} onClick={() => void check(item)}>Consultar incorporación</Button>}
        {publication && inProcess && item.estado === "Preseleccionada" &&
          <Button disabled={busy || list.loading} onClick={() => void decide(item, "Aceptada")}>Reintentar incorporación</Button>}
        {open && !inProcess && <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {publication ? <>
            <label style={{ width: "100%" }}>Motivo de rechazo <input disabled={busy} value={reasons[item.id_postulacion] || ""} maxLength={1000}
              onChange={event => setReasons(previous => ({ ...previous, [item.id_postulacion]: event.target.value }))} /></label>
            {item.estado === "Pendiente" && <Button disabled={busy || list.loading} onClick={() => void decide(item, "Preseleccionada")}>Preseleccionar</Button>}
            {item.estado === "Preseleccionada" && <Button disabled={busy || list.loading} onClick={() => void decide(item, "Aceptada")}>Aceptar postulación</Button>}
            <Button variant="secondary" disabled={busy || list.loading} onClick={() => void decide(item, "Rechazada")}>Rechazar postulación</Button>
          </> : <Button variant="secondary" disabled={busy || list.loading} onClick={() => void decide(item, "Retiro")}>Retirar postulación</Button>}
        </div>}
      </Card>;
    })}
    {list.cursor && !list.error && <Button variant="secondary" disabled={list.loading || busy} onClick={() => void list.load(list.cursor)}>Cargar más postulaciones</Button>}
    {rental && <RentalMembers key={rental} rental={rental} />}
  </div>;
}
