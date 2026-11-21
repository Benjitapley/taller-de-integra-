export const profileLimits = { ocupacion: 100, ciudad: 100, breve_descripcion: 255, sobre_mi: 5000 } as const;
export const photoLimit = 5 * 1024 * 1024;
export const contractPhotoLimit = 5_000_000;
export const profileOccupations = ["Estudiante", "Trabajador", "Ambos"] as const;
export const profileGenders = ["Hombre", "Mujer", "Otro", "Prefiero_no_indicarlo"] as const;
export const contractTextLimits = { ciudad: 100, breve_descripcion: 160, sobre_mi: 2000 } as const;
export const profileLocationFields = ["id_region_interes", "id_comuna_interes"] as const;
const editableFields = { ocupacion: profileOccupations, genero: profileGenders, ...contractTextLimits, id_region_interes: null, id_comuna_interes: null };

export function isProfilePhoto(file: File, limit: number) {
  return file.size > 0 && file.size <= limit && ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

export function validateProfileChanges(changes: Record<string, unknown>): string | null {
  if (!Object.keys(changes).length) return "Selecciona al menos un dato del perfil para actualizar.";
  for (const [name, value] of Object.entries(changes)) {
    if (!Object.hasOwn(editableFields, name)) return "El formulario contiene campos no editables.";
    if (value === null) continue;
    const rule = editableFields[name as keyof typeof editableFields];
    const valid = typeof rule === "number"
      ? typeof value === "string" && value.length <= rule && !value.includes("\0")
      : rule === null
        ? typeof value === "number" && Number.isSafeInteger(value) && value > 0
        : typeof value === "string" && (rule as readonly string[]).includes(value);
    if (!valid) return `Revisa el campo ${name}.`;
  }
  return null;
}
export function validateProfile(form: FormData): string | null {
  const allowed = ["edad", ...Object.keys(profileLimits), "foto"];
  for (const key of form.keys()) {
    if (!allowed.includes(key) || form.getAll(key).length !== 1) return "El formulario contiene campos no permitidos o repetidos.";
  }
  const age = form.get("edad");
  if (typeof age !== "string" || (age.trim() !== "" && (!/^\d{1,3}$/.test(age.trim()) || Number(age) > 120))) return "La edad debe ser un número entre 0 y 120, o quedar vacía.";
  for (const [key, limit] of Object.entries(profileLimits)) {
    const value = form.get(key);
    if (typeof value !== "string" || value.trim().length > limit || value.includes("\0")) return `Revisa ${key}: máximo ${limit} caracteres.`;
  }
  const photo = form.get("foto");
  if (photo !== null && typeof photo === "string") return "Selecciona una fotografía válida.";
  if (photo && photo.size && (photo.size > photoLimit || !["image/jpeg", "image/png", "image/webp"].includes(photo.type))) return "Usa una fotografía JPG, PNG o WEBP de hasta 5 MB.";
  return null;
}
