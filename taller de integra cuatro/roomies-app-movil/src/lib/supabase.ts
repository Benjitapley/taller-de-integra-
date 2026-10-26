import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform, type AppStateStatus } from "react-native";

let cliente: SupabaseClient | undefined;

/** Permite preparar el SDK antes de configurar el proyecto de pruebas o TI2. */
export function estaSupabaseConfigurado(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim(),
  );
}

/** M4-A02: una sola instancia compartida por todos los servicios de la app. */
export function getSupabaseClient(): SupabaseClient {
  if (cliente) return cliente;

  // Expo necesita referencias estáticas con process.env.NOMBRE para incluirlas.
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const clave = process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim();

  if (!url || !clave) {
    throw new Error(
      "Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_KEY en .env.local.",
    );
  }

  let protocolo: string;
  try {
    protocolo = new URL(url).protocol;
  } catch {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL debe ser una URL válida.");
  }
  if (protocolo !== "https:" && protocolo !== "http:") {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL debe usar HTTP o HTTPS.");
  }
  if (!clave.startsWith("sb_publishable_")) {
    throw new Error(
      "Usa la clave publishable de Supabase (sb_publishable_). Las claves secretas no pertenecen a la app móvil.",
    );
  }

  cliente = createClient(url, clave, {
    auth: {
      ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // /auth/callback procesa explícitamente los tokens del enlace de registro.
      flowType: "implicit",
    },
  });

  return cliente;
}

/**
 * En móvil, renueva tokens mientras la app está activa y libera la suscripción
 * al desmontar el layout. El SDK administra este ciclo automáticamente en web.
 * Esto prepara la persistencia del SDK; la restauración de la UI es M4-A06.
 */
export function iniciarCicloSesionSupabase(): () => void {
  if (!estaSupabaseConfigurado()) return () => {};

  const supabase = getSupabaseClient();
  if (Platform.OS === "web") return () => {};

  const sincronizar = (estado: AppStateStatus | null) => {
    if (estado === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  };

  sincronizar(AppState.currentState);
  const suscripcion = AppState.addEventListener("change", sincronizar);

  return () => {
    suscripcion.remove();
    supabase.auth.stopAutoRefresh();
  };
}
