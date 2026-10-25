import type { RegistroRequest, VerificacionRequest } from "./contracts";

export type AuthMode = "login" | "register";
export type AuthFieldName = "nombre" | "correo" | "contrasena" | "fecha_nacimiento";
export type AuthValues = RegistroRequest;
export type AuthErrors = Partial<Record<AuthFieldName, string>>;

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return "Ingresa tu correo electrónico.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Ingresa un correo electrónico válido.";
}

export type VerificationAction = "verify" | "resend";
export type VerificationErrors = Partial<Record<keyof VerificacionRequest, string>>;

export function validateVerification(values: VerificacionRequest, action: VerificationAction = "verify"): VerificationErrors {
  const errors: VerificationErrors = {};
  const emailError = validateEmail(values.correo);
  if (emailError) errors.correo = emailError;
  if (action === "verify") {
    if (!values.codigo) errors.codigo = "Ingresa el código de verificación.";
    else if (values.codigo.length !== 6 || !/^[0-9]{6}$/.test(values.codigo)) errors.codigo = "Ingresa exactamente 6 dígitos, sin espacios ni letras.";
  }
  return errors;
}

// Calendario local: no convertir la fecha de nacimiento a UTC ni usar Date.parse,
// que normaliza fechas inexistentes como el 31 de febrero.
export function validateAuth(mode: AuthMode, values: AuthValues, today = new Date()): AuthErrors {
  const errors: AuthErrors = {};
  if (mode === "register" && !values.nombre.trim()) errors.nombre = "Ingresa tu nombre completo.";
  const emailError = validateEmail(values.correo);
  if (emailError) errors.correo = emailError;

  // La contraseña se conserva exactamente como se escribe, incluidos espacios.
  if (!values.contrasena) errors.contrasena = "Ingresa tu contraseña.";
  else if (mode === "register" && values.contrasena.length < 6) errors.contrasena = "Usa al menos 6 caracteres en la contraseña.";

  if (mode === "register") {
    const raw = values.fecha_nacimiento;
    if (!raw) errors.fecha_nacimiento = "Ingresa tu fecha de nacimiento.";
    else {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
      const [year, month, day] = match ? match.slice(1).map(Number) : [0, 0, 0];
      const birth = new Date(0);
      birth.setFullYear(year, month - 1, day);
      birth.setHours(0, 0, 0, 0);
      if (!match || year < 1 || birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) {
        errors.fecha_nacimiento = "Ingresa una fecha de nacimiento válida.";
      } else {
        const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const birthdayPending = today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day);
        const age = today.getFullYear() - year - Number(birthdayPending);
        if (birth > current) errors.fecha_nacimiento = "La fecha de nacimiento no puede ser futura.";
        else if (age < 18) errors.fecha_nacimiento = "Debes tener al menos 18 años para registrarte.";
      }
    }
  }
  return errors;
}
