"use client";

import { useEffect, useId, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import styles from "./AppShell.module.css";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (!ref.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={ref} className={styles.userMenu} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><Icon name="user" size={16} />Información de cuenta</button>
    <div id={id} hidden={!open} className={styles.userPanel}><strong>Autenticación pendiente</strong><p>Esta vista no consulta tu sesión.</p><a href="/acceso">Abrir acceso HTML anterior</a></div>
  </div>;
}
