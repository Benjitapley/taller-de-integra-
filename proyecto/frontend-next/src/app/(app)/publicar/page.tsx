import type { Metadata } from "next";
import PageHeader from "@/components/layout/PageHeader";
import PublicationTypeCard from "@/features/publicaciones/PublicationTypeCard";
import Card from "@/components/ui/Card";
import styles from "@/features/publicaciones/publicaciones.module.css";

export const metadata: Metadata = { title: "Publicar | ¿Hay cupo?" };

export default function Publish() {
  return <main>
    <PageHeader title="Publicar" description="Elige cómo quieres compartir una oportunidad con la comunidad." />
    <div className={styles.publishContent}>
      <div className={styles.typeGrid}>
        <PublicationTypeCard title="Compartir una oportunidad" description="Encontré un lugar y busco con quién compartirlo." icon="search" />
        <PublicationTypeCard title="Publicar un arriendo" description="Soy arrendador y quiero ofrecer un espacio disponible." icon="home" />
      </div>
      <Card soft className={styles.publishInfo}><h2>✦ Crea tu publicación en pocos pasos</h2><p>La selección visual está preparada. Los formularios específicos, las fotografías y la vista previa se integrarán en otra tarea.</p></Card>
      <a className={styles.legacyLink} href="/crear">Abrir formulario HTML anterior (requiere FastAPI)</a>
    </div>
  </main>;
}
