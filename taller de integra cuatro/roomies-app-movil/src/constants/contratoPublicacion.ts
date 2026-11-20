import type { TipoVivienda } from "@/types/Publicacion";

// Nombres de campo y límites de POST /api/publicaciones (Contrato de microservicios,
// cap. 4.1, "Crear / editar publicación"). Están juntos a propósito: Cabrera (TI2) debe
// confirmar los nombres, y si cambia alguno se corrige solo aquí.

export const CAMPOS_API_PUBLICACION = {
  imagenes: "imagenes",
  reglasArrendador: "reglas_arrendador",
  idRegion: "id_region",
  idComuna: "id_comuna",
} as const;

/** Valor que el contrato espera en `tipo_vivienda` (Casa | Departamento | Habitacion). */
export const TIPO_VIVIENDA_API: Record<TipoVivienda, string> = {
  casa: "Casa",
  departamento: "Departamento",
  habitacion: "Habitacion",
};

/** `reglas_arrendador`: hasta 20 textos de máximo 300 caracteres. */
export const MAX_REGLAS_ARRENDADOR = 20;
export const MAX_CARACTERES_REGLA = 300;

/** `precio`: CLP entero de 0 a 999.999.999.999 (12 dígitos). */
export const MAX_DIGITOS_PRECIO = 12;
export const PRECIO_MAXIMO = 999_999_999_999;

/** Cantidad máxima de imágenes por publicación Arrendador. */
export const MAX_IMAGENES_ARRENDADOR = 5;

/** El POST de creación debe responder exactamente 201. */
export const ESTADO_HTTP_CREADA = 201;

/** Largo máximo de la cabecera Idempotency-Key. */
export const MAX_LARGO_CLAVE_IDEMPOTENCIA = 80;

/** Región por la que parte el selector (alcance TI2 D10-D12: La Araucanía). */
export const REGION_INICIAL = "La Araucanía";

/** Límites de texto y capacidad (contrato 4.1). */
export const MAX_CARACTERES_TITULO = 200;
export const MAX_CARACTERES_DESCRIPCION = 5000;
export const MAX_CUPOS_TOTALES = 2_147_483_647;
export const MAX_DIGITOS_CUPOS = 10;

// ---------------------------------------------------------------------------
// Forma de POST /api/publicaciones que valida el servicio Listado de TI2 (S3R-C02)
// ---------------------------------------------------------------------------
// La app se adapta al servidor tal como está hoy, aunque difiera del contrato v2 (4.1):
// exige `ubicacion` y `categoria`, acepta `tipo_vivienda` en minúscula y llama `reglas`
// a las reglas del arrendador. Si Listado cambia, se ajusta solo este bloque y
// `formaListadoArrendador` en services/publicacionesService.ts.

/** `tipo_vivienda` como lo acepta Listado (minúscula). */
export const TIPO_VIVIENDA_API_LISTADO: Record<TipoVivienda, string> = {
  casa: "casa",
  departamento: "departamento",
  habitacion: "habitacion",
};

/** Nombre con el que Listado recibe las reglas del arrendador. */
export const CAMPO_REGLAS_LISTADO = "reglas";
/** `categoria`: una publicación de arrendador siempre "ofrezco". */
export const CATEGORIA_LISTADO = "ofrezco";
/** Largo máximo de `ubicacion`. */
export const MAX_LARGO_UBICACION = 250;
