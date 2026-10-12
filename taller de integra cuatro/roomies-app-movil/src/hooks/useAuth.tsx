import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { UsuarioPerfil } from "@/types/Usuario";
import { credencialesMock } from "@/mocks/auth";

interface AuthContextValue {
  usuario: UsuarioPerfil | null;
  estaAutenticado: boolean;
  iniciarSesion: (email: string, password: string) => Promise<boolean>;
  registrarCuenta: (datos: {
    nombre: string;
    email: string;
    password: string;
    fechaNacimiento: string;
  }) => Promise<boolean>;
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioPerfil | null>(null);
  const [credenciales, setCredenciales] = useState(credencialesMock);

  async function iniciarSesion(email: string, password: string) {
    const credencial = credenciales.find(
      (item) =>
        item.usuario.email.toLowerCase() === email.trim().toLowerCase() &&
        item.password === password,
    );

    if (!credencial) {
      return false;
    }

    setUsuario(credencial.usuario);
    return true;
  }

  async function registrarCuenta(datos: {
    nombre: string;
    email: string;
    password: string;
    fechaNacimiento: string;
  }) {
    const correoExiste = credenciales.some(
      (item) => item.usuario.email.toLowerCase() === datos.email.trim().toLowerCase(),
    );

    if (correoExiste) {
      return false;
    }

    const nuevoUsuario: UsuarioPerfil = {
      idUsuario: Date.now(),
      rol: "Usuario",
      nombre: datos.nombre.trim(),
      email: datos.email.trim(),
      fechaNacimiento: datos.fechaNacimiento,
      estadoVerificacion: "Pendiente",
      presupuesto: 0,
      zonaInteres: "",
      ocupacion: "Estudiante",
      fotoPerfilUrl: undefined,
      calificacionPromedio: undefined,
      cantidadEvaluaciones: 0,
    };

    setCredenciales((actuales) => [
      ...actuales,
      { usuario: nuevoUsuario, password: datos.password },
    ]);
    setUsuario(nuevoUsuario);
    return true;
  }

  function cerrarSesion() {
    setUsuario(null);
  }

  const value = useMemo(
    () => ({
      usuario,
      estaAutenticado: usuario !== null,
      iniciarSesion,
      registrarCuenta,
      cerrarSesion,
    }),
    [usuario],
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
