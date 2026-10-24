import Link from "next/link";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { routes } from "@/config/navigation";
import styles from "./auth.module.css";

export default function AccessPlaceholder() {
  return <main id="acceso-contenido" tabIndex={-1} className={styles.main}>
    <Card className={styles.card}>
      <span className={styles.brand}><Icon name="home" size={28} />¿Hay cupo?</span>
      <h1>Iniciar sesión o registrarse</h1>
      <p>Encuentra compañeros de casa y tu próximo hogar.</p>
      <div className={styles.notice}><h2>Acceso pendiente de integración</h2><p>El registro, login y sesión se conectarán en SCRUM-72. Esta pantalla no solicita credenciales ni crea una sesión.</p></div>
      <a className={styles.legacy} href={routes.legacyAccess}>Abrir acceso HTML anterior</a>
      <p className={styles.help}>Requiere FastAPI. El sistema anterior conserva sus limitaciones de seguridad.</p>
      <Link href={routes.guide}>Guía de navegación y revisión de SCRUM-66</Link>
    </Card>
  </main>;
}
