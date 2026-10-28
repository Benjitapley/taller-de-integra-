"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import { routes } from "@/config/navigation";
import type { Profile } from "./contracts";
import ProfileEditor from "./ProfileEditor";
import AccountVerification from "./AccountVerification";
import styles from "./perfil.module.css";

type State = { kind: "loading" } | { kind: "empty" } | { kind: "error" } | { kind: "expired" } | { kind: "ready"; profile: Profile };
function Avatar({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return <div className={styles.avatar}>{src && !failed
    ? <Image src={src} alt={`Fotografía de ${name || "perfil"}`} width={112} height={112} unoptimized referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <span role="img" aria-label="Sin fotografía de perfil"><Icon name="user" size={44} /></span>}</div>;
}
export default function ProfileView() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      try {
        const response = await fetch("/web-api/perfil", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]) });
        if (abort.signal.aborted) return;
        if ([401, 403].includes(response.status)) { setState({ kind: "expired" }); return; }
        if (response.status === 404) { setState({ kind: "empty" }); return; }
        if (!response.ok) { setState({ kind: "error" }); return; }
        const profile: Profile = await response.json();
        if (!abort.signal.aborted) setState({ kind: "ready", profile });
      } catch {
        if (!abort.signal.aborted) setState({ kind: "error" });
      }
    }
    void load();
    return () => abort.abort();
  }, [attempt]);
  function retry() { setState({ kind: "loading" }); setAttempt((previous) => previous + 1); }
  if (state.kind === "loading") return <Card className={styles.state} role="status" aria-live="polite" aria-busy="true"><Icon name="user" size={32} /><p>Cargando tu perfil…</p></Card>;
  if (state.kind === "expired") return <Card className={styles.state}><p role="alert">Tu sesión ha expirado o ya no está disponible.</p><Link href={routes.access}>Volver a iniciar sesión</Link></Card>;
  if (state.kind === "empty") return <section aria-label="Perfil vacío"><EmptyState icon="user" title="Perfil no disponible" description="No se encontró un perfil para tu cuenta." /><Button variant="secondary" className={styles.retry} onClick={retry}>Volver a consultar</Button></section>;
  if (state.kind === "error") return <Card className={styles.state}>{notice && <p role="status">{notice}</p>}<p role="alert">No se pudo cargar tu perfil. Intenta nuevamente más tarde.</p><Button variant="secondary" onClick={retry}>Reintentar</Button></Card>;
  const profile = state.profile;
  return <div className={styles.grid}>
    <Card className={styles.summary}>
      <Avatar key={profile.foto_perfil} src={profile.foto_perfil} name={profile.nombre} />
      <h2>{profile.nombre || "Nombre sin indicar"}</h2>
      <p className={styles.description}>{profile.breve_descripcion || "Aún no hay una descripción breve."}</p>
      <Button id="edit-profile" onClick={() => { setNotice(""); setEditing(true); }}>Editar perfil</Button>
      {notice && <p role="status">{notice}</p>}
      <div className={styles.stat}><strong>{profile.total_publicaciones}</strong><span>Publicaciones</span></div>
    </Card>
    <div className={styles.details}>
      <Card><h2>Información personal</h2><dl className={styles.facts}>
        <div><dt>Edad</dt><dd>{profile.edad === null ? "Sin indicar" : `${profile.edad} años`}</dd></div>
        <div><dt>Ocupación</dt><dd>{profile.ocupacion || "Sin indicar"}</dd></div>
        <div><dt>Ciudad</dt><dd>{profile.ciudad || "Sin indicar"}</dd></div>
      </dl></Card>
      <Card><h2>Sobre mí</h2><p className={styles.about}>{profile.sobre_mi || "Aún no hay información sobre ti."}</p></Card>
      <AccountVerification verified={profile.verificado} onRefresh={retry} />
    </div>
    {editing && <ProfileEditor profile={profile} onClose={() => setEditing(false)} onExpired={() => { setEditing(false); setState({ kind: "expired" }); }} onSaved={() => { setEditing(false); setNotice("Perfil guardado correctamente."); retry(); }} />}
  </div>;
}
