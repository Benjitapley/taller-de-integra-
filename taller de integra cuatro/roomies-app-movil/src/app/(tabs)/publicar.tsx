import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import AppHeader from "@/components/AppHeader";
import { TipoPublicacionCard } from "@/components/publicaciones/TipoPublicacionCard";
import { USUARIO_ACTUAL_MOCK } from "@/data/convivenciaMock";
import { paletaPublicacion } from "@/constants/origenPublicacion";
import { colors } from "@/theme/colors";

export default function Publicar() {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.pantalla}
      contentContainerStyle={styles.contenedor}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader fotoUsuarioUrl={USUARIO_ACTUAL_MOCK.fotoUrl} />

      <View style={styles.encabezado}>
        <Text style={styles.titulo}>Publicar</Text>
        <Text style={styles.subtitulo}>
          ¿Qué quieres compartir con la comunidad?
        </Text>
      </View>

      <TipoPublicacionCard
        tipo="Compartida"
        titulo="Compartir oportunidad"
        descripcion="Encontré un lugar y busco con quién compartirlo."
        onPress={() => router.push("/publicacion/crear/compartida")} // formulario compartida
      />

      <TipoPublicacionCard
        tipo="Arrendador"
        titulo="Publicar arriendo"
        descripcion="Soy arrendador y quiero ofrecer un espacio disponible."
        onPress={() => router.push("/publicacion/crear/arrendador")} // formulario arrendador
      />

      <View style={styles.recuadro}>
        <View style={styles.recuadroTitulo}>
          <Text style={styles.recuadroTexto}>+ Publicar es sencillo</Text>
        </View>
        <Text style={styles.subtitulo}>
          Completa los datos, agrega fotos y revisa cómo quedará antes de publicarlo.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#F9FAFB" },
  contenedor: { padding: 16, gap: 14 },
  encabezado: { marginTop: 8, marginBottom: 4, gap: 6 },
  titulo: { fontSize: 22, fontWeight: "700", color: paletaPublicacion.textoPrincipal },
  subtitulo: { fontSize: 14, lineHeight: 20, color: paletaPublicacion.textoSecundario },
  recuadro: {
    marginTop: 6,
    padding: 16,
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: paletaPublicacion.fondoSuave,
  },
  recuadroTitulo: { flexDirection: "row", alignItems: "center", gap: 6 },
  recuadroTexto: { fontSize: 15, fontWeight: "700", color: colors.primary },
});
