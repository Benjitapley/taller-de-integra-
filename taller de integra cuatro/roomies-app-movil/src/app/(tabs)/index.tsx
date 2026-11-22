import { ScrollView, StyleSheet } from "react-native";
import AppHeader from "@/components/AppHeader";
import BuscadorPublicaciones from "@/components/BuscadorPublicaciones";
import { USUARIO_ACTUAL_MOCK } from "@/data/convivenciaMock";

export default function Inicio() {
  return (
    <ScrollView
      style={styles.pantalla}
      contentContainerStyle={styles.contenedor}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader fotoUsuarioUrl={USUARIO_ACTUAL_MOCK.fotoUrl} />
      <BuscadorPublicaciones />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  contenedor: {
    padding: 16,
    gap: 12,
  },
});
