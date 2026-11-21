"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

import { appendPublications, publicationPage, type Publication } from "./contracts";

const formatPrice = (value: number | string | undefined) => new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
}).format(Number(value ?? 0));

export default function MyPublications() {
  const inFlight = useRef(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [items, setItems] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load(signal?: AbortSignal, next?: string | null) {
    if (inFlight.current && !signal) return;
    inFlight.current = true;
    const query = next ? `?cursor=${encodeURIComponent(next)}` : "";
    return fetch(`/web-api/mis-publicaciones${query}`, { credentials: "same-origin", cache: "no-store", signal }).then(async response => {
      if (response.status === 401) { setItems([]); setCursor(null); throw new Error(); }
      if (!response.ok) throw new Error();
      const page = publicationPage(await response.json());
      if (!signal?.aborted) { setItems(current => next ? appendPublications(current, page.items) : page.items); setCursor(page.siguiente_cursor); setError(""); }
    }).catch(() => { if (!signal?.aborted) setError("No se pudieron cargar tus publicaciones. Intenta nuevamente."); })
      .finally(() => { if (!signal?.aborted) { inFlight.current = false; setLoading(false); } });
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

    const saved = await response.json();
    setItems(current => current.map(item => item.id_publicacion === id ? { ...item, estado: saved.estado, cupos_disponibles: saved.cupos_disponibles } : item));
    } catch { setError("No se pudo confirmar el cierre. Actualiza el listado."); }
  }

  return <main>
    <PageHeader title="Mis publicaciones" description="Administra tus publicaciones y edita el contenido cuando lo necesites." />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
      <Link href="/publicar" style={{ textDecoration: "none", display: "inline-block", background: "#382384", color: "#fff", padding: "12px 16px", borderRadius: 8, fontWeight: 700 }}>Crear publicación</Link>
    </div>

    {loading ? <Card><p>Cargando tus publicaciones…</p></Card> : null}
    {!loading && error ? <Card><p role="alert">{error}</p><Button onClick={() => { setLoading(true); void load(undefined, cursor); }}>Reintentar</Button></Card> : null}
    {!loading && !error && items.length === 0 ? <Card><p>Aún no tienes publicaciones creadas.</p><Link href="/publicar">Crear la primera</Link></Card> : null}

    {items.length > 0 ? <div style={{ display: "grid", gap: 16 }}>
      {items.map((item) => <Card key={item.id_publicacion}>
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
          <span>{item.cupos_disponibles ?? "Por confirmar"} cupos disponibles · {item.cupos_totales ?? "—"} totales</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <Link href={`/publicaciones/${item.id_publicacion}`}>Ver detalle</Link>
          <Link href={`/mis-publicaciones/${item.id_publicacion}/integrantes`}>Ver integrantes del arriendo</Link>
          {item.tipo === "Arrendador" && <Link href={`/postulantes/${item.id_publicacion}`}>Ver postulantes</Link>}
          <Link href={`/editar-publicacion?id=${item.id_publicacion}`} style={{ display: "inline-block", textDecoration: "none", padding: "10px 14px", borderRadius: 8, background: "#e5e7eb", color: "#111827", fontWeight: 700 }}>Editar</Link>
          <Button variant="secondary" disabled={item.estado === "Cerrada"} onClick={() => void close(item.id_publicacion)}>Cerrar publicación</Button>
        </div>
      </Card>)}
    </div> : null}
    {cursor && <Button disabled={loading} onClick={() => { setLoading(true); void load(undefined, cursor); }}>{loading ? "Cargando..." : "Cargar más"}</Button>}
    {!loading && !cursor && items.length > 0 && <p role="status">No hay más publicaciones.</p>}
  </main>;
}
