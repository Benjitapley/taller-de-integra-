"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { validatePublicationForm } from "./validation";
import LocationFields from "./LocationFields";
import ImageFields from "./ImageFields";
import PublicationRules, { setPublicationRules } from "./PublicationRules";
import styles from "./publicaciones.module.css";

type PublicationKind = "Arrendador";
export default function PublicationForm({ kind, onBack }: { kind: PublicationKind; onBack: () => void }) {
  const router = useRouter();
  const operation = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<FormData | null>(null);
  const resetSubmission = () => { operation.current = null; setPreview(null); };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    form.set("tipo", kind);
    if (!String(form.get("ubicacion") ?? "").trim()) form.delete("ubicacion");
    setPublicationRules(form);
    const validationError = validatePublicationForm(form);
    if (validationError) { setMessage(validationError); return; }

    setMessage("");
    if ((event.nativeEvent as SubmitEvent).submitter?.getAttribute("name") === "preview") {
      const selected = event.currentTarget.querySelector<HTMLSelectElement>("select[data-publication-commune]");
      if (selected?.value) form.set("nombre_comuna", selected.selectedOptions[0].text);
      setPreview(form);
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/web-api/publicaciones", {
        method: "POST",
        body: form,
        credentials: "same-origin",
        headers: { "X-Haycupo-CSRF": "1", "Idempotency-Key": operation.current ??= crypto.randomUUID() },
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
      const saved = await response.json();
      if (!Number.isSafeInteger(saved?.id_publicacion) || saved.id_publicacion < 1) {
        setMessage("No se pudo confirmar el aviso guardado. Revisa Mis publicaciones.");
        return;
      }
      router.push("/publicaciones/" + saved.id_publicacion);
    } catch {
      setMessage("No se pudo confirmar la publicación. Revisa tus publicaciones antes de volver a intentarlo.");
    } finally {
      setPending(false);
    }
  }

  return <section className={styles.formSection}>
    <button className={styles.backButton} type="button" onClick={onBack}>← Cambiar tipo de publicación</button>
    <h2>Publicar un arriendo</h2>
    <p>Ofrece un espacio que arriendas y recibe postulaciones individuales. Tú podrás revisar y decidir sobre cada solicitud.</p>
    <form className={styles.publicationForm} onSubmit={submit} onChange={resetSubmission} aria-busy={pending}>
      <fieldset disabled={pending}>
        <legend>Detalles de la publicación</legend>
        <label className={styles.fullField}>Título
          <input name="titulo" required maxLength={200} placeholder="Ej.: Habitación cerca del centro" />
        </label>
        <label>Tipo de vivienda
          <select name="tipo_vivienda" defaultValue="" required>
            <option value="" disabled>Selecciona una opción</option><option value="casa">Casa</option>
            <option value="departamento">Departamento</option><option value="habitacion">Habitación</option>
          </select>
        </label>
        <LocationFields />
        <label>Dirección o sector (opcional)
          <input name="ubicacion" maxLength={250} />
        </label>
          <label>Precio del arriendo (CLP)
          <input name="precio" type="number" min="0" max="999999999999" step="1" required />
        </label>
        <label>Capacidad total del espacio
          <input name="cupos_totales" type="number" min="1" max="2147483647" step="1" required />
        </label>
        <label>¿Acepta mascotas?
          <select name="mascota" defaultValue="no"><option value="si">Sí</option><option value="no">No</option></select>
        </label>
        <label className={styles.fullField}>Descripción
          <textarea name="descripcion" rows={5} maxLength={5000} required placeholder="Describe el espacio, sus características y las reglas que deben conocer los postulantes." />
        </label>
        <div className={styles.fullField}><PublicationRules /></div>
        <div className={styles.fullField}><ImageFields onRemoveFile={resetSubmission} /></div>
        {preview && <section className={styles.fullField} aria-label="Vista previa del aviso" aria-live="polite">
          <h3>{String(preview.get("titulo"))}</h3>
          <p>{[preview.get("ubicacion"), preview.get("nombre_comuna")].filter(Boolean).join(" · ")}</p>
          <p>{new Intl.NumberFormat("es-CL").format(Number(preview.get("precio")))} CLP · Capacidad total {String(preview.get("cupos_totales"))}</p>
          <p>{String(preview.get("descripcion"))}</p>
        </section>}
        <div className={styles.formActions}>
          <Button type="submit">{pending ? "Publicando…" : "Publicar ahora"}</Button>
          <Button type="submit" variant="secondary" name="preview">Vista previa</Button>
          <Button type="button" variant="secondary" onClick={onBack}>Cancelar</Button>
        </div>
      </fieldset>
      {pending && <p role="status">Enviando la publicación…</p>}
      {message && <p className={styles.formError} role="alert">{message}</p>}
    </form>
    <Link href="/inicio">Volver a las publicaciones</Link>
  </section>;
}
