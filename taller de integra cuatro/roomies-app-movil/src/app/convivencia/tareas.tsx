import { Ionicons } from "@expo/vector-icons";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { TAREAS_MOCK, TAREAS_PROXIMAS_MOCK } from "@/data/convivenciaMock";
import type { TareaConvivencia } from "@/types/Convivencia";

// Subpantalla de MOB-11: detalle completo de tareas de convivencia,
// separadas en "esta semana" (las mismas de la tarjeta de Mensajes) y
// "próximas" (semana siguiente). Se llega acá tocando "Ver todo" en
// Organización de la casa.

function FilaTarea({ tarea }: { tarea: TareaConvivencia }) {
  return (
    <View style={styles.filaTarea}>
      <View style={styles.iconoCategoria}>
        <Ionicons name={tarea.icono as never} size={18} color="#4F46E5" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.categoria}>{tarea.categoria}</Text>
        {tarea.frecuenciaTexto ? <Text style={styles.frecuencia}>{tarea.frecuenciaTexto}</Text> : null}
      </View>
      <View style={styles.badgeDia}>
        <Text style={styles.badgeDiaTexto}>{tarea.diaTexto}</Text>
      </View>
      <Image source={{ uri: tarea.responsable.fotoUrl }} style={styles.avatar} />
    </View>
  );
}

function Seccion({ titulo, tareas }: { titulo: string; tareas: TareaConvivencia[] }) {
  return (
    <View style={styles.seccion}>
      <Text style={styles.tituloSeccion}>{titulo}</Text>
      <View style={styles.tarjeta}>
        {tareas.map((tarea, indice) => (
          <View key={tarea.id}>
            <FilaTarea tarea={tarea} />
            {indice < tareas.length - 1 && <View style={styles.separador} />}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function TareasConvivencia() {
  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenedor}>
      <Seccion titulo="Tareas de esta semana" tareas={TAREAS_MOCK} />
      <Seccion titulo="Próximas tareas" tareas={TAREAS_PROXIMAS_MOCK} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#F9FAFB" },
  contenedor: { padding: 16, gap: 20 },
  seccion: { gap: 8 },
  tituloSeccion: { fontSize: 15, fontWeight: "700", color: "#111827" },
  tarjeta: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
  },
  filaTarea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  iconoCategoria: {
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    padding: 8,
  },
  categoria: { fontSize: 14, fontWeight: "700", color: "#111827" },
  frecuencia: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  badgeDia: {
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeDiaTexto: { fontSize: 12, color: "#4F46E5", fontWeight: "600" },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  separador: { height: 1, backgroundColor: "#F3F4F6" },
});
