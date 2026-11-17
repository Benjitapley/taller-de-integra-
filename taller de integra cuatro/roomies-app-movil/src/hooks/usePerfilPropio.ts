import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { consultarPerfilPropio, type ResultadoPerfilPropio } from "@/services/usuariosService";
import type { PerfilPropioVista } from "@/types/Usuario";

export type EstadoPerfilPropio =
  | { tipo: "cargando" }
  | { tipo: "resultado"; resultado: ResultadoPerfilPropio };

export function usePerfilPropio() {
  const { usuarioActual, provisionPerfil, reintentarProvisionPerfil } = useAuth();
  const identidadId = usuarioActual?.identidad.id ?? null;
  const perfilPreparado = provisionPerfil?.exito === true;
  const [intento, setIntento] = useState(0);
  const [consulta, setConsulta] = useState<{
    identidadId: string | null;
    intento: number;
    estado: EstadoPerfilPropio;
  }>({ identidadId: null, intento: 0, estado: { tipo: "cargando" } });

  useFocusEffect(useCallback(() => {
    if (!identidadId || !perfilPreparado) return;
    let vigente = true;
    setConsulta({ identidadId, intento, estado: { tipo: "cargando" } });

    async function cargar() {
      let resultado: ResultadoPerfilPropio;
      try {
        resultado = await consultarPerfilPropio(undefined, identidadId ?? undefined);
      } catch {
        resultado = { exito: false, codigo: "red", error: "No pudimos consultar tu perfil. Inténtalo otra vez." };
      }
      if (vigente) setConsulta({ identidadId, intento, estado: { tipo: "resultado", resultado } });
    }

    void cargar();
    // Descarta resultados después de salir de Perfil, reintentar o cambiar de cuenta.
    return () => { vigente = false; };
  }, [identidadId, intento, perfilPreparado]));

  // Nunca mostrar el perfil anterior durante el render de un cambio de identidad.
  const estado: EstadoPerfilPropio = provisionPerfil && !provisionPerfil.exito
    ? { tipo: "resultado", resultado: provisionPerfil }
    : perfilPreparado && consulta.identidadId === identidadId && consulta.intento === intento
    ? consulta.estado
    : { tipo: "cargando" };

  const reintentar = useCallback(() => {
    if (perfilPreparado) setIntento((valor) => valor + 1);
    else reintentarProvisionPerfil();
  }, [perfilPreparado, reintentarProvisionPerfil]);
  const reflejarPerfilGuardado = useCallback((perfil: PerfilPropioVista) => {
    setConsulta((actual) => actual.identidadId === identidadId && actual.intento === intento
      ? { identidadId, intento, estado: { tipo: "resultado", resultado: { exito: true, perfil } } }
      : actual);
  }, [identidadId, intento]);
  return { estado, reintentar, reflejarPerfilGuardado };
}
