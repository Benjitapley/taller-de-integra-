export const profileLimits = { ocupacion: 100, ciudad: 100, breve_descripcion: 255, sobre_mi: 5000 } as const;
export const photoLimit = 5 * 1024 * 1024;
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
