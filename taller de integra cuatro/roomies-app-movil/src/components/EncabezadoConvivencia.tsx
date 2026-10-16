import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";
import type { IntegranteConvivencia } from "@/types/Convivencia";

type Props = {
  integrantes: IntegranteConvivencia[];
};

export default function EncabezadoConvivencia({ integrantes }: Props) {
  return (
    <View style={styles.encabezado}>
      <View style={styles.avataresGrupo}>
        {integrantes.map((integrante, indice) => (
          <Image
            key={integrante.id}
            source={{ uri: integrante.fotoUrl }}
            style={[styles.avatarGrupo, { marginLeft: indice === 0 ? 0 : -10 }]}
          />
        ))}
      </View>
      <View style={styles.encabezadoTextos}>
        <View style={styles.filaNombreGrupo}>
          <Text style={styles.nombreGrupo}>Roomies</Text>
          <Ionicons name="home" size={16} color="#4F46E5" />
        </View>
        <Text style={styles.subtituloGrupo}>{integrantes.length} miembros • viviendo juntos</Text>
      </View>
      <View style={styles.encabezadoAcciones}>
        <Ionicons name="call-outline" size={20} color="#4F46E5" />
        <Ionicons name="ellipsis-vertical" size={20} color="#4F46E5" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  avataresGrupo: { flexDirection: "row" },
  avatarGrupo: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: "#fff" },
  encabezadoTextos: { flex: 1 },
  filaNombreGrupo: { flexDirection: "row", alignItems: "center", gap: 4 },
  nombreGrupo: { fontSize: 16, fontWeight: "700", color: "#111827" },
  subtituloGrupo: { fontSize: 12, color: "#059669" },
  encabezadoAcciones: { flexDirection: "row", gap: 14 },
});
