import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { InfoArriendo } from "@/types/Convivencia";


type Props = {
  info: InfoArriendo;
  cantidadIntegrantes: number;
};

export default function ResumenArriendo({ info, cantidadIntegrantes }: Props) {
  return (
    <View style={styles.tarjeta}>
      <Ionicons name="home" size={18} color="#4F46E5" />
      <View style={{ flex: 1 }}>
        <Text style={styles.titulo}>Nuestro lugar</Text>
        <Text style={styles.texto}>
          {info.direccion} · {info.numeroDepto} · {cantidadIntegrantes} integrantes
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F5F3FF",
    borderRadius: 12,
    padding: 14,
  },
  titulo: { fontSize: 13, fontWeight: "700", color: "#111827" },
  texto: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});
