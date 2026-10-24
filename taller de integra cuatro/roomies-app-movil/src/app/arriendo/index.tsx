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
  USUARIO_TIENE_ARRIENDO_MOCK,
} from "@/data/convivenciaMock";


function SinArriendo() {
  return (
    <View style={styles.sinArriendoContenedor}>
      <View style={styles.sinArriendoIconoFondo}>
        <Ionicons name="home-outline" size={36} color="#9CA3AF" />
      </View>
      <Text style={styles.sinArriendoTitulo}>Todavía no tienes un arriendo activo</Text>
      <Text style={styles.sinArriendoTexto}>
        Cuando te unas a un arriendo o encuentres compañeros de casa, vas a poder ver acá la
        convivencia, las tareas y el chat del grupo.
      </Text>
      <Pressable style={styles.sinArriendoBoton} onPress={() => router.push("/(tabs)/buscar")}>
        <Text style={styles.sinArriendoBotonTexto}>Ir a Buscar</Text>
      </Pressable>
    </View>
  );
}

export default function DashboardArriendo() {
  if (!USUARIO_TIENE_ARRIENDO_MOCK) {
    return <SinArriendo />;
  }

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
  sinArriendoContenedor: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 32,
    gap: 10,
  },
  sinArriendoIconoFondo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  sinArriendoTitulo: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  sinArriendoTexto: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
  },
  sinArriendoBoton: {
    backgroundColor: "#4F46E5",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 10,
  },
  sinArriendoBotonTexto: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
