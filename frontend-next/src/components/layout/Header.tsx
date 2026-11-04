import Link from "next/link";
import { routes } from "@/config/navigation";
import Icon from "@/components/ui/Icon";
import styles from "./AppShell.module.css";

export default function Header({ onOpenSidebar, sidebarOpen }: { onOpenSidebar: () => void; sidebarOpen: boolean }) {
  return <header className={styles.compactHeader}><button type="button" className={styles.menuButton} aria-label="Abrir menú lateral" aria-expanded={sidebarOpen} aria-haspopup="dialog" onClick={onOpenSidebar}><Icon name="menu" /></button><Link href={routes.home}>¿Hay cupo?</Link></header>;
}
