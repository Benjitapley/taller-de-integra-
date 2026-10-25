"use client";

import { useEffect, useId, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import styles from "./AppShell.module.css";
import { submitAuth } from "@/features/auth/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { routes } from "@/config/navigation";

export default function UserMenu() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function logout() {
    if (pending) return;
    setPending(true);
    const result = await submitAuth("logout", {});
    setPending(false);
    if (result.ok || [401, 403].includes(result.status)) { router.replace("/"); router.refresh(); }
    else setMessage(`${result.message} No se confirmó la revocación; vuelve a intentar cerrar sesión.`);
  }
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
    <div id={id} hidden={!open} className={styles.userPanel}><strong>Sesión validada por FastAPI</strong><Link href={routes.profile} onClick={() => setOpen(false)}>Ver mi perfil</Link><button type="button" onClick={logout} disabled={pending}>{pending ? "Cerrando sesión…" : "Cerrar sesión"}</button><p role="status">{message}</p></div>
  </div>;
}
