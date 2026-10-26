import * as Linking from "expo-linking";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { estaSupabaseConfigurado, getSupabaseClient } from "@/lib/supabase";
import { confirmarRegistroSupabase, registrarCuentaSupabase } from "@/services/authService";
import type {
  DatosRegistro,
  ResultadoConfirmacion,
  ResultadoRegistro,
  SesionSupabase,
  UsuarioActual,
} from "@/types/Auth";
import type { UsuarioPerfil } from "@/types/Usuario";
import { credencialesMock } from "@/mocks/auth";

interface AuthContextValue {
  /** Perfil del login de demostración; se retirará al integrar M4-A05. */
  usuario: UsuarioPerfil | null;
  sesion: SesionSupabase | null;
  usuarioActual: UsuarioActual | null;
  estaAutenticado: boolean;
  iniciarSesion: (email: string, password: string) => Promise<boolean>;
  registrarCuenta: (datos: DatosRegistro) => Promise<ResultadoRegistro>;
  confirmarRegistro: (enlace: string) => Promise<ResultadoConfirmacion>;
  cerrarSesion: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioPerfil | null>(null);
  const [sesion, setSesion] = useState<SesionSupabase | null>(null);

  // M4-A05 reemplazará este login. El registro real nunca añade contraseñas al mock.
  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const credencial = credencialesMock.find(
      (item) =>
        item.usuario.email.toLowerCase() === email.trim().toLowerCase() &&
        item.password === password,
    );

    if (!credencial) {
      return false;
    }

    setUsuario(credencial.usuario);
    return true;
  }, []);

  const registrarCuenta = useCallback(async (datos: DatosRegistro) => {
    const resultado = await registrarCuentaSupabase(datos, Linking.createURL("/auth/callback"));
    if (resultado.exito) {
      setUsuario(null);
      setSesion(resultado.estado === "sesion_iniciada" ? resultado.sesion : null);
    }
    return resultado;
  }, []);

  const confirmarRegistro = useCallback(async (enlace: string) => {
    const resultado = await confirmarRegistroSupabase(enlace);
    if (resultado.exito) {
      setUsuario(null);
      setSesion(resultado.sesion);
    }
    return resultado;
  }, []);

  // Permite cerrar también una sesión obtenida desde el enlace de registro.
  const cerrarSesion = useCallback(async () => {
    try {
      if (estaSupabaseConfigurado()) {
        const { error } = await getSupabaseClient().auth.signOut();
        if (error) return false;
      }
      setSesion(null);
      setUsuario(null);
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({
      usuario,
      sesion,
      usuarioActual: sesion ? { identidad: sesion.user, perfil: null } : null,
      estaAutenticado: sesion !== null || usuario !== null,
      iniciarSesion,
      registrarCuenta,
      confirmarRegistro,
      cerrarSesion,
    }),
    [usuario, sesion, iniciarSesion, registrarCuenta, confirmarRegistro, cerrarSesion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe utilizarse dentro de AuthProvider");
  }

  return context;
}
