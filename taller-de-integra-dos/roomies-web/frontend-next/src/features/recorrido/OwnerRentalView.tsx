"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/layout/PageHeader";
import { ArriendoStatus } from "@/features/recorrido/JourneyStatus";
import type { ArriendoDto } from "@/features/recorrido/types";
import styles from "@/features/recorrido/recorrido.module.css";

export default function OwnerRentalView({ rentalId }: { rentalId: string }) {
  const [rental, setRental] = useState<ArriendoDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden" | "missing">("loading");
  const [version, setVersion] = useState(0);
  const load = useCallback(async (signal: AbortSignal) => {
    if (!/^[1-9][0-9]{0,9}$/.test(rentalId)) { setStatus("missing"); return; }
    try {
      const response = await fetch(`/web-api/arriendos/${rentalId}`, { cache: "no-store", credentials: "same-origin", signal });
      if (response.status === 403) { setStatus("forbidden"); return; }
      if (response.status === 404) { setStatus("missing"); return; }
      if (!response.ok) throw new Error();
      const data = await response.json() as ArriendoDto;
      if (data.id_arriendo !== Number(rentalId) || !Number.isSafeInteger(data.id_publicacion) ||
          !["Activo", "Finalizado"].includes(data.estado) ||
          ![data.cupos_totales, data.integrantes_activos, data.cupos_disponibles].every(value => Number.isSafeInteger(value) && value >= 0) ||
          data.integrantes_activos + data.cupos_disponibles !== data.cupos_totales) throw new Error();
      setRental(data);
      setStatus("ready");
    } catch { if (!signal.aborted) setStatus("error"); }
  }, [rentalId]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load, version]);

  return <main>
    <PageHeader title="Arriendo de tu publicación" description="Consulta la ocupación y los integrantes autorizados de esta publicación." />
    <p><Link href="/mis-publicaciones">Volver a Mis publicaciones</Link></p>
    {status === "loading" ? <Card><p role="status">Cargando información del arriendo…</p></Card> : null}
    {status === "error" ? <Card><p role="alert">No pudimos cargar el arriendo. Intenta nuevamente.</p><Button onClick={() => { setStatus("loading"); setVersion(value => value + 1); }}>Reintentar</Button></Card> : null}
    {status === "forbidden" ? <Card><p role="alert">No tienes permiso para consultar este arriendo.</p></Card> : null}
    {status === "missing" ? <Card><p role="status">No se encontró un arriendo para esta publicación.</p></Card> : null}
    {status === "ready" && rental ? <Card>
      <div className={styles.header}><div><h2 style={{ margin: 0 }}>Arriendo #{rental.id_arriendo}</h2>
        <p style={{ margin: "6px 0 0" }}><Link href={`/publicaciones/${rental.id_publicacion}`}>Ver publicación #{rental.id_publicacion}</Link></p></div>
        <ArriendoStatus estado={rental.estado} />
      </div>
      <div className={styles.facts}>
        <div className={styles.fact}><span>Capacidad total</span><strong>{rental.cupos_totales}</strong></div>
        <div className={styles.fact}><span>Integrantes activos</span><strong>{rental.integrantes_activos}</strong></div>
        <div className={styles.fact}><span>Cupos disponibles</span><strong>{rental.cupos_disponibles}</strong></div>
      </div>
      <div className={styles.actions}><Link className={styles.actionLink} href={`/mi-arriendo/${rental.id_arriendo}/integrantes`}>Ver integrantes</Link></div>
      <p>La vista de dueño permite consultar integrantes. Las conversaciones y tareas son privadas para integrantes autorizados.</p>
    </Card> : null}
  </main>;
}
