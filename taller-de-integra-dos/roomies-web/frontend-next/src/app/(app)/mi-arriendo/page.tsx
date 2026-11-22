"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ArriendoStatus } from "@/features/recorrido/JourneyStatus";
import styles from "@/features/recorrido/recorrido.module.css";

type Arriendo = {
  id_arriendo: number;
  id_publicacion: number;
  estado: "Activo" | "Finalizado";
  cupos_totales: number;
  integrantes_activos: number;
  cupos_disponibles: number;
  id_responsable: number | null;
};

export default function MyArriendoPage() {
  const [arriendo, setArriendo] = useState<Arriendo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/web-api/arriendos/mio", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 404) {
        setArriendo(null);
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error();
      setArriendo(await response.json());
    } catch {
      setError("No pudimos cargar tu arriendo. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const request = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(request);
  }, []);

  return <main>
    <PageHeader title="Mi arriendo" description="Consulta el estado de tu incorporación y de la convivencia." />
    {loading ? <Card><p role="status">Cargando tu arriendo…</p></Card> : null}
    {!loading && error ? <Card><p role="alert">{error}</p><Button onClick={() => void load()}>Reintentar</Button></Card> : null}
    {!loading && !error && !arriendo ? <Card><p>Aún no tienes un arriendo activo.</p><Link href="/mis-postulaciones">Ver mis postulaciones</Link></Card> : null}
    {!loading && arriendo ? <Card>
      <div className={styles.header}>
        <div>
          <h2 style={{ margin: 0 }}>Arriendo #{arriendo.id_arriendo}</h2>
          <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>Publicación #{arriendo.id_publicacion}</p>
        </div>
        <ArriendoStatus estado={arriendo.estado} />
      </div>
      <div className={styles.facts}>
        <div className={styles.fact}><span>Capacidad total</span><strong>{arriendo.cupos_totales}</strong></div>
        <div className={styles.fact}><span>Integrantes activos</span><strong>{arriendo.integrantes_activos}</strong></div>
        <div className={styles.fact}><span>Cupos disponibles</span><strong>{arriendo.cupos_disponibles}</strong></div>
      </div>
      {arriendo.estado === "Activo" ? <div className={styles.actions}>
        <Link className={styles.actionLink} href="/mi-arriendo/integrantes">Ver integrantes</Link>
        <Link className={styles.actionLink} href="/mi-arriendo/chat">Abrir chat</Link>
        <Link className={styles.actionLink} href="/mi-arriendo/tareas">Ver tareas</Link>
      </div> : null}
      {arriendo.estado === "Activo" ? <div className={styles.overviewGrid}>
        <section className={styles.overviewCard} aria-labelledby="chat-summary-heading">
          <h2 id="chat-summary-heading">Chat del arriendo</h2>
          <p>Conversación compartida por integrantes activos.</p>
          <Link href="/mi-arriendo/chat">Abrir chat <span aria-hidden="true">›</span></Link>
        </section>
        <section className={styles.overviewCard} aria-labelledby="tasks-summary-heading">
          <h2 id="tasks-summary-heading">Organización de la casa</h2>
          <p>Consulta y organiza las tareas del hogar.</p>
          <Link href="/mi-arriendo/tareas">Ver tareas <span aria-hidden="true">›</span></Link>
        </section>
      </div> : null}
    </Card> : null}
  </main>;
}
