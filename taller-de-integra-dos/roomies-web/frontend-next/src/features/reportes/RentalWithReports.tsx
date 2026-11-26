"use client";

import { useState } from "react";
import { useActiveRental } from "@/features/convivencia/useActiveRental";
import Link from "next/link";
import ReportMembers from "@/features/reportes/ReportMembers";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import DevelopmentReviewControl from "@/features/recorrido/DevelopmentReviewControl";
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
type PreviewState = "api" | "loading" | "empty" | "error" | "active";
const isDevelopment = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ROOMIES_VISUAL_REVIEW === "true";
const previewRental: Arriendo = {
  id_arriendo: 101, id_publicacion: 42, estado: "Activo", cupos_totales: 4,
  integrantes_activos: 3, cupos_disponibles: 1, id_responsable: 7,
};

export default function MyArriendoPage({ canReport = false }: { canReport?: boolean }) {
  const { rental: arriendo, status, retry: retryRental } = useActiveRental();
  const loading = status === "loading";
  const error = status === "error" ? "No pudimos cargar tu arriendo. Intenta nuevamente." :
    status === "denied" ? "No tienes acceso a este arriendo. Inicia sesión nuevamente." : "";
  const [preview, setPreview] = useState<PreviewState>("api");

  const showingPreview = isDevelopment && preview !== "api";
  const visibleLoading = showingPreview ? preview === "loading" : loading;
  const visibleError = showingPreview ? preview === "error" : Boolean(error);
  const visibleArriendo = showingPreview ? preview === "active" ? previewRental : null : arriendo;
  const visibleEmpty = showingPreview ? preview === "empty" : !loading && !error && !arriendo;

  function retry() {
    if (showingPreview) setPreview("api");
    retryRental();
  }

  return <main>
    <PageHeader title="Mi arriendo" description="Consulta el estado de tu incorporación y de la convivencia." />
    {isDevelopment ? <DevelopmentReviewControl label="Estado de Mi arriendo" value={preview} onChange={setPreview} options={[
      { value: "api", label: "Respuesta de API" }, { value: "loading", label: "Cargando" },
      { value: "empty", label: "Sin arriendo activo (404)" }, { value: "error", label: "Error recuperable (503/red)" },
      { value: "active", label: "Arriendo activo de muestra" },
    ]} /> : null}
    {visibleLoading ? <Card><p role="status">Cargando tu arriendo…</p></Card> : null}
    {!visibleLoading && visibleError ? <Card><p role="alert">{showingPreview ? "No pudimos cargar tu arriendo. Intenta nuevamente." : error}</p><Button onClick={retry}>Reintentar</Button></Card> : null}
    {visibleEmpty ? <Card><h2>Sin arriendo activo</h2><p>Aún no tienes un arriendo activo.</p><Link href="/mis-postulaciones">Ver mis postulaciones</Link></Card> : null}
    {!visibleLoading && !visibleError && visibleArriendo ? <Card>
      <div className={styles.header}>
        <div>
          <h2 style={{ margin: 0 }}>Arriendo #{visibleArriendo.id_arriendo}</h2>
          <p style={{ margin: "6px 0 0", color: "var(--muted)" }}><Link href={`/publicaciones/${visibleArriendo.id_publicacion}`}>Ver publicación #{visibleArriendo.id_publicacion}</Link></p>
        </div>
        <ArriendoStatus estado={visibleArriendo.estado} />
      </div>
      <div className={styles.facts}>
        <div className={styles.fact}><span>Capacidad total</span><strong>{visibleArriendo.cupos_totales}</strong></div>
        <div className={styles.fact}><span>Integrantes activos</span><strong>{visibleArriendo.integrantes_activos}</strong></div>
        <div className={styles.fact}><span>Cupos disponibles</span><strong>{visibleArriendo.cupos_disponibles}</strong></div>
      </div>
      {visibleArriendo.estado === "Activo" ? <>
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
      {canReport && !showingPreview ? <ReportMembers rentalId={visibleArriendo.id_arriendo} /> : null}
    </Card> : null}
  </main>;
}
