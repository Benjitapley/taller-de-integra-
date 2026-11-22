"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReportMembers from "@/features/reportes/ReportMembers";
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

export default function MyArriendoPage({ canReport = false }: { canReport?: boolean }) {
  const [arriendo, setArriendo] = useState<Arriendo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void fetch("/web-api/arriendos/mio", { credentials: "same-origin", cache: "no-store", signal }).then(async response => {
      if (signal.aborted) return;
      if (response.status === 404) {
        setArriendo(null);
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!signal.aborted) setArriendo(data);
    }).catch(() => {
      if (!signal.aborted) setError("No pudimos cargar tu arriendo. Intenta nuevamente.");
    }).finally(() => {
      if (!signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [requestVersion]);

  return <main>
    <PageHeader title="Mi arriendo" description="Consulta el estado de tu incorporación y de la convivencia." />
    {loading ? <Card><p role="status">Cargando tu arriendo…</p></Card> : null}
    {!loading && error ? <Card><p role="alert">{error}</p><Button onClick={() => { setLoading(true); setError(""); setRequestVersion(value => value + 1); }}>Reintentar</Button></Card> : null}
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
      {arriendo.estado === "Activo" ? <>
        <div className={styles.actions}>
          <Link className={styles.actionLink} href="/mi-arriendo/integrantes">Ver integrantes</Link>
          <Link className={styles.actionLink} href="/mi-arriendo/chat">Abrir chat</Link>
          <Link className={styles.actionLink} href="/mi-arriendo/tareas">Ver tareas</Link>
        </div>
        <div className={styles.overviewGrid}>
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
        </div>
      </> : null}
      {canReport ? <ReportMembers rentalId={arriendo.id_arriendo} /> : null}
    </Card> : null}
  </main>;
}
