import { Text, View, StyleSheet } from "react-native";

export default function Publicar() {
  return (
    <View style={styles.container}>
      <Text>Publicar</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
