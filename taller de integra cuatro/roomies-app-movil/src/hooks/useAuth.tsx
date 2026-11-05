import * as Linking from "expo-linking";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { estaSupabaseConfigurado, getSupabaseClient } from "@/lib/supabase";
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
  restaurandoSesion: boolean;
  errorRestauracion: string | null;
  reintentarRestauracion: () => void;
  iniciarSesion: (email: string, password: string) => Promise<ResultadoInicioSesion>;
  registrarCuenta: (datos: DatosRegistro) => Promise<ResultadoRegistro>;
  confirmarRegistro: (enlace: string) => Promise<ResultadoConfirmacion>;
  cerrarSesion: () => Promise<ResultadoCierreSesion>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionSupabase | null>(null);
  const [restaurandoSesion, setRestaurandoSesion] = useState(true);
  const [errorRestauracion, setErrorRestauracion] = useState<string | null>(null);
  const [intentoRestauracion, setIntentoRestauracion] = useState(0);

  useEffect(() => {
    let vigente = true;
    let sesionActualizadaPorEvento = false;
    let desuscribir = () => {};

    async function recuperarSesion() {
      try {
        if (!estaSupabaseConfigurado()) {
          if (vigente) setSesion(null);
          return;
        }

        const supabase = getSupabaseClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (evento, nuevaSesion) => {
            if (!vigente || evento === "INITIAL_SESSION") return;
            // Callback síncrono: no llamar métodos de Auth desde esta notificación.
            sesionActualizadaPorEvento = true;
            setSesion(nuevaSesion);
            setErrorRestauracion(null);
            setRestaurandoSesion(false);
          },
        );
        desuscribir = () => subscription.unsubscribe();

        // La lectura inicial permite distinguir un error de una sesión inexistente.
        // INITIAL_SESSION se ignora porque no proporciona el error de recuperación.
        const { data, error } = await supabase.auth.getSession();
        if (!vigente || sesionActualizadaPorEvento) return;
        if (error) throw error;
        setSesion(data.session);
        setErrorRestauracion(null);
      } catch {
        if (!vigente || sesionActualizadaPorEvento) return;
        setSesion(null);
        setErrorRestauracion("No pudimos recuperar tu sesión. Revisa tu conexión y vuelve a intentarlo.");
      } finally {
        // Un login/logout o una renovación posterior tienen prioridad sobre la lectura inicial.
        if (vigente && !sesionActualizadaPorEvento) setRestaurandoSesion(false);
      }
    }

    void recuperarSesion();
    return () => {
      vigente = false;
      desuscribir();
    };
  }, [intentoRestauracion]);

  const reintentarRestauracion = useCallback(() => {
    setErrorRestauracion(null);
    setRestaurandoSesion(true);
    setIntentoRestauracion((intento) => intento + 1);
  }, []);

  // El servicio ejecuta la operación; la suscripción refleja la sesión del SDK.
  const iniciarSesion = useCallback(
    (email: string, password: string) => iniciarSesionSupabase(email, password),
    [],
  );

  const registrarCuenta = useCallback(
    (datos: DatosRegistro) => registrarCuentaSupabase(datos, Linking.createURL("/auth/callback")),
    [],
  );

  const confirmarRegistro = useCallback(
    (enlace: string) => confirmarRegistroSupabase(enlace),
    [],
  );

  const cerrarSesion = useCallback(() => cerrarSesionSupabase(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      sesion,
      usuarioActual: sesion ? { identidad: sesion.user, perfil: null } : null,
      estaAutenticado: sesion !== null,
      restaurandoSesion,
      errorRestauracion,
      reintentarRestauracion,
      iniciarSesion,
      registrarCuenta,
      confirmarRegistro,
      cerrarSesion,
    }),
    [
      sesion,
      restaurandoSesion,
      errorRestauracion,
      reintentarRestauracion,
      iniciarSesion,
      registrarCuenta,
      confirmarRegistro,
      cerrarSesion,
    ],
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
