import "server-only";

/** Server transport. No credentials from the browser are forwarded as headers.
 * FastAPI remains the authority for signature, expiry and session revocation.
 */
export type WebAuthConfig = { origin: string; backend: string; secure: boolean; provider?: "supabase"; supabase?: { origin: string; key: string }; localSignupAutoconfirm?: boolean; recoverySecret?: string };
export type Transport = typeof fetch;
export function authConfig(env: NodeJS.ProcessEnv = process.env): WebAuthConfig | null {
  if (env.WEB_AUTH_ENABLED !== "true") return null;
  try {
    const web = new URL(env.WEB_AUTH_ORIGIN ?? "");
    const backend = new URL(env.WEB_AUTH_FASTAPI_ORIGIN ?? "");
    const provider = env.WEB_AUTH_PROVIDER ?? "legacy";
    if (!["legacy", "supabase"].includes(provider)) return null;
    for (const url of [web, backend]) {
      if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
      const localGateway = url === backend && (env.ROOMIES_LOCAL_MODE === "1" || env.ROOMIES_RUNTIME_MODE === "supabase") && env.NODE_ENV !== "production" && url.hostname === "api-gateway";
      if (url.protocol !== "https:" && !(url.protocol === "http:" && (["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || localGateway))) return null;
    }
    if (web.origin === backend.origin || (env.NODE_ENV === "production" && web.protocol !== "https:")) return null;
    if (provider === "supabase") {
      const identity = new URL(env.WEB_SUPABASE_ORIGIN ?? "");
      const key = env.WEB_SUPABASE_PUBLISHABLE_KEY ?? "";
      const real = env.ROOMIES_RUNTIME_MODE === "supabase" && env.ROOMIES_LOCAL_MODE !== "1" && /^[a-z0-9]{20}$/.test(env.ROOMIES_SUPABASE_PROJECT_REF ?? "") && identity.origin === `https://${env.ROOMIES_SUPABASE_PROJECT_REF}.supabase.co`;
      const disposable = env.ROOMIES_LOCAL_MODE === "1" && (!env.ROOMIES_RUNTIME_MODE || env.ROOMIES_RUNTIME_MODE === "disposable") && ["127.0.0.1", "localhost", "[::1]", "host.docker.internal", "supabase-auth"].includes(identity.hostname);
      if (!(real || disposable) ||
          !["http:", "https:"].includes(identity.protocol) || identity.username || identity.password || identity.pathname !== "/" || identity.search || identity.hash || !key || key.length > 4096 || key.startsWith("sb_secret_") || /[\r\n]/.test(key)) return null;
      if (key.split(".").length === 3 && JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role !== "anon") return null;
      return { origin: web.origin, backend: backend.origin, secure: web.protocol === "https:", provider: "supabase", supabase: { origin: identity.origin, key }, localSignupAutoconfirm: disposable && env.NODE_ENV !== "production", ...(env.WEB_AUTH_RECOVERY_SECRET ? { recoverySecret: env.WEB_AUTH_RECOVERY_SECRET } : {}) };
    }
    return { origin: web.origin, backend: backend.origin, secure: web.protocol === "https:" };
  } catch { return null; }
}
export const cookieName = (config: WebAuthConfig) => config.provider === "supabase" ? (config.secure ? "__Host-roomies_sb_access" : "roomies_sb_dev_access") : (config.secure ? "__Host-haycupo_session" : "haycupo_dev_session");
export const profilePath = (config: WebAuthConfig) => config.provider === "supabase" ? "/local/v1/perfil" : "/api/perfil";
export function sessionCookie(config: WebAuthConfig, token = "", maxAge = 0) {
  return `${cookieName(config)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.secure ? "; Secure" : ""}`;
}
export function readToken(cookie: string | null, config: WebAuthConfig) {
  const matches = (cookie ?? "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${cookieName(config)}=`));
  if (matches.length !== 1) return "";
  const token = matches[0].slice(cookieName(config).length + 1);
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) && token.length <= 3800 ? token : "";
}
const messages: Record<number, string> = {
  400: "Revisa los datos o solicita un nuevo código si ha expirado.",
  401: "Credenciales incorrectas o sesión expirada. Inicia sesión nuevamente.",
  403: "Acceso no permitido. Si estás iniciando sesión, verifica primero tu correo.",
  404: "No se encontró la cuenta solicitada.",
  409: "La cuenta o el código requiere revisión. No se cambiaron tus credenciales.",
  422: "Revisa el formato y los límites de los campos indicados.",
  429: "Se alcanzó el límite de intentos o envíos. Espera antes de volver a intentar.",
  503: "No pudimos completar la solicitud. Intenta nuevamente en unos minutos. Si ya recibiste un correo de confirmación, utiliza su enlace o intenta iniciar sesión antes de repetir el registro.",
};
export function authReply(status: number, body: unknown, headers?: HeadersInit) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "Vary": "Cookie", ...headers } });
}
export function authError(status: number, headers?: HeadersInit) {
  return authReply(status, { detail: messages[status] ?? messages[503] }, headers);
}
export async function upstream(config: WebAuthConfig, path: string, token: string, body?: unknown, transport: Transport = fetch) {
  return transport(`${config.backend}${path}`, {
    method: body === undefined ? "GET" : "POST", cache: "no-store", redirect: "error",
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
export async function getSession(config: WebAuthConfig | null, token: string, transport: Transport = fetch): Promise<Response> {
  if (!config) return authError(503);
  if (!token) return authError(401);
  try {
    const response = await upstream(config, profilePath(config), token, undefined, transport);
    if (!response.ok) return authError([401, 403].includes(response.status) ? response.status : 503);
    const profile = await response.json();
    if (!profile || typeof profile.nombre !== "string") return authError(503);
    // Explicit public shape: never echo arbitrary upstream fields or JWTs.
    let remaining: number | undefined;
    if (config.provider === "supabase") {
      try { remaining = Math.max(0, Math.floor(JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).exp - Date.now() / 1000)); } catch { return authError(401); }
    }
    return authReply(200, { authenticated: true, user: { nombre: profile.nombre }, ...(remaining === undefined ? {} : { expires_in: remaining }) });
  } catch { return authError(503); }
}
const actions = ["registro", "verificar", "reenviar-codigo", "login", "logout", "sesion", "renovar", "confirmar", "recuperar", "recuperacion-callback", "cambiar-contrasena", "recuperacion-estado"];
async function limitedJson(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16_384) { await reader.cancel(); throw new Error(); }
    chunks.push(value);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
  return data;
}
export async function handleAuth(request: Request, action: string, config: WebAuthConfig | null, transport: Transport = fetch): Promise<Response> {
  if (!actions.includes(action)) return authReply(404, { detail: "Ruta no disponible." });
  if (!config) return authError(503);
  if (config.provider === "supabase") {
    const { handleSupabaseAuth } = await import("./supabase");
    return handleSupabaseAuth(request, action, config, transport, { reply: authReply, error: authError, limitedJson, token: readToken, accessCookie: sessionCookie, session: getSession });
  }
  if (["renovar", "confirmar", "recuperar", "recuperacion-callback", "cambiar-contrasena", "recuperacion-estado"].includes(action)) return authReply(404, { detail: "Ruta no disponible." });
  const token = readToken(request.headers.get("cookie"), config);
  if (action === "sesion") {
    if (request.method !== "GET") return authReply(405, {}, { Allow: "GET" });
    const response = await getSession(config, token, transport);
    if ([401, 403].includes(response.status)) response.headers.set("Set-Cookie", sessionCookie(config));
    return response;
  }
  if (request.method !== "POST") return authReply(405, {}, { Allow: "POST" });
  // Fixed configured origin: do not trust Host or X-Forwarded-* from callers.
  if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
      (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return authError(403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return authError(422);
  let data: Record<string, unknown>;
  try { data = await limitedJson(request); } catch { return authError(422); }
  const fields = action === "registro" ? ["nombre", "correo", "contrasena", "fecha_nacimiento"] :
    action === "login" ? ["correo", "contrasena"] : action === "verificar" ? ["correo", "codigo"] : action === "logout" ? [] : ["correo"];
  if (fields.some((key) => typeof data[key] !== "string" || !(data[key] as string).length) ||
      Object.keys(data).some((key) => !fields.includes(key))) return authError(422);
  if (action === "logout" && !token) return authError(401, { "Set-Cookie": sessionCookie(config) });
  try {
    const response = await upstream(config, `/auth/${action}`, action === "logout" ? token : "", data, transport);
    if (!response.ok) {
      const status = [400, 401, 403, 404, 409, 422, 429, 503].includes(response.status) ? response.status : 503;
      const headers: Record<string, string> = {};
      const retry = response.headers.get("retry-after");
      if (status === 429 && retry && /^\d{1,5}$/.test(retry)) headers["Retry-After"] = retry;
      if (action === "logout" && [401, 403].includes(status)) headers["Set-Cookie"] = sessionCookie(config);
      return authError(status, headers);
    }
    const result = await response.json();
    if (result?.success !== true) return authError(503);
    if (action === "login") {
      const jwt = result.access_token;
      if (typeof jwt !== "string" || jwt.length > 3800 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt) || result.token_type !== "bearer") return authError(503);
      // This unverified exp only bounds cookie retention; authorization is always FastAPI's job.
      const exp = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).exp;
      const age = Math.floor(exp - Date.now() / 1000);
      if (!Number.isSafeInteger(exp) || age <= 0) return authError(503);
      if (!(await getSession(config, jwt, transport)).ok) return authError(503);
      return authReply(200, { success: true }, { "Set-Cookie": sessionCookie(config, jwt, Math.min(age, 86400)) });
    }
    const message = action === "registro" ? "Revisa tu correo para verificar tu cuenta." : action === "verificar" ? "Cuenta verificada. Ya puedes iniciar sesión." : action === "logout" ? "Sesión revocada." : "Solicitud procesada. Revisa tu correo si la cuenta sigue pendiente.";
    return authReply(200, { success: true, message, ...(action === "registro" ? { verificacion_pendiente: true } : {}) }, action === "logout" ? { "Set-Cookie": sessionCookie(config) } : undefined);
  } catch { return authError(503); }
}
