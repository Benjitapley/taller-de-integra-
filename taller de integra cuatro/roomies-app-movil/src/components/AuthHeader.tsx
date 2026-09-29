import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

type Props = {
  mostrarVolver?: boolean;
};

export default function AuthHeader({ mostrarVolver = false }: Props) {
  return (
    <View style={styles.contenedor}>
      {mostrarVolver ? (
        <Pressable
          onPress={() => router.back()}
          style={styles.botonVolver}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={22} color="#4B3FCA" />
        </Pressable>
      ) : (
        <View style={styles.espacio} />
      )}

      <Text style={styles.titulo}>Roomies</Text>
      <View style={styles.espacio} />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    width: "100%",
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  botonVolver: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  espacio: {
    width: 32,
  },
  titulo: {
    fontSize: 15,
    fontWeight: "700",
    color: "#4B3FCA",
  },
});
