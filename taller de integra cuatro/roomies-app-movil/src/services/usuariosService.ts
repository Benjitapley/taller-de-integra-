import { solicitarJson } from "@/services/httpClient";
import type { ErrorHttp } from "@/types/Http";
import type { PerfilPropioVista } from "@/types/Usuario";

/** Valida el DTO acordado con TI2 y lo convierte al modelo de la pantalla. */
export type AdaptadorPerfilPropio = (datos: unknown) => PerfilPropioVista | null;

export type ResultadoPerfilPropio =
  | { exito: true; perfil: PerfilPropioVista }
  | ErrorHttp
  | { exito: false; codigo: "contrato_pendiente"; error: string };

// Sustituir por el adaptador real cuando TI2 confirme JSON, campos y nulabilidad.
// No asumir que UsuarioPerfil es el DTO ni aceptar el antiguo /api/perfil por alias.
const adaptadorPerfilTi2: AdaptadorPerfilPropio | null = null;

/**
 * Ruta de referencia del backlog. Sin adaptador confirmado no hace peticiones.
 * El parámetro permite probar la orquestación con un contrato ficticio explícito;
 * no habilita un modo mock en la aplicación.
 */
export async function consultarPerfilPropio(
  adaptar: AdaptadorPerfilPropio | null = adaptadorPerfilTi2,
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
    const perfil = resultado.datos === null || resultado.estadoHttp === 204
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
