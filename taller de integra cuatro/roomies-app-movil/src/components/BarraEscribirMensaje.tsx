import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

type Props = {
  valor: string;
  onCambiarValor: (texto: string) => void;
  onEnviar: () => void;
};

export default function BarraEscribirMensaje({ valor, onCambiarValor, onEnviar }: Props) {
  return (
    <View style={styles.barraEscribir}>
      <Ionicons name="add-circle" size={28} color="#4F46E5" />
      <TextInput
        value={valor}
        onChangeText={onCambiarValor}
        placeholder="Escribe un mensaje..."
        placeholderTextColor="#9CA3AF"
        style={styles.inputEscribir}
        onSubmitEditing={onEnviar}
        returnKeyType="send"
      />
      <Ionicons name="happy-outline" size={22} color="#9CA3AF" />
      <Pressable style={styles.botonEnviar} onPress={onEnviar}>
        <Ionicons name="send" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  barraEscribir: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  inputEscribir: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
  },
  botonEnviar: {
    backgroundColor: "#4F46E5",
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
