"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Application = { id_postulacion: number; id_publicacion: number; id_usuario: number; titulo?: string; estado: string; motivo?: string | null };
export default function Applications({ publication }: { publication?: number }) {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const load = useCallback((signal?: AbortSignal) => fetch(`/web-api/postulaciones${publication ? `?publicacion=${publication}` : ""}`, { cache: "no-store", signal })
    .then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!signal?.aborted) { setItems(data); setError(""); }
    }).catch(() => { if (!signal?.aborted) setError("No se pudieron consultar las postulaciones."); })
    .finally(() => { if (!signal?.aborted) setLoading(false); }), [publication]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function decide(item: Application, estado: string) {
    if (pending) return;
    const motivo = reasons[item.id_postulacion]?.trim();
    if (["Rechazada", "Cancelada"].includes(estado) && !motivo) { setError("Indica un motivo para rechazar o cancelar."); return; }
    setPending(true); setError("");
    try {
      const response = await fetch("/web-api/postulaciones", { method: "PATCH", headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" }, body: JSON.stringify({ id: item.id_postulacion, estado, ...(motivo ? { motivo } : {}) }) });
      if (!response.ok) throw new Error();
      await load();
    } catch { setError("No se confirmó el cambio. Actualiza el listado antes de repetirlo."); }
    finally { setPending(false); }
  }
  return <div style={{ display: "grid", gap: 16 }}>
    {loading && <p role="status">Cargando postulaciones…</p>}
    {error && <Card><p role="alert">{error}</p><Button onClick={() => void load()}>Actualizar</Button></Card>}
    {!loading && !items.length && <Card><p>No hay postulaciones para mostrar.</p></Card>}
    {!loading && items.map(item => <Card key={item.id_postulacion}>
      <h2>{publication ? `Postulación ${item.id_postulacion}` : item.titulo || "Publicación"}</h2>
      <p>Estado: {item.estado}</p>{item.motivo && <p>Motivo: {item.motivo}</p>}
      {item.estado === "Aceptada" && <p>Tu postulación fue aceptada. La incorporación al arriendo aún está pendiente.</p>}
      <p><Link href={`/publicaciones/${item.id_publicacion}`}>Ver publicación</Link></p>
      {["Pendiente", "Preseleccionada"].includes(item.estado) && <>
        <label>Motivo<input value={reasons[item.id_postulacion] || ""} maxLength={1000} onChange={event => setReasons(previous => ({ ...previous, [item.id_postulacion]: event.target.value }))} /></label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          {publication ? <>
            {item.estado === "Pendiente" && <Button disabled={pending} onClick={() => void decide(item, "Preseleccionada")}>Preseleccionar</Button>}
            {item.estado === "Preseleccionada" && <Button disabled={pending} onClick={() => void decide(item, "Aceptada")}>Aceptar postulación</Button>}
            <Button variant="secondary" disabled={pending} onClick={() => void decide(item, "Rechazada")}>Rechazar postulación</Button>
          </> : <Button variant="secondary" disabled={pending} onClick={() => void decide(item, "Cancelada")}>Cancelar postulación</Button>}
        </div>
      </>}
    </Card>)}
  </div>;
}
