"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { validatePublicationForm } from "./validation";
import styles from "./publicaciones.module.css";

type PublicationKind = "Compartida" | "Arrendador";

export default function PublicationForm({ kind, onBack }: { kind: PublicationKind; onBack: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    form.set("tipo", kind);
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
    <p>Completa los datos para que la comunidad encuentre tu publicación.</p>
    <form className={styles.publicationForm} onSubmit={submit} aria-busy={pending}>
      <fieldset disabled={pending}>
        <legend>Detalles de la publicación</legend>
        <label className={styles.fullField}>Título
          <input name="titulo" required maxLength={200} placeholder="Ej.: Habitación cerca del centro" />
        </label>
        <label>¿Buscas u ofreces?
          <select name="categoria" defaultValue={kind === "Compartida" ? "busco" : "ofrezco"} required>
            <option value="busco">Busco arriendo</option><option value="ofrezco">Ofrezco arriendo</option>
          </select>
        </label>
        <label>Tipo de vivienda
          <select name="tipo_vivienda" defaultValue="" required>
            <option value="" disabled>Selecciona una opción</option><option value="casa">Casa</option>
            <option value="departamento">Departamento</option><option value="habitacion">Habitación</option>
          </select>
        </label>
        <label>Ubicación
          <input name="ubicacion" required maxLength={250} placeholder="Comuna o sector" />
        </label>
        <label>Precio o presupuesto (CLP)
          <input name="precio" type="number" min="0" max="999999999999.99" step="0.01" required />
        </label>
        <label>Cupos disponibles
          <input name="cupos_totales" type="number" min="1" max="2147483647" step="1" required />
        </label>
        <label>¿Acepta mascotas?
          <select name="mascota" defaultValue="no"><option value="si">Sí</option><option value="no">No</option></select>
        </label>
        <label className={styles.fullField}>Descripción
          <textarea name="descripcion" rows={5} maxLength={5000} required placeholder="Describe el lugar o lo que estás buscando." />
        </label>
        <label className={styles.fullField}>Fotografía (opcional)
          <input name="imagen" type="file" accept="image/jpeg,image/png,image/webp" />
          <small>JPG, PNG o WEBP, máximo 5 MB.</small>
        </label>
        <label className={`${styles.fullField} ${styles.checkboxField}`}>
          <input name="permitir_comentarios" type="checkbox" value="true" />
          Permitir comentarios en esta publicación
        </label>
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
