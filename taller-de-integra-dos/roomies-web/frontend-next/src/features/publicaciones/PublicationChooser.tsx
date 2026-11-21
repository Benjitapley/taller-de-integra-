"use client";

import { useState } from "react";
import PublicationTypeCard from "./PublicationTypeCard";
import PublicationForm from "./PublicationForm";
import styles from "./publicaciones.module.css";

type PublicationKind = "Compartida" | "Arrendador";

export default function PublicationChooser() {
  const [kind, setKind] = useState<PublicationKind | null>(null);
  return <div className={styles.publishContent}>
    {!kind && <>
      <div className={styles.typeGrid}>
        <PublicationTypeCard title="Compartir una oportunidad" description="Encontré un lugar y busco con quién compartirlo." icon="search" onSelect={() => setKind("Compartida")} />
        <PublicationTypeCard title="Publicar un arriendo" description="Soy arrendador y quiero ofrecer un espacio disponible." icon="home" onSelect={() => setKind("Arrendador")} />
      </div>
      <p className={styles.publishInfo}>El formulario permite publicar los detalles, filtros de vivienda y una fotografía opcional.</p>
    </>}
    {kind && <PublicationForm key={kind} kind={kind} onBack={() => setKind(null)} />}
  </div>;
}
