import type { EstadoPublicacion, TipoPublicacion, TipoVivienda } from "@/types/Publicacion";

/** Imagen ya guardada en el servidor; `idImagen` es lo que se envía en `imagenes_conservar`. */
export interface ImagenRemota {
  idImagen: number;
  url: string;
  orden: number;
}

/**
 * Publicación del propio usuario (Mis publicaciones y edición), ya adaptada desde la
 * respuesta del servicio Listado. Quién la arma: adapters/publicacionPropiaAdapter.ts.
 */
export interface PublicacionPropia {
  idPublicacion: number;
  tipo: TipoPublicacion;
  titulo: string;
  descripcion: string;
  precio: number;
  tipoVivienda: TipoVivienda | "";
  aceptaMascotas: boolean;
  estado: EstadoPublicacion;
  cuposTotales: number;
  /** null cuando el servicio aún no confirma la ocupación: no se muestra como 0. */
  cuposDisponibles: number | null;
  idRegion: number | null;
  idComuna: number | null;
  /** Vacíos si el servicio solo entrega ids; la pantalla de edición los completa con el catálogo. */
  nombreRegion: string;
  nombreComuna: string;
  /** Texto "Comuna, Región" tal como lo entrega el servicio (puede venir vacío). */
  ubicacion: string;
  reglas: string[];
  imagenes: ImagenRemota[];
  /** Contrato 4.1: null mientras no hay arriendo. El servicio actual aún no lo envía. */
  idArriendo: number | null;
  fechaPublicacion: string | null;
}
