import "server-only";
import { authConfig, authReply, limitedJson, readToken, sessionCookie, upstream, profilePath, type Transport, type WebAuthConfig } from "../auth/gateway";
import type { Profile } from "../../features/perfil/contracts";
import { contractPhotoLimit, isProfilePhoto, photoLimit, validateProfile, validateProfileChanges } from "../../features/perfil/validation";

/** Only existing local image resources; never send the browser to an arbitrary URL. */
export function profilePhoto(value: unknown): string | null {
  return typeof value === "string" && /^\/imagenes\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp)$/i.test(value) ? value : null;
}
function storedPhoto(value: unknown, config: WebAuthConfig): string | null {
  if (typeof value !== "string" || !config.supabase) return null;
  const prefix = `${config.supabase.origin}/storage/v1/object/public/perfiles/`;
  if (!value.startsWith(prefix)) return null;
  return /^(?:[A-Za-z0-9_-][A-Za-z0-9._~-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._~-]*\.(?:png|jpe?g|webp)$/i.test(value.slice(prefix.length)) ? value : null;
}
function optionalText(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("Invalid profile field");
  return value.trim() || null;
}
export function normalizeProfile(value: unknown, config?: WebAuthConfig): Profile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid profile");
  const data = value as Record<string, unknown>;
  const canonical = config?.profileContract === "v1";
  const count = data.total_publicaciones === undefined ? (canonical ? null : undefined) : data.total_publicaciones;
  if (typeof data.nombre !== "string" ||
      (count !== null && (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0))) throw new Error("Invalid profile");
  let age: number | null = null;
  if (data.edad !== "" && data.edad !== null && data.edad !== undefined) {
    // The existing API can return a DB number or numeric text, and '' when empty.
    if (typeof data.edad !== "number" && !(typeof data.edad === "string" && /^[0-9]+$/.test(data.edad))) throw new Error("Invalid age");
    age = Number(data.edad);
    if (!Number.isSafeInteger(age) || age < 0) throw new Error("Invalid age");
  }
  return {
    nombre: data.nombre.trim(), edad: age,
    ocupacion: optionalText(data.ocupacion), ciudad: optionalText(data.ciudad),
    breve_descripcion: optionalText(data.breve_descripcion), sobre_mi: optionalText(data.sobre_mi),
    foto_perfil: canonical ? storedPhoto(data.foto_perfil, config) ?? profilePhoto(data.foto_perfil) : profilePhoto(data.foto_perfil),
    total_publicaciones: count,
    verificado: typeof data.verificado === "boolean" ? data.verificado : null,
    ...(canonical ? {
      contrato_perfil: "v1" as const,
      edad_calculada: true,
      genero: optionalText(data.genero),
      id_region_interes: locationId(data.id_region_interes),
      id_comuna_interes: locationId(data.id_comuna_interes),
      verificado: typeof data.correo_verificado === "boolean" ? data.correo_verificado : null,
    } : {}),
  };
}
function locationId(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

const unavailable = () => authReply(503, { detail: "No se pudo cargar tu perfil. Intenta nuevamente más tarde." });
const saveUnavailable = () => authReply(503, { detail: "No se confirmó el guardado. Consulta tu perfil antes de volver a intentar." });
const expired = (config: WebAuthConfig, status = 401) => authReply(status, { detail: "Tu sesión ha expirado o ya no está disponible. Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
const sameOrigin = (request: Request, config: WebAuthConfig) =>
  request.headers.get("origin") === config.origin && request.headers.get("x-haycupo-csrf") === "1" &&
  (!request.headers.has("sec-fetch-site") || request.headers.get("sec-fetch-site") === "same-origin");
const rejectedOrigin = () => authReply(403, { code: "CSRF_REJECTED", detail: "Origen de solicitud no permitido." });

function saveError(status: number, config: WebAuthConfig) {
  switch (status) {
    case 401: return expired(config);
    case 403: return authReply(403, { code: "FORBIDDEN", detail: "No tienes permiso para guardar estos cambios." });
    case 404: return authReply(404, { detail: "La operación de perfil no está disponible." });
    case 409: return authReply(409, { detail: "Consulta el perfil actualizado antes de volver a guardar." });
    case 413: return authReply(413, { detail: "La fotografía supera los 5 MB." });
    case 415: return authReply(415, { detail: "Formato no admitido. Usa JPG, PNG o WEBP." });
    case 422: return authReply(422, { detail: "Revisa los campos, la región y la comuna, o selecciona una fotografía válida." });
    default: return saveUnavailable();
  }
}

async function patchProfile(request: Request, config: WebAuthConfig, token: string, transport: Transport) {
  if (!sameOrigin(request, config)) return rejectedOrigin();
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return authReply(415, { detail: "Envía los cambios del perfil en JSON." });
  let changes: Record<string, unknown>;
  try { changes = await limitedJson(request); }
  catch { return authReply(422, { detail: "Formulario no válido." }); }
  const problem = validateProfileChanges(changes);
  if (problem) return authReply(422, { detail: problem });
  const saved = await transport(`${config.backend}${profilePath(config)}`, {
    method: "PATCH", body: JSON.stringify(changes), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  return saved.ok ? authReply(200, { success: true }) : saveError(saved.status, config);
}

export async function handleProfilePhoto(request: Request, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (request.method !== "PUT") return authReply(405, { detail: "Método no permitido." }, { Allow: "PUT" });
  if (!config || config.profileContract !== "v1") return unavailable();
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return expired(config);
  if (!sameOrigin(request, config)) return rejectedOrigin();
  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data;")) return saveError(415, config);
  const reader = request.body?.getReader();
  if (!reader) return authReply(422, { detail: "Selecciona una fotografía." });
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > contractPhotoLimit + 65_536) {
        await reader.cancel();
        return saveError(413, config);
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    let form: FormData;
    try { form = await new Response(body, { headers: { "Content-Type": contentType } }).formData(); }
    catch { return authReply(422, { detail: "Formulario de fotografía no válido." }); }
    const photo = form.get("foto");
    if (!(photo instanceof File) || Array.from(form.keys()).length !== 1) return authReply(422, { detail: "Envía una sola fotografía." });
    if (photo.size > contractPhotoLimit) return saveError(413, config);
    if (!isProfilePhoto(photo, contractPhotoLimit)) return saveError(415, config);
    const saved = await transport(`${config.backend}${profilePath(config)}/foto`, {
      method: "PUT", body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json", "Content-Type": contentType, Authorization: `Bearer ${token}` },
    });
    if (!saved.ok) return saveError(saved.status, config);
    const result = await saved.json();
    const url = storedPhoto(result?.foto_perfil, config);
    return url ? authReply(200, { foto_perfil: url }) : saveUnavailable();
  } catch {
    return saveUnavailable();
  }
}

export async function handleProfile(request: Request, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch): Promise<Response> {
  const canonical = config?.profileContract === "v1";
  const mutation = canonical ? "PATCH" : "PUT";
  if (!["GET", mutation].includes(request.method)) return authReply(405, { detail: "Método no permitido." }, { Allow: `GET, ${mutation}` });
  if (!config) return unavailable();
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return expired(config);
  try {
    if (request.method === "PATCH") return await patchProfile(request, config, token, transport);
    if (request.method === "PUT") {
      if (!sameOrigin(request, config)) return rejectedOrigin();
      if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) return authReply(422, { detail: "Envía el formulario con su fotografía opcional." });
      const reader = request.body?.getReader();
      if (!reader) return authReply(422, { detail: "Formulario vacío." });
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > photoLimit + 65_536) { await reader.cancel(); return authReply(413, { detail: "El formulario supera el tamaño permitido." }); }
        chunks.push(value);
      }
      let form: FormData;
      try { form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData(); }
      catch { return authReply(422, { detail: "Formulario no válido." }); }
      const error = validateProfile(form);
      if (error) return authReply(422, { detail: error });
      const saved = await transport(`${config.backend}${profilePath(config)}`, {
        method: "PUT", body: form, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (saved.status === 401) return expired(config);
      if (saved.status === 403) return authReply(403, { code: "FORBIDDEN", detail: "No tienes permiso para guardar estos cambios." });
      if ([413, 422].includes(saved.status)) return authReply(saved.status, { detail: saved.status === 413 ? "La fotografía supera los 5 MB." : "Revisa los campos y selecciona una imagen válida de hasta 20 megapíxeles." });
      if (!saved.ok) return authReply(503, { detail: "No se confirmó el guardado. Consulta tu perfil antes de volver a intentar." });
      // Saving and reloading are separate: a failed reload must not claim the save failed.
      return authReply(200, { success: true });
    }
    // No query/ID/header from the caller is forwarded. FastAPI authorizes the JWT.
    const response = await upstream(config, profilePath(config), token, undefined, transport);
    if ([401, 403].includes(response.status)) return expired(config, response.status);
    if (response.status === 404) return authReply(404, { detail: "No hay un perfil disponible para tu cuenta." });
    if (!response.ok) return unavailable();
    let data = await response.json();
    if (config.provider === "supabase" && !canonical) {
      if (typeof data?.edad_calculada !== "boolean" || typeof data?.verificado !== "boolean") return unavailable();
      // Profile availability does not depend on the optional publication counter.
      const summary = config.profileContract === "local-v1" ? "/local/v1/publicaciones/resumen" : "/api/v1/publicaciones/resumen";
      const count = await upstream(config, summary, token, undefined, transport).catch(() => null);
      const totals = count?.ok ? await count.json().catch(() => null) : null;
      data = { ...data, total_publicaciones: Number.isSafeInteger(totals?.total_publicaciones) && totals.total_publicaciones >= 0 ? totals.total_publicaciones : null };
    }
    return authReply(200, { ...normalizeProfile(data, config), ...(config.provider === "supabase" && !canonical ? { edad_calculada: data.edad_calculada } : {}) });
  } catch {
    return request.method === "GET" ? unavailable() : saveUnavailable();
  }
}
