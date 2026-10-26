import { isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  DatosRegistro,
  ResultadoConfirmacion,
  ResultadoRegistro,
} from "@/types/Auth";
import { REQUISITOS_CONTRASENA, validarContrasena } from "@/utils/contrasena";
import { validarFechaNacimiento } from "@/utils/fechaNacimiento";

/** Solo traduce errores conocidos; evita mostrar detalles internos del servidor. */
function mensajeErrorRegistro(error: unknown): string {
  if (isAuthError(error)) {
    if (error.message.includes("ROOMIES_EDAD_MINIMA")) {
      return "Debes tener al menos 18 años para crear una cuenta.";
    }
    if (error.message.includes("ROOMIES_FECHA_NACIMIENTO_INVALIDA")) {
      return "Revisa tu fecha de nacimiento: debe ser una fecha válida y no futura.";
    }

    switch (error.code) {
      case "weak_password":
        return `La contraseña no cumple la política del servicio. ${REQUISITOS_CONTRASENA} Si ya cumple esas condiciones, prueba con una contraseña más larga y difícil de adivinar.`;
      case "email_address_invalid":
      case "validation_failed":
        return "Revisa el correo y los datos del registro.";
      case "email_address_not_authorized":
        return "El servicio de correo de este entorno solo permite direcciones autorizadas por el equipo. Usa una de ellas o configura el envío de correos.";
      case "over_email_send_rate_limit":
      case "over_request_rate_limit":
        return "Se alcanzó el límite de intentos o de correos. Espera un momento antes de volver a intentarlo.";
      case "email_exists":
      case "user_already_exists":
        return "No se pudo completar el registro con esos datos. Si ya tienes cuenta, inicia sesión.";
      case "signup_disabled":
      case "email_provider_disabled":
        return "El registro por correo no está habilitado en este momento.";
    }
  }

  if (isAuthRetryableFetchError(error) || error instanceof TypeError) {
    return "No pudimos comunicarnos con el servicio. Revisa tu conexión e inténtalo otra vez.";
  }

  return "No pudimos completar el registro. Inténtalo nuevamente; si persiste, revisa la configuración del servicio.";
}

/** M4-A04: registra una identidad; el perfil Roomies se obtendrá desde TI2. */
export async function registrarCuentaSupabase(
  datos: DatosRegistro,
  emailRedirectTo: string,
): Promise<ResultadoRegistro> {
  if (!datos.nombre.trim() || !datos.email.trim()) {
    return { exito: false, error: "Completa todos los campos." };
  }

  const fecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datos.fechaNacimiento);
  const validacionFecha = validarFechaNacimiento(
    fecha ? `${fecha[3]}/${fecha[2]}/${fecha[1]}` : "",
  );
  if (!validacionFecha.valido) {
    return { exito: false, error: validacionFecha.error };
  }
  const errorPassword = validarContrasena(datos.password);
  if (errorPassword) return { exito: false, error: errorPassword };

  try {
    const { data, error } = await getSupabaseClient().auth.signUp({
      email: datos.email.trim().toLowerCase(),
      password: datos.password,
      options: {
        emailRedirectTo,
        data: {
          nombre: datos.nombre.trim(),
          fecha_nacimiento: validacionFecha.fechaISO,
        },
      },
    });

    if (error) return { exito: false, error: mensajeErrorRegistro(error) };
    if (data.session) {
      return { exito: true, estado: "sesion_iniciada", sesion: data.session };
    }
    if (!data.user) {
      return { exito: false, error: "El servicio no entregó un resultado de registro. Vuelve a intentarlo." };
    }

    // Supabase puede ocultar si ya existe la cuenta. No asegurar que se creó
    // una nueva ni que llegó un correo solo porque signUp no devolvió error.
    return { exito: true, estado: "confirmacion_pendiente" };
  } catch (error) {
    return { exito: false, error: mensajeErrorRegistro(error) };
  }
}

/** Procesa el enlace de confirmación del flujo implícito configurado en el SDK. */
export async function confirmarRegistroSupabase(enlace: string): Promise<ResultadoConfirmacion> {
  try {
    const url = new URL(enlace);
    const parametros = new URLSearchParams(url.hash.slice(1));
    const errorEnlace = parametros.get("error") ?? url.searchParams.get("error");
    if (errorEnlace) {
      return { exito: false, error: "El enlace de confirmación venció o ya fue utilizado. Intenta iniciar sesión si ya confirmaste tu correo." };
    }

    const tipo = parametros.get("type");
    const accessToken = parametros.get("access_token");
    const refreshToken = parametros.get("refresh_token");
    if (!accessToken || !refreshToken || tipo !== "signup") {
      return { exito: false, error: "Este enlace no contiene una confirmación de registro válida. Abre el enlace completo que recibiste por correo." };
    }

    const supabase = getSupabaseClient();
    // Verificar el usuario con el proveedor antes de guardar los tokens.
    const { data: identidad, error: errorIdentidad } = await supabase.auth.getUser(accessToken);
    if (errorIdentidad || !identidad.user?.email_confirmed_at) {
      return { exito: false, error: "No pudimos verificar la confirmación. Intenta iniciar sesión si ya confirmaste tu correo." };
    }
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error || !data.session) {
      return { exito: false, error: "Tu correo puede estar confirmado, pero no pudimos iniciar la sesión. Intenta iniciar sesión de nuevo." };
    }
    return { exito: true, sesion: data.session };
  } catch {
    return { exito: false, error: "No pudimos procesar la confirmación. Revisa tu conexión y abre otra vez el enlace del correo." };
  }
}
