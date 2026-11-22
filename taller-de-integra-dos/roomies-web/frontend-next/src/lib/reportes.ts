import "server-only";
import { authConfig, authReply, limitedJson, readToken, sessionCookie, upstream, type Transport, type WebAuthConfig } from "./auth/gateway";
import { reportCategories, type Report } from "../features/reportes/contracts";

export function reportsEnabled(config: WebAuthConfig | null = authConfig()) {
  return config?.provider === "supabase" && process.env.WEB_REPORTES_ENABLED === "true";
}

const positiveId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const validText = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && Array.from(value.trim()).length <= limit && !value.includes("\0");
const responseFields = ["id_reporte", "tipo", "id_usuario_reportado", "id_publicacion_reportada", "categoria", "descripcion", "estado", "fecha"] as const;

export function publicReport(value: unknown): Report {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
  const report = value as Record<string, unknown>;
  const person = positiveId(report.id_usuario_reportado) && report.id_publicacion_reportada === null && report.tipo === "Usuario";
  const listing = positiveId(report.id_publicacion_reportada) && report.id_usuario_reportado === null && report.tipo === "Publicacion";
  if (!positiveId(report.id_reporte) || !(person || listing) ||
      !validText(report.categoria, 80) || !validText(report.descripcion, 1000) ||
      typeof report.estado !== "string" || !["Pendiente", "En_Revision", "Resuelto", "Descartado"].includes(report.estado) ||
      typeof report.fecha !== "string" || !Number.isFinite(Date.parse(report.fecha))) throw new Error();
  return Object.fromEntries(responseFields.map(key => [key, report[key]])) as Report;
}

const unavailable = () => authReply(503, { detail: "No pudimos confirmar la operación. Revisa tus reportes antes de volver a enviarlo." });
const invalid = () => authReply(422, { detail: "Revisa los datos del reporte." });

export async function handleReports(request: Request, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (!config || !reportsEnabled(config)) return authReply(404, { detail: "Reportes no está habilitado." });
  const token = readToken(request.headers.get("cookie"), config);
  const expired = () => authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  if (!token) return expired();

  const sending = request.method === "POST";
  const query = new URL(request.url).searchParams;
  let path: string;
  let body: Record<string, unknown> | undefined;
  let operation: string | null = null;
  if (sending) {
    if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
        (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
      return authReply(403, { detail: "Origen de solicitud no permitido." });
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" || query.size) return invalid();
    operation = request.headers.get("idempotency-key");
    if (!operation || !/^[A-Za-z0-9:_-]{1,80}$/.test(operation)) return invalid();
    try {
      const data = await limitedJson(request);
      const { categoria, descripcion, id_usuario_reportado: person, id_publicacion_reportada: listing } = data;
      const allowed = ["categoria", "descripcion", "id_usuario_reportado", "id_publicacion_reportada"];
      if (Object.keys(data).some(key => !allowed.includes(key)) || !validText(categoria, 80) ||
          !reportCategories.some(value => value === categoria.trim()) || !validText(descripcion, 1000)) return invalid();
      if ((person != null && !positiveId(person)) || (listing != null && !positiveId(listing)) || (person == null) === (listing == null)) return invalid();
      body = { categoria: categoria.trim(), descripcion: descripcion.trim(), ...(person == null ? { id_publicacion_reportada: listing } : { id_usuario_reportado: person }) };
    } catch { return invalid(); }
    path = "/api/reportes";
  } else if (request.method === "GET") {
    if ([...query.keys()].some(key => key !== "cursor" || query.getAll(key).length !== 1)) return invalid();
    const cursor = query.get("cursor");
    if (cursor !== null && !/^[A-Za-z0-9_.-]{1,512}$/.test(cursor)) return invalid();
    path = "/api/reportes/mios" + (cursor === null ? "" : "?" + query.toString());
  } else {
    return authReply(405, { detail: "Método no permitido." }, { Allow: "GET, POST" });
  }

  try {
    const response = sending ? await transport(`${config.backend}${path}`, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": operation! },
      body: JSON.stringify(body),
    }) : await upstream(config, path, token, undefined, transport);
    if (response.status === 401) return expired();
    if (response.status === 403) return authReply(403, { detail: sending
      ? "No puedes reportar ese objetivo. Confirma tu correo y comprueba que la publicación sea ajena o que hayas tenido una conexión aceptada o convivencia con esa persona."
      : "Tu cuenta no puede consultar estos reportes." });
    if (response.status === 404) return authReply(404, { detail: sending ? "El objetivo del reporte no está disponible." : "No se encontraron reportes para esta sesión." });
    if (response.status === 422) return invalid();
    if (response.status === 409) return authReply(409, { detail: "La clave de envío ya corresponde a otro reporte. Revisa tus reportes antes de repetirlo." });
    if (response.status === 429) return authReply(429, { detail: "Espera unos minutos antes de volver a intentarlo." });
    if (response.status !== (sending ? 201 : 200)) return unavailable();
    const data = await response.json();
    if (sending) {
      const report = publicReport(data);
      if (report.categoria !== body!.categoria || report.descripcion !== body!.descripcion ||
          report.id_usuario_reportado !== (body!.id_usuario_reportado ?? null) ||
          report.id_publicacion_reportada !== (body!.id_publicacion_reportada ?? null)) return unavailable();
      return authReply(201, report);
    }
    if (!Array.isArray(data?.items) || data.items.length > 20 ||
        (data.siguiente_cursor !== null && (typeof data.siguiente_cursor !== "string" || !/^[A-Za-z0-9_.-]{1,512}$/.test(data.siguiente_cursor)))) return unavailable();
    return authReply(200, { items: data.items.map(publicReport), siguiente_cursor: data.siguiente_cursor });
  } catch {
    return unavailable();
  }
}

