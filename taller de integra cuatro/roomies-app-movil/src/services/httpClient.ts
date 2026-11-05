import { estaSupabaseConfigurado, getSupabaseClient } from "@/lib/supabase";
import type { CodigoErrorHttp, ErrorHttp, OpcionesPeticionHttp, ResultadoHttp } from "@/types/Http";

function fallo(codigo: CodigoErrorHttp, error: string, estadoHttp?: number): ErrorHttp {
  return { exito: false, codigo, error, ...(estadoHttp === undefined ? {} : { estadoHttp }) };
}

function falloRespuesta(estadoHttp: number): ErrorHttp {
  if (estadoHttp === 401) {
    return fallo("no_autorizado", "El servicio no aceptó tu sesión.", estadoHttp);
  }
  if (estadoHttp === 403) {
    return fallo("sin_permiso", "No tienes permiso para realizar esta acción.", estadoHttp);
  }
  const mensaje = estadoHttp === 404
    ? "No se encontró el recurso solicitado."
    : estadoHttp === 400 || estadoHttp === 422
      ? "Revisa los datos que enviaste."
      : estadoHttp === 429
        ? "Se alcanzó el límite de solicitudes. Espera un momento e inténtalo otra vez."
        : "No pudimos completar la solicitud. Inténtalo más tarde.";
  // No propagar cuerpos de error que puedan contener datos internos o sensibles.
  return fallo("http", mensaje, estadoHttp);
}

/**
 * M4-A07: cliente JSON para la API de TI2. El SDK administra los tokens;
 * este módulo los obtiene para cada petición, sin guardarlos ni registrarlos.
 * Los adaptadores de cada recurso deben validar la forma de `datos` (unknown).
 */
export async function solicitarJson(
  ruta: string,
  opciones: OpcionesPeticionHttp = {},
): Promise<ResultadoHttp> {
  let base: URL;
  try {
    // Referencia estática necesaria para que Expo incluya el valor por entorno.
    const configuracion = process.env.EXPO_PUBLIC_API_URL?.trim();
    if (!configuracion) throw new Error();
    base = new URL(configuracion);
    if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
      throw new Error();
    }
    base.pathname = `${base.pathname.replace(/\/+$/, "")}/`;
  } catch {
    return fallo("configuracion", "La conexión con el servicio todavía no está configurada correctamente.");
  }

  let url: URL;
  try {
    // Solo rutas de esta API: no aceptar URLs externas para enviarles el Bearer.
    if (!ruta.startsWith("/") || ruta.startsWith("//") || ruta.includes("\\")) throw new Error();
    url = new URL(ruta.slice(1), base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.hash) throw new Error();
  } catch {
    return fallo("peticion_invalida", "La ruta de la solicitud no es válida.");
  }

  const metodo = opciones.metodo ?? "GET";
  const tiempoLimiteMs = opciones.tiempoLimiteMs ?? 15000;
  if (!Number.isFinite(tiempoLimiteMs) || tiempoLimiteMs <= 0) {
    return fallo("peticion_invalida", "El tiempo de espera de la solicitud no es válido.");
  }

  let cuerpo: string | undefined;
  if (opciones.cuerpo !== undefined) {
    if (metodo === "GET") return fallo("peticion_invalida", "Una consulta GET no admite cuerpo.");
    try {
      cuerpo = JSON.stringify(opciones.cuerpo);
      if (cuerpo === undefined) throw new Error();
    } catch {
      return fallo("peticion_invalida", "Los datos de la solicitud no tienen un formato válido.");
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (cuerpo !== undefined) headers["Content-Type"] = "application/json";
  if (opciones.autenticada !== false) {
    if (!estaSupabaseConfigurado()) {
      return fallo("configuracion", "La autenticación todavía no está configurada correctamente.");
    }
    try {
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) return fallo("sesion_no_disponible", "No pudimos comprobar tu sesión. Inténtalo otra vez.");
      const token = data.session?.access_token;
      if (!token) return fallo("sin_sesion", "Inicia sesión para continuar.");
      headers.Authorization = `Bearer ${token}`;
    } catch {
      return fallo("sesion_no_disponible", "No pudimos comprobar tu sesión. Inténtalo otra vez.");
    }
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), tiempoLimiteMs);
  try {
    const respuesta = await fetch(url.href, {
      method: metodo,
      headers,
      body: cuerpo,
      signal: controlador.signal,
      credentials: "omit",
    });
    if (!respuesta.ok) return falloRespuesta(respuesta.status);
    if (respuesta.status === 204) return { exito: true, datos: null, estadoHttp: 204 };
    try {
      const datos: unknown = await respuesta.json();
      return { exito: true, datos, estadoHttp: respuesta.status };
    } catch {
      if (controlador.signal.aborted) return fallo("tiempo_agotado", "El servicio tardó demasiado en responder. Inténtalo otra vez.");
      return fallo("respuesta_invalida", "El servicio devolvió una respuesta que no pudimos interpretar.", respuesta.status);
    }
  } catch {
    return controlador.signal.aborted
      ? fallo("tiempo_agotado", "El servicio tardó demasiado en responder. Inténtalo otra vez.")
      : fallo("red", "No pudimos conectar con el servicio. Revisa tu conexión e inténtalo otra vez.");
  } finally {
    clearTimeout(temporizador);
  }
}
