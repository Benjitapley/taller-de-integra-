import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";

type NombreIcono = keyof typeof Ionicons.glyphMap;

interface InterruptorFormularioProps {
  etiqueta: string;
  icono: NombreIcono;
  descripcion?: string;
  valor: boolean;
  onCambiar: (valor: boolean) => void;
}

// Sí/no del formulario ("¿Se aceptan mascotas?", "Permitir comentarios").
export const InterruptorFormulario: React.FC<InterruptorFormularioProps> = ({
  etiqueta,
  icono,
  descripcion,
  valor,
  onCambiar,
}) => (
  <View style={styles.contenedor}>
    <View style={styles.fila}>
      <View style={styles.texto}>
        <View style={styles.filaEtiqueta}>
          <Ionicons name={icono} size={16} color={colors.primary} />
          <Text style={styles.etiqueta}>{etiqueta}</Text>
        </View>
        {descripcion ? <Text style={styles.descripcion}>{descripcion}</Text> : null}
      </View>
      <Switch
        value={valor}
        onValueChange={onCambiar}
        trackColor={{ false: "#D1D5DB", true: colors.primary }}
        thumbColor="#FFFFFF"
        accessibilityLabel={etiqueta}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  contenedor: { marginBottom: 16, width: "100%" },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
  },
  texto: { flex: 1 },
  filaEtiqueta: { flexDirection: "row", alignItems: "center", gap: 8 },
  etiqueta: { fontSize: 15, fontWeight: "700", color: colors.primary },
  descripcion: { fontSize: 12, color: "#6B7280", marginTop: 4 },
});
