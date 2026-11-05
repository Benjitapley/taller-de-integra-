import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { paletaPublicacion } from "@/constants/origenPublicacion";
import { colors } from "@/theme/colors";

type NombreIcono = keyof typeof Ionicons.glyphMap;

export interface OpcionSelector<T extends string> {
  valor: T;
  etiqueta: string;
  icono: NombreIcono;
}

interface SelectorOpcionesProps<T extends string> {
  etiqueta: string;
  iconoEtiqueta: NombreIcono;
  opciones: readonly OpcionSelector<T>[];
  /** "" mientras no se elige nada. */
  valor: T | "";
  onCambiar: (valor: T) => void;
  error?: string;
}

// Selector de una opción entre pocas (2 o 3), con el mismo encabezado (ícono +
// etiqueta) y el mismo estilo de error que CustomInput. Lo usan "¿Buscas u
// ofreces?" y "Tipo de vivienda".
export function SelectorOpciones<T extends string>({
  etiqueta,
  iconoEtiqueta,
  opciones,
  valor,
  onCambiar,
  error,
}: SelectorOpcionesProps<T>) {
  return (
    <View style={styles.contenedor}>
      <View style={styles.filaEtiqueta}>
        <Ionicons name={iconoEtiqueta} size={16} color={colors.primary} />
        <Text style={styles.etiqueta}>{etiqueta}</Text>
      </View>

      <View style={styles.opciones} accessibilityRole="radiogroup">
        {opciones.map((opcion) => {
          const seleccionada = valor === opcion.valor;
          return (
            <Pressable
              key={opcion.valor}
              onPress={() => onCambiar(opcion.valor)}
              style={[
                styles.opcion,
                seleccionada && styles.opcionSeleccionada,
                !!error && !seleccionada && styles.opcionError,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: seleccionada }}
              accessibilityLabel={opcion.etiqueta}
            >
              <Ionicons
                name={opcion.icono}
                size={22}
                color={seleccionada ? colors.primary : paletaPublicacion.textoSecundario}
              />
              <Text
                style={[styles.opcionTexto, seleccionada && styles.opcionTextoSeleccionada]}
                numberOfLines={1}
              >
                {opcion.etiqueta}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error && <Text style={styles.textoError}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    marginBottom: 16,
    width: "100%",
  },
  filaEtiqueta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 7,
  },
  etiqueta: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  opciones: {
    flexDirection: "row",
    gap: 8,
  },
  opcion: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  opcionSeleccionada: {
    borderColor: colors.primary,
    backgroundColor: paletaPublicacion.fondoSuave,
  },
  opcionError: {
    borderColor: "#B42318",
  },
  opcionTexto: {
    fontSize: 13,
    color: paletaPublicacion.textoSecundario,
  },
  opcionTextoSeleccionada: {
    fontWeight: "700",
    color: colors.primary,
  },
  textoError: {
    fontSize: 12,
    color: "#B42318",
    marginTop: 4,
  },
});
