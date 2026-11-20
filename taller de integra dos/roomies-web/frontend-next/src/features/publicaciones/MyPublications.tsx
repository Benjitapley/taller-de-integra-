"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type Publication = {
  id: number;
  titulo: string;
  precio?: number | string;
  tipo?: string;
  ubicacion?: string;
  cupos?: number | string;
  estado?: string;
  cupos_disponibles?: number | null;
};

const formatPrice = (value: number | string | undefined) => new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
}).format(Number(value ?? 0));

export default function MyPublications() {
  const [items, setItems] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load(signal?: AbortSignal) {
    return fetch("/web-api/mis-publicaciones", { credentials: "same-origin", cache: "no-store", signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar tus publicaciones.");
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("Respuesta de publicaciones inválida.");
        if (signal?.aborted) return;
        setItems(data);
        setError("");
      }).catch(() => {
        if (signal?.aborted) return;
        setError("No se pudieron cargar tus publicaciones. Intenta nuevamente.");
      }).finally(() => { if (!signal?.aborted) setLoading(false); });
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  async function close(id: number) {
    setError("");
    try {
    const response = await fetch(`/web-api/publicaciones/${id}/cerrar`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "X-Haycupo-CSRF": "1" },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.detail || "No se pudo cerrar la publicación.");
      return;
    }

    await load();
    } catch { setError("No se pudo confirmar el cierre. Actualiza el listado."); }
  }

  return <main>
    <PageHeader title="Mis publicaciones" description="Administra tus publicaciones y edita el contenido cuando lo necesites." />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
      <Link href="/publicar" style={{ textDecoration: "none", display: "inline-block", background: "#382384", color: "#fff", padding: "12px 16px", borderRadius: 8, fontWeight: 700 }}>Crear publicación</Link>
    </div>

    {loading ? <Card><p>Cargando tus publicaciones…</p></Card> : null}
    {!loading && error ? <Card><p role="alert">{error}</p><Button onClick={() => void load()}>Reintentar</Button></Card> : null}
    {!loading && !error && items.length === 0 ? <Card><p>Aún no tienes publicaciones creadas.</p><Link href="/publicar">Crear la primera</Link></Card> : null}

    {!loading && !error && items.length > 0 ? <div style={{ display: "grid", gap: 16 }}>
      {items.map((item) => <Card key={item.id}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 8px" }}>{item.titulo}</h2>
            <p style={{ margin: 0, color: "#4b5563" }}>{item.ubicacion || "Sin ubicación"}</p>
          </div>
          <span style={{ padding: "6px 10px", borderRadius: 999, background: "#eef2ff", color: "#3730a3", fontWeight: 700 }}>
            {item.estado || "Disponible"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, color: "#111827" }}>
          <strong>{formatPrice(item.precio)}</strong>
          <span>{item.tipo || "Sin tipo"}</span>
          <span>{item.cupos_disponibles ?? "Por confirmar"} cupos disponibles · {item.cupos ?? "—"} totales</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <Link href={`/publicaciones/${item.id}`}>Ver detalle</Link>
          {item.tipo === "Arrendador" && <Link href={`/postulantes/${item.id}`}>Ver postulantes</Link>}
          <Link href={`/editar-publicacion?id=${item.id}`} style={{ display: "inline-block", textDecoration: "none", padding: "10px 14px", borderRadius: 8, background: "#e5e7eb", color: "#111827", fontWeight: 700 }}>Editar</Link>
          <Button variant="secondary" disabled={item.estado === "Cerrada"} onClick={() => void close(item.id)}>Cerrar publicación</Button>
        </div>
      </Card>)}
    </div> : null}
  </main>;
}
