import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { consultarPerfilPropio, type ResultadoPerfilPropio } from "@/services/usuariosService";

export type EstadoPerfilPropio =
  | { tipo: "cargando" }
  | { tipo: "resultado"; resultado: ResultadoPerfilPropio };

export function usePerfilPropio() {
  const { usuarioActual } = useAuth();
  const identidadId = usuarioActual?.identidad.id ?? null;
  const [intento, setIntento] = useState(0);
  const [consulta, setConsulta] = useState<{
    identidadId: string | null;
    intento: number;
    estado: EstadoPerfilPropio;
  }>({ identidadId: null, intento: 0, estado: { tipo: "cargando" } });

  useFocusEffect(useCallback(() => {
    let vigente = true;
    setConsulta({ identidadId, intento, estado: { tipo: "cargando" } });

    async function cargar() {
      let resultado: ResultadoPerfilPropio;
      try {
        resultado = identidadId
          ? await consultarPerfilPropio()
          : { exito: false, codigo: "sin_sesion", error: "Inicia sesión para consultar tu perfil." };
      } catch {
        resultado = { exito: false, codigo: "red", error: "No pudimos consultar tu perfil. Inténtalo otra vez." };
      }
      if (vigente) setConsulta({ identidadId, intento, estado: { tipo: "resultado", resultado } });
    }

    void cargar();
    // Descarta resultados después de salir de Perfil, reintentar o cambiar de cuenta.
    return () => { vigente = false; };
  }, [identidadId, intento]));

  // Nunca mostrar el perfil anterior durante el render de un cambio de identidad.
  const estado: EstadoPerfilPropio = consulta.identidadId === identidadId && consulta.intento === intento
    ? consulta.estado
    : { tipo: "cargando" };

  const reintentar = useCallback(() => setIntento((valor) => valor + 1), []);
  return { estado, reintentar };
}
