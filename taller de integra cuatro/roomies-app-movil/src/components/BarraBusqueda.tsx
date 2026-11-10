import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";


type Props = {
  valor: string;
  onCambiarValor: (texto: string) => void;
  onPresionarFiltros?: () => void;
  placeholder?: string;
};

export default function BarraBusqueda({
  valor,
  onCambiarValor,
  onPresionarFiltros,
  placeholder = "Buscar compañeros, arriendos...",
}: Props) {
  return (
    <View style={styles.fila}>
      <View style={styles.buscador}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          value={valor}
          onChangeText={onCambiarValor}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
      </View>

      {onPresionarFiltros && (
        <Pressable style={styles.botonFiltros} onPress={onPresionarFiltros}>
          <Ionicons name="options-outline" size={16} color="#4F46E5" />
          <Text style={styles.botonFiltrosTexto}>Filtros</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: "row",
    gap: 8,
  },
  buscador: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
  },
  botonFiltros: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#4F46E5",
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
  },
  botonFiltrosTexto: {
    color: "#4F46E5",
    fontWeight: "600",
    fontSize: 13,
  },
});
