"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { publicImageURL, type PublicationImage } from "./contracts";
import type { ImageSelection } from "./PublicationPreview";
import { publicationImageLimit } from "./validation";
import styles from "./publicaciones.module.css";
export type { PublicationImage } from "./contracts";

export default function ImageFields({ images = [], onRemoveFile, onSelectionChange }: {
  images?: PublicationImage[]; onRemoveFile?: () => void; onSelectionChange?: (selection: ImageSelection) => void;
}) {
  const [retained, setRetained] = useState(images.map(item => item.id_imagen));
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => previews.forEach(preview => URL.revokeObjectURL(preview.url)), [previews]);
  const kept = images.filter(item => retained.includes(item.id_imagen));
  const error = kept.length + previews.length > 5 ? "Puedes guardar hasta 5 imágenes en total." :
    previews.some(({ file }) => file.size > publicationImageLimit) ? "Cada imagen debe pesar como máximo 5000000 bytes." :
    previews.some(({ file }) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size === 0) ? "Selecciona archivos JPG, PNG o WebP no vacíos." : "";
  function selectFiles(files: File[]) {
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    if (input.current) input.current.files = transfer.files;
    setPreviews(files.map(file => ({ file, url: URL.createObjectURL(file) })));
    onSelectionChange?.({ retained: kept, files });
    onRemoveFile?.();
  }
  return <div className={styles.imageUpload}>
    <input name="imagenes_conservar" type="hidden" value={JSON.stringify(kept.map(item => item.id_imagen))} />
    <label>Fotografías (hasta 5 en total)
      <input ref={input} name="imagenes" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => selectFiles([...previews.map(item => item.file), ...Array.from(event.target.files ?? [])])} />
      <small>{kept.length + previews.length} de 5 imágenes. JPG, PNG o WebP; máximo 5000000 bytes por archivo.</small>
    </label>
    <div className={styles.imageGrid}>
      {images.map(image => <label key={image.id_imagen} className={styles.thumbnail}>
        {publicImageURL(image.url) && <Image src={image.url} alt="Imagen guardada" width={120} height={90} unoptimized />}
        {kept[0]?.id_imagen === image.id_imagen && <span className={styles.chip}>Portada</span>}
        <span><input type="checkbox" aria-label="Conservar imagen" checked={retained.includes(image.id_imagen)} onChange={event => {
          const ids = event.target.checked ? [...retained, image.id_imagen] : retained.filter(id => id !== image.id_imagen);
          setRetained(ids); onRemoveFile?.();
          onSelectionChange?.({ retained: images.filter(item => ids.includes(item.id_imagen)), files: previews.map(item => item.file) });
        }} /> Conservar imagen</span>
      </label>)}
      {previews.map(({ file, url }, index) => <div key={url} className={styles.thumbnail}>
        <Image src={url} alt={`Vista previa ${index + 1}`} width={120} height={90} unoptimized />
        {!kept.length && index === 0 && <span className={styles.chip}>Portada</span>}
        <small>{file.name} · {file.size} bytes</small>
        <button type="button" onClick={() => selectFiles(previews.filter((_, position) => position !== index).map(item => item.file))}>Quitar</button>
      </div>)}
    </div>
    <small>Quitar una foto guardada solo aplica al guardar los cambios. La primera conservada o nueva será la portada.</small>
    {error && <p role="alert">{error}</p>}
  </div>;
}
