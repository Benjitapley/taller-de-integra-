import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import HomeContent from "@/features/inicio/HomeContent";
import PromoCard from "@/components/layout/PromoCard";
import styles from "@/features/inicio/inicio.module.css";

export default function Home() {
  return <main>
    <PageHeader title="¿Hay cupo?" description="Encuentra compañeros de casa o arriendos disponibles." />
    <div className={styles.homeGrid}>
      <div className={styles.mainColumn}><Suspense fallback={<p>Cargando navegación…</p>}><HomeContent /></Suspense></div>
      <PromoCard />
    </div>
  </main>;
}
