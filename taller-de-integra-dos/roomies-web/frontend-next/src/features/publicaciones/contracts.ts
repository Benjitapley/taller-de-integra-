export type PublicationImage = { id_imagen: number; url: string; orden: number };
export type Publication = {
  id_publicacion: number; id_arriendo?: number | null; titulo: string; precio: number; ubicacion: string;
  tipo: string | null; tipo_vivienda: string | null; categoria: string | null;
  cupos_totales: number | null; cupos_disponibles: number | null;
  imagenes: PublicationImage[]; descripcion: string | null; mascota: string | null; estado: string | null;
};
export type PublicationPage = { items: Publication[]; siguiente_cursor: string | null };

export function publicImageURL(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/^\/imagenes\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp)$/i.test(value)) return value;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}

export function publicationPage(value: unknown): PublicationPage {
  if (!value || typeof value !== "object" || !("items" in value) || !Array.isArray(value.items) ||
      !("siguiente_cursor" in value) || (value.siguiente_cursor !== null && typeof value.siguiente_cursor !== "string")) throw new Error("Respuesta de publicaciones inválida.");
  return {
    siguiente_cursor: value.siguiente_cursor,
    items: value.items.map((item: Record<string, unknown>) => {
      if (!item || !Number.isSafeInteger(item.id_publicacion) || Number(item.id_publicacion) < 1 || !Number.isSafeInteger(item.precio) || Number(item.precio) < 0 || Number(item.precio) > 999999999999) throw new Error("Publicación inválida.");
      const text = (name: string) => typeof item[name] === "string" ? item[name] as string : null;
      return {
        id_publicacion: item.id_publicacion as number,
        id_arriendo: Number.isSafeInteger(item.id_arriendo) && Number(item.id_arriendo) > 0 ? Number(item.id_arriendo) : null,
        titulo: text("titulo") || "Publicación sin título", precio: item.precio as number,
        ubicacion: text("ubicacion") || "Ubicación por confirmar", tipo: text("tipo"), tipo_vivienda: text("tipo_vivienda"),
        categoria: text("categoria"), estado: text("estado"), descripcion: text("descripcion"), mascota: text("mascota"),
        cupos_totales: typeof item.cupos_totales === "number" ? item.cupos_totales : null,
        cupos_disponibles: typeof item.cupos_disponibles === "number" ? item.cupos_disponibles : null,
        imagenes: Array.isArray(item.imagenes) ? item.imagenes.filter(image => image && Number.isSafeInteger(image.id_imagen) && publicImageURL(image.url)).map(image => ({ id_imagen: image.id_imagen, url: image.url, orden: image.orden })) : [],
      };
    }),
  };
}

export function appendPublications(previous: Publication[], incoming: Publication[]): Publication[] {
  const ids = new Set(previous.map(item => item.id_publicacion));
  const result = [...previous];
  for (const item of incoming) {
    if (!ids.has(item.id_publicacion)) { result.push(item); ids.add(item.id_publicacion); }
  }
  return result;
}
