import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { CustomButton } from "@/components/CustomButton";
import type { EstadoPerfilPropio } from "@/hooks/usePerfilPropio";
import type { PerfilPropioVista } from "@/types/Usuario";

const NO_DISPONIBLE = "No disponible";

function ResumenPersonal({ perfil }: { perfil: PerfilPropioVista }) {
  return (
    <View style={styles.tarjeta}>
      <View style={styles.filaPrincipal}>
        {perfil.fotoPerfilUrl ? (
          <Image accessibilityLabel="Foto de perfil" source={{ uri: perfil.fotoPerfilUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarVacio]}>
            <Ionicons name="person-outline" size={30} color="#4F46E5" />
          </View>
        )}
        <View style={styles.infoPrincipal}>
          <Text style={styles.nombre}>{perfil.nombre ?? NO_DISPONIBLE}</Text>
          <Text style={styles.texto}>{perfil.email ?? NO_DISPONIBLE}</Text>
          <Text style={styles.textoSecundario}>Calificación: {NO_DISPONIBLE.toLowerCase()}</Text>
        </View>
      </View>
      <View style={styles.filaDatos}>
        <Dato icono="location-outline" valor={perfil.ubicacion ?? NO_DISPONIBLE} />
        <Dato icono="calendar-outline" valor={perfil.edad === null ? NO_DISPONIBLE : `${perfil.edad} años`} />
        <Dato icono="briefcase-outline" valor={perfil.ocupacion ?? NO_DISPONIBLE} />
      </View>
      <Text style={styles.texto}>{perfil.bio ?? "Descripción no disponible."}</Text>
    </View>
  );
}

function Dato({ icono, valor }: { icono: keyof typeof Ionicons.glyphMap; valor: string }) {
  return (
    <View style={styles.dato}>
      <Ionicons name={icono} size={14} color="#6B7280" />
      <Text style={styles.textoSecundario}>{valor}</Text>
    </View>
  );
}

function SobreMi({ perfil }: { perfil: PerfilPropioVista }) {
  return (
    <View style={styles.tarjeta}>
      <Text style={styles.titulo}>Sobre mí</Text>
      <Text style={styles.etiqueta}>Preferencias</Text>
      <Text style={styles.texto}>
        {perfil.preferencias === null ? NO_DISPONIBLE : perfil.preferencias.join(", ") || "Sin preferencias indicadas."}
      </Text>
      <View style={styles.subBloque}>
        <Text style={styles.etiqueta}>Busco en</Text>
        <Text style={styles.texto}>
          {perfil.buscaEn === null ? NO_DISPONIBLE : perfil.buscaEn.join(", ") || "Sin zonas indicadas."}
        </Text>
      </View>
      <View style={styles.subBloque}>
        <Text style={styles.etiqueta}>Presupuesto</Text>
        <Text style={styles.texto}>
          {perfil.presupuesto === null ? NO_DISPONIBLE : `Máx. $${perfil.presupuesto.toLocaleString("es-CL")} CLP`}
        </Text>
      </View>
    </View>
  );
}

export function ContenidoPerfil({ estado, onReintentar }: {
  estado: EstadoPerfilPropio;
  onReintentar: () => void;
}) {
  const resultado = estado.tipo === "resultado" ? estado.resultado : null;

  return (
    <>
      {estado.tipo === "cargando" ? (
        <View style={[styles.tarjeta, styles.estado]} accessibilityState={{ busy: true }} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.titulo}>Cargando tu perfil</Text>
          <Text style={styles.textoSecundario}>Espera un momento.</Text>
        </View>
      ) : resultado?.exito ? (
        <>
          <ResumenPersonal perfil={resultado.perfil} />
          <SobreMi perfil={resultado.perfil} />
        </>
      ) : resultado ? (
        <View style={[styles.tarjeta, styles.estado]}>
          <Ionicons name="person-circle-outline" size={42} color="#4F46E5" />
          <Text style={styles.titulo}>
            {resultado.codigo === "contrato_pendiente" ? "Perfil no disponible" : "No pudimos cargar tu perfil"}
          </Text>
          <Text accessibilityRole="alert" style={styles.mensajeError}>{resultado.error}</Text>
          <CustomButton titulo="Reintentar" iconoIzquierdo="refresh-outline" onPress={onReintentar} />
        </View>
      ) : null}

      <View style={styles.filaStats}>
        {[
          { icono: "home-outline" as const, etiqueta: "Publicaciones" },
          { icono: "chatbubble-outline" as const, etiqueta: "Mensajes" },
          { icono: "heart-outline" as const, etiqueta: "Guardados" },
          { icono: "ribbon-outline" as const, etiqueta: "Evaluaciones" },
        ].map(({ icono, etiqueta }) => (
          <View key={etiqueta} style={styles.stat} accessibilityLabel={`${etiqueta}: no disponible`}>
            <Ionicons name={icono} size={18} color="#4F46E5" />
            <Text style={styles.statValor}>—</Text>
            <Text style={styles.statEtiqueta}>{etiqueta}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.textoSecundario}>Estadísticas no disponibles.</Text>
      <View style={styles.tarjeta}>
        <Text style={styles.titulo}>Publicaciones activas</Text>
        <Text style={styles.textoSecundario}>No disponibles por el momento.</Text>
      </View>
      <View style={styles.tarjeta}>
        <Text style={styles.titulo}>Evaluaciones recibidas</Text>
        <Text style={styles.textoSecundario}>Reputación y evaluaciones no disponibles por el momento.</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  tarjeta: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", padding: 16, gap: 10 },
  estado: { gap: 14, alignItems: "center", paddingVertical: 28 },
  titulo: { fontSize: 16, fontWeight: "700", color: "#111827" },
  nombre: { fontSize: 18, fontWeight: "700", color: "#111827" },
  texto: { fontSize: 14, color: "#374151", lineHeight: 21 },
  textoSecundario: { fontSize: 13, color: "#6B7280", lineHeight: 20 },
  mensajeError: { fontSize: 14, color: "#4B5563", lineHeight: 21, textAlign: "center" },
  filaPrincipal: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoPrincipal: { flex: 1, gap: 4 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarVacio: { backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  filaDatos: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  dato: { flexDirection: "row", alignItems: "center", gap: 4 },
  etiqueta: { fontSize: 13, fontWeight: "600", color: "#111827" },
  subBloque: { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10, gap: 4 },
  filaStats: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", paddingVertical: 14 },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statValor: { fontSize: 16, color: "#6B7280" },
  statEtiqueta: { fontSize: 11, color: "#6B7280", textAlign: "center" },
});
