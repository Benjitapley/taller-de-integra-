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
}

export type ResultadoHttp =
  | { exito: true; datos: unknown; estadoHttp: number }
  | ErrorHttp;

export interface OpcionesPeticionHttp {
  metodo?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  cuerpo?: unknown;
  /** Las peticiones son protegidas salvo que se indique false explícitamente. */
  autenticada?: boolean;
  /** Tiempo máximo de fetch y lectura del cuerpo; por defecto, 15 segundos. */
  tiempoLimiteMs?: number;
}
