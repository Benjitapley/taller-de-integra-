import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CHATS_EXPLORATORIOS_MOCK } from "@/data/chatsMock";

export default function ListaChats() {
  return (
    <View style={styles.contenedor}>
      {CHATS_EXPLORATORIOS_MOCK.map((chat) => (
        <Pressable
          key={chat.id}
          style={styles.fila}
          onPress={() => router.push(`/chats/${chat.id}`)}
        >
          <Image source={{ uri: chat.avatarUrl }} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.nombre}>{chat.nombreOtraPersona}</Text>
            <Text style={styles.estado}>
              {chat.estado === "preseleccionada" ? "Preseleccionada" : "Pendiente"}
            </Text>
          </View>
        </Pressable>
      ))}
      <Text style={styles.nota}>
        Diseño completo de esta lista: mockup "Lista general de chats" (tarea aparte).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#F9FAFB", padding: 16, gap: 10 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  nombre: { fontSize: 14, fontWeight: "700", color: "#111827" },
  estado: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  nota: { marginTop: 12, color: "#9CA3AF", fontSize: 12, textAlign: "center" },
});
