import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { CustomButton } from '@/components/CustomButton';
import { LineaEstadoPostulacion } from '@/components/postulaciones/LineaEstadoPostulacion';
import { PostulacionCard } from '@/components/postulaciones/PostulacionCard';
import { chatPorEstadoPostulacion } from '@/constants/estadoPostulacion';
import { paletaPublicacion } from '@/constants/origenPublicacion';
import { publicacionesMock } from '@/mocks';
import { postulacionesMock } from '@/mocks/postulaciones';
import { colors } from '@/theme/colors';

// M4-C09: "Mi postulación" con datos de demostración (mocks).
// Se abre con la publicación a la que se postuló: /postulaciones?idPublicacion=4
// (luego en M4-C10 se vera desde el detalle, "Ver mi postulación"). Solo muestra el estado que recibe; no
// hay ninguna acción que lo cambie. En M4-C11 se reemplazara el mock por el endpoint GET /postulaciones/mias.
export default function MiPostulacion() {
  const router = useRouter();
  const { idPublicacion } = useLocalSearchParams<{ idPublicacion?: string }>();

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const opcionesHeader = {
    headerShown: true,
    title: 'Mi postulación',
    headerTintColor: colors.primary,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerLeft: () => (
      <Pressable
        onPress={volver}
        hitSlop={12}
        accessibilityLabel="Volver"
        style={{ paddingHorizontal: 12 }}
      >
        <Ionicons name="arrow-back" size={24} color={colors.primary} />
      </Pressable>
    ),
  };

  const postulacion = postulacionesMock.find((p) => p.idPublicacion === Number(idPublicacion));

  if (!postulacion) {
    return (
      <>
        <Stack.Screen options={opcionesHeader} />
        <View style={styles.vacio}>
          <Ionicons name="document-text-outline" size={40} color={colors.primary} />
          <Text style={styles.vacioTitulo}>No encontramos tu postulación</Text>
          <Text style={styles.vacioTexto}>
            Aún no te has postulado a esta publicación o esta no existe.
          </Text>
          <View style={styles.vacioBoton}>
            <CustomButton
              titulo="Volver a publicaciones"
              onPress={() => router.replace('/(tabs)')}
            />
          </View>
        </View>
      </>
    );
  }

  const publicacion = publicacionesMock.find((p) => p.idPublicacion === postulacion.idPublicacion);
  const chat = chatPorEstadoPostulacion[postulacion.estado];

  return (
    <>
      <Stack.Screen options={opcionesHeader} />
      <ScrollView
        style={styles.pantalla}
        contentContainerStyle={styles.contenido}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.aviso}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.avisoTexto}>
            (Datos de demostración)
          </Text>
        </View>

        <PostulacionCard postulacion={postulacion} publicacion={publicacion} />

        <Text style={styles.seccionTitulo}>Estado de la postulación</Text>
        <LineaEstadoPostulacion estado={postulacion.estado} />

        {chat ? (
          <View style={styles.chat}>
            <View style={styles.chatCabecera}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
              <Text style={styles.chatTitulo}>Chat con arrendador</Text>
            </View>
            <Text style={styles.chatTexto}>{chat.texto}</Text>
            {chat.nota ? <Text style={styles.chatNota}>{chat.nota}</Text> : null}
          </View>
        ) : null}

        <View style={styles.accion}>
          <CustomButton
            titulo="Volver a publicaciones"
            variante="contorno"
            onPress={() => router.replace('/(tabs)')}
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contenido: {
    padding: 16,
    paddingBottom: 32,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: paletaPublicacion.fondoSuave,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  avisoTexto: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: paletaPublicacion.textoPrincipal,
  },
  seccionTitulo: {
    fontSize: 20,
    fontWeight: '700',
    color: paletaPublicacion.textoPrincipal,
    marginTop: 24,
    marginBottom: 12,
  },
  chat: {
    backgroundColor: paletaPublicacion.fondoSuave,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E0FA',
    padding: 16,
    marginTop: 20,
  },
  chatCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  chatTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  chatTexto: {
    fontSize: 14,
    lineHeight: 20,
    color: paletaPublicacion.textoSecundario,
  },
  chatNota: {
    fontSize: 12,
    color: paletaPublicacion.textoSecundario,
    marginTop: 8,
  },
  accion: {
    marginTop: 20,
  },
  vacio: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  vacioTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: paletaPublicacion.textoPrincipal,
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  vacioTexto: {
    fontSize: 14,
    color: paletaPublicacion.textoSecundario,
    textAlign: 'center',
    marginBottom: 20,
  },
  vacioBoton: {
    width: '100%',
  },
});
