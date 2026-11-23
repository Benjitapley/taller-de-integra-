// M4S3-D02 - identificador de cliente (id_cliente) de cada mensaje enviado.
// Se genera una sola vez por mensaje y se reutiliza en los reintentos: asi la API
// puede reconocer que es el mismo envio y no crear un duplicado.
//
// No es un secreto ni un token: solo debe ser unico. Se usa la fuente segura del
// entorno si existe y, si no, Math.random (suficiente para una clave de idempotencia).

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FuenteAleatoria = {
  randomUUID?: () => string;
  getRandomValues?: (bytes: Uint8Array<ArrayBuffer>) => unknown;
};

export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && FORMATO_UUID.test(valor);
}

export function generarUuidV4(fuente: FuenteAleatoria | undefined = globalThis.crypto): string {
  if (typeof fuente?.randomUUID === "function") {
    const generado = fuente.randomUUID();
    if (esUuid(generado)) return generado.toLowerCase();
  }

  const bytes = new Uint8Array(16);
  if (typeof fuente?.getRandomValues === "function") {
    fuente.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Version 4 y variante RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
