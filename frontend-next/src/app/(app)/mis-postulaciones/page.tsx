"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";

type Application = {
  id_conexion: number;
  id_receptor_FK: number;
  estado: string;
  fecha_solicitud: string;
};

export default function MyApplicationsPage() {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/web-api/mis-postulaciones", { credentials: "same-origin", cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          setError(data?.detail || "No se pudieron cargar tus postulaciones.");
          return;
        }
        if (!Array.isArray(data)) {
          setError("El servicio devolvió una respuesta no válida para tus postulaciones.");
          return;
        }
        setItems(data);
      } catch {
        setError("No se pudieron cargar tus postulaciones. Intenta nuevamente más tarde.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return <main>
    <PageHeader title="Mis postulaciones" description="Consulta el estado de las solicitudes que has enviado." />

    {loading ? <Card><p>Cargando tus postulaciones…</p></Card> : null}
    {!loading && error ? <Card><p role="alert">{error}</p></Card> : null}
    {!loading && !error && items.length === 0 ? <Card><p>No has enviado postulaciones todavía.</p></Card> : null}

    {!loading && !error && items.length > 0 ? <div style={{ display: "grid", gap: 16 }}>
      {items.map((item) => <Card key={item.id_conexion}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Solicitud #{item.id_conexion}</h2>
          <span style={{ padding: "6px 10px", borderRadius: 999, background: "#ecfeff", color: "#0f766e", fontWeight: 700 }}>
            {item.estado}
          </span>
        </div>
        <p style={{ margin: "12px 0 0" }}>Enviada al usuario #{item.id_receptor_FK}</p>
        <small style={{ display: "block", marginTop: 8, color: "#4b5563" }}>
          Fecha: {new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.fecha_solicitud))}
        </small>
      </Card>)}
    </div> : null}
  </main>;
}
