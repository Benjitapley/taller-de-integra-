import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LARGO_TEXTO_MAXIMO } from "@/types/api/ConversacionesDto";

const UMBRAL_CONTADOR = LARGO_TEXTO_MAXIMO - 200;

type Props = {
  valor: string;
  onCambiarValor: (texto: string) => void;
  onEnviar: () => void;
  deshabilitado?: boolean;
  soloTexto?: boolean;
};

export default function CompositorMensaje({
  valor,
  onCambiarValor,
  onEnviar,
  deshabilitado = false,
  soloTexto = false,
}: Props) {
  const vacio = valor.trim() === "";
  const bloqueado = vacio || deshabilitado;

  return (
    <View style={styles.contenedor}>
      {valor.length >= UMBRAL_CONTADOR && (
        <Text style={styles.contador}>
          {valor.length}/{LARGO_TEXTO_MAXIMO}
        </Text>
      )}
      <View style={styles.barraEscribir}>
        {!soloTexto && <Ionicons name="add-circle" size={28} color="#4F46E5" />}
        <TextInput
          value={valor}
          onChangeText={onCambiarValor}
          placeholder="Escribe un mensaje..."
          placeholderTextColor="#9CA3AF"
          style={styles.inputEscribir}
          onSubmitEditing={bloqueado ? undefined : onEnviar}
          returnKeyType="send"
          submitBehavior="submit"
          maxLength={LARGO_TEXTO_MAXIMO}
          editable={!deshabilitado}
        />
        {!soloTexto && <Ionicons name="happy-outline" size={22} color="#9CA3AF" />}
        <Pressable
          style={[styles.botonEnviar, bloqueado && styles.botonEnviarInactivo]}
          onPress={onEnviar}
          disabled={bloqueado}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
        >
          <Ionicons name="send" size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: "#fff" },
  contador: { alignSelf: "flex-end", fontSize: 11, color: "#6B7280", paddingHorizontal: 14, paddingTop: 6 },
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
  botonEnviarInactivo: { opacity: 0.4 },
});
