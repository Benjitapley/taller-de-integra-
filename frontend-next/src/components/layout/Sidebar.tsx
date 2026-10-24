import Link from "next/link";
import { routes } from "@/config/navigation";
import { usePathname } from "next/navigation";
import SidebarNavigation from "./SidebarNavigation";
import UserMenu from "./UserMenu";
import PromoCard from "./PromoCard";
import Icon from "@/components/ui/Icon";
import styles from "./AppShell.module.css";

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <aside className={styles.sidebar} aria-label="Menú de ¿Hay cupo?">
    <Link href={routes.home} className={styles.brand} aria-label="Roomies, inicio de ¿Hay cupo?" onNavigate={onNavigate}><span><Icon name="home" size={23} /></span>Roomies</Link>
    <SidebarNavigation onNavigate={onNavigate} />
    <div className={styles.sidebarSecondary}><Link href="/navegacion" aria-current={pathname === "/navegacion" ? "page" : undefined} onNavigate={onNavigate}>Guía de navegación</Link><UserMenu /></div>
    <PromoCard compact />
  </aside>;
}
