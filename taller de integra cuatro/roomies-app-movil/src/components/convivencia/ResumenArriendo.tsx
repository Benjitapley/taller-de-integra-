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
      <View style={styles.icono}><Ionicons name="home-outline" size={22} color="#5139E8" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.titulo}>Nuestro lugar</Text>
        <Text style={styles.texto}>{info.direccion}</Text>
        <Text style={styles.texto}>{info.numeroDepto} · {cantidadIntegrantes} integrantes</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#5139E8" />
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F7F5FF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8E2FA",
    padding: 14,
  },
  icono: { width: 38, height: 38, backgroundColor: "#EEE9FF", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  titulo: { fontSize: 14, fontWeight: "700", color: "#5139E8" },
  texto: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});
