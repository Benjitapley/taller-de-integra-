import { REGION_INICIAL } from "@/constants/contratoPublicacion";
import { solicitarJson } from "@/services/httpClient";
import type { ErrorHttp } from "@/types/Http";

// GET /api/regiones            -> [{ id_region, nombre }]
// GET /api/regiones/{id}/comunas -> [{ id_comuna, nombre }]
// Son públicos: se piden sin sesión.

export interface Region {
  idRegion: number;
  nombre: string;
}

export interface Comuna {
  idComuna: number;
  nombre: string;
}

export type ResultadoLista<T> = { exito: true; datos: T[] } | ErrorHttp;

export type Solicitar = typeof solicitarJson;

const esIdValido = (valor: unknown): valor is number =>
  typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 1;

function leerLista<T>(
  datos: unknown,
  campoId: string,
  crear: (id: number, nombre: string) => T,
): T[] | null {
  if (!Array.isArray(datos)) return null;
  const lista: T[] = [];
  for (const item of datos) {
    if (typeof item !== "object" || item === null) return null;
    const registro = item as Record<string, unknown>;
    const id = registro[campoId];
    const nombre = registro.nombre;
    if (!esIdValido(id) || typeof nombre !== "string" || !nombre.trim()) return null;
    lista.push(crear(id, nombre.trim()));
  }
  return lista;
}

const respuestaInvalida = (estadoHttp: number): ErrorHttp => ({
  exito: false,
  codigo: "respuesta_invalida",
  error: "El servicio devolvió una lista que no pudimos interpretar.",
  estadoHttp,
});


export async function obtenerRegiones(
  solicitar: Solicitar = solicitarJson,
): Promise<ResultadoLista<Region>> {
  const resultado = await solicitar("/api/regiones", { autenticada: false });
  if (!resultado.exito) return resultado;
  const lista = leerLista(resultado.datos, "id_region", (idRegion, nombre) => ({ idRegion, nombre }));
  if (!lista) return respuestaInvalida(resultado.estadoHttp);
  // Contrato 4.1: el catálogo devuelve todas las regiones, pero el selector móvil
  // ofrece solo La Araucanía. Se busca por nombre; no se fija su id.
  const araucania = buscarRegionPorNombre(lista, REGION_INICIAL);
  return { exito: true, datos: araucania ? [araucania] : [] };
}

export async function obtenerComunas(
  idRegion: number,
  solicitar: Solicitar = solicitarJson,
): Promise<ResultadoLista<Comuna>> {
  if (!esIdValido(idRegion)) {
    return { exito: false, codigo: "peticion_invalida", error: "La región elegida no es válida." };
  }
  const resultado = await solicitar(`/api/regiones/${idRegion}/comunas`, { autenticada: false });
  if (!resultado.exito) return resultado;
  const lista = leerLista(resultado.datos, "id_comuna", (idComuna, nombre) => ({ idComuna, nombre }));
  return lista ? { exito: true, datos: lista } : respuestaInvalida(resultado.estadoHttp);
}

const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es-CL");

/** Busca una región por nombre sin distinguir tildes ni mayúsculas ("La Araucania"). */
export function buscarRegionPorNombre(regiones: Region[], nombre: string): Region | undefined {
  const buscado = normalizar(nombre);
  return regiones.find((region) => normalizar(region.nombre) === buscado);
}
