import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { INTEGRANTES_MOCK } from "@/data/convivenciaMock";

const CHATS_SIN_LEER_MOCK = 3;

const COLORES_AVATAR = ["#C7D2FE", "#FBCFE8", "#BBF7D0", "#FDE68A"];

export default function SelectorChatArriendo() {
  return (
    <View style={styles.pantalla}>
      <Text style={styles.titulo}>Chat</Text>
      <Text style={styles.subtitulo}>Elige dónde quieres entrar</Text>

      <Pressable style={styles.tarjeta} onPress={() => router.push("/chats")}>
        <View style={styles.iconoCirculo}>
          <Ionicons name="chatbubble-outline" size={22} color="#4F46E5" />
        </View>
        <View style={styles.tarjetaTextos}>
          <Text style={styles.tarjetaTitulo}>Chats</Text>
          <Text style={styles.tarjetaSubtitulo}>Tus conversaciones</Text>
        </View>
        {CHATS_SIN_LEER_MOCK > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeTexto}>{CHATS_SIN_LEER_MOCK}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color="#4F46E5" />
      </Pressable>

      <Pressable style={styles.tarjeta} onPress={() => router.push("/arriendo")}>
        <View style={styles.iconoCirculo}>
          <Ionicons name="home-outline" size={22} color="#4F46E5" />
        </View>
        <View style={styles.tarjetaTextos}>
          <Text style={styles.tarjetaTitulo}>Arriendo</Text>
          <Text style={styles.tarjetaSubtitulo} numberOfLines={1}>
            Tu espacio de convivencia
          </Text>
        </View>
        <View style={styles.grupoAvatares}>
          {INTEGRANTES_MOCK.map((integrante, indice) => (
            <View
              key={integrante.id}
              style={[
                styles.avatarInicial,
                {
                  backgroundColor: COLORES_AVATAR[indice % COLORES_AVATAR.length],
                  marginLeft: indice === 0 ? 0 : -8,
                },
              ]}
            >
              <Text style={styles.avatarInicialTexto}>{integrante.nombre.charAt(0)}</Text>
            </View>
          ))}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#4F46E5" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#F9FAFB", padding: 20, gap: 16 },
  titulo: { fontSize: 30, fontWeight: "700", color: "#4F46E5", marginTop: 8 },
  subtitulo: { fontSize: 14, color: "#6B7280", marginBottom: 8 },
  tarjeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
  },
  iconoCirculo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  tarjetaTextos: { flex: 1 },
  tarjetaTitulo: { fontSize: 16, fontWeight: "700", color: "#111827" },
  tarjetaSubtitulo: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  badge: {
    backgroundColor: "#4F46E5",
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeTexto: { color: "#fff", fontSize: 12, fontWeight: "700" },
  grupoAvatares: { flexDirection: "row" },
  avatarInicial: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarInicialTexto: { fontSize: 11, fontWeight: "700", color: "#3730A3" },
});
