"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { publicImageURL, type PublicationImage } from "./contracts";
export type { PublicationImage } from "./contracts";

export default function ImageFields({ images = [], onRemoveFile }: { images?: PublicationImage[]; onRemoveFile?: () => void }) {
  const [retained, setRetained] = useState(images.map(item => item.id_imagen));
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => previews.forEach(preview => URL.revokeObjectURL(preview.url)), [previews]);
  function selectFiles(files: File[]) {
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    if (input.current) input.current.files = transfer.files;
    previews.forEach(preview => URL.revokeObjectURL(preview.url));
    setPreviews(files.map(file => ({ file, url: URL.createObjectURL(file) })));
  }
  return <div>
    <input name="imagenes_conservar" type="hidden" value={JSON.stringify(images.filter(item => retained.includes(item.id_imagen)).map(item => item.id_imagen))} />
    {images.map(image => <label key={image.id_imagen} style={{ display: "inline-grid", gap: 4, margin: 8 }}>
      {publicImageURL(image.url) && <Image src={image.url} alt="Imagen guardada" width={120} height={90} unoptimized />}
      <span><input type="checkbox" checked={retained.includes(image.id_imagen)} onChange={event => setRetained(current => event.target.checked ? [...current, image.id_imagen] : current.filter(id => id !== image.id_imagen))} /> Conservar imagen</span>
    </label>)}
    <label>Fotografías (hasta 5 en total)
      <input ref={input} name="imagenes" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => selectFiles([...previews.map(item => item.file), ...Array.from(event.target.files ?? [])])} />
      <small>{retained.length + previews.length} de 5 imágenes. JPG, PNG o WebP; máximo 5000000 bytes por archivo. La primera conservada o nueva es la portada.</small>
    </label>
    <div>{previews.map(({ file, url }, index) => <span key={url} style={{ display: "inline-grid", gap: 4, margin: 8 }}>
      <Image src={url} alt={`Vista previa ${index + 1}`} width={120} height={90} unoptimized />
      <span>{file.name} · {file.size} bytes <button type="button" onClick={() => {
        selectFiles(previews.filter(item => item.file !== file).map(item => item.file));
        onRemoveFile?.();
      }}>Quitar</button></span>
    </span>)}</div>
  </div>;
}
