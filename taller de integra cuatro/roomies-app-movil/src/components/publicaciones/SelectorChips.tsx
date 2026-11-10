import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";

type NombreIcono = keyof typeof Ionicons.glyphMap;

interface OpcionChip<T extends string> {
  valor: T;
  etiqueta: string;
}

interface SelectorChipsProps<T extends string> {
  etiqueta: string;
  iconoEtiqueta: NombreIcono;
  opciones: readonly OpcionChip<T>[];
  seleccionados: readonly T[];
  /** Se llama con la opción tocada; quien usa el selector decide si la agrega o la quita. */
  onAlternar: (valor: T) => void;
  ayuda?: string;
  error?: string;
}

// Selección de VARIAS opciones (SelectorOpciones solo permite una). Mantiene el
// mismo encabezado (ícono + etiqueta) y el mismo estilo de error que CustomInput.
export function SelectorChips<T extends string>({
  etiqueta,
  iconoEtiqueta,
  opciones,
  seleccionados,
  onAlternar,
  ayuda,
  error,
}: SelectorChipsProps<T>) {
  return (
    <View style={styles.contenedor}>
      <View style={styles.filaEtiqueta}>
        <Ionicons name={iconoEtiqueta} size={16} color={colors.primary} />
        <Text style={styles.etiqueta}>{etiqueta}</Text>
      </View>
      {ayuda ? <Text style={styles.ayuda}>{ayuda}</Text> : null}

      <View style={styles.chips}>
        {opciones.map((opcion) => {
          const activo = seleccionados.includes(opcion.valor);
          return (
            <Pressable
              key={opcion.valor}
              onPress={() => onAlternar(opcion.valor)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: activo }}
              style={[styles.chip, activo && styles.chipActivo, !!error && !activo && styles.chipError]}
            >
              <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>
                {opcion.etiqueta}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.textoError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginBottom: 16, width: "100%" },
  filaEtiqueta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  etiqueta: { fontSize: 15, fontWeight: "700", color: colors.primary },
  ayuda: { fontSize: 12, color: "#6B7280", marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
  },
  chipActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipError: { borderColor: "#B42318" },
  chipTexto: { fontSize: 14, fontWeight: "600", color: "#2D2D2D" },
  chipTextoActivo: { color: "#FFFFFF" },
  textoError: { fontSize: 12, color: "#B42318", marginTop: 4 },
});
