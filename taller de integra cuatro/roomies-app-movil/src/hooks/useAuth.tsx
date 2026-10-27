import * as Linking from "expo-linking";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  cerrarSesionSupabase,
  confirmarRegistroSupabase,
  iniciarSesionSupabase,
  registrarCuentaSupabase,
} from "@/services/authService";
import type {
  DatosRegistro,
  ResultadoCierreSesion,
  ResultadoConfirmacion,
  ResultadoInicioSesion,
  ResultadoRegistro,
  SesionSupabase,
  UsuarioActual,
} from "@/types/Auth";

interface AuthContextValue {
  sesion: SesionSupabase | null;
  usuarioActual: UsuarioActual | null;
  estaAutenticado: boolean;
  iniciarSesion: (email: string, password: string) => Promise<ResultadoInicioSesion>;
  registrarCuenta: (datos: DatosRegistro) => Promise<ResultadoRegistro>;
  confirmarRegistro: (enlace: string) => Promise<ResultadoConfirmacion>;
  cerrarSesion: () => Promise<ResultadoCierreSesion>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionSupabase | null>(null);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const resultado = await iniciarSesionSupabase(email, password);
    if (resultado.exito) setSesion(resultado.sesion);
    return resultado;
  }, []);

  const registrarCuenta = useCallback(async (datos: DatosRegistro) => {
    const resultado = await registrarCuentaSupabase(datos, Linking.createURL("/auth/callback"));
    if (resultado.exito) {
      setSesion(resultado.estado === "sesion_iniciada" ? resultado.sesion : null);
    }
    return resultado;
  }, []);

  const confirmarRegistro = useCallback(async (enlace: string) => {
    const resultado = await confirmarRegistroSupabase(enlace);
    if (resultado.exito) {
      setSesion(resultado.sesion);
    }
    return resultado;
  }, []);

  const cerrarSesion = useCallback(async () => {
    const resultado = await cerrarSesionSupabase();
    if (resultado.exito || resultado.sesionLocalCerrada) {
      setSesion(null);
    }
    return resultado;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      sesion,
      usuarioActual: sesion ? { identidad: sesion.user, perfil: null } : null,
      estaAutenticado: sesion !== null,
      iniciarSesion,
      registrarCuenta,
      confirmarRegistro,
      cerrarSesion,
    }),
    [sesion, iniciarSesion, registrarCuenta, confirmarRegistro, cerrarSesion],
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
