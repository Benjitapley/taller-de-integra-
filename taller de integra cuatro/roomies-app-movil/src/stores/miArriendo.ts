import { consultarMiArriendo } from "@/services/arriendosService";
import type { ResultadoProvisionPerfil } from "@/services/provisionPerfilService";
import type { EstadoMiArriendo, ResultadoMiArriendo } from "@/types/Arriendo";


export type CargarMiArriendo = () => Promise<ResultadoMiArriendo>;

const MENSAJE_FALLO_INESPERADO = "No pudimos consultar tu arriendo. Inténtalo otra vez.";

export function crearAlmacenMiArriendo(cargar: CargarMiArriendo = () => consultarMiArriendo()) {
  let estado: EstadoMiArriendo = { tipo: "cargando" };
  let generacion = 0;
  const oyentes = new Set<() => void>();

  function suscribir(oyente: () => void) {
    oyentes.add(oyente);
    return () => { oyentes.delete(oyente); };
  }

  function obtenerEstado() {
    return estado;
  }

  function publicar(siguiente: EstadoMiArriendo) {
    estado = siguiente;
    oyentes.forEach((oyente) => oyente());
  }

  function aplicar(resultado: ResultadoMiArriendo) {
    if (resultado.exito) {
      publicar({
        tipo: "datos",
        arriendo: resultado.arriendo,
        integrantes: resultado.integrantes,
        integrantesParciales: resultado.integrantesParciales,
        errorActualizacion: null,
      });
      return;
    }
    // Pérdida de pertenencia o de acceso (p. ej. retiro): se descartan los datos privados.
    if (resultado.codigo === "sin_pertenencia") {
      publicar({ tipo: "sin_pertenencia" });
      return;
    }
    if (resultado.codigo === "sin_permiso") {
      publicar({ tipo: "sin_permiso", error: resultado });
      return;
    }
    // Sin sesión o token rechazado: no se puede confirmar la pertenencia; no se conservan datos.
    if (resultado.codigo === "no_autorizado" || resultado.codigo === "sin_sesion") {
      publicar({ tipo: "error", error: resultado });
      return;
    }
    // Fallo transitorio (red, tiempo agotado, 5xx, respuesta ilegible): si ya habia datos
    // se conservan con un aviso; si no, se muestra el error con Reintentar.
    if (estado.tipo === "datos") {
      publicar({ ...estado, errorActualizacion: resultado });
    } else {
      publicar({ tipo: "error", error: resultado });
    }
  }

  /** Decide que se ve mientras se relee: nunca se vacia una pantalla que ya tiene resultado. */
  function prepararLectura(mostrarCarga: boolean) {
    switch (estado.tipo) {
      case "cargando":
        return;
      case "datos":
        // Los datos se conservan; solo se retira el aviso de una relectura anterior fallida.
        if (mostrarCarga && estado.errorActualizacion) publicar({ ...estado, errorActualizacion: null });
        return;
      case "error":
        publicar({ tipo: "cargando" });
        return;
      default:
        // sin_pertenencia / sin_permiso: la relectura es silenciosa salvo Reintentar.
        if (mostrarCarga) publicar({ tipo: "cargando" });
    }
  }

  /**
   * Lee el arriendo. Por defecto la lectura es silenciosa si ya hay un resultado
   * (datos, sin pertenencia o sin permiso); `mostrarCarga` fuerza el indicador (Reintentar).
   */
  async function recargar(opciones: { mostrarCarga?: boolean } = {}): Promise<void> {
    const numero = ++generacion;
    prepararLectura(opciones.mostrarCarga === true);

    let resultado: ResultadoMiArriendo;
    try {
      resultado = await cargar();
    } catch {
      resultado = { exito: false, codigo: "red", error: MENSAJE_FALLO_INESPERADO };
    }
    if (numero !== generacion) return;
    aplicar(resultado);
  }

  /** Descarta las lecturas en curso (al perder el foco o desmontar la pantalla). */
  function invalidar() {
    generacion += 1;
  }

  return { suscribir, obtenerEstado, recargar, invalidar };
}

export type AlmacenMiArriendo = ReturnType<typeof crearAlmacenMiArriendo>;

/**
 * Lo que ve la pantalla. Igual que Perfil, el arriendo solo se consulta cuando la provisión del perfil de
 * negocio terminó: mientras sigue en curso se muestra «cargando», y si falló, ese error con su Reintentar.
 */
export function estadoVisibleMiArriendo(
  provision: ResultadoProvisionPerfil | null,
  estado: EstadoMiArriendo,
): EstadoMiArriendo {
  if (provision === null) return { tipo: "cargando" };
  if (!provision.exito) return { tipo: "error", error: provision };
  return estado;
}
