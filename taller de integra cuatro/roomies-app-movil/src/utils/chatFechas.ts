// M4S3-D02 - formato de hora y separadores de dia del chat.
// Todo se muestra en la hora local del telefono; la API entrega fecha_envio en ISO 8601.

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function dosDigitos(numero: number): string {
  return String(numero).padStart(2, "0");
}

/**
 * Fecha valida o null; nunca lanza. La API (Python) manda microsegundos
 * ("...:00.123456+00:00"): se recortan a milisegundos porque no todos los motores
 * de JavaScript aceptan mas de tres decimales.
 */
export function leerFecha(iso: string): Date | null {
  const fecha = new Date(iso.replace(/(\.\d{3})\d+/, "$1"));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** "HH:MM" local, o cadena vacia si la fecha no es valida. */
export function horaLocal(iso: string): string {
  const fecha = leerFecha(iso);
  return fecha ? `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}` : "";
}

/** Identifica el dia local de una fecha (para agrupar mensajes); "" si no es valida. */
export function claveDia(iso: string): string {
  const fecha = leerFecha(iso);
  return fecha ? `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}` : "";
}

/** "Hoy", "Ayer", "16 nov" o "16 nov 2025" (si no es del ano actual). */
export function etiquetaDia(iso: string, ahora: Date = new Date()): string {
  const fecha = leerFecha(iso);
  if (!fecha) return "";

  const hoy = claveDia(ahora.toISOString());
  const ayer = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1);
  const clave = claveDia(fecha.toISOString());
  if (clave === hoy) return "Hoy";
  if (clave === claveDia(ayer.toISOString())) return "Ayer";

  const base = `${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`;
  return fecha.getFullYear() === ahora.getFullYear() ? base : `${base} ${fecha.getFullYear()}`;
}