/** Solo consulta miembros autorizados por Convivencia; no expone datos internos. */
export async function handleReportMembers(request: Request, rental: string, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (!config || !reportsEnabled(config)) return authReply(404, { detail: "Reportes no está habilitado." });
  if (request.method !== "GET") return authReply(405, { detail: "Método no permitido." });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return authReply(401, { detail: "Inicia sesión nuevamente." });
  const query = new URL(request.url).searchParams;
  if (!/^[1-9][0-9]*$/.test(rental) || !Number.isSafeInteger(Number(rental)) ||
      [...query.keys()].some(key => key !== "cursor" || query.getAll(key).length !== 1)) return invalid();
  const cursor = query.get("cursor");
  if (cursor !== null && !/^[A-Za-z0-9_.-]{1,2048}$/.test(cursor)) return invalid();
  try {
    const response = await upstream(config, `/api/arriendos/${rental}/integrantes${cursor ? "?" + query : ""}`, token, undefined, transport);
    if (response.status === 401) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
    if (response.status === 403) return authReply(403, { detail: "No tienes permiso para consultar este arriendo." });
    if (response.status === 404) return authReply(404, { detail: "La consulta de integrantes no está disponible para este arriendo." });
    if (response.status === 422) return invalid();
    if (!response.ok) return unavailable();
    const page = await response.json();
    if (!Array.isArray(page?.items) || page.items.length > 20 || (page.siguiente_cursor !== null &&
        (typeof page.siguiente_cursor !== "string" || !/^[A-Za-z0-9_.-]{1,2048}$/.test(page.siguiente_cursor)))) return unavailable();
    const items = page.items.map((member: Record<string, unknown>) => {
      if (!member || !positiveId(member.id_usuario)) throw new Error();
      return { id_usuario: member.id_usuario, nombre: typeof member.nombre === "string" && member.nombre.length <= 200 ? member.nombre : null };
    });
    return authReply(200, { items, siguiente_cursor: page.siguiente_cursor });
  } catch { return unavailable(); }
}
