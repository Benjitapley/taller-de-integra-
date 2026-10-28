import "server-only";
import { authConfig, authReply, readToken, sessionCookie, upstream, type Transport, type WebAuthConfig } from "../auth/gateway";
import type { Profile } from "../../features/perfil/contracts";
import { photoLimit, validateProfile } from "../../features/perfil/validation";

/** Only existing local image resources; never send the browser to an arbitrary URL. */
export function profilePhoto(value: unknown): string | null {
  return typeof value === "string" && /^\/imagenes\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp)$/i.test(value) ? value : null;
}
function optionalText(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("Invalid profile field");
  return value.trim() || null;
}
export function normalizeProfile(value: unknown): Profile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid profile");
  const data = value as Record<string, unknown>;
  if (typeof data.nombre !== "string" || !Number.isSafeInteger(data.total_publicaciones) || (data.total_publicaciones as number) < 0) throw new Error("Invalid profile");
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
    foto_perfil: profilePhoto(data.foto_perfil), total_publicaciones: data.total_publicaciones as number,
    verificado: typeof data.verificado === "boolean" ? data.verificado : null,
  };
}
const unavailable = () => authReply(503, { detail: "No se pudo cargar tu perfil. Intenta nuevamente más tarde." });
export async function handleProfile(request: Request, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch): Promise<Response> {
  if (!["GET", "PUT"].includes(request.method)) return authReply(405, { detail: "Método no permitido." }, { Allow: "GET, PUT" });
  if (!config) return unavailable();
  const expired = (status: number) => authReply(status, { detail: "Tu sesión ha expirado o ya no está disponible. Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return expired(401);
  try {
    if (request.method === "PUT") {
      if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
          (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return authReply(403, { code: "CSRF_REJECTED", detail: "Origen de solicitud no permitido." });
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
      const saved = await transport(`${config.backend}/api/perfil`, {
        method: "PUT", body: form, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (saved.status === 401) return expired(401);
      if (saved.status === 403) return authReply(403, { code: "FORBIDDEN", detail: "No tienes permiso para guardar estos cambios." });
      if ([413, 422].includes(saved.status)) return authReply(saved.status, { detail: saved.status === 413 ? "La fotografía supera los 5 MB." : "Revisa los campos y selecciona una imagen válida de hasta 20 megapíxeles." });
      if (!saved.ok) return authReply(503, { detail: "No se confirmó el guardado. Consulta tu perfil antes de volver a intentar." });
      // Saving and reloading are separate: a failed reload must not claim the save failed.
      return authReply(200, { success: true });
    }
    // No query/ID/header from the caller is forwarded. FastAPI authorizes the JWT.
    const response = await upstream(config, "/api/perfil", token, undefined, transport);
    if ([401, 403].includes(response.status)) return expired(response.status);
    if (response.status === 404) return authReply(404, { detail: "No hay un perfil disponible para tu cuenta." });
    if (!response.ok) return unavailable();
    return authReply(200, normalizeProfile(await response.json()));
  } catch {
    return request.method === "PUT" ? authReply(503, { detail: "No se confirmó el guardado. Consulta tu perfil antes de volver a intentar." }) : unavailable();
  }
}
