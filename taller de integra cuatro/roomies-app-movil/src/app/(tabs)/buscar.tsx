import { useEffect, useState } from "react";
import { Text, View, StyleSheet, TouchableOpacity, FlatList, ScrollView, ActivityIndicator} from "react-native";
import { UsuarioCard } from "@/components/Usuario_Card";
import { usuariosMock } from "@/mocks/usuarios";
import { colors } from "@/theme/colors";
import { paletaPublicacion } from "@/constants/origenPublicacion";
import BuscadorPublicaciones from '@/components/BuscadorPublicaciones';
import BuscadorPersonas from '@/components/BuscadorPersonas';
import BarraBusqueda from '@/components/BarraBusqueda';
import { obtenerPublicaciones } from "@/services/publicaciones.service";


export default function Buscar() {
  const [tab, setTab] = useState<'arriendos' | 'personas'>('arriendos');
  const [publicaciones, setPublicaciones] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    // setTimeout simula el tiempo de carga de una conexión a internet real
    setTimeout(async () => {
      const datos = await obtenerPublicaciones();
      setPublicaciones(datos);
      setCargando(false);
    }, 800);
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

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
          <BuscadorPublicaciones publicaciones={publicaciones} />        
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
  contenido: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nota: { color: paletaPublicacion.textoSecundario },
});
