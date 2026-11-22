import type { ReactNode } from "react";
import styles from "@/features/auth/auth.module.css";

export default function AccessLayout({ children }: { children: ReactNode }) {
  return <div className={styles.layout}>
    <a className={styles.skipLink} href="#acceso-contenido">Saltar al contenido</a>
    {children}
  </div>;
}
