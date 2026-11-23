"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { publicImageURL, type PublicationImage } from "./contracts";
export type { PublicationImage } from "./contracts";

export default function ImageFields({ images = [] }: { images?: PublicationImage[] }) {
  const [retained, setRetained] = useState(images.map(item => item.id_imagen));
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => () => previews.forEach(url => URL.revokeObjectURL(url)), [previews]);
  return <div>
    <input name="imagenes_conservar" type="hidden" value={JSON.stringify(images.filter(item => retained.includes(item.id_imagen)).map(item => item.id_imagen))} />
    {images.map(image => <label key={image.id_imagen} style={{ display: "inline-grid", gap: 4, margin: 8 }}>
      {publicImageURL(image.url) && <Image src={image.url} alt="Imagen guardada" width={120} height={90} unoptimized />}
      <span><input type="checkbox" checked={retained.includes(image.id_imagen)} onChange={event => setRetained(current => event.target.checked ? [...current, image.id_imagen] : current.filter(id => id !== image.id_imagen))} /> Conservar imagen</span>
    </label>)}
    <label>Fotografías (hasta 5 en total)
      <input name="imagenes" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => setPreviews(Array.from(event.target.files ?? []).map(file => URL.createObjectURL(file)))} />
      <small>JPG, PNG o WebP. Máximo 5000000 bytes por archivo. La primera imagen conservada o nueva es la portada.</small>
    </label>
    <div>{previews.map((url, index) => <Image key={url} src={url} alt={`Vista previa ${index + 1}`} width={120} height={90} unoptimized style={{ margin: 8 }} />)}</div>
  </div>;
}
