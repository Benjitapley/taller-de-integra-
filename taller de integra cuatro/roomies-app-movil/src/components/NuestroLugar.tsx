import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

export default function NuestroLugar() {
  return (
    <View style={styles.nuestroLugar}>
      <Ionicons name="pin-outline" size={16} color="#4F46E5" />
      <View style={{ flex: 1 }}>
        <Text style={styles.nuestroLugarTitulo}>Nuestro lugar</Text>
        <Text style={styles.nuestroLugarTexto}>Providencia, Santiago • Departamento 4D/2B</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </View>
  );
}

const styles = StyleSheet.create({
  nuestroLugar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F5F3FF",
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    padding: 12,
  },
  nuestroLugarTitulo: { fontSize: 13, fontWeight: "700", color: "#111827" },
  nuestroLugarTexto: { fontSize: 12, color: "#6B7280" },
});
