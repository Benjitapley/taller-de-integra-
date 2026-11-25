"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

import { type Publication } from "./contracts";
import { useCursorList } from "../lists/useCursorList";
import ListProgress from "../lists/ListProgress";
const publicationId = (item: Publication) => item.id_publicacion;

const formatPrice = (value: number | string | undefined) => new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
}).format(Number(value ?? 0));

export default function MyPublications() {
  const [status, setStatus] = useState("");
  const [closing, setClosing] = useState<number | null>(null);
  const query = new URLSearchParams({ limite: "20", ...(status ? { estado: status } : {}) });
  const list = useCursorList<Publication>("/web-api/mis-publicaciones?" + query, publicationId);
  const { items, setItems, loading } = list;
  const [error, setError] = useState("");

  async function close(id: number) {
    if (closing !== null) return;
    setError("");
    setClosing(id);
    try {
      const response = await fetch(`/web-api/publicaciones/${id}/cerrar`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "X-Haycupo-CSRF": "1" },
        signal: AbortSignal.timeout(15_000),
      });

      const saved = await response.json().catch(() => null);
      if (!response.ok || saved?.id_publicacion !== id || saved.estado !== "Cerrada") {
        setError(saved?.detail || "No se pudo confirmar el cierre. Actualiza el listado.");
        return;
      }

      setItems(current => status && status !== saved.estado
        ? current.filter(item => item.id_publicacion !== id)
        : current.map(item => item.id_publicacion === id ? { ...item, ...saved } : item));
    } catch {
      setError("No se pudo confirmar el cierre. Actualiza el listado.");
    } finally {
      setClosing(null);
    }
  }

  return <main>
    <PageHeader title="Mis publicaciones" description="Administra tus publicaciones y edita el contenido cuando lo necesites." />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
      <label>Estado
        <select value={status} disabled={closing !== null} onChange={event => { setError(""); setStatus(event.target.value); }}>
          <option value="">Todos los estados</option>
          <option value="Disponible">Disponible</option>
          <option value="Activa">Activa</option>
          <option value="Cerrada">Cerrada</option>
        </select>
      </label>
      <Link href="/publicar" style={{ textDecoration: "none", display: "inline-block", background: "#382384", color: "#fff", padding: "12px 16px", borderRadius: 8, fontWeight: 700 }}>Crear publicación</Link>
    </div>

    {error && <Card><p role="alert">{error}</p><Button disabled={loading} onClick={() => { setError(""); void list.load(); }}>Actualizar listado</Button></Card>}
    {list.loaded && !loading && !list.error && items.length === 0 ? <Card><p>{status ? "No tienes publicaciones en este estado." : "Aún no tienes publicaciones creadas."}</p>{!status && <Link href="/publicar">Crear la primera</Link>}</Card> : null}

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
          {item.id_arriendo ? <Link href={`/mi-arriendo/${item.id_arriendo}`}>Ver integrantes del arriendo</Link> : null}
          {item.tipo === "Arrendador" && <Link href={`/postulantes/${item.id_publicacion}`}>Ver postulantes</Link>}
          <Link href={`/editar-publicacion?id=${item.id_publicacion}`} style={{ display: "inline-block", textDecoration: "none", padding: "10px 14px", borderRadius: 8, background: "#e5e7eb", color: "#111827", fontWeight: 700 }}>Editar</Link>
          <Button variant="secondary" disabled={item.estado === "Cerrada" || closing !== null} onClick={() => void close(item.id_publicacion)}>{closing === item.id_publicacion ? "Cerrando…" : "Cerrar publicación"}</Button>
        </div>
      </Card>)}
    </div> : null}
    <ListProgress {...list} count={items.length} retry={() => void list.retryLoad()} more={() => void list.load(list.cursor)} />
  </main>;
}
