export const publicationImageLimit = 5_000_000;
export const publicationBodyLimit = 26_000_000;
const allowedFields = new Set([
  "titulo", "categoria", "ubicacion", "precio", "tipo", "cupos_totales", "id_region", "id_comuna",
  "tipo_vivienda", "descripcion", "mascota", "permitir_comentarios", "imagenes", "imagenes_conservar", "reglas", "reglas_arrendador",
]);

export function validatePublicationForm(form: FormData): string | null {
  for (const key of form.keys()) {
    if (!allowedFields.has(key) || (key !== "imagenes" && form.getAll(key).length !== 1)) return "El formulario contiene campos no permitidos o repetidos.";
  }
  const text = (name: string) => typeof form.get(name) === "string" ? String(form.get(name)).trim() : "";
  if (!text("titulo") || text("titulo").length > 200) return "El título es obligatorio y debe tener hasta 200 caracteres.";
  if (form.has("ubicacion") && (!text("ubicacion") || text("ubicacion").length > 250)) return "La ubicación debe tener hasta 250 caracteres.";
  if (!text("descripcion") || text("descripcion").length > 5000) return "La descripción es obligatoria y debe tener hasta 5000 caracteres.";
  if (text("tipo") !== "Arrendador") return "Selecciona una publicación de arrendador.";
  if (!["casa", "departamento", "habitacion"].includes(text("tipo_vivienda"))) return "Selecciona un tipo de vivienda válido.";
  if (!/^\d{1,12}$/.test(text("precio"))) return "El precio debe ser un entero entre 0 y 999999999999 CLP.";
  for (const name of ["cupos_totales", "id_region", "id_comuna"]) {
    if (!/^[1-9]\d{0,9}$/.test(text(name)) || Number(text(name)) > 2147483647) return "Selecciona región, comuna y cupos válidos.";
  }
  if (form.has("mascota") && !["si", "no"].includes(text("mascota"))) return "Indica si se aceptan mascotas.";
  if (form.has("reglas_arrendador")) {
    if (form.has("reglas")) return "Envía un solo campo de reglas.";
    try {
      const rules: unknown = JSON.parse(text("reglas_arrendador"));
      if (!Array.isArray(rules) || rules.length > 20 ||
          rules.some(rule => typeof rule !== "string" || !rule.trim() || [...rule].length > 300 || rule.includes("\0"))) throw new Error();
    } catch {
      return "Puedes ingresar hasta 20 reglas de 300 caracteres cada una.";
    }
  }
  let retained: unknown = [];
  try { retained = JSON.parse(text("imagenes_conservar") || "[]"); } catch { return "Las imágenes conservadas no son válidas."; }
  if (!Array.isArray(retained) || !retained.every(id => Number.isSafeInteger(id) && id > 0) || new Set(retained).size !== retained.length) return "Las imágenes conservadas no son válidas.";
  const images = form.getAll("imagenes").filter(image => typeof image === "string" || image.name !== "" || image.size > 0);
  if (images.length + retained.length > 5) return "Puedes guardar hasta 5 imágenes en total.";
  for (const image of images) {
    if (typeof image === "string") return "Selecciona una imagen válida.";
    if (image.size === 0) return "La imagen seleccionada está vacía.";
    if (image.size > publicationImageLimit) return "Cada imagen debe pesar como máximo 5 MB (5000000 bytes).";
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) return "Usa imágenes JPG, PNG o WEBP.";
  }
  return null;
}
