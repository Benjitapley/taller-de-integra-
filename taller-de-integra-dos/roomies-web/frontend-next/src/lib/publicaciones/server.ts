import "server-only";
import { authConfig, authReply, readToken, sessionCookie, type Transport, type WebAuthConfig } from "../auth/gateway";
import { publicationBodyLimit, validatePublicationForm } from "../../features/publicaciones/validation";

const unavailable = () => authReply(503, { detail: "No se pudo confirmar la publicación. Comprueba tus publicaciones antes de volver a intentarlo." });

async function readForm(request: Request): Promise<FormData | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > publicationBodyLimit) {
      await reader.cancel();
      throw new RangeError("form-too-large");
    }
    chunks.push(value);
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type")! },
    }).formData();
  } catch {
    return null;
  }
}

function upstreamDetail(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("detail" in value)) return null;
  const detail = value.detail;
  if (typeof detail === "string") return detail.slice(0, 500);
  if (!Array.isArray(detail)) return null;
  const messages = detail.flatMap((item) => item && typeof item.msg === "string" ? [item.msg] : []);
  return messages.length ? messages.join("; ").slice(0, 500) : null;
}

export async function handleSavePublication(
  request: Request,
  config: WebAuthConfig | null = authConfig(),
  transport: Transport = fetch,
  publicationId?: string,
): Promise<Response> {
  const method = publicationId === undefined ? "POST" : "PUT";
  if (request.method !== method) return authReply(405, { detail: "Método no permitido." }, { Allow: method });
  if (publicationId !== undefined && !/^[1-9]\d{0,9}$/.test(publicationId)) return authReply(400, { detail: "Identificador inválido." });
  if (!config) return unavailable();
  const expired = () => authReply(401, { detail: "Tu sesión ha expirado o ya no está disponible. Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return expired();
  if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
      (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
    return authReply(403, { code: "CSRF_REJECTED", detail: "Origen de solicitud no permitido." });
  }
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) {
    return authReply(422, { detail: "Envía el formulario de publicación completo." });
  }

  let form: FormData | null;
  try {
    form = await readForm(request);
  } catch (error) {
    if (error instanceof RangeError) return authReply(413, { detail: "El formulario supera el tamaño permitido de 26 MB." });
    return authReply(422, { detail: "El formulario no es válido." });
  }
  if (!form) return authReply(422, { detail: "El formulario no es válido." });
  const validationError = validatePublicationForm(form);
  if (validationError) return authReply(422, { detail: validationError });
  const images = form.getAll("imagenes").filter(image => typeof image !== "string" && (image.name !== "" || image.size > 0));
  form.delete("imagenes");
  for (const image of images) form.append("imagenes", image);

  try {
    const saved = await transport(`${config.backend}/api/publicaciones${publicationId === undefined ? "" : `/${publicationId}`}`, {
      method,
      body: form,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`,
        ...(request.headers.has("Idempotency-Key") ? { "Idempotency-Key": request.headers.get("Idempotency-Key")! } : {}) },
    });
    if (saved.status === 401) return expired();
    if (saved.status === 403) return authReply(403, { detail: "No tienes permiso para crear publicaciones." });
    if (saved.status === 413) return authReply(413, { detail: "La imagen debe pesar como máximo 5 MB." });
    if ([409, 415, 422].includes(saved.status)) {
      let payload: unknown;
      try { payload = await saved.json(); } catch { payload = null; }
      return authReply(saved.status, { detail: upstreamDetail(payload) ?? "Revisa los campos y selecciona imágenes válidas." });
    }
    if (!saved.ok) return unavailable();
    const result: unknown = await saved.json();
    if (!result || typeof result !== "object" || !("id_publicacion" in result) ||
        !Number.isSafeInteger(result.id_publicacion) || (result.id_publicacion as number) < 1) return unavailable();
    if (method === "PUT") {
      if (result.id_publicacion !== Number(publicationId)) return unavailable();
      return authReply(200, { id_publicacion: result.id_publicacion, mensaje: "Publicación actualizada" });
    }
    return authReply(201, { id_publicacion: result.id_publicacion, mensaje: "Publicación creada" });
  } catch {
    return unavailable();
  }
}

export const handleCreatePublication = handleSavePublication;

type Operation = "mine" | "edit" | "close";
const fields = ["id_publicacion", "titulo", "precio", "estado", "tipo", "ubicacion", "cupos_totales", "cupos_disponibles", "imagenes", "categoria", "tipo_vivienda", "mascota", "descripcion", "permitir_comentarios", "id_region", "id_comuna", "reglas"];
function publication(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || !("id_publicacion" in value) || !Number.isSafeInteger(value.id_publicacion) || Number(value.id_publicacion) < 1) throw new Error("Invalid response");
  const source = value as Record<string, unknown>;
  const result = Object.fromEntries(fields.filter((key) => key in source).map((key) => [key, source[key]]));
  if (Array.isArray(source.imagenes)) result.imagenes = source.imagenes.map(image => ({ id_imagen: image.id_imagen, url: image.url, orden: image.orden }));
  return result;
}

export async function handlePublicationRequest(
  request: Request, operation: Operation, id?: string,
  config: WebAuthConfig | null = authConfig(), transport: Transport = fetch,
): Promise<Response> {
  if (!config) return unavailable();
  const token = readToken(request.headers.get("cookie"), config);
  const expired = () => authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  if (!token) return expired();
  if (operation !== "mine" && (!id || !/^[1-9]\d{0,9}$/.test(id))) return authReply(400, { detail: "Identificador inválido." });
  const method = operation === "close" ? "PATCH" : "GET";
  if (request.method !== method) return authReply(405, { detail: "Método no permitido." }, { Allow: method });
  if (method !== "GET" && (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
      (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin"))) return authReply(403, { detail: "Origen de solicitud no permitido." });
  const query = new URLSearchParams();
  if (operation === "mine") {
    const supplied = new URL(request.url).searchParams;
    for (const key of ["limite", "cursor"]) if (supplied.has(key)) query.set(key, supplied.get(key)!);
  }
  const path = operation === "mine" ? `/api/publicaciones/mias${query.size ? `?${query}` : ""}` : `/api/publicaciones/${id}${operation === "close" ? "/cerrar" : ""}`;
  try {
    const response = await transport(`${config.backend}${path}`, { method, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
    if (response.status === 401) return expired();
    if ([403, 404, 409, 422].includes(response.status)) return authReply(response.status, { detail: "La publicación no está disponible para esta operación." });
    if (!response.ok) return unavailable();
    const body: unknown = await response.json();
    if (operation === "mine") {
      if (!body || typeof body !== "object" || !("items" in body) || !Array.isArray(body.items) || !("siguiente_cursor" in body) ||
          (body.siguiente_cursor !== null && typeof body.siguiente_cursor !== "string")) throw new Error("Invalid list");
      return authReply(200, { items: body.items.map(publication), siguiente_cursor: body.siguiente_cursor });
    }
    return authReply(200, publication(body));
  } catch { return unavailable(); }
}
