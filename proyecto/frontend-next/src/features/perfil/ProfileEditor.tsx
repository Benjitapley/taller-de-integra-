"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import type { Profile } from "./contracts";
import { photoLimit, profileLimits, validateProfile } from "./validation";
import styles from "./perfil.module.css";

export default function ProfileEditor({ profile, onClose, onSaved, onExpired }: {
  profile: Profile; onClose: () => void; onSaved: () => void; onExpired: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  useEffect(() => () => { document.getElementById("edit-profile")?.focus(); }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const error = validateProfile(data);
    if (error) { setMessage(error); return; }
    setMessage(""); setPending(true);
    try {
      const response = await fetch("/web-api/perfil", {
        method: "PUT", body: data, credentials: "same-origin", headers: { "X-Haycupo-CSRF": "1" }, signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 401) { onExpired(); return; }
      if (response.status === 403) {
        const body = await response.json().catch(() => null);
        setMessage(body?.code === "CSRF_REJECTED"
          ? "No se pudo validar el origen de la solicitud. Tus cambios siguen en el formulario. Intenta nuevamente desde la dirección de la aplicación."
          : "No tienes permiso para guardar estos cambios. Tus datos siguen en el formulario.");
        return;
      }
      if (!response.ok) {
        const body = await response.json();
        setMessage(body.detail || "No se confirmó el guardado. Intenta nuevamente.");
        return;
      }
      onSaved();
    } catch { setMessage("No se confirmó el guardado. Consulta tu perfil antes de volver a intentar."); }
    finally { setPending(false); }
  }
  return <Modal open title="Editar perfil" onClose={() => { if (!pending) onClose(); }}>
    <form onSubmit={save} noValidate aria-label="Editar tu perfil" aria-busy={pending}>
      <p>Actualiza tu información. Los campos de texto pueden quedar vacíos.</p>
      <fieldset className={styles.editFields} disabled={pending}>
        <legend className={styles.legend}>Datos del perfil</legend>
        <label htmlFor="profile-age">Edad</label>
        <input id="profile-age" name="edad" type="number" min="0" max="120" step="1" defaultValue={profile.edad ?? ""} />
        {([["ocupacion", "Ocupación"], ["ciudad", "Ciudad"], ["breve_descripcion", "Descripción breve"], ["sobre_mi", "Sobre mí (biografía)"]] as const).map(([name, label]) => <div key={name} className={styles.editField}>
          <label htmlFor={`profile-${name}`}>{label}</label>
          {name === "sobre_mi" ? <textarea id={`profile-${name}`} name={name} rows={5} maxLength={profileLimits[name]} defaultValue={profile[name] ?? ""} />
            : <input id={`profile-${name}`} name={name} maxLength={profileLimits[name]} defaultValue={profile[name] ?? ""} />}
          <small>Máximo {profileLimits[name]} caracteres.</small>
        </div>)}
        <label htmlFor="profile-photo">Fotografía</label>
        <input id="profile-photo" name="foto" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="photo-help" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && (file.size > photoLimit || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
            setPreview(null); setMessage("Usa una fotografía JPG, PNG o WEBP de hasta 5 MB."); return;
          }
          setPreview(file ? URL.createObjectURL(file) : null); setMessage("");
        }} />
        <small id="photo-help">JPG, PNG o WEBP. Hasta 5 MB y 20 megapíxeles. Sin seleccionar archivo se conserva la foto actual.</small>
        {(preview || profile.foto_perfil) && <Image className={styles.preview} src={preview || profile.foto_perfil!} alt="Vista previa de fotografía" width={112} height={112} unoptimized onError={() => setMessage("No se pudo mostrar la fotografía. Selecciona una imagen válida.")} />}
        <div className={styles.actions}><Button type="submit">{pending ? "Guardando…" : "Guardar cambios"}</Button><Button variant="secondary" onClick={onClose}>Cancelar</Button></div>
      </fieldset>
      {pending && <p role="status">Guardando tu perfil…</p>}
      {message && <p role="alert">{message}</p>}
    </form>
  </Modal>;
}
