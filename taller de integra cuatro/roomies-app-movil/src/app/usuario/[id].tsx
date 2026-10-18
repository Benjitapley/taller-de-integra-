import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { usuariosMock } from '@/mocks/usuarios';
import { colors } from '@/theme/colors';
import { paletaPublicacion } from '@/constants/origenPublicacion';
import type { Usuario } from '@/types/Usuario';


function formatoPrecio(precio: number): string {
  return `$${String(precio).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CLP`;
}

function calcularEdad(fechaNacimiento: string): number {
  const nacimiento = new Date(fechaNacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumple =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (aunNoCumple) edad--;
  return edad;
}

function InfoFila({
  icono,
  etiqueta,
  valor,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  etiqueta: string;
  valor: string;
}) {
  return (
    <View style={styles.infoFila}>
      <Ionicons name={icono} size={20} color={colors.primary} />
      <View style={styles.infoTextos}>
        <Text style={styles.infoEtiqueta}>{etiqueta}</Text>
        <Text style={styles.infoValor}>{valor}</Text>
      </View>
    </View>
  );
}


function DetallePerfil({ usuario }: { usuario: Usuario }) {
  const verificado = usuario.estadoVerificacion === 'Verificada';
  const colorEstado = verificado ? colors.success : colors.warning;

  return (
    <ScrollView contentContainerStyle={styles.contenido}>
      <View style={styles.portada}>
        {usuario.fotoPerfilUrl ? (
          <Image source={{ uri: usuario.fotoPerfilUrl }} style={styles.foto} />
        ) : (
          <View style={[styles.foto, styles.fotoVacia]}>
            <Ionicons name="person" size={56} color={colors.primary} />
          </View>
        )}

        <Text style={styles.nombre}>
          {usuario.nombre}, {calcularEdad(usuario.fechaNacimiento)}
        </Text>

        <View style={[styles.chip, { backgroundColor: `${colorEstado}1A` }]}>
          <Ionicons
            name={verificado ? 'checkmark-circle' : 'time-outline'}
            size={16}
            color={colorEstado}
          />
          <Text style={styles.chipTexto}>{usuario.estadoVerificacion}</Text>
        </View>

        {usuario.calificacionPromedio !== undefined ? (
          <View style={styles.fila}>
            <Ionicons name="star" size={18} color={colors.warning} />
            <Text style={styles.calificacion}>{usuario.calificacionPromedio.toFixed(1)}</Text>
            {usuario.cantidadEvaluaciones !== undefined ? (
              <Text style={styles.evaluaciones}>({usuario.cantidadEvaluaciones} evaluaciones)</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.evaluaciones}>Sin evaluaciones aún</Text>
        )}
      </View>

      <View style={styles.bloque}>
        <InfoFila icono="wallet-outline" etiqueta="Presupuesto" valor={formatoPrecio(usuario.presupuesto)} />
        <InfoFila icono="location-outline" etiqueta="Zona de interés" valor={usuario.zonaInteres} />
        <InfoFila icono="person-outline" etiqueta="Ocupación" valor={usuario.ocupacion} />
      </View>
    </ScrollView>
  );
}


export default function PerfilPublico() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const usuario = usuariosMock.find((u) => String(u.idUsuario) === id);

  return (
    <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false}} />

        <TouchableOpacity style= {styles.encabezado} onPress={() => router.back()} accessibilityLabel="Volver">
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
            <Text style={styles.encabezadoTexto}>Perfil</Text>
        </TouchableOpacity>
      


        {usuario ? (
            <DetallePerfil usuario={usuario} />
        ) : (
            <Text style={styles.vacio}>Usuario no encontrado</Text>
        )}
      </View>
    );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  encabezado: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  encabezadoTexto: { fontSize: 18, fontWeight: '700', color: colors.primary, marginLeft: 12 },
  contenido: { padding: 20, paddingBottom: 40 },
  portada: { alignItems: 'center' },
  foto: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: colors.primary },
  fotoVacia: {
    backgroundColor: paletaPublicacion.fondoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombre: { fontSize: 24, fontWeight: '800', color: paletaPublicacion.textoPrincipal, marginTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 10,
  },
  chipTexto: { fontSize: 13, fontWeight: '600', color: paletaPublicacion.textoPrincipal, marginLeft: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  calificacion: { fontSize: 16, fontWeight: '700', color: paletaPublicacion.textoPrincipal, marginLeft: 4 },
  evaluaciones: { fontSize: 14, color: paletaPublicacion.textoSecundario, marginLeft: 6, marginTop: 12 },
  bloque: {
    backgroundColor: paletaPublicacion.fondoSuave,
    borderRadius: 14,
    padding: 16,
    marginTop: 28,
  },
  infoFila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoTextos: { marginLeft: 14 },
  infoEtiqueta: { fontSize: 12, color: paletaPublicacion.textoSecundario },
  infoValor: { fontSize: 16, fontWeight: '600', color: paletaPublicacion.textoPrincipal, marginTop: 2 },
  vacio: { textAlign: 'center', marginTop: 40, color: paletaPublicacion.textoSecundario },
});