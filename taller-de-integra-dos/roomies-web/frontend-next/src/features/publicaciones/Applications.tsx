"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { PostulationStatus } from "@/features/recorrido/JourneyStatus";

type Application = {
  id_postulacion: number; id_publicacion: number; id_usuario: number; titulo?: string;
  estado: "Pendiente" | "Preseleccionada" | "Aceptada" | "Rechazada" | "Cancelada";
  motivo?: string | null; id_arriendo?: number | null; incorporacion_pendiente?: boolean;
  operacion?: { id_operacion: string; estado: "Pendiente" | "Confirmada" | "Rechazada"; codigo_error?: string };
};
const confirmed = (item: Application) => item.estado === "Aceptada" && item.incorporacion_pendiente === false && Number.isSafeInteger(item.id_arriendo) && Number(item.id_arriendo) > 0;

export default function Applications({ publication }: { publication?: number }) {
  return <ApplicationList key={publication ?? "mine"} publication={publication} />;
}

function ApplicationList({ publication }: { publication?: number }) {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [recovery, setRecovery] = useState<Record<number, string>>({});
  const inFlight = useRef(false);
  const keys = useRef(new Map<number, string>());

  const remember = useCallback((item: Application) => {
    if (item.operacion?.estado === "Pendiente") keys.current.set(item.id_postulacion, item.operacion.id_operacion);
    else if (confirmed(item) || item.operacion?.estado === "Rechazada" || item.estado !== "Preseleccionada") {
      keys.current.delete(item.id_postulacion);
      setRecovery(previous => { const next = { ...previous }; delete next[item.id_postulacion]; return next; });
    }
  }, []);
  const clearPrivate = useCallback(() => {
    keys.current.clear(); setItems([]); setRecovery({}); setReasons({});
    setError("Ya no tienes acceso a estas postulaciones. Actualiza la sesión para continuar.");
  }, []);
  const load = useCallback((signal?: AbortSignal) => fetch(`/web-api/postulaciones${publication ? `?publicacion=${publication}` : ""}`, { cache: "no-store", signal })
    .then(async response => {
      if (signal?.aborted) return;
      if ([401, 403].includes(response.status)) clearPrivate();
      if (!response.ok) throw new Error();
      const data: Application[] = await response.json();
      if (!Array.isArray(data)) throw new Error();
      if (!signal?.aborted) { data.forEach(remember); setItems(data); setError(""); }
    }).catch(() => { if (!signal?.aborted) setError("No se pudieron consultar las postulaciones."); })
    .finally(() => { if (!signal?.aborted) setLoading(false); }), [publication, clearPrivate, remember]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

  async function refreshItem(id: number) {
    const response = await fetch(`/web-api/postulaciones/${id}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if ([401, 403, 404].includes(response.status)) clearPrivate();
    if (!response.ok) throw new Error();
    const item: Application = await response.json();
    if (item.id_postulacion !== id) throw new Error();
    remember(item);
    setItems(previous => previous.map(current => current.id_postulacion === id ? item : current));
    return item;
  }
  async function recover(id: number) {
    setRecovery(previous => ({ ...previous, [id]: "No se confirmó la incorporación. Puedes consultar el estado o volver a intentarlo." }));
    try {
      const result = await refreshItem(id);
      if (result.operacion?.estado === "Rechazada") setError("La incorporación no se completó. Puedes iniciar un nuevo intento cuando se haya corregido la condición.");
    } catch { /* The same operation key remains available while its result is unknown. */ }
  }
  async function consult(item: Application) {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setError("");
    try { await refreshItem(item.id_postulacion); }
    catch { setError("No se pudo consultar el estado. Puedes volver a intentarlo."); }
    finally { inFlight.current = false; setPending(false); }
  }
  async function decide(item: Application, estado: string) {
    if (inFlight.current) return;
    const motivo = reasons[item.id_postulacion]?.trim();
    if (["Rechazada", "Cancelada"].includes(estado) && !motivo) { setError("Indica un motivo para rechazar o cancelar."); return; }
    inFlight.current = true; setPending(true); setError("");
    try {
      let key: string | undefined;
      if (estado === "Aceptada") {
        const current = await refreshItem(item.id_postulacion);
        if (confirmed(current)) return;
        if (current.estado !== "Preseleccionada") { setError("La postulación ya no permite aceptar esta solicitud."); return; }
        key = keys.current.get(item.id_postulacion) ?? crypto.randomUUID();
        keys.current.set(item.id_postulacion, key);
      }
      const response = await fetch("/web-api/postulaciones", {
        method: "PATCH", signal: AbortSignal.timeout(20_000),
        headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1", ...(key ? { "Idempotency-Key": key } : {}) },
        body: JSON.stringify({ id: item.id_postulacion, estado, ...(["Rechazada", "Cancelada"].includes(estado) ? { motivo } : {}) }),
      });
      if (response.status === 401) clearPrivate();
      if (!response.ok) {
        if (estado === "Aceptada") { await recover(item.id_postulacion); return; }
        throw new Error();
      }
      const saved: Application = await response.json();
      if (saved.id_postulacion !== item.id_postulacion) throw new Error();
      remember(saved);
      setItems(previous => previous.map(current => current.id_postulacion === saved.id_postulacion ? saved : current));
      setRecovery(previous => { const next = { ...previous }; delete next[saved.id_postulacion]; return next; });
    } catch {
      if (estado === "Aceptada") await recover(item.id_postulacion);
      else setError("No se confirmó el cambio. Actualiza el listado antes de repetirlo.");
    } finally { inFlight.current = false; setPending(false); }
  }
  return <div style={{ display: "grid", gap: 16 }} aria-busy={pending}>
    {loading && <p role="status">Cargando postulaciones…</p>}
    {error && <Card><p role="alert">{error}</p><Button disabled={pending} onClick={() => void load()}>Actualizar</Button></Card>}
    {!loading && !items.length && <Card><p>No hay postulaciones para mostrar.</p></Card>}
    {!loading && items.map(item => {
      const waiting = item.operacion?.estado === "Pendiente" || Boolean(recovery[item.id_postulacion]);
      const accepted = confirmed(item);
      return <Card key={item.id_postulacion}>
        <h2>{publication ? `Postulación ${item.id_postulacion}` : item.titulo || "Publicación"}</h2>
        <p>Estado: <PostulationStatus estado={item.estado === "Aceptada" && !accepted ? "Preseleccionada" : item.estado} /></p>
        {item.motivo && <p>Motivo: {item.motivo}</p>}
        {(waiting || (item.estado === "Aceptada" && !accepted)) && <p role="status">La incorporación al arriendo aún no está confirmada.</p>}
        {recovery[item.id_postulacion] && <p role="alert">{recovery[item.id_postulacion]}</p>}
        {item.estado === "Preseleccionada" && item.operacion?.estado === "Rechazada" && <p>La incorporación no se completó. La postulación sigue preseleccionada.</p>}
        {accepted && <p>{publication ? "La persona quedó incorporada al arriendo." : <>Tu incorporación quedó confirmada. <Link href="/mi-arriendo">Abrir Mi arriendo</Link></>}</p>}
        <p><Link href={`/publicaciones/${item.id_publicacion}`}>Ver publicación</Link></p>
        {(waiting || (item.estado === "Aceptada" && !accepted)) && <Button disabled={pending} onClick={() => void consult(item)}>Consultar estado</Button>}
        {["Pendiente", "Preseleccionada"].includes(item.estado) && <>
          <label>Motivo<input disabled={pending || waiting} value={reasons[item.id_postulacion] || ""} maxLength={1000} onChange={event => setReasons(previous => ({ ...previous, [item.id_postulacion]: event.target.value }))} /></label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
            {publication ? <>
              {item.estado === "Pendiente" && <Button disabled={pending} onClick={() => void decide(item, "Preseleccionada")}>Preseleccionar</Button>}
              {item.estado === "Preseleccionada" && <Button disabled={pending} onClick={() => void decide(item, "Aceptada")}>{waiting || item.operacion?.estado === "Rechazada" ? "Reintentar aceptación" : "Aceptar postulación"}</Button>}
              <Button variant="secondary" disabled={pending || waiting} onClick={() => void decide(item, "Rechazada")}>Rechazar postulación</Button>
            </> : <Button variant="secondary" disabled={pending || waiting} onClick={() => void decide(item, "Cancelada")}>Cancelar postulación</Button>}
          </div>
        </>}
      </Card>;
    })}
  </div>;
}
