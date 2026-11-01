import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

interface CustomInputProps extends TextInputProps {
  etiqueta: string;
  icono: keyof typeof Ionicons.glyphMap;
  esContrasena?: boolean;
  error?: string;
  mostrarIconoInterior?: boolean;
  iconoDerecho?: keyof typeof Ionicons.glyphMap;
}

export const CustomInput: React.FC<CustomInputProps> = ({
  etiqueta,
  icono,
  esContrasena = false,
  error,
  mostrarIconoInterior = true,
  iconoDerecho,
  ...rest
}) => {
  const [mostrarContrasena, setMostrarContrasena] = useState(false);

  const iconoDerechoVisible =
    esContrasena
      ? mostrarContrasena
        ? "eye-off-outline"
        : "eye-outline"
      : iconoDerecho;

  return (
    <View style={styles.contenedor}>
      <View style={styles.filaEtiqueta}>
        <Ionicons name={icono} size={16} color={colors.primary} />
        <Text style={styles.etiqueta}>{etiqueta}</Text>
      </View>

      <View style={[styles.inputWrapper, error && styles.inputWrapperError]}>
        {mostrarIconoInterior && (
          <Ionicons
            name={icono}
            size={18}
            color={colors.border}
            style={styles.icono}
          />
        )}

        <TextInput
          style={styles.input}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={esContrasena && !mostrarContrasena}
          {...rest}
        />

        {iconoDerechoVisible && (
          <TouchableOpacity
            onPress={
              esContrasena
                ? () => setMostrarContrasena(!mostrarContrasena)
                : undefined
            }
            disabled={!esContrasena}
            hitSlop={8}
          >
            <Ionicons
              name={iconoDerechoVisible}
              size={21}
              color={colors.border}
            />
          </TouchableOpacity>
        )}
      </View>

      {error ? <Text style={styles.textoError}>{error}</Text> : null}
    </View>
  );
};

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
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 54,
    backgroundColor: "#FFFFFF",
  },
  inputWrapperError: {
    borderColor: "#B42318",
  },
  icono: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#2D2D2D",
  },
  textoError: {
    fontSize: 12,
    color: "#B42318",
    marginTop: 4,
  },
});
