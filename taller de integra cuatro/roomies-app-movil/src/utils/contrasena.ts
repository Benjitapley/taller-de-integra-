// Mantener esta política alineada con Authentication > Sign In / Providers > Email.
export const REQUISITOS_CONTRASENA =
  "Usa al menos 6 caracteres, una minúscula, una mayúscula, un número y un símbolo (por ejemplo, !, @ o #).";

// Símbolos admitidos por la política de Supabase; un espacio no es un símbolo.
const SIMBOLOS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

export function validarContrasena(password: string): string | null {
  if (
    Array.from(password).length < 6 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !Array.from(password).some((caracter) => SIMBOLOS.includes(caracter))
  ) {
    return REQUISITOS_CONTRASENA;
  }

  return null;
}
