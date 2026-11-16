import { solicitarJson } from "@/services/httpClient";
import type { ErrorHttp } from "@/types/Http";
import { validarFechaNacimiento } from "@/utils/fechaNacimiento";

const PERFIL_RENDER = "/usuarios/me";
const MAX_NOMBRE = 200;

export function rutasPerfilPropio(modo = process.env.EXPO_PUBLIC_CONTRATO_PERFIL?.trim()) {
  switch (modo) {
    case "render":
      return { consulta: PERFIL_RENDER, alta: "/local/v1/perfil/inicializacion" };
    case undefined:
    case "":
      return { consulta: PERFIL_RENDER, alta: null };
    default:
      return null;
  }
}

export function errorConfiguracionPerfil(): ErrorHttp {
  return { exito: false, codigo: "configuracion", error: "La conexión con el perfil todavía no está configurada correctamente." };
}

export interface DatosProvisionPerfil {
  identidadId: string;
  correoConfirmado: boolean;
  nombre: unknown;
  fechaNacimiento: unknown;
}

export type ResultadoProvisionPerfil = { exito: true } | ErrorHttp;

export async function asegurarPerfilPropio(datos: DatosProvisionPerfil): Promise<ResultadoProvisionPerfil> {
  const rutas = rutasPerfilPropio();
  if (!rutas) return errorConfiguracionPerfil();
  if (!rutas.alta) return { exito: true };

  const identidadEsperada = datos.identidadId;
  const consulta = await solicitarJson(rutas.consulta, { identidadEsperada });
  if (consulta.exito) {
    return consulta.estadoHttp === 200 ? { exito: true } : respuestaInvalida(consulta.estadoHttp);
  }
  if (consulta.estadoHttp !== 404) return consulta;

  if (!datos.correoConfirmado) {
    return { exito: false, codigo: "sin_permiso", error: "Confirma tu correo e inicia sesión para crear tu perfil." };
  }
  const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
  const partes = typeof datos.fechaNacimiento === "string"
    ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(datos.fechaNacimiento)
    : null;
  const fecha = partes ? validarFechaNacimiento(`${partes[3]}/${partes[2]}/${partes[1]}`) : null;
  if (!nombre || [...nombre].length > MAX_NOMBRE || nombre.includes("\0") || !fecha?.valido || fecha.edad > 120) {
    return {
      exito: false,
      codigo: "peticion_invalida",
      error: "Faltan datos válidos de tu registro para crear el perfil. Contacta al equipo de Roomies para recuperar tu cuenta.",
    };
  }

  const alta = await solicitarJson(rutas.alta, {
    metodo: "POST",
    identidadEsperada,
    cuerpo: { nombre, fecha_nacimiento: fecha.fechaISO },
  });
  if (!alta.exito) return alta;
  if (
    [200, 201].includes(alta.estadoHttp) && alta.datos &&
    typeof alta.datos === "object" && "id_usuario" in alta.datos &&
    typeof alta.datos.id_usuario === "number" && Number.isSafeInteger(alta.datos.id_usuario) && alta.datos.id_usuario > 0 &&
    "inicializado" in alta.datos && alta.datos.inicializado === true
  ) {
    return { exito: true };
  }
  return respuestaInvalida(alta.estadoHttp);
}

function respuestaInvalida(estadoHttp: number): ErrorHttp {
  return { exito: false, codigo: "respuesta_invalida", error: "No pudimos comprobar el perfil de tu cuenta. Inténtalo otra vez.", estadoHttp };
}
