import type { ImagenRemota, PublicacionPropia } from "@/types/PublicacionPropia";
import type {
  EstadoPublicacion,
  FormularioPublicacionValores,
  TipoPublicacion,
  TipoVivienda,
} from "@/types/Publicacion";

type Registro = Record<string, unknown>;

const esRegistro = (valor: unknown): valor is Registro =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

const enteroSeguro = (valor: unknown): number | null =>
  typeof valor === "number" && Number.isSafeInteger(valor) ? valor : null;

const enteroPositivo = (valor: unknown): number | null => {
  const numero = enteroSeguro(valor);
  return numero !== null && numero >= 1 ? numero : null;
};

const ESTADOS: readonly EstadoPublicacion[] = ["Disponible", "Activa", "Cerrada"];
const TIPOS: readonly TipoPublicacion[] = ["Arrendador", "Compartida"];
const VIVIENDAS: readonly TipoVivienda[] = ["casa", "departamento", "habitacion"];

function leerImagenes(valor: unknown): ImagenRemota[] | null {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) return null;
  const imagenes: ImagenRemota[] = [];
  for (const [indice, item] of valor.entries()) {
    if (!esRegistro(item)) return null;
    const idImagen = enteroPositivo(item.id_imagen);
    if (idImagen === null || typeof item.url !== "string" || !item.url) return null;
    imagenes.push({ idImagen, url: item.url, orden: enteroSeguro(item.orden) ?? indice });
  }
  // La primera es la portada y el orden es estable (contrato 4.1).
  return imagenes.sort((a, b) => a.orden - b.orden);
}

function leerReglas(valor: unknown): string[] | null {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor) || valor.some((regla) => typeof regla !== "string")) return null;
  return valor as string[];
}

/** Región o comuna: objeto {id, nombre} del contrato o id plano de Listado. */
function leerCatalogo(
  registro: Registro,
  campoObjeto: "region" | "comuna",
  campoId: "id_region" | "id_comuna",
): { id: number | null; nombre: string } {
  const objeto = registro[campoObjeto];
  if (esRegistro(objeto)) {
    return {
      id: enteroPositivo(objeto.id) ?? enteroPositivo(registro[campoId]),
      nombre: typeof objeto.nombre === "string" ? objeto.nombre.trim() : "",
    };
  }
  return { id: enteroPositivo(registro[campoId]), nombre: "" };
}

export function adaptarPublicacionPropia(crudo: unknown): PublicacionPropia | null {
  if (!esRegistro(crudo)) return null;

  const idPublicacion = enteroPositivo(crudo.id_publicacion ?? crudo.id);
  const precio = enteroSeguro(crudo.precio);
  const cuposTotales = enteroPositivo(crudo.cupos_totales);
  const estado = ESTADOS.find((e) => e === crudo.estado);
  const tipo = TIPOS.find((t) => t === crudo.tipo);
  if (
    idPublicacion === null ||
    precio === null || precio < 0 ||
    cuposTotales === null ||
    !estado || !tipo ||
    typeof crudo.titulo !== "string" ||
    typeof crudo.descripcion !== "string"
  ) {
    return null;
  }

  const imagenes = leerImagenes(crudo.imagenes);
  const reglas = leerReglas(crudo.reglas_arrendador ?? crudo.reglas);
  if (imagenes === null || reglas === null) return null;

  const vivienda = typeof crudo.tipo_vivienda === "string" ? crudo.tipo_vivienda.toLowerCase() : "";
  const region = leerCatalogo(crudo, "region", "id_region");
  const comuna = leerCatalogo(crudo, "comuna", "id_comuna");

  return {
    idPublicacion,
    tipo,
    titulo: crudo.titulo,
    descripcion: crudo.descripcion,
    precio,
    tipoVivienda: VIVIENDAS.find((v) => v === vivienda) ?? "",
    aceptaMascotas: crudo.mascota === "si",
    estado,
    cuposTotales,
    cuposDisponibles: enteroSeguro(crudo.cupos_disponibles),
    idRegion: region.id,
    idComuna: comuna.id,
    nombreRegion: region.nombre,
    nombreComuna: comuna.nombre,
    ubicacion: typeof crudo.ubicacion === "string" ? crudo.ubicacion : "",
    reglas,
    imagenes,
    idArriendo: enteroPositivo(crudo.id_arriendo),
    fechaPublicacion: typeof crudo.fecha_publicacion === "string" ? crudo.fecha_publicacion : null,
  };
}

/**
 * Valores iniciales del formulario de edición. Los nombres de región y comuna (que el
 * formulario necesita para armar `ubicacion`) llegan aparte, resueltos con el catálogo.
 */
export function aValoresFormulario(
  publicacion: PublicacionPropia,
  nombres: { nombreRegion: string; nombreComuna: string },
): FormularioPublicacionValores {
  return {
    tipo: "Arrendador",
    titulo: publicacion.titulo,
    precio: String(publicacion.precio),
    idRegion: publicacion.idRegion === null ? "" : String(publicacion.idRegion),
    idComuna: publicacion.idComuna === null ? "" : String(publicacion.idComuna),
    nombreRegion: nombres.nombreRegion,
    nombreComuna: nombres.nombreComuna,
    tipoVivienda: publicacion.tipoVivienda,
    cupos: String(publicacion.cuposTotales),
    descripcion: publicacion.descripcion,
    enlaceReferencia: "",
    aceptaMascotas: publicacion.aceptaMascotas,
    permitirComentarios: false,
    reglas: publicacion.reglas,
  };
}
