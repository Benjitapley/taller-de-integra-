import "server-only";
import { authConfig, authReply, readToken, sessionCookie, upstream, type Transport, type WebAuthConfig } from "../auth/gateway";
import type { AdminData, AdminPublication, AdminSummary } from "../../features/admin/contracts";

const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export function normalizeAdmin(summary: unknown, publications: unknown, page: number): AdminData {
  if (!summary || typeof summary !== "object" || !publications || typeof publications !== "object") throw new Error("Invalid admin data");
  const s = summary as Record<string, unknown>, p = publications as Record<string, unknown>;
  if (![s.usuarios, s.publicaciones, s.conexiones].every(count) || p.pagina !== page || typeof p.hay_mas !== "boolean" || !Array.isArray(p.items) || p.items.length > 20) throw new Error("Invalid admin data");
  const items: AdminPublication[] = p.items.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("Invalid publication");
    const r = row as Record<string, unknown>;
    if (!count(r.id) || r.id === 0 || ![r.titulo, r.ubicacion, r.estado].every(v => typeof v === "string" || v === null) ||
      !(r.precio === null || typeof r.precio === "number" && Number.isFinite(r.precio) && r.precio >= 0) || !(r.cupos_totales === null || count(r.cupos_totales))) throw new Error("Invalid publication");
    return { id: r.id, titulo: r.titulo as string ?? "", ubicacion: r.ubicacion as string ?? "", estado: r.estado as string ?? "", precio: r.precio as number | null, cupos_totales: r.cupos_totales as number | null };
  });
  return { resumen: { usuarios: s.usuarios, publicaciones: s.publicaciones, conexiones: s.conexiones } as AdminSummary, items, pagina: page, hay_mas: p.hay_mas };
}

export async function handleAdmin(request: Request, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch): Promise<Response> {
  if (request.method !== "GET") return authReply(405, { detail: "Método no permitido." }, { Allow: "GET" });
  const unavailable = () => authReply(503, { detail: "No se pudo consultar el panel. Intenta nuevamente más tarde." });
  if (!config) return unavailable();
  const token = readToken(request.headers.get("cookie"), config);
  const expired = () => authReply(401, { detail: "Tu sesión ha expirado. Vuelve a iniciar sesión." }, { "Set-Cookie": sessionCookie(config) });
  if (!token) return expired();
  const query = new URL(request.url).searchParams;
  const page = query.get("pagina") ?? "1";
  if ([...query.keys()].some(k => k !== "pagina") || query.getAll("pagina").length > 1 || !/^[1-9][0-9]{0,5}$/.test(page) || Number(page) > 100000) return authReply(422, { detail: "Página no válida." });
  try {
    const responses = await Promise.all([
      upstream(config, "/api/admin/resumen", token, undefined, transport),
      upstream(config, `/api/admin/publicaciones?limite=20&pagina=${page}`, token, undefined, transport),
    ]);
    if (responses.some(r => r.status === 401)) return expired();
    if (responses.some(r => r.status === 403)) return authReply(403, { detail: "Tu cuenta no tiene acceso administrativo." });
    if (responses.some(r => !r.ok)) return unavailable();
    return authReply(200, normalizeAdmin(await responses[0].json(), await responses[1].json(), Number(page)));
  } catch { return unavailable(); }
}
