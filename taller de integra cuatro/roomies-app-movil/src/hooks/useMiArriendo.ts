import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { consultarMiArriendo } from "@/services/arriendosService";
import { crearAlmacenMiArriendo, estadoVisibleMiArriendo } from "@/stores/miArriendo";


export function useMiArriendo() {
  const { usuarioActual, provisionPerfil, reintentarProvisionPerfil } = useAuth();
  const identidadId = usuarioActual?.identidad.id ?? null;
  const perfilPreparado = provisionPerfil?.exito === true;
  const contexto = useMemo(() => ({
    identidadId,
    // La consulta viaja atada a la cuenta (identidadEsperada): si la sesión cambia en medio, no se envía.
    almacen: crearAlmacenMiArriendo(identidadId ? () => consultarMiArriendo(undefined, identidadId) : undefined),
  }), [identidadId]);
  const { almacen } = contexto;

  const estadoAlmacen = useSyncExternalStore(almacen.suscribir, almacen.obtenerEstado, almacen.obtenerEstado);

  useFocusEffect(useCallback(() => {
    if (!perfilPreparado) return;
    void almacen.recargar();
    // Al salir de la pantalla o cambiar de cuenta, la respuesta en vuelo se descarta.
    return () => almacen.invalidar();
  }, [almacen, perfilPreparado]));

  const estado = estadoVisibleMiArriendo(provisionPerfil, estadoAlmacen);

  const reintentar = useCallback(() => {
    if (perfilPreparado) void almacen.recargar({ mostrarCarga: true });
    else reintentarProvisionPerfil();
  }, [almacen, perfilPreparado, reintentarProvisionPerfil]);

  return { estado, reintentar };
}
