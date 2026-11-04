import Link from "next/link";
import { routes } from "@/config/navigation";
import Icon from "@/components/ui/Icon";
import styles from "./AppShell.module.css";

export default function PromoCard({ compact = false }: { compact?: boolean }) {
  if (compact) return <div className={styles.promo}>
    <div className={styles.promoVisual} aria-hidden="true"><Icon name="home" size={48} /><span>🪴 🛋️</span></div>
    <h3>¿Buscas algo<br />para tu casa?</h3><p>Publica o encuentra<br />lo que necesitas.</p>
    <Link href={routes.home}>Ver publicaciones</Link>
  </div>;
  return <aside className={styles.rightSpot} aria-label="Encuentra a tu próximo roomie"><span className={styles.house} aria-hidden="true">🏡</span><h2>Encuentra a tu próximo roomie</h2><p>Explora publicaciones y conecta con personas compatibles.</p></aside>;
}
