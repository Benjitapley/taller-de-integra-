import { StyleSheet, Text, View } from "react-native";

export default function AuthDivider() {
  return (
    <View style={styles.fila}>
      <View style={styles.linea} />
      <Text style={styles.texto}>o</Text>
      <View style={styles.linea} />
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginVertical: 12,
  },
  linea: {
    flex: 1,
    height: 1,
    backgroundColor: "#DCD9EC",
  },
  texto: {
    color: "#4B3FCA",
    fontSize: 18,
    fontWeight: "700",
  },
});
