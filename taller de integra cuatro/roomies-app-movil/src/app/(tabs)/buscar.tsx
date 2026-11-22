import { useEffect, useState } from "react";
import { Text, View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { colors } from "@/theme/colors";
import { paletaPublicacion } from "@/constants/origenPublicacion";
import { CustomButton } from "@/components/CustomButton";
import BuscadorPublicaciones from '@/components/BuscadorPublicaciones';
import BuscadorPersonas from '@/components/BuscadorPersonas';
import { obtenerPublicaciones } from "@/services/publicacionesService";
import type { Publicacion } from "@/types/Publicacion";

export default function Buscar() {
  const [tab, setTab] = useState<'arriendos' | 'personas'>('arriendos');
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    obtenerPublicaciones()
      .then((datos) => { if (activo) setPublicaciones(datos); })
      .catch(() => { if (activo) setErrorCarga(true); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [intento]);

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'arriendos' && styles.tabActiva]}
          onPress={() => setTab('arriendos')}
        >
          <Text style={[styles.tabTexto, tab === 'arriendos' && styles.tabTextoActivo]}>
            Arriendos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, tab === 'personas' && styles.tabActiva]}
          onPress={() => setTab('personas')}
        >
          <Text style={[styles.tabTexto, tab === 'personas' && styles.tabTextoActivo]}>
            Personas
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'arriendos' ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {cargando ? <ActivityIndicator size="large" color={colors.primary} /> :
            errorCarga ? (
              <View style={styles.centrado}>
                <Text>No pudimos cargar las publicaciones.</Text>
                <CustomButton titulo="Reintentar" onPress={() => {
                  setCargando(true);
                  setErrorCarga(false);
                  setIntento((valor) => valor + 1);
                }} />
              </View>
            ) : <BuscadorPublicaciones publicaciones={publicaciones} />}
        </ScrollView>
      ) : (
        <BuscadorPersonas />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActiva: { borderBottomColor: colors.primary },
  tabTexto: { color: paletaPublicacion.textoSecundario, fontWeight: '600' },
  tabTextoActivo: { color: colors.primary },
});
