import { StyleSheet, Text, View } from "react-native";

// Placeholder de destino para el selector (M4-D01). La lista general de
// chats (mockup n_m_chat_convivencia_02, "Lista general de chats") es una
// tarea aparte — esta pantalla solo deja el routing listo y probado.

export default function ListaChats() {
  return (
    <View style={styles.contenedor}>
      <Text style={styles.texto}>Lista de chats</Text>
      <Text style={styles.nota}>Pendiente: mockup "Lista general de chats" (n_m_chat_convivencia_02).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F9FAFB", padding: 24 },
  texto: { fontSize: 16, fontWeight: "700", color: "#111827" },
  nota: { marginTop: 8, color: "#6B7280", fontSize: 13, textAlign: "center" },
});
