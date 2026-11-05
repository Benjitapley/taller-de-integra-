import { solicitarJson } from "@/services/httpClient";
import type { ErrorHttp } from "@/types/Http";
import type { PerfilPropioTi2, PerfilPropioVista } from "@/types/Usuario";

/** Valida el DTO acordado con TI2 y lo convierte al modelo de la pantalla. */
export type AdaptadorPerfilPropio = (datos: unknown) => PerfilPropioVista | null;

export type ResultadoPerfilPropio =
  | { exito: true; perfil: PerfilPropioVista }
  | ErrorHttp
  | { exito: false; codigo: "contrato_pendiente"; error: string };

function esPerfilTi2(datos: unknown): datos is PerfilPropioTi2 {
  if (datos === null || typeof datos !== "object" || Array.isArray(datos)) return false;
  const valor = datos as Record<string, unknown>;
  if (typeof valor.nombre !== "string" || !valor.nombre.trim()) return false;
  if (valor.edad !== null && (typeof valor.edad !== "number" || !Number.isInteger(valor.edad) || valor.edad < 0 || valor.edad > 120)) return false;
  return ["ocupacion", "ciudad", "breve_descripcion", "sobre_mi", "foto_perfil"]
    .every((campo) => valor[campo] === null || typeof valor[campo] === "string");
}

function textoDisponible(valor: string | null): string | null {
  return valor?.trim() || null;
}

function fotoDisponible(valor: string | null): string | null {
  const texto = textoDisponible(valor);
  if (!texto) return null;
  try {
    // Conservar una referencia de la API, sin inventar avatares ni rutas de imágenes.
    const url = texto.startsWith("/") && !texto.startsWith("//")
      ? new URL(texto, process.env.EXPO_PUBLIC_API_URL)
      : new URL(texto);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Contrato publicado en SCRUM-77; campos ausentes de la API siguen no disponibles. */
export function adaptarPerfilTi2(datos: unknown): PerfilPropioVista | null {
  if (!esPerfilTi2(datos)) return null;
  return {
    nombre: datos.nombre.trim(),
    email: null,
    fotoPerfilUrl: fotoDisponible(datos.foto_perfil),
    edad: datos.edad,
    ocupacion: textoDisponible(datos.ocupacion),
    ubicacion: textoDisponible(datos.ciudad),
    breveDescripcion: textoDisponible(datos.breve_descripcion),
    bio: textoDisponible(datos.sobre_mi),
    presupuesto: null,
    preferencias: null,
    buscaEn: null,
  };
}

/**
 * GET protegido mediante A07. El adaptador por defecto valida el contrato publicado;
 * un resultado de Auth no se utiliza como sustituto de un perfil de negocio.
 */
export async function consultarPerfilPropio(
  adaptar: AdaptadorPerfilPropio | null = adaptarPerfilTi2,
): Promise<ResultadoPerfilPropio> {
  if (!adaptar) {
    return {
      exito: false,
      codigo: "contrato_pendiente",
      error: "La consulta de tu perfil todavía no está disponible. Inténtalo más tarde.",
    };
  }

  const resultado = await solicitarJson("/usuarios/me");
  if (!resultado.exito) return resultado;

  try {
    const perfil = resultado.datos === null || resultado.estadoHttp !== 200
      ? null
      : adaptar(resultado.datos);
    if (perfil) return { exito: true, perfil };
  } catch {
    // No mostrar ni registrar el cuerpo o detalles internos del adaptador.
  }
  return {
    exito: false,
    codigo: "respuesta_invalida",
    error: "El servicio devolvió un perfil que no pudimos interpretar.",
    estadoHttp: resultado.estadoHttp,
  };
}
