"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RenewSession() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/web-api/auth/renovar", { method: "POST", headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" }, body: "{}" })
      .then(response => { if (active) { if (response.ok) router.replace("/inicio"); else if (response.status === 401) router.replace("/"); else setFailed(true); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [router]);
  return <main><h1>Restaurar sesión</h1>{failed ? <p role="alert">No se pudo restaurar la sesión. <Link href="/">Volver al acceso</Link></p> : <p role="status">Comprobando tu sesión…</p>}</main>;
}
