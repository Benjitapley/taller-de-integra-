import { MAX_LARGO_CLAVE_IDEMPOTENCIA } from "@/constants/contratoPublicacion";

// Idempotency-Key de POST /api/publicaciones (contrato 1.3: misma clave + mismo
// cuerpo = misma respuesta, sin duplicar).
//
// Se genera UNA clave por borrador y se reutiliza en cada reintento. La "huella"
// resume lo que se envía (campos + fotos): si la persona cambia algo, el cuerpo es
// otro y se usa una clave nueva; si no cambió nada, se reutiliza la misma aunque haya
// salido de la pantalla y vuelto. Tras un éxito se olvida (nuevo borrador = nueva clave).

let actual: { huella: string; clave: string } | null = null;

export function generarClave(): string {
  const aleatorio = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const base =
    aleatorio ??
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const n = Math.floor(Math.random() * 16);
      return (c === "x" ? n : (n & 0x3) | 0x8).toString(16);
    });
  // UUID en su forma canónica (minúscula, con guiones): el contrato pide solo ≤ 80
  // caracteres, pero Listado valida UUID, así que esta forma sirve con ambos.
  return base.toLowerCase().slice(0, MAX_LARGO_CLAVE_IDEMPOTENCIA);
}

export function claveParaBorrador(huella: string): string {
  if (!actual || actual.huella !== huella) {
    actual = { huella, clave: generarClave() };
  }
  return actual.clave;
}

export function olvidarClaveBorrador(): void {
  actual = null;
}
