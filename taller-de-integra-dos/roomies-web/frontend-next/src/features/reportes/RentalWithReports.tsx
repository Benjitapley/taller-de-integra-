"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReportMembers from "@/features/reportes/ReportMembers";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import DevelopmentReviewControl from "@/features/recorrido/DevelopmentReviewControl";
import { ArriendoStatus } from "@/features/recorrido/JourneyStatus";
import type { MiArriendoVista } from "@/features/recorrido/types";
import styles from "@/features/recorrido/recorrido.module.css";

type PreviewState = "api" | "loading" | "empty" | "error" | "active";
const isDevelopment = process.env.NODE_ENV === "development";
const previewRental: MiArriendoVista = {
  id_arriendo: 101, id_publicacion: 42, estado: "Activo", cupos_totales: 4,
  integrantes_activos: 3, cupos_disponibles: 1, id_responsable: 7,
};

export default function MyArriendoPage({ canReport = false }: { canReport?: boolean }) {
  const [arriendo, setArriendo] = useState<MiArriendoVista | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const [preview, setPreview] = useState<PreviewState>("api");

  useEffect(() => {
    if (isDevelopment && preview !== "api") return;
    const controller = new AbortController();
    const { signal } = controller;
    void fetch("/web-api/arriendos/mio", { credentials: "same-origin", cache: "no-store", signal }).then(async response => {
      if (signal.aborted) return;
      if ([401, 403, 404].includes(response.status)) {
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
  }, [requestVersion, preview]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") { setArriendo(null); setLoading(true); setError(""); setRequestVersion(value => value + 1); } };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  const showingPreview = isDevelopment && preview !== "api";
  const visibleLoading = showingPreview ? preview === "loading" : loading;
  const visibleError = showingPreview ? preview === "error" : Boolean(error);
  const visibleArriendo = showingPreview ? preview === "active" ? previewRental : null : arriendo;
  const visibleEmpty = showingPreview ? preview === "empty" : !loading && !error && !arriendo;

  function retry() {
    if (showingPreview) { setPreview("active"); return; }
    setLoading(true);
    setError("");
    setRequestVersion(value => value + 1);
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
    {visibleEmpty ? <Card><p>Aún no tienes un arriendo activo.</p><Link href="/mis-postulaciones">Ver mis postulaciones</Link></Card> : null}
    {!visibleLoading && !visibleError && visibleArriendo ? <>
      <div className={styles.dashboardLayout}>
        <div className={styles.dashboardMain}>
          <Link className={styles.homeBanner} href="/mi-arriendo/integrantes">
            <span className={styles.iconBubble}><Icon name="home" size={26} /></span>
            <span><strong>Nuestro lugar</strong><small>Arriendo #{visibleArriendo.id_arriendo} · Publicación #{visibleArriendo.id_publicacion}</small><b>{visibleArriendo.integrantes_activos} integrantes · {visibleArriendo.estado === "Activo" ? "viviendo juntos" : "arriendo finalizado"}</b></span>
            <span className={styles.cardArrow} aria-hidden="true">›</span>
          </Link>
          {visibleArriendo.estado === "Activo" ? <>
            <Link className={styles.journeyLink} href="/mi-arriendo/chat">
              <span className={styles.avatarStack} aria-hidden="true">{Array.from({ length: Math.min(visibleArriendo.integrantes_activos, 3) }, (_, index) => <span key={index}>R</span>)}</span>
              <span><strong>Chat del arriendo</strong><small>Conversación compartida por integrantes activos</small></span>
              <span className={styles.cardArrow} aria-hidden="true">›</span>
            </Link>
            <Card className={styles.taskPreview}>
              <div className={styles.sectionHeading}><h2>Organización de la casa</h2><Link href="/mi-arriendo/tareas">Ver tareas <span aria-hidden="true">›</span></Link></div>
              <p>Coordina las tareas con los integrantes del arriendo.</p>
              <Link className={styles.taskPreviewAction} href="/mi-arriendo/tareas"><Icon name="plus" size={19} /> Abrir tareas</Link>
            </Card>
          </> : null}
          <Link className={styles.journeyLink} href="/mi-arriendo/integrantes">
            <span className={styles.iconBubble}><Icon name="user" size={22} /></span>
            <span><strong>Detalles del arriendo</strong><small>Integrantes · cupos · datos del grupo</small></span>
            <span className={styles.cardArrow} aria-hidden="true">›</span>
          </Link>
        </div>
        <aside className={styles.dashboardAside} aria-label="Datos del grupo">
          <Card className={styles.groupCard}>
            <div className={styles.groupCardHeader}><h2>Datos del grupo</h2><ArriendoStatus estado={visibleArriendo.estado} /></div>
            <dl className={styles.groupFacts}>
              <div><dt>Integrantes activos</dt><dd>{visibleArriendo.integrantes_activos}</dd></div>
              <div><dt>Cupos disponibles</dt><dd>{visibleArriendo.cupos_disponibles}</dd></div>
              <div><dt>Capacidad total</dt><dd>{visibleArriendo.cupos_totales}</dd></div>
            </dl>
            <Link className={styles.publicationLink} href={`/publicaciones/${visibleArriendo.id_publicacion}`}>Ver publicación #{visibleArriendo.id_publicacion}</Link>
          </Card>
        </aside>
      </div>
      {canReport && !showingPreview ? <ReportMembers rentalId={visibleArriendo.id_arriendo} /> : null}
    </> : null}
  </main>;
}
