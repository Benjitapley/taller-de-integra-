export const publicationImageLimit = 5_000_000;
export const publicationBodyLimit = 26_000_000;
const allowedFields = new Set([
  "titulo", "precio", "tipo", "cupos_totales", "id_region", "id_comuna",
  "tipo_vivienda", "descripcion", "mascota", "imagenes", "imagenes_conservar", "reglas_arrendador",
]);

export function validatePublicationForm(form: FormData): string | null {
  for (const key of form.keys()) {
    if (!allowedFields.has(key) || (key !== "imagenes" && form.getAll(key).length !== 1)) return "El formulario contiene campos no permitidos o repetidos.";
  }
  const text = (name: string) => typeof form.get(name) === "string" ? String(form.get(name)).trim() : "";
  if (!text("titulo") || text("titulo").length > 200) return "El título es obligatorio y debe tener hasta 200 caracteres.";
  if (!text("descripcion") || text("descripcion").length > 5000) return "La descripción es obligatoria y debe tener hasta 5000 caracteres.";
  if (text("tipo") !== "Arrendador") return "Selecciona una publicación de arrendador.";
  if (!["Casa", "Departamento", "Habitacion"].includes(text("tipo_vivienda"))) return "Selecciona un tipo de vivienda válido.";
  if (!/^\d{1,12}$/.test(text("precio"))) return "El precio debe ser un entero entre 0 y 999999999999 CLP.";
  for (const name of ["cupos_totales", "id_region", "id_comuna"]) {
    if (!/^[1-9]\d{0,9}$/.test(text(name)) || Number(text(name)) > 2147483647) return "Selecciona región, comuna y cupos válidos.";
  }
  if (form.has("mascota") && !["si", "no"].includes(text("mascota"))) return "Indica si se aceptan mascotas.";
  if (form.has("reglas_arrendador")) {
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

export type PublicationError = {
  codigo: string;
  mensaje: string;
  detalles?: { campo: string; mensaje: string }[];
};

const defaultErrors: Record<number, [string, string]> = {
  400: ["validacion", "Revisa los parámetros de la solicitud."],
  401: ["no_autenticado", "Tu sesión ha expirado. Inicia sesión nuevamente."],
  403: ["sin_permiso", "No tienes permiso para realizar esta operación."],
  404: ["no_encontrado", "No se encontró la publicación."],
  405: ["metodo_no_permitido", "Método no permitido."],
  409: ["estado_invalido", "El aviso cambió. Revisa su capacidad y estado antes de reintentar."],
  413: ["archivo_muy_grande", "Cada imagen debe pesar como máximo 5000000 bytes."],
  415: ["tipo_archivo_no_permitido", "Usa imágenes JPG, PNG o WebP."],
  422: ["validacion", "Revisa los campos de la publicación."],
  429: ["demasiados_intentos", "Demasiados intentos. Espera unos instantes antes de reintentar."],
  503: ["dependencia_no_disponible", "No se pudo confirmar la operación. Conservamos tus datos; revisa tus publicaciones antes de reintentar."],
};
const conflictMessages: Record<string, string> = {
  configuracion_bloqueada: "Las reglas solo se pueden editar mientras el aviso esté Disponible.",
  sin_cupos: "No hay cupos disponibles. Actualiza el aviso para revisar su capacidad.",
  publicacion_cerrada: "La publicación está cerrada.",
  correo_no_verificado: "Verifica tu correo antes de publicar.",
};

/** The canonical envelope is preferred; detail remains a transition adapter only. */
export function publicationError(status: number, value: unknown): PublicationError {
  const fallback = defaultErrors[status] ?? defaultErrors[503];
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const codigo = typeof source.codigo === "string" && /^[a-z][a-z0-9_]{0,99}$/.test(source.codigo) ? source.codigo : fallback[0];
  const clean = (text: unknown) => typeof text === "string" && text.trim() ? text.trim().slice(0, 1000) : null;
  const mensaje = clean(source.mensaje) ?? conflictMessages[codigo] ?? clean(source.detail) ?? fallback[1];
  const detalles = Array.isArray(source.detalles) ? source.detalles.flatMap(item => {
    if (!item || typeof item !== "object" || typeof item.campo !== "string" || !/^[a-z][a-z0-9_.]{0,99}$/.test(item.campo)) return [];
    const mensaje = clean(item.mensaje);
    return mensaje ? [{ campo: item.campo, mensaje }] : [];
  }).slice(0, 30) : [];
  return { codigo, mensaje, ...(detalles.length ? { detalles } : {}) };
}
