import type { Report } from "../reportes/contracts";

export const statusLabels = { Pendiente: "Pendiente", En_Revision: "En revisión", Resuelto: "Resuelto", Descartado: "Descartado" };
export const typeLabels = { Usuario: "Persona", Publicacion: "Publicación" };
export const transitions: Record<Report["estado"], Report["estado"][]> = {
  Pendiente: ["En_Revision", "Descartado"],
  En_Revision: ["Resuelto", "Descartado"],
  Resuelto: [],
  Descartado: [],
};

export type AdminReport = Report & { id_denunciante: number };
export type ReviewEntry = {
  id_actuacion: number;
  id_administrador: number;
  estado_anterior: Report["estado"];
  estado_nuevo: Report["estado"];
  nota_interna: string | null;
  fecha: string;
};
export type AdminReportDetail = AdminReport & { historial: ReviewEntry[] };
export type AdminReportPage = { items: AdminReport[]; siguiente_cursor: string | null };

export function reportTarget(report: Report) {
  return `${typeLabels[report.tipo]} #${report.id_usuario_reportado ?? report.id_publicacion_reportada}`;
}

const dateFormat = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" });
export function reportDate(date: string) {
  return dateFormat.format(new Date(date));
}
