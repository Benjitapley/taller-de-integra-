import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import ModalDemo from "@/features/navegacion/ModalDemo";
import styles from "@/features/navegacion/navegacion.module.css";

export const metadata: Metadata = { title: "Guía de navegación | ¿Hay cupo?" };

export default function NavigationDemo() {
  return <main className={styles.guide}>
    <PageHeader title="Guía de navegación" description="Demostración de estructura WEB. Sin operaciones de negocio." />
    <Card className={styles.guideCard}><h2>¿Hay cupo?</h2><p>Un lugar para encontrar tu próximo hogar y compartir nuevos comienzos.</p><p>La aplicación Next.js está funcionando. Las rutas de aplicación aún no están protegidas por una sesión.</p><ul className={styles.guideLinks}><li><Link href="/">Acceso pendiente</Link></li><li><Link href="/inicio">Inicio</Link></li><li><Link href="/inicio?vista=personas">Pestaña Personas</Link></li><li><Link href="/publicar">Tipos de publicación</Link></li></ul></Card>
    <Card className={styles.guideCard}><h2>Diálogo reutilizable</h2><p>Comprueba apertura, cierre y recorrido del foco. Este ejemplo no contiene formularios de tareas, recordatorios ni documentos.</p><ModalDemo /></Card>
    <Card className={styles.guideCard}><h2>Interfaz HTML anterior</h2><p>Estos enlaces cargan páginas completas y requieren FastAPI en el puerto 8000. No verifican identidad ni garantizan una sesión. Sus enlaces internos conservan los destinos originales y pueden volver a la interfaz nueva.</p><ul className={styles.guideLinks}><li><a href="/acceso">Acceso HTML</a></li><li><a href="/legacy/inicio">Inicio HTML</a></li><li><a href="/legacy/crear">Crear HTML</a></li><li><a href="/legacy/mis-publicaciones">Mis publicaciones HTML</a></li><li><a href="/legacy/perfil">Perfil HTML</a></li></ul></Card>
  </main>;
}
