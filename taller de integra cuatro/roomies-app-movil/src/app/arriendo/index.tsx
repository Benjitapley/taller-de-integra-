import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import OrganizacionCasaCard from "@/components/OrganizacionCasaCard";
import ProximosRecordatorios from "@/components/convivencia/ProximosRecordatorios";
import ResumenArriendo from "@/components/convivencia/ResumenArriendo";
import {
  INFO_ARRIENDO_MOCK,
  INTEGRANTES_MOCK,
  RECORDATORIOS_MOCK,
  TAREAS_MOCK,
  ULTIMO_MENSAJE_ARRIENDO_MOCK,
} from "@/data/convivenciaMock";


export default function DashboardArriendo() {
  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenedor}>
      <ResumenArriendo info={INFO_ARRIENDO_MOCK} cantidadIntegrantes={INTEGRANTES_MOCK.length} />

      <Pressable style={styles.tarjetaChat} onPress={() => router.push("/arriendo/chat")}>
        <View style={styles.grupoAvatares}>
          {INTEGRANTES_MOCK.map((integrante, indice) => (
            <Image
              key={integrante.id}
              source={{ uri: integrante.fotoUrl }}
              style={[styles.avatarChat, { marginLeft: indice === 0 ? 0 : -10 }]}
            />
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tarjetaChatTitulo}>Chat del arriendo</Text>
          <Text style={styles.tarjetaChatSubtitulo} numberOfLines={1}>
            Roomies · "{ULTIMO_MENSAJE_ARRIENDO_MOCK.texto}"
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#4F46E5" />
      </Pressable>

      <OrganizacionCasaCard tareas={TAREAS_MOCK} onVerTodo={() => router.push("/convivencia/tareas")} />

      <ProximosRecordatorios recordatorios={RECORDATORIOS_MOCK} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#F9FAFB" },
  contenedor: { padding: 16, gap: 14 },
  tarjetaChat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
  },
  grupoAvatares: { flexDirection: "row" },
  avatarChat: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#fff" },
  tarjetaChatTitulo: { fontSize: 14, fontWeight: "700", color: "#111827" },
  tarjetaChatSubtitulo: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});
