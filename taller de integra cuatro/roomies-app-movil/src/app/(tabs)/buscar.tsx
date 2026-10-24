import { useState } from "react";
import { Text, View, StyleSheet, TouchableOpacity, FlatList, ScrollView} from "react-native";
import { UsuarioCard } from "@/components/Usuario_Card";
import { usuariosMock } from "@/mocks/usuarios";
import { colors } from "@/theme/colors";
import { paletaPublicacion } from "@/constants/origenPublicacion";
import BuscadorPublicaciones from '@/components/BuscadorPublicaciones';


export default function Buscar() {
  const [tab, setTab] = useState<'arriendos' | 'personas'>('arriendos');
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
            <BuscadorPublicaciones />
        </ScrollView>
      ) : (
        <FlatList
          data={usuariosMock}
          keyExtractor={(u) => String(u.idUsuario)}
          renderItem={({ item }) => <UsuarioCard usuario={item} />}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
