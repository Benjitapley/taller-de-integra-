import type { EstadoArriendoDto, OrigenArriendoDto } from "@/types/api/ArriendoDto";
import type { ErrorHttp } from "@/types/Http";

export interface IntegranteArriendoVista {
  idUsuario: number;
  nombre: string;
  fotoUrl: string | null;
  esResponsable: boolean;
  /** true solo si el servidor marcó a este integrante como la persona con sesión. */
  esPropio: boolean;
}

export interface ArriendoVista {
  idArriendo: number;
  idPublicacion: number;
  estado: EstadoArriendoDto;
  origen: OrigenArriendoDto | null;
  /** Título de la publicación; null si no pudo obtenerse (la pantalla usa un rótulo genérico). */
  titulo: string | null;
  ubicacion: string | null;
  cuposTotales: number;
  cuposDisponibles: number | null;
  integrantesActivos: number;
  fechaInicio: string | null;
  /** Relación de la persona con sesión (GET /mio); null si el servidor no la informó. */
  soyResponsable: boolean | null;
}

/** La persona no pertenece a un arriendo activo (404 contractual o arriendo no activo). */
export interface SinPertenencia {
  exito: false;
  codigo: "sin_pertenencia";
  error: string;
  estadoHttp?: number;
}

export type ResultadoMiArriendo =
  | {
      exito: true;
      arriendo: ArriendoVista;
      /** null = la API aún no entrega la lista (no existe /integrantes); es distinto de «lista vacía». */
      integrantes: IntegranteArriendoVista[] | null;
      /** true si quedaron páginas sin leer al llegar al tope de seguridad. */
      integrantesParciales: boolean;
    }
  | SinPertenencia
  | ErrorHttp;

/** Estado que consume la pantalla; cada variante corresponde a una vista distinta. */
export type EstadoMiArriendo =
  | { tipo: "cargando" }
  | {
      tipo: "datos";
      arriendo: ArriendoVista;
      /** null = lista de integrantes no disponible todavía (ver ResultadoMiArriendo). */
      integrantes: IntegranteArriendoVista[] | null;
      integrantesParciales: boolean;
      /** Una relectura falló por causa transitoria; se conservan los últimos datos. */
      errorActualizacion: ErrorHttp | null;
    }
  | { tipo: "sin_pertenencia" }
  | { tipo: "sin_permiso"; error: ErrorHttp }
  | { tipo: "error"; error: ErrorHttp };
