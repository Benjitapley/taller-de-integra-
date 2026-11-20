export type ReportTarget = { id_usuario_reportado: number } | { id_publicacion_reportada: number };
export type Report = {
  id_reporte: number;
  tipo: "Usuario" | "Publicacion";
  id_usuario_reportado: number | null;
  id_publicacion_reportada: number | null;
  categoria: string;
  descripcion: string;
  estado: "Pendiente" | "En_Revision" | "Resuelto" | "Descartado";
  fecha: string;
};
export type ReportPage = { items: Report[]; siguiente_cursor: string | null };
