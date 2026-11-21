"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { validatePublicationForm } from "./validation";
import styles from "./publicaciones.module.css";

type PublicationKind = "Compartida" | "Arrendador";
type Region = { id_region: number; nombre: string };
type Commune = { id_comuna: number; nombre: string };

export default function PublicationForm({ kind, onBack }: { kind: PublicationKind; onBack: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [regionId, setRegionId] = useState("");
  const shared = kind === "Compartida";

  useEffect(() => {
    fetch("/api/regiones", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.ok ? response.json() : [])
      .then((value: unknown) => {
        if (Array.isArray(value)) setRegions(value.filter((item): item is Region =>
          !!item && typeof item === "object" && typeof item.id_region === "number" && typeof item.nombre === "string"));
      })
      .catch(() => setRegions([]));
  }, []);

  useEffect(() => {
    if (!regionId) return;
    const controller = new AbortController();
    fetch(`/api/regiones/${regionId}/comunas`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : [])
      .then((value: unknown) => {
        if (!controller.signal.aborted && Array.isArray(value)) setCommunes(value.filter((item): item is Commune =>
          !!item && typeof item === "object" && typeof item.id_comuna === "number" && typeof item.nombre === "string"));
      })
      .catch(() => { if (!controller.signal.aborted) setCommunes([]); });
    return () => controller.abort();
  }, [regionId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    form.set("tipo", kind);
    form.delete("confirmo_origen");
    if (!shared) form.set("categoria", "ofrezco");
    form.set("permitir_comentarios", form.has("permitir_comentarios") ? "true" : "false");
    const validationError = validatePublicationForm(form);
    if (validationError) { setMessage(validationError); return; }

    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/web-api/publicaciones", {
        method: "POST",
        body: form,
        credentials: "same-origin",
        headers: { "X-Haycupo-CSRF": "1" },
        signal: AbortSignal.timeout(25_000),
      });
      if (response.status === 401) {
        router.replace("/");
        return;
      }
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        const detail = result && typeof result === "object" && "detail" in result && typeof result.detail === "string"
          ? result.detail
          : "No se pudo confirmar la publicación. Revisa los datos e inténtalo nuevamente.";
        setMessage(detail);
        return;
      }
      router.push("/inicio");
    } catch {
      setMessage("No se pudo confirmar la publicación. Revisa tus publicaciones antes de volver a intentarlo.");
    } finally {
      setPending(false);
    }
  }

  return <section className={styles.formSection}>
    <button className={styles.backButton} type="button" onClick={onBack}>← Cambiar tipo de publicación</button>
    <h2>{kind === "Compartida" ? "Compartir una oportunidad" : "Publicar un arriendo"}</h2>
    <p>{shared ? "Registra la información de un aviso que encontraste fuera de Roomies para buscar con quién compartir ese lugar. No te registras como arrendador." : "Ofrece un espacio que arriendas y recibe postulaciones individuales. Tú podrás revisar y decidir sobre cada solicitud."}</p>
    <form className={styles.publicationForm} onSubmit={submit} aria-busy={pending}>
      <fieldset disabled={pending}>
        <legend>Detalles de la publicación</legend>
        <label className={styles.fullField}>Título
          <input name="titulo" required maxLength={200} placeholder="Ej.: Habitación cerca del centro" />
        </label>
        {shared ? <label>Objetivo del aviso
          <select name="categoria" defaultValue="busco" required>
            <option value="busco">Busco con quién compartir este lugar</option><option value="ofrezco">Comparto una oportunidad encontrada</option>
          </select>
        </label> : <input type="hidden" name="categoria" value="ofrezco" />}
        <label>Tipo de vivienda
          <select name="tipo_vivienda" defaultValue="" required>
            <option value="" disabled>Selecciona una opción</option><option value="casa">Casa</option>
            <option value="departamento">Departamento</option><option value="habitacion">Habitación</option>
          </select>
        </label>
        <label>Región
          <select name="id_region" value={regionId} onChange={(event) => { setCommunes([]); setRegionId(event.target.value); }} required>
            <option value="" disabled>Selecciona una región</option>
            {regions.map((region) => <option key={region.id_region} value={region.id_region}>{region.nombre}</option>)}
          </select>
        </label>
        <label>Comuna
          <select name="id_comuna" required disabled={!regionId}>
            <option value="" disabled>Selecciona una comuna</option>
            {communes.map((commune) => <option key={commune.id_comuna} value={commune.id_comuna}>{commune.nombre}</option>)}
          </select>
        </label>
        <label>{shared ? "Precio indicado en el aviso externo (CLP)" : "Precio del arriendo (CLP)"}
          <input name="precio" type="number" min="0" max="999999999999" step="1" required />
        </label>
        <label>{shared ? "Capacidad total indicada en el aviso" : "Capacidad total del espacio"}
          <input name="cupos_totales" type="number" min="1" max="2147483647" step="1" required />
        </label>
        <label>¿Acepta mascotas?
          <select name="mascota" defaultValue="no"><option value="si">Sí</option><option value="no">No</option></select>
        </label>
        <label className={styles.fullField}>Descripción
          <textarea name="descripcion" rows={5} maxLength={5000} required placeholder={shared ? "Transcribe la información externa: características, condiciones y dónde encontraste el aviso." : "Describe el espacio, sus características y las reglas que deben conocer los postulantes."} />
        </label>
        <label className={styles.fullField}>Fotografía (opcional)
          <input name="imagen" type="file" accept="image/jpeg,image/png,image/webp" />
          <small>JPG, PNG o WEBP, máximo 5 MB.</small>
        </label>
        <label className={`${styles.fullField} ${styles.checkboxField}`}>
          <input name="permitir_comentarios" type="checkbox" value="true" />
          Permitir comentarios en esta publicación
        </label>
        {shared && <label className={`${styles.fullField} ${styles.checkboxField}`}>
          <input name="confirmo_origen" type="checkbox" required />Confirmo que comparto información obtenida externamente y revisaré su disponibilidad. Esta publicación no recibe postulaciones de arrendador.
        </label>}
        <div className={styles.formActions}>
          <Button type="submit">{pending ? "Publicando…" : "Publicar ahora"}</Button>
          <Button type="button" variant="secondary" onClick={onBack}>Cancelar</Button>
        </div>
      </fieldset>
      {pending && <p role="status">Enviando la publicación…</p>}
      {message && <p className={styles.formError} role="alert">{message}</p>}
    </form>
    <Link href="/inicio">Volver a las publicaciones</Link>
  </section>;
}
