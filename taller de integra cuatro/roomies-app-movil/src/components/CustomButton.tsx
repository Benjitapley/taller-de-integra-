import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

interface CustomButtonProps {
  titulo: string;
  onPress: () => void;
  variante?: "solido" | "contorno";
  cargando?: boolean;
  deshabilitado?: boolean;
  iconoDerecho?: keyof typeof Ionicons.glyphMap;
  iconoIzquierdo?: keyof typeof Ionicons.glyphMap;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  titulo,
  onPress,
  variante = "solido",
  cargando = false,
  deshabilitado = false,
  iconoDerecho,
  iconoIzquierdo,
}) => {
  const esSolido = variante === "solido";

  return (
    <TouchableOpacity
      style={[
        styles.base,
        esSolido ? styles.solido : styles.contorno,
        deshabilitado && styles.deshabilitado,
      ]}
      onPress={onPress}
      disabled={deshabilitado || cargando}
      activeOpacity={0.8}
    >
      {cargando ? (
        <ActivityIndicator
          color={esSolido ? colors.background : colors.primary}
        />
      ) : (
        <>
          {iconoIzquierdo && (
            <Ionicons
              name={iconoIzquierdo}
              size={21}
              color={esSolido ? colors.background : colors.primary}
            />
          )}
          <Text
            style={[
              styles.texto,
              esSolido ? styles.textoSolido : styles.textoContorno,
            ]}
          >
            {titulo}
          </Text>
          {iconoDerecho && (
            <Ionicons
              name={iconoDerecho}
              size={25}
              color={esSolido ? colors.background : colors.primary}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },
  solido: {
    backgroundColor: colors.primary,
  },
  contorno: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  deshabilitado: {
    opacity: 0.5,
  },
  texto: {
    fontSize: 16,
    fontWeight: "600",
  },
  textoSolido: {
    color: colors.background,
  },
  textoContorno: {
    color: colors.primary,
  },
});
