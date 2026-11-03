"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Modal from "@/components/ui/Modal";
import styles from "./AppShell.module.css";

export default function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const resize = () => { if (media.matches) setOpen(false); };
    const history = () => setOpen(false);
    media.addEventListener("change", resize);
    window.addEventListener("popstate", history);
    return () => { media.removeEventListener("change", resize); window.removeEventListener("popstate", history); };
  }, []);
  return <div className={styles.shell}>
    <a className={styles.skipLink} href="#contenido">Saltar al contenido</a>
    <div className={styles.desktopSidebar}><Sidebar /></div>
    <Header sidebarOpen={open} onOpenSidebar={() => setOpen(true)} />
    <Modal key={pathname} title="Navegación" drawer open={open} onClose={() => setOpen(false)}>
      <Sidebar onNavigate={() => setOpen(false)} />
    </Modal>
    <div id="contenido" tabIndex={-1} className={styles.content}>{children}</div>
  </div>;
}
