import "server-only";
import { cookies } from "next/headers";
import { authConfig, authReply, cookieName } from "../auth/gateway";
import { handleAdminReports } from "./reportes";

/** Authorize the page through Reportes itself, before serializing private data. */
export async function adminReportsResponse(id?: string) {
  const config = authConfig();
  if (!config) return authReply(503, { detail: "No se pudo comprobar el acceso administrativo." });
  const name = cookieName(config);
  const token = (await cookies()).get(name)?.value ?? "";
  return handleAdminReports(new Request(`${config.origin}/web-api/admin/reportes${id ? `/${id}` : ""}`, {
    headers: { cookie: `${name}=${token}` },
  }), id, config);
}
