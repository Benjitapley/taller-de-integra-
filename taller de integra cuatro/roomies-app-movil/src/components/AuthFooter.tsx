import { Image, StyleSheet, Text, View } from "react-native";

export default function AuthFooter() {
  return (
    <View style={styles.contenedor}>
      <Image
        source={require("../../assets/images/auth/footer-plant.png")}
        style={styles.planta}
        resizeMode="contain"
        accessibilityLabel="Ilustración de una planta"
      />

      <View style={styles.mensaje}>
        <Text style={styles.texto}>Miles de personas ya encontraron</Text>
        <Text style={styles.texto}>
          su lugar ideal <Text style={styles.corazon}>♡</Text>
        </Text>
        <View style={styles.subrayado} />
      </View>

      <Image
        source={require("../../assets/images/auth/footer-keys.png")}
        style={styles.llaves}
        resizeMode="contain"
        accessibilityLabel="Ilustración de llaves"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    width: "100%",
    minHeight: 116,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 14,
  },
  planta: {
    width: 78,
    height: 118,
  },
  llaves: {
    width: 82,
    height: 116,
  },
  mensaje: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  texto: {
    color: "#4B3FCA",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 22,
  },
  corazon: {
    fontSize: 22,
  },
  subrayado: {
    width: 100,
    height: 3,
    borderRadius: 3,
    backgroundColor: "#C8BFF2",
    marginTop: 4,
  },
});
