"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import type { Profile } from "./contracts";
import { contractPhotoLimit, contractTextLimits, isProfilePhoto, photoLimit, profileGenders, profileLimits, profileLocationFields, profileOccupations, validateProfile, validateProfileChanges } from "./validation";
import ProfileLocation from "./ProfileLocation";
import styles from "./perfil.module.css";

export default function ProfileEditor({ profile, onClose, onSaved, onPhotoSaved, onExpired }: {
  profile: Profile; onClose: () => void; onSaved: () => void; onPhotoSaved: (url: string) => void; onExpired: () => void;
}) {
  const canonical = profile.contrato_perfil === "v1";
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [message, setMessage] = useState("");
  const [photoNotice, setPhotoNotice] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  useEffect(() => () => { document.getElementById("edit-profile")?.focus(); }, []);
  async function send(path: string, method: string, body: FormData | string) {
    if (busy.current) return;
    busy.current = true;
    setMessage("");
    setPhotoNotice("");
    setPending(true);
    try {
      const response = await fetch(path, {
        method, body, credentials: "same-origin",
        headers: { "X-Haycupo-CSRF": "1", ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}) },
        signal: AbortSignal.timeout(20_000),
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
        const error = await response.json().catch(() => null);
        setMessage(error?.detail || "No se confirmó el guardado. Intenta nuevamente.");
        return;
      }
      const result = await response.json();
      if (path.endsWith("/foto")) {
        if (typeof result?.foto_perfil !== "string" || !result.foto_perfil) throw new Error("Foto sin confirmar");
        onPhotoSaved(result.foto_perfil);
        if (photoInput.current) photoInput.current.value = "";
        setPreview(null);
        setPhotoNotice("Foto guardada correctamente.");
      } else {
        if (result?.success !== true) throw new Error("Guardado sin confirmar");
        onSaved();
      }
    } catch { setMessage("No se confirmó el guardado. Consulta tu perfil antes de volver a intentar."); }
    finally { busy.current = false; setPending(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!canonical) {
      const error = validateProfile(data);
      if (error) { setMessage(error); return; }
      await send("/web-api/perfil", "PUT", data);
      return;
    }
    if (preview) {
      setMessage("Guarda la foto o quita la selección antes de guardar los datos.");
      return;
    }
    const changes: Record<string, unknown> = {};
    for (const key of ["ocupacion", "genero", ...Object.keys(contractTextLimits)] as const) {
      const raw = data.get(key);
      if (typeof raw !== "string") continue;
      const value = raw.trim() || null;
      if (value !== profile[key as keyof Profile]) changes[key] = value;
    }
    for (const key of profileLocationFields) {
      const raw = data.get(key);
      if (typeof raw !== "string") continue;
      const value = raw === "" ? null : Number(raw);
      if (value !== (profile[key] ?? null)) changes[key] = value;
    }
    if (Object.hasOwn(changes, "id_region_interes") && !Object.hasOwn(changes, "id_comuna_interes")) changes.id_comuna_interes = null;
    const error = validateProfileChanges(changes);
    if (error) { setMessage(error); return; }
    await send("/web-api/perfil", "PATCH", JSON.stringify(changes));
  }
  async function savePhoto() {
    const file = photoInput.current?.files?.[0];
    if (!file || !isProfilePhoto(file, contractPhotoLimit)) { setMessage("Selecciona una fotografía JPG, PNG o WEBP de hasta 5 MB."); return; }
    const data = new FormData();
    data.set("foto", file);
    await send("/web-api/perfil/foto", "PUT", data);
  }
  return <Modal open title="Editar perfil" onClose={() => { if (!pending) onClose(); }}>
    <form onSubmit={save} noValidate aria-label="Editar tu perfil" aria-busy={pending}>
      <p>Actualiza tu información. Los campos de texto pueden quedar vacíos.</p>
      <fieldset className={styles.editFields} disabled={pending}>
        <legend className={styles.legend}>Datos del perfil</legend>
        <label htmlFor="profile-age">Edad</label>
        <input id="profile-age" name={canonical ? undefined : "edad"} type="number" min="0" max="120" step="1" readOnly={profile.edad_calculada} defaultValue={profile.edad ?? ""} />
        {profile.edad_calculada && <small>Calculada desde tu fecha de nacimiento.</small>}
        {canonical && ([["ocupacion", "Ocupación", profileOccupations], ["genero", "Género", profileGenders]] as const).map(([name, label, options]) => <div key={name} className={styles.editField}>
          <label htmlFor={`profile-${name}`}>{label}</label>
          <select id={`profile-${name}`} name={name} defaultValue={profile[name] ?? ""}>
            <option value="">Sin indicar</option>
            {profile[name] && !(options as readonly string[]).includes(profile[name]) && <option>{profile[name]}</option>}
            {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
          </select>
        </div>)}
        {([["ocupacion", "Ocupación"], ["ciudad", "Ciudad"], ["breve_descripcion", "Descripción breve"], ["sobre_mi", "Sobre mí (biografía)"]] as const)
          .filter(([name]) => !canonical || name !== "ocupacion").map(([name, label]) => {
          const limit = canonical && name !== "ocupacion" ? contractTextLimits[name] : profileLimits[name];
          return <div key={name} className={styles.editField}>
          <label htmlFor={`profile-${name}`}>{label}</label>
          {name === "sobre_mi" ? <textarea id={`profile-${name}`} name={name} rows={5} maxLength={limit} defaultValue={profile[name] ?? ""} />
            : <input id={`profile-${name}`} name={name} maxLength={limit} defaultValue={profile[name] ?? ""} />}
          <small>Máximo {limit} caracteres.</small>
        </div>; })}
        {canonical && <ProfileLocation profile={profile} />}
        <label htmlFor="profile-photo">Fotografía</label>
        <input ref={photoInput} id="profile-photo" name={canonical ? undefined : "foto"} type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="photo-help" onChange={(e) => {
          const file = e.target.files?.[0];
          setPhotoNotice("");
          if (file && !isProfilePhoto(file, canonical ? contractPhotoLimit : photoLimit)) {
            e.target.value = "";
            setPreview(null);
            setMessage("Usa una fotografía JPG, PNG o WEBP de hasta 5 MB.");
            return;
          }
          setPreview(file ? URL.createObjectURL(file) : null); setMessage("");
        }} />
        <small id="photo-help">{canonical ? "JPG, PNG o WEBP. Hasta 5 MB. Usa Guardar foto para confirmar el reemplazo." : "JPG, PNG o WEBP. Hasta 5 MB y 20 megapíxeles. Sin seleccionar archivo se conserva la foto actual."}</small>
        {(preview || profile.foto_perfil) && <Image className={styles.preview} src={preview || profile.foto_perfil!} alt="Vista previa de fotografía" width={112} height={112} unoptimized referrerPolicy="no-referrer" onError={() => setMessage("No se pudo mostrar la fotografía. Selecciona una imagen válida.")} />}
        {canonical && preview && <div className={styles.actions}>
          <Button variant="secondary" onClick={savePhoto}>Guardar foto</Button>
          <Button variant="secondary" onClick={() => {
            if (photoInput.current) photoInput.current.value = "";
            setPreview(null);
            setMessage("");
          }}>Quitar selección</Button>
        </div>}
        <div className={styles.actions}><Button type="submit">{pending ? "Guardando…" : "Guardar cambios"}</Button><Button variant="secondary" onClick={onClose}>Cancelar</Button></div>
      </fieldset>
      {pending && <p role="status">Guardando tu perfil…</p>}
      {photoNotice && <p role="status">{photoNotice}</p>}
      {message && <p role="alert">{message}</p>}
    </form>
  </Modal>;
}
