import Image from "next/image";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { routes } from "@/config/navigation";
import AuthForm from "./AuthForm";
import VerificationForm from "./VerificationForm";
import type { AuthMode } from "./validation";
import styles from "./auth.module.css";

export default function AuthScreen({ mode }: { mode: AuthMode | "verify" }) {
  const register = mode === "register";
  const verify = mode === "verify";
  return <>
    <header className={styles.topbar}>
      <Link className={styles.brand} href={routes.access}><Icon name="home" size={28} />¿Hay cupo?</Link>
      <Link className={styles.headerLink} href={register || verify ? routes.access : routes.register}>{register || verify ? "Iniciar sesión" : "Crear cuenta"}</Link>
    </header>
    <main id="acceso-contenido" tabIndex={-1} className={styles.main}>
      <section className={styles.hero} aria-label="Encuentra tu próximo hogar">
        <p className={styles.eyebrow}>Un espacio para nuevos comienzos</p>
        <h2>Tu próximo hogar <br />empieza aquí.</h2>
        <p>Encuentra el lugar ideal para ti o comparte el tuyo.</p>
        <Image className={styles.sofa} src="/Iconos/sofa(login).webp" alt="Ilustración de un sofá" width={520} height={340} preload />
        <ul className={styles.benefits}>
          <li><Icon name="user" />Conecta con personas que buscan o arriendan.</li>
          <li><Icon name="home" />Encuentra el arriendo o compañero ideal.</li>
          <li><Icon name="heart" />Comparte tu espacio, encuentra tu comunidad.</li>
        </ul>
      </section>
      <Card className={styles.card}>
        <h1>{verify ? "Verifica tu correo" : register ? "Crea tu cuenta" : "¡Bienvenido de vuelta!"}</h1>
        <p className={styles.subtitle}>{verify ? "Introduce tu correo y el código de seis dígitos." : register ? "Encuentra tu próximo espacio ideal." : "Inicia sesión para encontrar tu próximo hogar."}</p>
        <div className={styles.notice}><strong>Integración segura preparada</strong><p>El envío requiere que el entorno de pruebas esté habilitado. Si el servicio no está disponible, verás un error y no se confirmará ninguna operación.</p></div>
        {verify ? <VerificationForm /> : <AuthForm key={mode} mode={mode} />}
      </Card>
    </main>
    <footer className={styles.footer}><Link href={routes.guide}>Guía de navegación</Link></footer>
  </>;
}
