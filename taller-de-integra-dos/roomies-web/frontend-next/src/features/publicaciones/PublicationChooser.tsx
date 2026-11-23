"use client";

import { useState } from "react";
import PublicationTypeCard from "./PublicationTypeCard";
import PublicationForm from "./PublicationForm";
import styles from "./publicaciones.module.css";

type PublicationKind = "Arrendador";

export default function PublicationChooser() {
  const [kind, setKind] = useState<PublicationKind | null>(null);
  return <div className={styles.publishContent}>
    {!kind && <>
      <div className={styles.typeGrid}>
        <PublicationTypeCard title="Publicar un arriendo" description="Soy arrendador y quiero ofrecer un espacio disponible." icon="home" onSelect={() => setKind("Arrendador")} />
      </div>
      <p className={styles.publishInfo}>Completa los detalles, adjunta hasta cinco fotografías y revisa la vista previa antes de publicar.</p>
    </>}
    {kind && <PublicationForm key={kind} kind={kind} onBack={() => setKind(null)} />}
  </div>;
}
