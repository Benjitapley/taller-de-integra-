import "server-only";
import { authConfig, authReply, readToken, sessionCookie, upstream, type Transport, type WebAuthConfig } from "../auth/gateway";
import type { Profile } from "../../features/perfil/contracts";

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
  };
}
const unavailable = () => authReply(503, { detail: "No se pudo cargar tu perfil. Intenta nuevamente más tarde." });
export async function handleProfile(request: Request, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch): Promise<Response> {
  if (request.method !== "GET") return authReply(405, { detail: "Solo se permite consultar el perfil." }, { Allow: "GET" });
  if (!config) return unavailable();
  const expired = (status: number) => authReply(status, { detail: "Tu sesión ha expirado o ya no está disponible. Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return expired(401);
  try {
    // No query/ID/header from the caller is forwarded. FastAPI authorizes the JWT.
    const response = await upstream(config, "/api/perfil", token, undefined, transport);
    if ([401, 403].includes(response.status)) return expired(response.status);
    if (response.status === 404) return authReply(404, { detail: "No hay un perfil disponible para tu cuenta." });
    if (!response.ok) return unavailable();
    return authReply(200, normalizeProfile(await response.json()));
  } catch { return unavailable(); }
}
