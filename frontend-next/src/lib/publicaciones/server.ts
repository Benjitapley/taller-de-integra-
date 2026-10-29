import "server-only";
import { authConfig, authReply, readToken, sessionCookie, type Transport, type WebAuthConfig } from "../auth/gateway";
import { publicationImageLimit, validatePublicationForm } from "../../features/publicaciones/validation";

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
    if (size > publicationImageLimit + 65_536) {
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

export async function handleCreatePublication(
  request: Request,
  config: WebAuthConfig | null = authConfig(),
  transport: Transport = fetch,
): Promise<Response> {
  if (request.method !== "POST") return authReply(405, { detail: "Método no permitido." }, { Allow: "POST" });
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
    if (error instanceof RangeError) return authReply(413, { detail: "El formulario supera el tamaño permitido de 5 MB." });
    return authReply(422, { detail: "El formulario no es válido." });
  }
  if (!form) return authReply(422, { detail: "El formulario no es válido." });
  const validationError = validatePublicationForm(form);
  if (validationError) return authReply(422, { detail: validationError });

  try {
    const saved = await transport(`${config.backend}/api/publicaciones`, {
      method: "POST",
      body: form,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (saved.status === 401) return expired();
    if (saved.status === 403) return authReply(403, { detail: "No tienes permiso para crear publicaciones." });
    if (saved.status === 413) return authReply(413, { detail: "La imagen debe pesar como máximo 5 MB." });
    if (saved.status === 422) {
      let payload: unknown;
      try { payload = await saved.json(); } catch { payload = null; }
      return authReply(422, { detail: upstreamDetail(payload) ?? "Revisa los campos y selecciona una imagen válida." });
    }
    if (!saved.ok) return unavailable();
    const result: unknown = await saved.json();
    if (!result || typeof result !== "object" || !("id" in result) ||
        !Number.isSafeInteger(result.id) || (result.id as number) < 1) return unavailable();
    return authReply(201, { id: result.id, mensaje: "Publicación creada" });
  } catch {
    return unavailable();
  }
}
