"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { navigationItems } from "@/config/navigation";
import styles from "./AppShell.module.css";


export default function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <nav aria-label="Navegación principal"><ul className={styles.navList}>{navigationItems.map((item) => {
    const content = <><Icon name={item.icon} size={20} /><span>{item.label}</span>{item.legacy ? <small className={styles.navBadge}>HTML</small> : !item.href ? <small className={styles.navBadge}>Pendiente</small> : null}</>;
    return <li key={item.label}>{!item.href ? <span className={styles.pendingLink} aria-disabled="true">{content}</span> : item.legacy ? <a className={styles.navLink} href={item.href} onClick={onNavigate} title="Abrir página HTML anterior; requiere FastAPI">{content}</a> : <Link className={styles.navLink} href={item.href} aria-current={pathname === item.href ? "page" : undefined} onNavigate={onNavigate}>{content}</Link>}</li>;
  })}</ul></nav>;
}
