export type AdminSummary = { usuarios: number; publicaciones: number; conexiones: number };
export type AdminPublication = { id: number; titulo: string; precio: number | null; ubicacion: string; estado: string; cupos_totales: number | null };
export type AdminData = { resumen: AdminSummary; items: AdminPublication[]; pagina: number; hay_mas: boolean };
