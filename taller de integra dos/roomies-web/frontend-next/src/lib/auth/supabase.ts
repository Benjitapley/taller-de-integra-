import "server-only";
import { randomBytes, createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { WebAuthConfig, Transport } from "./gateway";

type Bridge = {
  reply: (status: number, body: unknown, headers?: HeadersInit) => Response;
  error: (status: number, headers?: HeadersInit) => Response;
  limitedJson: (request: Request) => Promise<Record<string, unknown>>;
  token: (cookie: string | null, config: WebAuthConfig) => string;
  accessCookie: (config: WebAuthConfig, token?: string, age?: number) => string;
  session: (config: WebAuthConfig | null, token: string, transport?: Transport) => Promise<Response>;
};

const pkceName = (config: WebAuthConfig) => config.secure ? "__Host-roomies_pkce" : "roomies_pkce_dev";
function pkceCookie(config: WebAuthConfig, value = "", age = 0) {
  // Solo el comprobante temporal usa Lax para recibir el enlace desde el correo.
  return `${pkceName(config)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${config.secure ? "; Secure" : ""}`;
}
function readPkce(request: Request, config: WebAuthConfig) {
  const values = (request.headers.get("cookie") ?? "").split(";").map(v => v.trim()).filter(v => v.startsWith(pkceName(config) + "="));
  const verifier = values.length === 1 ? values[0].slice(pkceName(config).length + 1) : "";
  return /^[A-Za-z0-9_-]{64}$/.test(verifier) ? verifier : "";
}

export const refreshCookieName = (config: WebAuthConfig) => config.secure ? "__Host-roomies_sb_refresh" : "roomies_sb_dev_refresh";
export function refreshCookie(config: WebAuthConfig, token = "", age = 0) {
  return `${refreshCookieName(config)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${config.secure ? "; Secure" : ""}`;
}
function readRefresh(request: Request, config: WebAuthConfig) {
  const matches = (request.headers.get("cookie") ?? "").split(";").map(v => v.trim()).filter(v => v.startsWith(refreshCookieName(config) + "="));
  if (matches.length !== 1) return "";
  try {
    const value = decodeURIComponent(matches[0].slice(refreshCookieName(config).length + 1));
    return value.length <= 2048 && /^[A-Za-z0-9._~-]+$/.test(value) ? value : "";
  } catch { return ""; }
}
function headers(config: WebAuthConfig, token?: string): Record<string, string> {
  return { apikey: config.supabase!.key, Accept: "application/json", "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
async function provider(config: WebAuthConfig, path: string, transport: Transport, body?: unknown, token?: string, method?: "PUT") {
  return transport(`${config.supabase!.origin}/auth/v1${path}`, { method: method ?? (body === undefined ? "GET" : "POST"), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000), headers: headers(config, token), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const recoveryName = (config: WebAuthConfig, verifier = false) => `${config.secure ? "__Host-" : ""}roomies_recovery${verifier ? "_pkce" : ""}${config.secure ? "" : "_dev"}`;
function recoveryCookie(config: WebAuthConfig, value = "", age = 0, verifier = false) {
  return `${recoveryName(config, verifier)}=${value}; Path=/; HttpOnly; SameSite=${verifier ? "Lax" : "Strict"}; Max-Age=${age}${config.secure ? "; Secure" : ""}`;
}
function readRecoveryCookie(request: Request, config: WebAuthConfig, verifier = false) {
  const name = recoveryName(config, verifier) + "=";
  const matches = (request.headers.get("cookie") ?? "").split(";").map(v => v.trim()).filter(v => v.startsWith(name));
  return matches.length === 1 ? matches[0].slice(name.length) : "";
}
type Recovery = { access: string; subject: string; expires: number; nonce: string };
function signRecovery(value: Recovery, config: WebAuthConfig) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return payload + "." + createHmac("sha256", config.recoverySecret!).update("password-recovery:" + payload).digest("base64url");
}
const usedRecoveries = new Map<string, number>();
function readRecovery(request: Request, config: WebAuthConfig): Recovery | null {
  try {
    if (!config.recoverySecret || config.recoverySecret.length < 32) return null;
    const raw = readRecoveryCookie(request, config);
    if (raw.length > 3800 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(raw)) return null;
    const [payload, signature] = raw.split(".");
    const expected = createHmac("sha256", config.recoverySecret).update("password-recovery:" + payload).digest();
    const given = Buffer.from(signature, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString()) as Recovery;
    if (!Number.isSafeInteger(value.expires) || value.expires <= Date.now()/1000 || typeof value.access !== "string" || typeof value.subject !== "string" || typeof value.nonce !== "string" || usedRecoveries.has(value.nonce)) return null;
    return value;
  } catch { return null; }
}
function redirect(config: WebAuthConfig, path: string, cookies: string[] = []) {
  const response = new Response(null, { status: 303, headers: { Location: config.origin + path, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  for (const cookie of cookies) response.headers.append("Set-Cookie", cookie);
  return response;
}
function clear(response: Response, config: WebAuthConfig, bridge: Bridge) {
  response.headers.append("Set-Cookie", bridge.accessCookie(config));
  response.headers.append("Set-Cookie", refreshCookie(config));
  return response;
}
class IdentityRejected extends Error {}
async function user(config: WebAuthConfig, token: string, transport: Transport) {
  const response = await provider(config, "/user", transport, undefined, token);
  if ([401,403].includes(response.status)) throw new IdentityRejected();
  if (!response.ok) throw new Error("user-unavailable");
  const value: unknown = await response.json();
  if (!value || typeof value !== "object") throw new Error();
  const result = value as Record<string, unknown>;
  if (typeof result.id !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(result.id) || typeof result.email_confirmed_at !== "string" || !result.email_confirmed_at) throw new Error();
  return result;
}
async function initialize(config: WebAuthConfig, token: string, identity: Record<string, unknown>, transport: Transport) {
  const current = await transport(`${config.backend}/local/v1/perfil`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000), headers: { Authorization: `Bearer ${token}` } });
  if (current.ok) return;
  if (current.status !== 404) throw new Error("profile-unavailable");
  const metadata = identity.user_metadata;
  if (!metadata || typeof metadata !== "object") throw new Error("profile-incomplete");
  const data = metadata as Record<string, unknown>;
  if (typeof data.nombre !== "string" || !data.nombre.trim() || data.nombre.length > 200 || typeof data.fecha_nacimiento !== "string") throw new Error("profile-incomplete");
  const response = await transport(`${config.backend}/local/v1/perfil/inicializacion`, {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nombre: data.nombre, fecha_nacimiento: data.fecha_nacimiento }),
  });
  if (!response.ok) throw new Error("profile-unavailable");
}
function validBirthDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const birth = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== value) return false;
  const today = new Date();
  const age = today.getUTCFullYear() - birth.getUTCFullYear() - (today.toISOString().slice(5, 10) < value.slice(5, 10) ? 1 : 0);
  return age >= 18 && age <= 120;
}
function tokens(value: unknown) {
  if (!value || typeof value !== "object") throw new Error();
  const data = value as Record<string, unknown>;
  if (typeof data.access_token !== "string" || data.access_token.length > 3800 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(data.access_token) ||
      typeof data.refresh_token !== "string" || !/^[A-Za-z0-9._~-]{10,2048}$/.test(data.refresh_token) || data.token_type !== "bearer") throw new Error();
  // Solo limita retención; FastAPI verifica criptografía y permisos.
  const claims = JSON.parse(Buffer.from(data.access_token.split(".")[1], "base64url").toString());
  const remaining = Math.floor(claims.exp - Date.now() / 1000);
  if (!Number.isSafeInteger(claims.exp) || remaining < 1 || remaining > 86400) throw new Error();
  return { access: data.access_token, refresh: data.refresh_token, remaining };
}
const rotations = new Map<string, Promise<unknown>>();
class RefreshRejected extends Error {}
async function rotate(config: WebAuthConfig, refresh: string, transport: Transport) {
  const key = config.supabase!.origin + ":" + refresh;
  let pending = rotations.get(key);
  if (!pending) {
    pending = (async () => {
      const response = await provider(config, "/token?grant_type=refresh_token", transport, { refresh_token: refresh });
      if (!response.ok) {
        if ([400, 401, 403].includes(response.status)) throw new RefreshRejected();
        throw new Error("refresh-unavailable");
      }
      return response.json();
    })();
    if (rotations.size >= 256) rotations.delete(rotations.keys().next().value!);
    rotations.set(key, pending);
    const timer = setTimeout(() => rotations.delete(key), 5000);
    timer.unref?.();
    pending.catch(() => rotations.delete(key));
  }
  return pending;
}

export async function handleSupabaseAuth(request: Request, action: string, config: WebAuthConfig, transport: Transport, bridge: Bridge): Promise<Response> {
  if (!config.supabase) return bridge.error(503);
  const token = bridge.token(request.headers.get("cookie"), config);
  if (action === "recuperacion-estado") {
    if (request.method !== "GET") return bridge.reply(405, {}, { Allow: "GET" });
    const context = readRecovery(request, config);
    if (!context) return bridge.reply(401, { detail: "El enlace no es válido o ha expirado. Solicita uno nuevo." });
    try {
      const identity = await user(config, context.access, transport);
      return identity.id === context.subject ? bridge.reply(200, { valid: true }) : bridge.error(401);
    } catch (error) { return error instanceof IdentityRejected ? bridge.reply(401, { detail: "El enlace no es válido o ha expirado. Solicita uno nuevo." }) : bridge.error(503); }
  }
  if (action === "recuperacion-callback") {
    if (request.method !== "GET") return bridge.reply(405, {}, { Allow: "GET" });
    const query = new URL(request.url).searchParams;
    const code = query.get("code") ?? "";
    const verifier = readRecoveryCookie(request, config, true);
    const failed = () => redirect(config, "/recuperar-contrasena?estado=enlace-invalido", [recoveryCookie(config), recoveryCookie(config,"",0,true)]);
    if (!config.recoverySecret || config.recoverySecret.length < 32) return bridge.error(503);
    if (!/^[A-Za-z0-9_-]{64}$/.test(verifier) || !/^[A-Za-z0-9_-]{10,512}$/.test(code) || query.getAll("code").length !== 1 || [...query.keys()].some(k => k !== "code")) return failed();
    try {
      const response = await provider(config, "/token?grant_type=pkce", transport, { auth_code: code, code_verifier: verifier });
      if (!response.ok) return failed();
      const session = tokens(await response.json());
      const identity = await user(config, session.access, transport);
      const age = Math.min(600, session.remaining);
      const capsule = signRecovery({ access: session.access, subject: String(identity.id), expires: Math.floor(Date.now()/1000)+age, nonce: randomBytes(24).toString("base64url") }, config);
      if (capsule.length > 3800) return bridge.error(503);
      return redirect(config, "/restablecer-contrasena", [recoveryCookie(config,capsule,age), recoveryCookie(config,"",0,true)]);
    } catch { return redirect(config, "/recuperar-contrasena?estado=servicio-no-disponible"); }
  }
  if (action === "confirmar") {
    if (request.method !== "GET") return bridge.reply(405, {}, { Allow: "GET" });
    const query = new URL(request.url).searchParams;
    const code = query.get("code") ?? "";
    const verifier = readPkce(request, config);
    if (!verifier || !/^[A-Za-z0-9_-]{10,512}$/.test(code) || query.getAll("code").length !== 1 || [...query.keys()].some(k => k !== "code")) return redirect(config, "/verificar?estado=enlace-invalido");
    try {
      const response = await provider(config, "/token?grant_type=pkce", transport, { auth_code: code, code_verifier: verifier });
      if (!response.ok) return redirect(config, response.status >= 500 ? "/verificar?estado=servicio-no-disponible" : "/verificar?estado=enlace-invalido");
      const session = tokens(await response.json());
      const identity = await user(config, session.access, transport);
      let profilePending = false;
      try { await initialize(config, session.access, identity, transport); } catch { profilePending = true; }
      await provider(config, "/logout?scope=local", transport, {}, session.access);
      return redirect(config, "/?correo=verificado" + (profilePending ? "&perfil=pendiente" : ""), [pkceCookie(config)]);
    } catch { return redirect(config, "/verificar?estado=servicio-no-disponible"); }
  }
  if (action === "sesion") {
    if (request.method !== "GET") return bridge.reply(405, {}, { Allow: "GET" });
    const response = await bridge.session(config, token, transport);
    // Una cookie de refresh vigente permite recuperación por POST, nunca en un GET.
    return response;
  }
  if (request.method !== "POST") return bridge.reply(405, {}, { Allow: "POST" });
  if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
      (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return bridge.error(403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return bridge.error(422);
  let data: Record<string, unknown>;
  try { data = await bridge.limitedJson(request); } catch { return bridge.error(422); }
  const fields = action === "registro" ? ["nombre", "correo", "contrasena", "fecha_nacimiento"] : action === "login" ? ["correo", "contrasena"] : action === "verificar" ? ["correo", "codigo"] : ["reenviar-codigo", "recuperar"].includes(action) ? ["correo"] : action === "cambiar-contrasena" ? ["contrasena", "confirmacion"] : [];
  if (fields.some(k => typeof data[k] !== "string" || !data[k]) || Object.keys(data).some(k => !fields.includes(k))) return bridge.error(422);
  try {
    if (action === "recuperar") {
      if (!config.recoverySecret || config.recoverySecret.length < 32) return bridge.error(503);
      const email = String(data.correo).trim();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bridge.error(422);
      const verifier = randomBytes(48).toString("base64url");
      const response = await provider(config, `/recover?redirect_to=${encodeURIComponent(config.origin + "/web-api/auth/recuperacion-callback")}`, transport, { email, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "s256" });
      if (response.status === 429) {
        const retry = response.headers.get("retry-after");
        return bridge.error(429, retry && /^\d{1,5}$/.test(retry) ? { "Retry-After": retry } : undefined);
      }
      if (response.status >= 500) return bridge.error(503);
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        if (!["user_not_found","email_not_found"].includes(error?.error_code ?? error?.code)) return bridge.error(503);
      }
      // Mismo contrato para correo existente/inexistente, sin consultar usuarios.
      const result = bridge.reply(200, { success: true, message: "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña." }, { "Set-Cookie": recoveryCookie(config,verifier,3600,true) });
      result.headers.append("Set-Cookie", pkceCookie(config));
      return result;
    }
    if (action === "cambiar-contrasena") {
      const context = readRecovery(request, config);
      if (!context) return bridge.reply(401, { detail: "El enlace no es válido o ha expirado. Solicita uno nuevo." });
      const password = String(data.contrasena);
      if (password.length < 8 || password.length > 128 || password !== data.confirmacion) return bridge.reply(422, { detail: "Las contraseñas deben coincidir y tener entre 8 y 128 caracteres." });
      const identity = await user(config, context.access, transport);
      if (identity.id !== context.subject) return bridge.error(401);
      if (usedRecoveries.has(context.nonce)) return bridge.error(401);
      for (const [key, exp] of usedRecoveries) if (exp <= Date.now()/1000) usedRecoveries.delete(key);
      if (usedRecoveries.size >= 1000) return bridge.error(429);
      usedRecoveries.set(context.nonce, context.expires);
      let changed: Response;
      try { changed = await provider(config, "/user", transport, { password }, context.access, "PUT"); }
      catch { usedRecoveries.delete(context.nonce); throw new Error(); }
      if (!changed.ok) {
        usedRecoveries.delete(context.nonce);
        return bridge.reply([400,422].includes(changed.status) ? 422 : changed.status === 429 ? 429 : 401, { detail: "No se pudo actualizar la contraseña. Usa una diferente o solicita un enlace nuevo." });
      }
      await provider(config, "/logout?scope=global", transport, {}, context.access).catch(() => null);
      if (token) await transport(`${config.backend}/local/v1/sesion/revocar`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) }).catch(() => null);
      const response = clear(bridge.reply(200, { success: true, message: "Contraseña actualizada correctamente. Ya puedes iniciar sesión." }), config, bridge);
      response.headers.append("Set-Cookie", recoveryCookie(config));
      response.headers.append("Set-Cookie", recoveryCookie(config,"",0,true));
      return response;
    }
    if (action === "logout") {
      if (!token) return clear(bridge.error(401), config, bridge);
      const revoked = await transport(`${config.backend}/local/v1/sesion/revocar`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
      const signedOut = await provider(config, "/logout?scope=local", transport, {}, token);
      rotations.delete(config.supabase.origin + ":" + readRefresh(request, config));
      return clear(revoked.ok && signedOut.ok ? bridge.reply(200, { success: true, message: "Sesión cerrada." }) : bridge.error(503), config, bridge);
    }
    if (action === "registro") {
      if (!validBirthDate(data.fecha_nacimiento) || (data.nombre as string).trim().length > 200 || !(data.nombre as string).trim() || (data.contrasena as string).length < 8 || (data.contrasena as string).length > 128 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.correo))) return bridge.error(422);
      const verifier = randomBytes(48).toString("base64url");
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      const response = await provider(config, `/signup?redirect_to=${encodeURIComponent(config.origin + "/web-api/auth/confirmar")}`, transport, { email: data.correo, password: data.contrasena, data: { nombre: (data.nombre as string).trim(), fecha_nacimiento: data.fecha_nacimiento }, code_challenge: challenge, code_challenge_method: "s256" });
      if (!response.ok) return bridge.error(response.status === 429 ? 429 : 422);
      const result = await response.json();
      if (!result || typeof result !== "object" || result.access_token) return bridge.error(503);
      const created = bridge.reply(200, { success: true, verificacion_pendiente: true, message: "Revisa tu correo para verificar tu cuenta." }, { "Set-Cookie": pkceCookie(config, verifier, 3600) });
      created.headers.append("Set-Cookie", recoveryCookie(config,"",0,true));
      return created;
    }
    if (action === "reenviar-codigo") {
      const response = await provider(config, "/resend", transport, { email: data.correo, type: "signup" });
      return response.ok ? bridge.reply(200, { success: true, message: "Revisa tu correo si la cuenta sigue pendiente." }) : bridge.error(response.status === 429 ? 429 : 422);
    }
    if (action === "verificar") {
      if (!/^\d{6,10}$/.test(String(data.codigo))) return bridge.error(422);
      const response = await provider(config, "/verify", transport, { email: data.correo, token: data.codigo, type: "email" });
      if (!response.ok) return bridge.error(response.status === 429 ? 429 : 400);
      const session = tokens(await response.json());
      const identity = await user(config, session.access, transport);
      await initialize(config, session.access, identity, transport);
      await provider(config, "/logout?scope=local", transport, {}, session.access);
      return bridge.reply(200, { success: true, message: "Correo verificado. Ya puedes iniciar sesión." }, { "Set-Cookie": pkceCookie(config) });
    }
    let result: unknown;
    if (action === "renovar") {
      const refresh = readRefresh(request, config);
      if (!refresh) return clear(bridge.error(401), config, bridge);
      try { result = await rotate(config, refresh, transport); } catch (error) {
        return error instanceof RefreshRejected ? clear(bridge.error(401), config, bridge) : bridge.error(503);
      }
    } else if (action === "login") {
      const response = await provider(config, "/token?grant_type=password", transport, { email: data.correo, password: data.contrasena });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        return bridge.error(response.status === 429 ? 429 : error?.error_code === "email_not_confirmed" ? 403 : 401);
      }
      result = await response.json();
    } else return bridge.reply(404, { detail: "Ruta no disponible." });
    const session = tokens(result);
    const identity = await user(config, session.access, transport);
    await initialize(config, session.access, identity, transport);
    if (!(await bridge.session(config, session.access, transport)).ok) return clear(bridge.error(401), config, bridge);
    const response = bridge.reply(200, { success: true });
    response.headers.append("Set-Cookie", bridge.accessCookie(config, session.access, session.remaining));
    response.headers.append("Set-Cookie", refreshCookie(config, session.refresh, 7 * 86400));
    // Nunca conservar las credenciales del otro proveedor al iniciar esta sesión.
    response.headers.append("Set-Cookie", `${config.secure ? "__Host-haycupo_session" : "haycupo_dev_session"}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${config.secure ? "; Secure" : ""}`);
    return response;
  } catch {
    return action === "logout" ? clear(bridge.error(503), config, bridge) : bridge.error(503);
  }
}
