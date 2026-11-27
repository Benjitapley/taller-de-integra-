import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { ListaPaginada } from "@/services/listaPaginada";
import { consultar, pagina, type Resultado } from "@/services/roomiesApi";

export function usePagina<T>(ruta: string, validar: (v: unknown) => v is T, clave: keyof T, publica = false, historial = false) {
  const { sesion } = useAuth();
  const contexto = sesion?.access_token ?? "publico";
  const lista = useMemo(() => {
    void contexto;
    return new ListaPaginada<T>(cursor => pagina(ruta, validar, cursor, historial, publica), item => Number(item[clave]));
  }, [ruta, validar, clave, publica, historial, contexto]);
  const estado = useSyncExternalStore(lista.suscribir, lista.estado, lista.estado);
  const actualizar = useCallback(() => { lista.reiniciar(); void lista.cargar(); }, [lista]);
  useFocusEffect(useCallback(() => { actualizar(); return () => lista.reiniciar(); }, [actualizar, lista]));
  return { ...estado, cargar: lista.cargar, actualizar };
}

export function useConsulta<T>(ruta: string, validar: (v: unknown) => v is T, publica = false) {
  const { sesion } = useAuth();
  const contexto = `${sesion?.access_token ?? "publico"}:${ruta}`;
  const [intento, setIntento] = useState(0);
  const [valor, setValor] = useState<{ contexto: string; resultado: Resultado<T> | null }>({ contexto, resultado: null });
  useFocusEffect(useCallback(() => {
    void intento;
    let vigente = true;
    setValor({ contexto, resultado: null });
    if (!ruta) return () => { vigente = false; };
    void consultar(ruta, validar, { autenticada: !publica }).then(resultado => {
      if (vigente) setValor({ contexto, resultado });
    });
    return () => { vigente = false; };
  }, [ruta, validar, publica, contexto, intento]));
  return { resultado: valor.contexto === contexto ? valor.resultado : null, actualizar: () => setIntento(x => x + 1) };
}

/** Evita doble clic y descarta resultados de otra sesión o pantalla. */
export function useOperacion() {
  const { sesion } = useAuth();
  const contexto = useRef(sesion?.access_token);
  const token = sesion?.access_token;
  const version = useRef(0), bloqueo = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  useFocusEffect(useCallback(() => {
    contexto.current = token;
    bloqueo.current = false; setOcupado(false); setMensaje("");
    const referencia = version;
    return () => { referencia.current++; bloqueo.current = false; };
  }, [token]));
  async function ejecutar<T>(accion: () => Promise<Resultado<T>>, exito: (dato: T) => void) {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setMensaje("");
    const actor = contexto.current, turno = version.current;
    try {
      const resultado = await accion();
      if (actor !== contexto.current || turno !== version.current) return;
      if (resultado.exito) exito(resultado.datos); else setMensaje(resultado.error);
    } catch { if (turno === version.current) setMensaje("No pudimos completar la solicitud. Inténtalo nuevamente.");
    } finally { if (actor === contexto.current && turno === version.current) { bloqueo.current = false; setOcupado(false); } }
  }
  return { ocupado, mensaje, setMensaje, ejecutar };
}
