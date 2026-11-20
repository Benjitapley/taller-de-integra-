import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FormularioPublicacionValores } from "@/types/Publicacion";

// M4S3-C01: el borrador de publicación sobrevive al reinicio de la app.
// Se guarda en AsyncStorage (ya instalado), separado por cuenta para que otra
// persona que inicie sesión en el mismo teléfono no vea el borrador ajeno.

const PREFIJO = "roomies:borrador_publicacion:";

export interface BorradorGuardado {
  valores: FormularioPublicacionValores;
  /** URIs locales de las fotos elegidas (la primera es la portada). */
  fotos: string[];
}

const clave = (idUsuario: string) => `${PREFIJO}${idUsuario}`;

const esTextoLista = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

// Copia en memoria de lo último leído/escrito, para fusionar valores y fotos sin
// releer el almacenamiento en cada cambio.
const memoria = new Map<string, BorradorGuardado>();

function validar(crudo: unknown): BorradorGuardado | null {
  if (typeof crudo !== "object" || crudo === null) return null;
  const { valores, fotos } = crudo as Record<string, unknown>;
  if (typeof valores !== "object" || valores === null) return null;
  const v = valores as Record<string, unknown>;
  if (v.tipo !== "Arrendador" && v.tipo !== "Compartida") return null;
  for (const campo of ["titulo", "precio", "idRegion", "idComuna", "nombreRegion", "nombreComuna", "cupos", "descripcion"]) {
    if (typeof v[campo] !== "string") return null;
  }
  if (!esTextoLista(v.reglas ?? [])) return null;
  return {
    valores: { ...(v as unknown as FormularioPublicacionValores), reglas: (v.reglas as string[] | undefined) ?? [] },
    fotos: esTextoLista(fotos) ? fotos : [],
  };
}

export async function leerBorradorPersistido(idUsuario: string): Promise<BorradorGuardado | null> {
  try {
    const texto = await AsyncStorage.getItem(clave(idUsuario));
    if (!texto) return null;
    const borrador = validar(JSON.parse(texto));
    if (borrador) memoria.set(idUsuario, borrador);
    return borrador;
  } catch {
    return null; // borrador corrupto o sin acceso: se empieza de cero sin romper la pantalla
  }
}

async function escribir(idUsuario: string, borrador: BorradorGuardado): Promise<void> {
  memoria.set(idUsuario, borrador);
  try {
    await AsyncStorage.setItem(clave(idUsuario), JSON.stringify(borrador));
  } catch {
    // Guardar es un apoyo: si falla, el formulario sigue funcionando.
  }
}

export async function guardarValoresBorrador(
  idUsuario: string,
  valores: FormularioPublicacionValores,
): Promise<void> {
  await escribir(idUsuario, { valores, fotos: memoria.get(idUsuario)?.fotos ?? [] });
}

// Guarda las fotos junto con los valores con que se llegó a la pantalla de fotos
// (los más recientes: el guardado con espera del formulario puede ir un paso atrás).
export async function guardarFotosPersistidas(
  idUsuario: string,
  fotos: string[],
  valores: FormularioPublicacionValores,
): Promise<void> {
  await escribir(idUsuario, { valores, fotos });
}

export async function descartarBorradorPersistido(idUsuario: string): Promise<void> {
  memoria.delete(idUsuario);
  try {
    await AsyncStorage.removeItem(clave(idUsuario));
  } catch {
    // nada que hacer
  }
}
