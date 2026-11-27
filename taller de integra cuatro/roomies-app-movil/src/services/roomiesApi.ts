import { solicitarJson, solicitarFormulario } from "@/services/httpClient";
import type { ErrorHttp, OpcionesPeticionHttp } from "@/types/Http";
import type { Pagina } from "@/services/listaPaginada";

export type Resultado<T> = { exito: true; datos: T; estadoHttp: number } | ErrorHttp;
export type Objeto = Record<string, unknown>;
export const objeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);
export const id = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const fecha = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v));
export type PublicacionApi = Objeto & { id_publicacion: number; titulo: string; descripcion: string; precio: number; ubicacion: string; estado: string; cupos_totales: number; cupos_disponibles: number | null };
export type IntegranteApi = Objeto & { id_usuario: number; nombre: string | null; activo: boolean };
export type ConversacionApi = Objeto & { id_conversacion: number; id_arriendo: number; fecha_creacion: string };
export type MensajeApi = Objeto & { id_mensaje: number; id_conversacion: number; id_remitente: number; contenido: string; nombre_remitente: string; fecha_envio: string };
export type ReporteApi = Objeto & { id_reporte: number; estado: string; categoria: string; descripcion: string; fecha: string };
export type PerfilApi = Objeto & { id_usuario: number; nombre: string; foto_perfil: string | null };
export type ArriendoApi = Objeto & { id_arriendo: number; id_publicacion: number; estado: string; ocupacion: number; cupos_totales: number };
export type PostulacionApi = Objeto & { id_postulacion: number; id_publicacion: number; id_usuario: number; estado: string; fecha_postulacion: string };
export type NotificacionApi = Objeto & { id_notificacion: number; tipo: string; referencia_id: number; fecha: string };
export type PersonaApi = Objeto & { id_usuario_PK: number; nombre: string };

export const publicacionValida = (v: unknown): v is PublicacionApi => objeto(v) && id(v.id_publicacion) && typeof v.titulo === "string" && typeof v.descripcion === "string" && typeof v.ubicacion === "string" && Number.isSafeInteger(v.precio) && Number(v.precio) >= 0 && ["Disponible", "Activa", "Cerrada"].includes(String(v.estado)) && id(v.cupos_totales) && (v.cupos_disponibles === null || Number.isSafeInteger(v.cupos_disponibles) && Number(v.cupos_disponibles) >= 0);
export const integranteValido = (v: unknown): v is IntegranteApi => objeto(v) && id(v.id_usuario) && (v.nombre === null || typeof v.nombre === "string") && typeof v.activo === "boolean";
export const conversacionValida = (v: unknown): v is ConversacionApi => objeto(v) && id(v.id_conversacion) && id(v.id_arriendo) && fecha(v.fecha_creacion);
export const mensajeValido = (v: unknown): v is MensajeApi => objeto(v) && id(v.id_mensaje) && id(v.id_conversacion) && id(v.id_remitente) && typeof v.contenido === "string" && typeof v.nombre_remitente === "string" && fecha(v.fecha_envio);
export const reporteValido = (v: unknown): v is ReporteApi => objeto(v) && id(v.id_reporte) && ["Pendiente", "En_Revision", "Resuelto", "Descartado"].includes(String(v.estado)) && typeof v.categoria === "string" && typeof v.descripcion === "string" && fecha(v.fecha);
export const perfilValido = (v: unknown): v is PerfilApi => objeto(v) && id(v.id_usuario) && typeof v.nombre === "string" && (v.foto_perfil === null || typeof v.foto_perfil === "string");
export const arriendoValido = (v: unknown): v is ArriendoApi => objeto(v) && id(v.id_arriendo) && id(v.id_publicacion) && ["Activo", "Finalizado"].includes(String(v.estado)) && Number.isSafeInteger(v.ocupacion) && id(v.cupos_totales);
export const postulacionValida = (v: unknown): v is PostulacionApi => objeto(v) && id(v.id_postulacion) && id(v.id_publicacion) && id(v.id_usuario) && ["Pendiente", "Preseleccionada", "Aceptada", "Rechazada", "Cancelada"].includes(String(v.estado)) && fecha(v.fecha_postulacion);
export const notificacionValida = (v: unknown): v is NotificacionApi => objeto(v) && id(v.id_notificacion) && id(v.referencia_id) && typeof v.tipo === "string" && fecha(v.fecha);
export const personaValida = (v: unknown): v is PersonaApi => objeto(v) && id(v.id_usuario_PK) && typeof v.nombre === "string";

export function respuestaInvalida(estadoHttp: number): ErrorHttp {
  return { exito: false, codigo: "respuesta_invalida", error: "La respuesta del servicio no tiene el formato esperado.", estadoHttp };
}
export async function consultar<T>(ruta: string, validar: (v: unknown) => v is T, opciones?: OpcionesPeticionHttp, enviar = solicitarJson): Promise<Resultado<T>> {
  const result = await enviar(ruta, opciones);
  return !result.exito ? result : validar(result.datos) ? { ...result, datos: result.datos } : respuestaInvalida(result.estadoHttp);
}
export async function pagina<T>(ruta: string, validar: (v: unknown) => v is T, cursor?: string, historial = false, publica = false, enviar = solicitarJson): Promise<Resultado<Pagina<T>>> {
  const [path, query = ""] = ruta.split("?");
  const params = new URLSearchParams(query);
  params.set("limite", "20");
  if (cursor) params.set(historial ? "antes" : "cursor", cursor);
  return consultar(`${path}?${params}`, (v): v is Pagina<T> => objeto(v) && Array.isArray(v.items) && v.items.every(validar) &&
    (v.siguiente_cursor === null || typeof v.siguiente_cursor === "string" && v.siguiente_cursor.length > 0), { autenticada: !publica }, enviar);
}

/** Identificador de reintento, no una credencial. Conservar hasta confirmar la operación. */
export function nuevaClave(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}
export type FotoSeleccionada = { uri: string; mimeType?: string | null; fileName?: string | null; fileSize?: number; file?: File };
export function errorFoto(foto: FotoSeleccionada): string | null {
  if (!foto.mimeType || !["image/jpeg", "image/png", "image/webp"].includes(foto.mimeType)) return "Selecciona una imagen JPG, PNG o WebP.";
  if (foto.fileSize !== undefined && (foto.fileSize < 1 || foto.fileSize > 5_000_000)) return "Cada imagen debe pesar entre 1 byte y 5 MB.";
  return null;
}
export function adjuntarFoto(form: FormData, campo: string, foto: FotoSeleccionada) {
  if (foto.file) form.append(campo, foto.file, foto.fileName ?? foto.file.name);
  else form.append(campo, { uri: foto.uri, name: foto.fileName ?? `foto.${foto.mimeType === "image/png" ? "png" : foto.mimeType === "image/webp" ? "webp" : "jpg"}`, type: foto.mimeType } as unknown as Blob);
}
export async function subirFoto(foto: FotoSeleccionada, enviar = solicitarFormulario): Promise<Resultado<{ foto_perfil: string }>> {
  const error = errorFoto(foto);
  if (error) return { exito: false, codigo: "peticion_invalida", error };
  const cuerpo = new FormData(); adjuntarFoto(cuerpo, "foto", foto);
  const result = await enviar("/api/usuarios/me/foto", { metodo: "PUT", cuerpo });
  return !result.exito ? result : objeto(result.datos) && typeof result.datos.foto_perfil === "string" && /^https?:\/\//.test(result.datos.foto_perfil)
    ? { ...result, datos: { foto_perfil: result.datos.foto_perfil } } : respuestaInvalida(result.estadoHttp);
}
