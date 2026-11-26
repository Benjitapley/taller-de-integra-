import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Recordatorio } from "@/types/Convivencia";

type Props = {
  recordatorios: Recordatorio[];
  onAgregar?: () => void;
};

export default function ProximosRecordatorios({ recordatorios, onAgregar }: Props) {
  return (
    <View style={styles.tarjeta}>
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>Próximos recordatorios</Text>
        <Pressable style={styles.botonAgregar} onPress={onAgregar} disabled={!onAgregar} hitSlop={8}>
          <Ionicons name="add" size={18} color="#4F46E5" />
        </Pressable>
      </View>

      {recordatorios.length === 0 ? (
        <Text style={styles.vacio}>Sin recordatorios por ahora.</Text>
      ) : (
        recordatorios.map((recordatorio) => (
          <View key={recordatorio.id} style={styles.fila}>
            <View style={styles.iconoCirculo}>
              <Ionicons name="calendar-outline" size={16} color="#4F46E5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filaTitulo}>{recordatorio.titulo}</Text>
              <Text style={styles.filaSubtitulo}>
                {recordatorio.horaTexto
                  ? `${recordatorio.fechaTexto} · ${recordatorio.horaTexto}`
                  : recordatorio.fechaTexto}
              </Text>
              {recordatorio.descripcion ? (
                <Text style={styles.filaDescripcion} numberOfLines={2}>
                  {recordatorio.descripcion}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    gap: 6,
  },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titulo: { fontSize: 16, fontWeight: "700", color: "#5139E8" },
  botonAgregar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#EEE9FF",
    alignItems: "center",
    justifyContent: "center",
  },
  vacio: { fontSize: 13, color: "#9CA3AF" },
  fila: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderWidth: 1,
    borderColor: "#E8E2FA", borderRadius: 16, padding: 12 },
  iconoCirculo: { backgroundColor: "#EEE9FF", borderRadius: 10, padding: 8 },
  filaTitulo: { fontSize: 14, fontWeight: "600", color: "#111827" },
  filaSubtitulo: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  filaDescripcion: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
});
