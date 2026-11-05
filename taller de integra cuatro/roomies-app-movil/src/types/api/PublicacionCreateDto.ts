/**
 * DTOs de creación de publicaciones (M4-C07).
 *
 * Contrato contrastado con el CÓDIGO de listado-applications-service
 * (app/api/routes.py y app/domain/publications.py); no hay OpenAPI publicado.
 * Se crea con POST /api/publicaciones como formulario multipart. Campos que el
 * servicio acepta: titulo, descripcion, ubicacion, precio, tipo, categoria,
 * tipo_vivienda, mascota, cupos_totales, permitir_comentarios e imagen. Cualquier
 * otro campo se rechaza con 422. El autor NO viaja: sale del JWT.
 *
 * Reglas que valida el servicio y conviene conocer:
 *  - Una publicación `tipo` "Arrendador" debe llevar `categoria` "ofrezco".
 *  - `categoria` no se pregunta en el formulario: se deriva del origen
 *    (Arrendador = "ofrezco", Compartida = "busco"; ver CATEGORIA_POR_ORIGEN).
 *  - precio hasta 2 decimales y cupos_totales >= 1.
 *
 * No se envían (el servicio los rechazaría con 422), aunque el formulario móvil
 * los recoge. Pedir a TI2 que los agregue:
 *  - `enlace_referencia` (solo Compartida).
 *  - `tipos_mascotas_aceptadas` y `condiciones_mascotas`: hoy solo `mascota`.
 *    Los campos siguen tipados abajo para cuando existan.
 *  - Fotos: el servicio acepta UNA `imagen` opcional (JPG/PNG/WEBP, máx. 5 MB);
 *    el envío de fotos queda fuera de M4-C07.
 */

import type { TipoMascota, TipoVivienda } from "@/types/Publicacion";

export type CategoriaPublicacionDto = "busco" | "ofrezco";

export interface PublicacionCreateBaseDto {
  titulo: string;
  descripcion: string;
  precio: number;
  ubicacion: string;
  categoria: CategoriaPublicacionDto;
  tipo_vivienda: TipoVivienda;
  cupos_totales: number;
  mascota: "si" | "no";
  /**
   * Solo se envía si TI2 activó el detalle de mascotas (ver ENVIAR_DETALLE_MASCOTAS
   * en publicacionesService.ts); si no, el backend responde 503. Vacía cuando
   * `mascota` es "no".
   */
  tipos_mascotas_aceptadas?: TipoMascota[];
  /** Igual que la lista: solo con el detalle activado y si se escribió algo. */
  condiciones_mascotas?: string;
  permitir_comentarios: boolean;
}

export interface PublicacionArrendadorCreateDto extends PublicacionCreateBaseDto {
  tipo: "Arrendador";
}

export interface PublicacionCompartidaCreateDto extends PublicacionCreateBaseDto {
  tipo: "Compartida";
  enlace_referencia?: string;
}

export type PublicacionCreateDto =
  | PublicacionArrendadorCreateDto
  | PublicacionCompartidaCreateDto;


export interface PublicacionCreadaResponse {
  id: number;
  mensaje?: string;
}
