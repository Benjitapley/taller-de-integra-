"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";

export type ExistingPublicationImage = { id_imagen: number; url: string; orden?: number };

export default function PublicationImages({
  existing = [], keptIds, onKeptIdsChange, files, onFilesChange,
}: {
  existing?: ExistingPublicationImage[];
  keptIds: number[];
  onKeptIdsChange: (ids: number[]) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
}) {
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  const [error, setError] = useState("");
  useEffect(() => {
    return () => previews.forEach(URL.revokeObjectURL);
  }, [previews]);
  const retained = existing.filter((image) => keptIds.includes(image.id_imagen));

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const next = Array.from(event.target.files ?? []);
    const invalid = next.find((file) => file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (invalid) {
      setError(invalid.size > 5 * 1024 * 1024 ? `${invalid.name} supera el límite de 5 MB.` : `${invalid.name} no es JPG, PNG o WEBP.`);
      event.target.value = "";
      return;
    }
    if (retained.length + files.length + next.length > 5) {
      setError("Puedes adjuntar hasta 5 imágenes.");
      event.target.value = "";
      return;
    }
    setError("");
    onFilesChange([...files, ...next]);
    event.target.value = "";
  }

  return <section aria-label="Fotografías de la publicación" style={{ display: "grid", gap: 10 }}>
    <label style={{ display: "grid", gap: 8 }}>Fotografías (hasta 5, máximo 5 MB cada una)
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectFiles} />
    </label>
    <small>{retained.length + files.length}/5 fotografías seleccionadas. Las imágenes existentes se eliminan solo al guardar.</small>
    {error && <p role="alert">{error}</p>}
    {(retained.length > 0 || files.length > 0) && <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {retained.map((image) => <figure key={`old-${image.id_imagen}`} style={{ margin: 0, position: "relative" }}>
        <Image src={image.url} alt="Fotografía guardada de la publicación" width={150} height={110} unoptimized style={{ objectFit: "cover", borderRadius: 8 }} />
        <button type="button" aria-label="Quitar fotografía guardada" onClick={() => onKeptIdsChange(keptIds.filter((id) => id !== image.id_imagen))}>Quitar</button>
      </figure>)}
      {files.map((file, index) => <figure key={`${file.name}-${file.size}-${index}`} style={{ margin: 0, position: "relative" }}>
        {previews[index] && <Image src={previews[index]} alt={`Vista previa: ${file.name}`} width={150} height={110} unoptimized style={{ objectFit: "cover", borderRadius: 8 }} />}
        <figcaption>{file.name}</figcaption>
        <button type="button" aria-label={`Quitar ${file.name}`} onClick={() => onFilesChange(files.filter((_, current) => current !== index))}>Quitar</button>
      </figure>)}
    </div>}
  </section>;
}
