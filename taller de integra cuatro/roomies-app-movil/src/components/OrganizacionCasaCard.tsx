import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { TareaApi } from "@/services/tareasService";

type Props = {
  tareas: TareaApi[];
  idUsuarioActual: number | null;
  cargando: boolean;
  error: string;
  onVerTodo: () => void;
  onReintentar: () => void;
};

export default function OrganizacionCasaCard({ tareas, idUsuarioActual, cargando, error, onVerTodo, onReintentar }: Props) {
  return <View style={styles.tarjeta}>
    <View style={styles.encabezado}>
      <Text style={styles.titulo}>Organización de la casa</Text>
      <Pressable accessibilityRole="button" onPress={onVerTodo} hitSlop={8}>
        <Text style={styles.verTodo}>Ver todo</Text>
      </Pressable>
    </View>
    {cargando ? <Text style={styles.aviso}>Cargando tareas…</Text> : null}
    {!cargando && error ? <Pressable accessibilityRole="button" onPress={onReintentar}>
      <Text style={styles.aviso}>{error} · Reintentar</Text>
    </Pressable> : null}
    {!cargando && !error && tareas.length === 0 ? <Text style={styles.aviso}>No hay tareas pendientes.</Text> : null}
    {!cargando && !error && tareas.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.fila}>
      {tareas.slice(0, 4).map(tarea => <Pressable key={tarea.id_tarea} accessibilityRole="button"
        accessibilityLabel={`${tarea.titulo}, ${tarea.id_asignado === idUsuarioActual ? "asignada a ti" : "pendiente"}`}
        onPress={onVerTodo} style={styles.item}>
        <Text style={styles.nombre} numberOfLines={2}>{tarea.titulo}</Text>
        <Text style={styles.estado}>Pendiente</Text>
        <View style={styles.responsable}><Text style={styles.responsableTexto}>
          {tarea.id_asignado === idUsuarioActual ? "Tú" : tarea.id_asignado === null ? "—" : `#${tarea.id_asignado}`}
        </Text></View>
      </Pressable>)}
    </ScrollView> : null}
  </View>;
}

const styles = StyleSheet.create({
  tarjeta: { backgroundColor: "#F7F5FF", borderRadius: 20, borderWidth: 1, borderColor: "#E5DFFF", padding: 10, gap: 9 },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 },
  titulo: { fontSize: 16, fontWeight: "700", color: "#5139E8", flexShrink: 1 },
  verTodo: { fontSize: 12, color: "#5139E8" },
  fila: { flexDirection: "row", gap: 8 },
  item: { width: 76, height: 94, backgroundColor: "#fff", borderRadius: 15, borderWidth: 1,
    borderColor: "#E8E2FA", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 4 },
  nombre: { fontSize: 11, fontWeight: "700", color: "#5139E8", textAlign: "center" },
  estado: { fontSize: 10, color: "#85819B" },
  responsable: { minWidth: 26, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: "#E9E2FF", alignItems: "center" },
  responsableTexto: { color: "#5139E8", fontWeight: "700", fontSize: 10 },
  aviso: { fontSize: 12, color: "#77718D", padding: 8 },
});
