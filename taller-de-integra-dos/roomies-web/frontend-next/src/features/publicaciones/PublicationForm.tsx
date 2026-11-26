"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { validatePublicationForm, publicationError, type PublicationError } from "./validation";
import PublicationErrorNotice from "./PublicationErrorNotice";
import PublicationPreview, { emptySelection } from "./PublicationPreview";
import LocationFields from "./LocationFields";
import ImageFields from "./ImageFields";
import PublicationRules, { setPublicationRules } from "./PublicationRules";
import styles from "./publicaciones.module.css";

type PublicationKind = "Arrendador";
export default function PublicationForm({ kind, onBack }: { kind: PublicationKind; onBack: () => void }) {
  const router = useRouter();
  const operation = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PublicationError | null>(null);
  const [selection, setSelection] = useState(emptySelection);
  const [preview, setPreview] = useState<FormData | null>(null);
  const resetSubmission = () => { operation.current = null; };
  function updatePreview(element: HTMLFormElement) {
    const form = new FormData(element);
    const commune = element.querySelector<HTMLSelectElement>("select[data-publication-commune]");
    if (commune?.value) form.set("nombre_comuna", commune.selectedOptions[0].text);
    setPreview(form);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    form.set("tipo", kind);
    setPublicationRules(form);
    const validationError = validatePublicationForm(form);
    if (validationError) { setError(publicationError(422, { mensaje: validationError })); return; }

    setError(null);
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
      if (!response.ok) {
        setError(publicationError(response.status, await response.json().catch(() => null)));
        return;
      }
      const saved = await response.json();
      if (!Number.isSafeInteger(saved?.id_publicacion) || saved.id_publicacion < 1) {
        setError(publicationError(503, null));
        return;
      }
      router.push("/publicaciones/" + saved.id_publicacion);
    } catch {
      setError(publicationError(503, null));
    } finally {
      setPending(false);
    }
  }

  return <section className={styles.formSection}>
    <button className={styles.backButton} type="button" onClick={onBack}>← Cambiar tipo de publicación</button>
    <h2>Publicar un arriendo</h2>
    <p>Ofrece un espacio que arriendas y recibe postulaciones individuales. Tú podrás revisar y decidir sobre cada solicitud.</p>
    <form className={styles.publicationForm} onSubmit={submit} onChange={event => { resetSubmission(); updatePreview(event.currentTarget); }} aria-busy={pending}>
      <fieldset disabled={pending}>
        <legend>Detalles de la publicación</legend>
        <label className={styles.fullField}>Título
          <input name="titulo" required maxLength={200} placeholder="Ej.: Habitación cerca del centro" />
        </label>
        <label>Tipo de vivienda
          <select name="tipo_vivienda" defaultValue="" required>
            <option value="" disabled>Selecciona una opción</option><option value="Casa">Casa</option>
            <option value="Departamento">Departamento</option><option value="Habitacion">Habitación</option>
          </select>
        </label>
        <LocationFields />
          <label>Precio del arriendo (CLP)
          <input name="precio" type="number" min="0" max="999999999999" step="1" required />
        </label>
        <label>Capacidad total
          <input name="cupos_totales" type="number" min="1" max="2147483647" step="1" required />
        </label>
        <label>¿Acepta mascotas?
          <select name="mascota" defaultValue="no"><option value="si">Sí</option><option value="no">No</option></select>
        </label>
        <label className={styles.fullField}>Descripción
          <textarea name="descripcion" rows={5} maxLength={5000} required placeholder="Describe el espacio, sus características y las reglas que deben conocer los postulantes." />
        </label>
        <div className={styles.fullField}><PublicationRules onRulesChange={resetSubmission} /></div>
        <div className={styles.fullField}><ImageFields onRemoveFile={resetSubmission} onSelectionChange={setSelection} /></div>
        <div className={styles.fullField}><PublicationPreview form={preview} selection={selection} /></div>
        <div className={styles.formActions}>
          <Button type="submit">{pending ? "Publicando…" : "Publicar ahora"}</Button>
          <Button type="submit" variant="secondary" name="preview">Vista previa</Button>
          <Button type="button" variant="secondary" onClick={onBack}>Cancelar</Button>
        </div>
      </fieldset>
      {pending && <div role="status"><progress aria-label="Subiendo publicación y fotografías" /><p>Enviando la publicación y las fotografías…</p></div>}
      <PublicationErrorNotice error={error} />
    </form>
    <Link href="/inicio">Volver a las publicaciones</Link>
  </section>;
}
