"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { navigationItems } from "@/config/navigation";
import styles from "./AppShell.module.css";


export default function SidebarNavigation({ onNavigate, showReports = false }: { onNavigate?: () => void; showReports?: boolean }) {
  const pathname = usePathname();
  return <nav aria-label="Navegación principal"><ul className={styles.navList}>{navigationItems.filter(item => item.href !== "/mis-reportes" || showReports).map((item) => {
    const content = <><Icon name={item.icon} size={20} /><span>{item.label}</span>{!item.href ? <small className={styles.navBadge}>Pendiente</small> : null}</>;
    return <li key={item.label}>{!item.href ? <span className={styles.pendingLink} aria-disabled="true">{content}</span> : <Link className={styles.navLink} href={item.href} aria-current={pathname === item.href ? "page" : undefined} onNavigate={onNavigate}>{content}</Link>}</li>;
  })}</ul></nav>;
}
