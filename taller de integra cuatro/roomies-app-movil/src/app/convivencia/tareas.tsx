import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import AccesoArriendo from "@/components/convivencia/AccesoArriendo";
import { completarTarea, listarTareas, obtenerArriendoActual, type EstadoTarea, type PaginaTareas } from "@/services/tareasService";

export default function TareasProtegidas() {
  return <AccesoArriendo><TareasConvivencia /></AccesoArriendo>;
}
function TareasConvivencia() {
  const { sesion } = useAuth();
  const actor = sesion?.user.id;
  const credencial = sesion?.access_token;
  const [arriendo, setArriendo] = useState<number | null>(null);
  const [estado, setEstado] = useState<EstadoTarea>("Pendiente");
  const [pagina, setPagina] = useState<PaginaTareas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const peticion = useRef(0);
  const contexto = useRef(0);
  const enCurso = useRef<number | null>(null);
  const intento = useRef<{ filtro: EstadoTarea; id?: number; cursor?: string }>({ filtro: "Pendiente" });

  const cargar = useCallback(async (filtro: EstadoTarea, idArriendo?: number, cursor?: string) => {
    if (enCurso.current !== null) return;
    const actual = ++peticion.current;
    enCurso.current = actual;
    intento.current = { filtro, id: idArriendo, cursor };
    setCargando(true); setError("");
    const rental = idArriendo;
    const rentalResult = rental ? { exito: true as const, datos: rental } : await obtenerArriendoActual();
    if (actual !== peticion.current) return;
    if (!rentalResult.exito) {
      setPagina(null); setArriendo(null); setError(rentalResult.error); setCargando(false); enCurso.current = null;
      return;
    }
    const id = rentalResult.datos;
    setArriendo(id);
    const resultado = await listarTareas(id, filtro, cursor);
    if (actual !== peticion.current) return;
    if (!resultado.exito) {
      if ([401, 403, 404].includes(resultado.estadoHttp ?? 0)) { setPagina(null); setArriendo(null); }
      setError(resultado.error); setCargando(false); enCurso.current = null;
      return;
    }
    setPagina(anterior => ({ ...resultado.datos,
      items: cursor && anterior ? [...new Map([...anterior.items, ...resultado.datos.items].map(tarea => [tarea.id_tarea, tarea])).values()] : resultado.datos.items }));
    setCargando(false);
    enCurso.current = null;
  }, []);

  useFocusEffect(useCallback(() => {
    contexto.current++;
    enCurso.current = null;
    setPagina(null); setArriendo(null); setMensaje(""); setGuardando(false);
    if (actor && credencial) void cargar(estado);
    else { setCargando(false); setError("Inicia sesión nuevamente."); }
    const referencia = peticion;
    const contextoActual = contexto;
    return () => { referencia.current++; contextoActual.current++; enCurso.current = null; };
  }, [cargar, estado, actor, credencial]));

  function filtrar(nuevo: EstadoTarea) {
    if (nuevo === estado) return;
    setEstado(nuevo); setPagina(null); setMensaje("");
  }

  async function completar(id: number) {
    if (guardando || cargando || !arriendo) return;
    const actual = contexto.current;
    setGuardando(true); setError(""); setMensaje("");
    const resultado = await completarTarea(id);
    if (actual !== contexto.current) return;
    if (!resultado.exito) {
      if (resultado.estadoHttp === 401) { setPagina(null); setArriendo(null); }
      // Un 403 puede ser una baja reciente: volver a comprobar la pertenencia.
      if (resultado.estadoHttp === 403) await cargar(estado);
      if (actual === contexto.current) setError(resultado.error);
    } else {
      setMensaje("Tarea completada y guardada.");
      await cargar(estado, arriendo);
    }
    if (actual === contexto.current) setGuardando(false);
  }

  return <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenedor}>
    <Text style={styles.subtitulo}>Organiza las tareas con los integrantes de tu arriendo.</Text>
    {arriendo && <Pressable accessibilityRole="button" style={styles.boton} onPress={() => router.push("/convivencia/formulario")}><Text style={styles.botonTexto}>Crear tarea</Text></Pressable>}
    <View style={styles.filtros}>
      {(["Pendiente", "Completada"] as const).map(opcion => <Pressable key={opcion}
        accessibilityRole="button" accessibilityState={{ selected: estado === opcion }} disabled={guardando}
        style={[styles.filtro, estado === opcion && styles.filtroActivo]} onPress={() => filtrar(opcion)}>
        <Text style={[styles.filtroTexto, estado === opcion && styles.filtroTextoActivo]}>{opcion === "Pendiente" ? "Pendientes" : "Completadas"}</Text>
      </Pressable>)}
    </View>
    {mensaje ? <Text accessibilityRole="summary" style={styles.mensaje}>{mensaje}</Text> : null}
    {error ? <View style={styles.alerta}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" disabled={cargando} onPress={() => void cargar(intento.current.filtro, intento.current.id, intento.current.cursor)}><Text style={styles.enlace}>Reintentar</Text></Pressable></View> : null}
    {cargando ? <ActivityIndicator accessibilityLabel="Cargando tareas" color="#4F46E5" /> : null}
    {!cargando && pagina?.items.length === 0 ? <Text style={styles.vacio}>No hay tareas {estado.toLowerCase()}s.</Text> : null}
    {pagina?.items.map(tarea => {
      const propia = tarea.estado === "Pendiente" && tarea.id_asignado === pagina.id_usuario_actual;
      return <View key={tarea.id_tarea} style={styles.tarjeta}>
        <View style={styles.fila}><Text style={styles.nombre}>{tarea.titulo}</Text><Text style={styles.estado}>{tarea.estado}</Text></View>
        {tarea.descripcion ? <Text style={styles.descripcion}>{tarea.descripcion}</Text> : null}
        <Text style={styles.asignado}>{tarea.id_asignado === null ? "Sin asignar" : propia ? "Asignada a ti" : `Asignada a integrante #${tarea.id_asignado}`}</Text>
        {tarea.estado === "Pendiente" && <Pressable accessibilityRole="button" disabled={guardando || cargando} onPress={() => router.push({ pathname: "/convivencia/formulario", params: { tarea: tarea.id_tarea } })}><Text style={styles.enlace}>Reasignar tarea</Text></Pressable>}
        {propia ? <Pressable accessibilityRole="button" disabled={guardando || cargando} style={[styles.boton, (guardando || cargando) && styles.botonInactivo]}
          onPress={() => void completar(tarea.id_tarea)}><Text style={styles.botonTexto}>{guardando ? "Guardando…" : "Completar tarea"}</Text></Pressable> : null}
      </View>;
    })}
    {pagina?.siguiente_cursor && arriendo ? <Pressable accessibilityRole="button" disabled={cargando} style={styles.mas}
      onPress={() => void cargar(estado, arriendo, pagina.siguiente_cursor!)}><Text style={styles.enlace}>Más tareas</Text></Pressable> : null}
    {pagina && !pagina.siguiente_cursor && !cargando ? <Text style={styles.vacio}>Fin de la lista.</Text> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#FAF9FE" },
  contenedor: { padding: 20, gap: 14 },
  subtitulo: { color: "#6B7280", fontSize: 13 },
  filtros: { flexDirection: "row", gap: 8 },
  filtro: { flex: 1, borderWidth: 1, borderColor: "#DCD6FA", backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center" },
  filtroActivo: { backgroundColor: "#4F46E5" },
  filtroTexto: { color: "#4F46E5", fontWeight: "700" },
  filtroTextoActivo: { color: "#fff" },
  tarjeta: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E8E2FA", borderRadius: 18, padding: 16, gap: 8 },
  fila: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" },
  nombre: { flex: 1, fontSize: 16, fontWeight: "700", color: "#111827" },
  estado: { color: "#4F46E5", fontSize: 12 },
  descripcion: { color: "#4B5563" },
  asignado: { color: "#6B7280", fontSize: 12 },
  boton: { backgroundColor: "#4F46E5", borderRadius: 10, padding: 12, alignItems: "center" },
  botonInactivo: { opacity: 0.5 },
  botonTexto: { color: "#fff", fontWeight: "700" },
  alerta: { backgroundColor: "#FEF2F2", padding: 12, borderRadius: 10, gap: 8 },
  error: { color: "#991B1B" },
  mensaje: { color: "#047857" },
  enlace: { color: "#4F46E5", fontWeight: "700" },
  vacio: { color: "#6B7280", paddingVertical: 20 },
  mas: { alignItems: "center", padding: 12 },
});
