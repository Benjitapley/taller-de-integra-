import "server-only";
import { authConfig, authReply, limitedJson, readToken, sessionCookie, type Transport, type WebAuthConfig } from "../auth/gateway";
import { publicReport, reportsEnabled } from "../reportes";
import { type AdminReport, type ReviewEntry, statusLabels, typeLabels } from "../../features/admin/reportes";

const validId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const validCursor = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_.-]{1,512}$/.test(value);
const validStatus = (value: unknown): value is keyof typeof statusLabels => typeof value === "string" && Object.hasOwn(statusLabels, value);
const validNote = (value: unknown): value is string => typeof value === "string" && Array.from(value.trim()).length <= 1000 && !value.includes("\0");
const invalid = () => authReply(422, { detail: "Revisa los filtros o los datos de la revisión." });
const unavailable = () => authReply(503, { detail: "No se pudo confirmar la operación. Actualiza el reporte antes de volver a intentarlo." });

function adminReport(value: unknown): AdminReport {
  const report = publicReport(value);
  const { id_denunciante } = value as Record<string, unknown>;
  if (!validId(id_denunciante)) throw new Error();
  return { ...report, id_denunciante };
}

function reviewEntry(value: unknown): ReviewEntry {
  if (!value || typeof value !== "object") throw new Error();
  const { id_actuacion, id_administrador, estado_anterior, estado_nuevo, fecha, nota_interna } = value as Record<string, unknown>;
  if (!validId(id_actuacion) || !validId(id_administrador) || !validStatus(estado_anterior) || !validStatus(estado_nuevo) ||
      typeof fecha !== "string" || !Number.isFinite(Date.parse(fecha)) || (nota_interna !== null && !validNote(nota_interna))) throw new Error();
  return { id_actuacion, id_administrador, estado_anterior, estado_nuevo, fecha, nota_interna };
}

export async function handleAdminReports(
  request: Request, id?: string, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch,
) {
  if (!config || !reportsEnabled(config)) return authReply(404, { detail: "Reportes no está habilitado." });
  const token = readToken(request.headers.get("cookie"), config);
  const expired = () => authReply(401, { detail: "Tu sesión ha expirado. Vuelve a iniciar sesión." }, { "Set-Cookie": sessionCookie(config) });
  if (!token) return expired();

  const change = request.method === "PATCH";
  if (request.method !== "GET" && (!change || id === undefined)) return authReply(405, { detail: "Método no permitido." });
  const query = new URL(request.url).searchParams;
  if (id !== undefined && (!/^[1-9][0-9]*$/.test(id) || !validId(Number(id)))) return invalid();
  if (id !== undefined && query.size) return invalid();
  const path = id === undefined ? "/api/admin/reportes" : `/api/admin/reportes/${id}`;
  let body: string | undefined;
  if (change) {
    if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
        (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
      return authReply(403, { detail: "Origen de solicitud no permitido." });
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return invalid();
    try {
      const data = await limitedJson(request);
      const { estado, nota_interna } = data;
      if (Object.keys(data).some(key => key !== "estado" && key !== "nota_interna") ||
          !validStatus(estado) || (nota_interna != null && !validNote(nota_interna))) return invalid();
      body = JSON.stringify({ estado, nota_interna: nota_interna?.trim() || null });
    } catch { return invalid(); }
  } else if (id === undefined) {
    if ([...query.keys()].some(key => !["estado", "tipo", "cursor"].includes(key) || query.getAll(key).length !== 1)) return invalid();
    const estado = query.get("estado"), tipo = query.get("tipo"), cursor = query.get("cursor");
    if ((estado !== null && !validStatus(estado)) || (tipo !== null && !Object.hasOwn(typeLabels, tipo)) ||
        (cursor !== null && !validCursor(cursor))) return invalid();
  }

  try {
    const response = await transport(config.backend + path + (query.size ? "?" + query : ""), {
      method: request.method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(change ? { "Content-Type": "application/json" } : {}) },
      body,
    });
    if (response.status === 401) return expired();
    if (response.status === 403) return authReply(403, { detail: "Tu cuenta no tiene acceso administrativo." });
    if (response.status === 404) return authReply(404, { detail: "Reporte no encontrado." });
    if (response.status === 409) return authReply(409, { detail: "La transición no está permitida. Actualiza el reporte y revisa su estado." });
    if (response.status === 422) return invalid();
    if (!response.ok) return unavailable();
    const data = await response.json();
    if (id !== undefined) {
      const report = adminReport(data);
      if (report.id_reporte !== Number(id) || !Array.isArray(data.historial)) return unavailable();
      return authReply(200, { ...report, historial: data.historial.map(reviewEntry) });
    }
    if (!Array.isArray(data?.items) || data.items.length > 20 ||
        (data.siguiente_cursor !== null && !validCursor(data.siguiente_cursor))) return unavailable();
    return authReply(200, { items: data.items.map(adminReport), siguiente_cursor: data.siguiente_cursor });
  } catch { return unavailable(); }
}
