export interface PublicacionCreateBaseDto {
  titulo: string;
  descripcion: string;
  precio: number;
  id_region: number;
  id_comuna: number;
  /** Valor del contrato: "Casa" | "Departamento" | "Habitacion". */
  tipo_vivienda: string;
  cupos_totales: number;
  mascota: "si" | "no";
}

export interface PublicacionArrendadorCreateDto extends PublicacionCreateBaseDto {
  tipo: "Arrendador";
  // Forma que valida Listado hoy (difiere del contrato v2): se envía como JSON y se
  // omite si no hay reglas.
  reglas?: string[];
  categoria: "ofrezco";
  /** "Comuna, Región", derivada de la selección. */
  ubicacion: string;
}

export interface PublicacionCompartidaCreateDto extends PublicacionCreateBaseDto {
  tipo: "Compartida";
  enlace_referencia?: string;
}

export type PublicacionCreateDto =
  | PublicacionArrendadorCreateDto
  | PublicacionCompartidaCreateDto;

/** Respuesta 201 del contrato: la publicación creada (estado Disponible). */
export interface PublicacionCreadaResponse {
  id: number;
  mensaje?: string;
}
