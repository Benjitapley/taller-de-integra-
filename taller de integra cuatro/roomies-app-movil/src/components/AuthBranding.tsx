import { Image, StyleSheet, View } from "react-native";

export default function AuthBranding() {
  return (
    <View style={styles.contenedor}>
      <Image
        source={require("../../assets/images/auth/logo.png")}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="¿Hay cupo?"
      />

      <Image
        source={require("../../assets/images/auth/sofa(login).webp")}
        style={styles.ilustracion}
        resizeMode="contain"
        accessibilityLabel="Ilustración de un hogar"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    alignItems: "center",
    width: "100%",
  },
  logo: {
    width: "76%",
    height: 92,
    marginBottom: 4,
  },
  ilustracion: {
    width: "100%",
    height: 190,
    marginTop: 2,
  },
});
