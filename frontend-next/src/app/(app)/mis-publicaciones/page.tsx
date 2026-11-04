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
};

const formatPrice = (value: number | string | undefined) => new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
}).format(Number(value ?? 0));

export default function MyPublicationsPage() {
  const [items, setItems] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/web-api/mis-publicaciones", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.detail || "No se pudieron cargar tus publicaciones.");
        setItems([]);
        return;
      }
      const data = await response.json();
      setItems(Array.isArray(data) ? data : []);
      setError("");
    } catch {
      setError("No se pudieron cargar tus publicaciones. Intenta nuevamente más tarde.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function remove(id: number) {
    const response = await fetch(`/web-api/publicaciones/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "X-Haycupo-CSRF": "1" },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      alert(payload?.detail || "No se pudo eliminar la publicación.");
      return;
    }

    setItems((previous) => previous.filter((item) => item.id !== id));
  }

  return <main>
    <PageHeader title="Mis publicaciones" description="Administra tus publicaciones y edita el contenido cuando lo necesites." />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
      <Link href="/crear" style={{ textDecoration: "none", display: "inline-block", background: "#382384", color: "#fff", padding: "12px 16px", borderRadius: 8, fontWeight: 700 }}>Crear publicación</Link>
    </div>

    {loading ? <Card><p>Cargando tus publicaciones…</p></Card> : null}
    {!loading && error ? <Card><p role="alert">{error}</p></Card> : null}
    {!loading && !error && items.length === 0 ? <Card><p>Aún no tienes publicaciones creadas.</p><Link href="/crear">Crear la primera</Link></Card> : null}

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
          <span>{item.cupos ?? 0} cupos</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <Link href={`/editar-publicacion?id=${item.id}`} style={{ display: "inline-block", textDecoration: "none", padding: "10px 14px", borderRadius: 8, background: "#e5e7eb", color: "#111827", fontWeight: 700 }}>Editar</Link>
          <Button variant="secondary" onClick={() => void remove(item.id)}>Eliminar</Button>
        </div>
      </Card>)}
    </div> : null}
  </main>;
}
