export const publicationImageLimit = 5 * 1024 * 1024;
const allowedFields = new Set([
  "titulo", "categoria", "id_region", "id_comuna", "precio", "tipo", "cupos_totales",
  "tipo_vivienda", "descripcion", "mascota", "permitir_comentarios", "imagenes", "imagenes_conservar", "ubicacion",
]);

export function validatePublicationForm(form: FormData): string | null {
  for (const key of form.keys()) {
    if (!allowedFields.has(key) || (!(["imagenes", "imagenes_conservar"].includes(key)) && form.getAll(key).length !== 1)) return "El formulario contiene campos no permitidos o repetidos.";
  }

  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : null;
  };
  const titulo = text("titulo");
  const idRegion = text("id_region");
  const idComuna = text("id_comuna");
  const descripcion = text("descripcion");
  if (!titulo || titulo.length > 200) return "El título es obligatorio y debe tener hasta 200 caracteres.";
  const hasGeography = /^[1-9]\d*$/.test(idRegion ?? "") && /^[1-9]\d*$/.test(idComuna ?? "");
  if (!hasGeography && !text("ubicacion")) return "Selecciona una región y una comuna.";
  if (!descripcion || descripcion.length > 5000) return "La descripción es obligatoria y debe tener hasta 5000 caracteres.";
  if (!["busco", "ofrezco"].includes(text("categoria") ?? "")) return "Selecciona si buscas u ofreces arriendo.";
  if (!["Arrendador", "Compartida"].includes(text("tipo") ?? "")) return "Selecciona un tipo de publicación válido.";
  if (!["casa", "departamento", "habitacion"].includes(text("tipo_vivienda") ?? "")) return "Selecciona un tipo de vivienda válido.";

  const precio = text("precio") ?? "";
  if (!/^\d{1,12}$/.test(precio) || !Number.isSafeInteger(Number(precio)) || Number(precio) >= 1000000000000) return "El precio debe ser un entero CLP válido entre 0 y 999999999999.";
  const cupos = text("cupos_totales") ?? "";
  if (!/^[1-9]\d{0,9}$/.test(cupos) || Number(cupos) > 2147483647) return "La cantidad de cupos debe ser un entero positivo.";
  if (!["si", "no"].includes(text("mascota") ?? "")) return "Indica si se aceptan mascotas.";
  if (!["true", "false"].includes(text("permitir_comentarios") ?? "")) return "El valor de comentarios no es válido.";

  const images = form.getAll("imagenes");
  const kept = form.getAll("imagenes_conservar");
  if (images.length + kept.length > 5) return "Puedes adjuntar hasta 5 imágenes.";
  for (const image of images) {
    if (typeof image === "string") return "Selecciona imágenes válidas.";
    if (image.size > publicationImageLimit) return "Cada imagen puede pesar como máximo 5 MB.";
    if (image.size > 0 && !["image/jpeg", "image/png", "image/webp"].includes(image.type)) return "Usa imágenes JPG, PNG o WEBP.";
  }
  if (kept.some((id) => typeof id !== "string" || !/^[1-9]\d{0,9}$/.test(id))) return "La selección de imágenes guardadas no es válida.";
  return null;
}
