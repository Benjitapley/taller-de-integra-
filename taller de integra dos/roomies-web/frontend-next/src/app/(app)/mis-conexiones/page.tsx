"use client";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";

type Connection = { id_conexion: number; id_solicitante_FK: number; id_receptor_FK: number; estado: string; fecha_solicitud: string };
const tabs = [{ value: "recibidas", label: "Recibidas" }, { value: "enviadas", label: "Enviadas" }, { value: "aceptadas", label: "Aceptadas" }];
export default function ConnectionsPage() {
  const [view, setView] = useState("recibidas");
  return <main><PageHeader title="Mis conexiones" description="Gestiona las solicitudes para conocer a otros roomies." />
    <Tabs items={tabs} value={view} label="Solicitudes de conexión" onChange={setView}><ConnectionList key={view} view={view} /></Tabs>
  </main>;
}
function ConnectionList({ view }: { view: string }) {
  const [items, setItems] = useState<Connection[]>([]);
  const [names, setNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const load = useCallback((signal?: AbortSignal) => {
    return fetch(`/web-api/conexiones?vista=${view}`, { cache: "no-store", signal }).then(async response => {
      if (!response.ok) throw new Error("No se pudieron cargar las conexiones.");
      const list: Connection[] = await response.json();
      const ids = [...new Set(list.flatMap(item => [item.id_solicitante_FK, item.id_receptor_FK]))];
      const profiles = await Promise.all(ids.map(async id => {
        try {
          const response = await fetch(`/conexiones/usuarios/${id}`, { cache: "no-store", signal });
          const profile = response.ok ? await response.json() : null;
          return [id, typeof profile?.nombre === "string" ? profile.nombre : "Perfil no disponible"] as const;
        } catch { return [id, "Perfil no disponible"] as const; }
      }));
      if (!signal?.aborted) { setItems(list); setNames(Object.fromEntries(profiles)); setError(""); }
    }).catch(() => { if (!signal?.aborted) setError("No se pudieron cargar las conexiones. Vuelve a intentarlo."); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [view]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function act(item: Connection, estado?: string) {
    if (pending) return;
    setPending(true); setError("");
    try {
      const response = await fetch("/web-api/conexiones", { method: estado ? "PUT" : "DELETE", headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" }, body: JSON.stringify({ id: item.id_conexion, ...(estado ? { estado } : {}) }) });
      if (!response.ok) throw new Error();
      await load();
    } catch { setError("No se pudo confirmar el cambio. Actualiza el listado antes de volver a intentarlo."); }
    finally { setPending(false); }
  }
  return <div style={{ display: "grid", gap: 16 }}>
    {loading && <p role="status">Cargando conexiones…</p>}
    {error && <Card><p role="alert">{error}</p><Button onClick={() => void load()}>Actualizar</Button></Card>}
    {!loading && !error && !items.length && <Card><p>No hay conexiones en esta vista.</p></Card>}
    {!loading && !error && items.map(item => <Card key={item.id_conexion}>
      <h2>{names[item.id_solicitante_FK]} → {names[item.id_receptor_FK]}</h2>
      <p>{item.estado}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {view === "recibidas" && item.estado === "Pendiente" && <>
          <Button disabled={pending} onClick={() => void act(item, "Aceptada")}>Aceptar</Button>
          <Button variant="secondary" disabled={pending} onClick={() => void act(item, "Rechazada")}>Rechazar</Button>
        </>}
        <Button variant="secondary" disabled={pending} onClick={() => void act(item)}>Eliminar conexión</Button>
      </div>
    </Card>)}
  </div>;
}
