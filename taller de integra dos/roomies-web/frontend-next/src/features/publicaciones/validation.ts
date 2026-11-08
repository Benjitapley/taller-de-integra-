export const publicationImageLimit = 5 * 1024 * 1024;
const allowedFields = new Set([
  "titulo", "categoria", "ubicacion", "precio", "tipo", "cupos_totales",
  "tipo_vivienda", "descripcion", "mascota", "permitir_comentarios", "imagen",
]);

export function validatePublicationForm(form: FormData): string | null {
  for (const key of form.keys()) {
    if (!allowedFields.has(key) || form.getAll(key).length !== 1) return "El formulario contiene campos no permitidos o repetidos.";
  }

  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : null;
  };
  const titulo = text("titulo");
  const ubicacion = text("ubicacion");
  const descripcion = text("descripcion");
  if (!titulo || titulo.length > 200) return "El título es obligatorio y debe tener hasta 200 caracteres.";
  if (!ubicacion || ubicacion.length > 250) return "La ubicación es obligatoria y debe tener hasta 250 caracteres.";
  if (!descripcion || descripcion.length > 5000) return "La descripción es obligatoria y debe tener hasta 5000 caracteres.";
  if (!["busco", "ofrezco"].includes(text("categoria") ?? "")) return "Selecciona si buscas u ofreces arriendo.";
  if (!["Arrendador", "Compartida"].includes(text("tipo") ?? "")) return "Selecciona un tipo de publicación válido.";
  if (!["casa", "departamento", "habitacion"].includes(text("tipo_vivienda") ?? "")) return "Selecciona un tipo de vivienda válido.";

  const precio = text("precio") ?? "";
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(precio) || !Number.isFinite(Number(precio))) return "El precio debe ser un número válido, igual o mayor que cero.";
  const cupos = text("cupos_totales") ?? "";
  if (!/^[1-9]\d{0,9}$/.test(cupos) || Number(cupos) > 2147483647) return "La cantidad de cupos debe ser un entero positivo.";
  if (!["si", "no"].includes(text("mascota") ?? "")) return "Indica si se aceptan mascotas.";
  if (!["true", "false"].includes(text("permitir_comentarios") ?? "")) return "El valor de comentarios no es válido.";

  const image = form.get("imagen");
  if (image !== null && typeof image !== "string") {
    if (image.size > 0 && image.size > publicationImageLimit) return "La imagen debe pesar como máximo 5 MB.";
    if (image.size > 0 && !["image/jpeg", "image/png", "image/webp"].includes(image.type)) return "Usa una imagen JPG, PNG o WEBP.";
  } else if (typeof image === "string") {
    return "Selecciona una imagen válida.";
  }
  return null;
}
