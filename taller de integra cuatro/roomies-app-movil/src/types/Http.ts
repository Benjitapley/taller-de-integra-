export type CodigoErrorHttp =
  | "configuracion"
  | "peticion_invalida"
  | "sin_sesion"
  | "sesion_no_disponible"
  | "no_autorizado"
  | "sin_permiso"
  | "http"
  | "red"
  | "tiempo_agotado"
  | "respuesta_invalida";

export interface ErrorHttp {
  exito: false;
  codigo: CodigoErrorHttp;
  error: string;
  estadoHttp?: number;
  //codigo` del error del contrato (p. ej. "correo_no_verificado"), si el servidor lo envió//
  codigoServidor?: string;
}

export type ResultadoHttp =
  | { exito: true; datos: unknown; estadoHttp: number }
  | ErrorHttp;

export interface OpcionesPeticionHttp {
  metodo?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  cuerpo?: unknown;
  /** Las peticiones son protegidas salvo que se indique false explícitamente. */
  autenticada?: boolean;
  /** Si se indica, solo usar el token de esta identidad. */
  identidadEsperada?: string;
  /** Tiempo máximo de fetch y lectura del cuerpo; por defecto, 15 segundos. */
  tiempoLimiteMs?: number;
  /**
   * Cabeceras adicionales (p. ej. `Idempotency-Key`). No pueden reemplazar
   * Authorization, Content-Type ni Accept: si lo intentan, la petición se rechaza.
   */
  headers?: Record<string, string>;
}

/** Formulario multipart; fetch genera Content-Type con su boundary. */
export interface OpcionesFormularioHttp extends Omit<OpcionesPeticionHttp, "metodo" | "cuerpo"> {
  /** POST por defecto; GET no admite formulario. */
  metodo?: "POST" | "PUT" | "PATCH" | "DELETE";
  cuerpo: FormData;
}
