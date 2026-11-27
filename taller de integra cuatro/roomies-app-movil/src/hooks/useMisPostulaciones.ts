import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { ListaPaginada } from "@/services/listaPaginada";
import { obtenerMisPostulaciones, type ResultadoMisPostulaciones } from "@/services/postulacionesService";

export function useMisPostulaciones(
  obtener: (cursor?: string) => Promise<ResultadoMisPostulaciones> = obtenerMisPostulaciones,
) {
  const { sesion } = useAuth();
  const identidad = sesion?.access_token;
  const lista = useMemo(() => {
    // Nueva instancia por sesión: no reutilizar filas ni respuestas de otra cuenta.
    void identidad;
    return new ListaPaginada(obtener, item => item.idPostulacion);
  }, [obtener, identidad]);
  const pagina = useSyncExternalStore(lista.suscribir, lista.estado, lista.estado);
  useFocusEffect(useCallback(() => {
    lista.reiniciar();
    if (identidad) void lista.cargar();
    return () => lista.reiniciar();
  }, [lista, identidad]));
  const estado = !identidad || (!pagina.iniciada && pagina.error) ? "error" : !pagina.iniciada ? "cargando" : "listo";
  return { estado, postulaciones: pagina.items, error: pagina.error,
    reintentar: lista.cargar, cargarMas: lista.cargar, cargandoMas: pagina.cargando,
    hayMas: pagina.cursor !== null };
}
