"use client";

import Image from "next/image";
import { useEffect, useMemo } from "react";
import type { PublicationImage } from "./contracts";
import styles from "./publicaciones.module.css";

export type ImageSelection = { retained: PublicationImage[]; files: File[] };
export const emptySelection: ImageSelection = { retained: [], files: [] };

export default function PublicationPreview({ form, selection = emptySelection }: { form: FormData | null; selection?: ImageSelection }) {
  const urls = useMemo(() => selection.files.map(file => URL.createObjectURL(file)), [selection.files]);
  useEffect(() => () => urls.forEach(url => URL.revokeObjectURL(url)), [urls]);
  const photos = [...selection.retained.map(image => image.url), ...urls];
  const price = String(form?.get("precio") ?? "");
  return <section className={styles.preview} aria-label="Vista previa del aviso" aria-live="polite">
    <h3>Vista previa</h3>
    <article className={styles.previewCard}>
      {photos[0] ? <Image src={photos[0]} alt="Portada de la vista previa" width={600} height={260} unoptimized /> : <div className={styles.noPhoto}>⌂ Tus fotografías aparecerán aquí</div>}
      <div className={styles.detailBody}>
        <span className={styles.chip}>⌂ Arriendo</span>
        <h3>{String(form?.get("titulo") || "Título de tu publicación")}</h3>
        <strong className={styles.price}>{/^\d{1,12}$/.test(price) ? `${new Intl.NumberFormat("es-CL").format(Number(price))} CLP` : "Precio por definir"}</strong>
        <p>⌖ {String(form?.get("nombre_comuna") || "Comuna por seleccionar")} · Capacidad total {String(form?.get("cupos_totales") || "—")}</p>
        <p className={styles.description}>{String(form?.get("descripcion") || "Describe tu espacio para que otras personas lo conozcan.")}</p>
      </div>
    </article>
    <small>Revisa los datos antes de guardar. Las fotos seleccionadas se suben al confirmar.</small>
  </section>;
}
