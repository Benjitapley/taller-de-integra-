import { Text, View, StyleSheet } from "react-native";

export default function Buscar() {
  return (
    <View style={styles.container}>
      <Text>Buscar</Text>
      <Text style={styles.nota}>Barra de búsqueda y filtros (MOB-06) van aquí.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  nota: { marginTop: 8, color: "#666" },
});
