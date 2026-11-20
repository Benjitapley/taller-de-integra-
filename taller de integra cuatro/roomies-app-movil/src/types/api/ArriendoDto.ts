export type EstadoArriendoDto = "Activo" | "Finalizado";
export type OrigenArriendoDto = "Compartida" | "Arrendador";
export type RolIntegranteDto = "Responsable" | "Integrante";

export interface PublicacionResumenDto {
  titulo?: string;
  ubicacion?: string | null;
  region?: { id?: number; nombre?: string };
  comuna?: { id?: number; nombre?: string };
}

export interface ArriendoDto {
  id_arriendo: number;
  id_publicacion: number;
  cupos_totales: number;
  integrantes_activos?: number;
  ocupacion?: number;
  version_capacidad?: number;
  estado?: EstadoArriendoDto;
  cupos_disponibles?: number | null;
  origen?: OrigenArriendoDto;
  id_responsable?: number | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  es_responsable?: boolean;
  rol?: RolIntegranteDto | null;
  publicacion?: PublicacionResumenDto;
}

/** Elemento de GET /api/arriendos/{id}/integrantes?activos=true (Forma A; aun no implementado). */
export interface IntegranteArriendoDto {
  id_usuario: number;
  nombre?: string;
  foto?: string | null;
  usuario?: { id_usuario?: number; nombre?: string; foto?: string | null };
  es_responsable?: boolean;
  rol?: RolIntegranteDto | null;
  fecha_ingreso?: string | null;
  fecha_salida?: string | null;
  es_yo?: boolean;
}

export type RespuestaIntegrantesDto =
  | IntegranteArriendoDto[]
  | { items: IntegranteArriendoDto[]; siguiente_cursor: string | null };
