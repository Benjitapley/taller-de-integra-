import { solicitarJson } from "@/services/httpClient";
import type { ErrorHttp, ResultadoHttp } from "@/types/Http";

export type EstadoTarea = "Pendiente" | "Completada";
export type TareaApi = {
  id_tarea: number;
  id_arriendo: number;
  titulo: string;
  descripcion: string | null;
  estado: EstadoTarea;
  id_creador: number;
  id_asignado: number | null;
  fecha_creacion: string;
};
export type PaginaTareas = { items: TareaApi[]; siguiente_cursor: string | null; id_usuario_actual: number };
type Exito<T> = { exito: true; datos: T; estadoHttp: number };
type Resultado<T> = Exito<T> | ErrorHttp;
type Transporte = typeof solicitarJson;

const idValido = (valor: unknown): valor is number => typeof valor === "number" && Number.isSafeInteger(valor) && valor > 0;
const errorRespuesta = (): ErrorHttp => ({ exito: false, codigo: "respuesta_invalida", error: "La respuesta de tareas no tiene el formato esperado." });

export function tarea(valor: unknown): valor is TareaApi {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return false;
  const item = valor as Record<string, unknown>;
  return idValido(item.id_tarea) && idValido(item.id_arriendo) && idValido(item.id_creador) &&
    (item.id_asignado === null || idValido(item.id_asignado)) &&
    typeof item.titulo === "string" && item.titulo.trim().length > 0 && item.titulo.length <= 120 &&
    (item.descripcion === null || typeof item.descripcion === "string" && item.descripcion.length <= 1000) &&
    (item.estado === "Pendiente" || item.estado === "Completada") &&
    typeof item.fecha_creacion === "string" && Number.isFinite(Date.parse(item.fecha_creacion));
}

export async function obtenerArriendoActual(enviar: Transporte = solicitarJson): Promise<Resultado<number>> {
  const respuesta: ResultadoHttp = await enviar("/api/arriendos/mio");
  if (!respuesta.exito) return respuesta;
  const valor = respuesta.datos as Record<string, unknown> | null;
  return valor && idValido(valor.id_arriendo)
    ? { exito: true, datos: valor.id_arriendo, estadoHttp: respuesta.estadoHttp } : errorRespuesta();
}

export async function listarTareas(idArriendo: number, estado: EstadoTarea, cursor?: string,
  enviar: Transporte = solicitarJson): Promise<Resultado<PaginaTareas>> {
  if (!idValido(idArriendo) || !["Pendiente", "Completada"].includes(estado) ||
      cursor !== undefined && !/^[A-Za-z0-9_-]{1,128}$/.test(cursor)) return errorRespuesta();
  const parametros = new URLSearchParams({ estado, limite: "20" });
  if (cursor) parametros.set("cursor", cursor);
  const respuesta = await enviar(`/api/arriendos/${idArriendo}/tareas?${parametros}`);
  if (!respuesta.exito) return respuesta;
  const valor = respuesta.datos as Record<string, unknown> | null;
  if (!valor || !Array.isArray(valor.items) || valor.items.length > 20 || !valor.items.every(tarea) ||
      !idValido(valor.id_usuario_actual) ||
      !(valor.siguiente_cursor === null || typeof valor.siguiente_cursor === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(valor.siguiente_cursor)))
    return errorRespuesta();
  return { exito: true, datos: valor as PaginaTareas, estadoHttp: respuesta.estadoHttp };
}

export async function completarTarea(idTarea: number, enviar: Transporte = solicitarJson): Promise<Resultado<TareaApi>> {
  if (!idValido(idTarea)) return errorRespuesta();
  const respuesta = await enviar(`/api/tareas/${idTarea}/estado`, { metodo: "PATCH", cuerpo: { estado: "Completada" } });
  if (!respuesta.exito) return respuesta;
  return tarea(respuesta.datos) && respuesta.datos.id_tarea === idTarea && respuesta.datos.estado === "Completada"
    ? { exito: true, datos: respuesta.datos, estadoHttp: respuesta.estadoHttp } : errorRespuesta();
}
