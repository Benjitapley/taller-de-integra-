import React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { CustomButton } from '@/components/CustomButton';
import { LineaEstadoPostulacion } from '@/components/postulaciones/LineaEstadoPostulacion';
import { PostulacionCard } from '@/components/postulaciones/PostulacionCard';
import { chatPorEstadoPostulacion } from '@/constants/estadoPostulacion';
import { paletaPublicacion } from '@/constants/origenPublicacion';
import { useAuth } from '@/hooks/useAuth';
import { useMisPostulaciones } from '@/hooks/useMisPostulaciones';
import { colors } from '@/theme/colors';

// M4-C11: postulaciones reales (GET /api/postulaciones/mias).
// - /postulaciones                   -> listado de mis postulaciones.
// - /postulaciones?idPublicacion=4   -> "Mi postulación" de esa publicación (a
//   donde lleva "Ver mi postulación" del detalle y cada tarjeta del listado).
// Solo muestra el estado que recibe del backend: no hay ninguna acción que lo
// cambie, ni forma de forzar una aceptación desde la app.

// `sesion_no_disponible` es un fallo pasajero: solo ofrece reintentar, no cerrar sesión.
const ERRORES_DE_SESION = ['sin_sesion', 'no_autorizado'];

function Mensaje({
  icono,
  titulo,
  texto,
  children,
}: {
  icono: React.ComponentProps<typeof Ionicons>['name'];
  titulo: string;
  texto: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.vacio}>
      <Ionicons name={icono} size={40} color={colors.primary} />
      <Text style={styles.vacioTitulo}>{titulo}</Text>
      <Text style={styles.vacioTexto}>{texto}</Text>
      {children ? <View style={styles.vacioBoton}>{children}</View> : null}
    </View>
  );
}

export default function MiPostulacion() {
  const router = useRouter();
  const { estaAutenticado, cerrarSesion } = useAuth();
  const { idPublicacion } = useLocalSearchParams<{ idPublicacion?: string }>();
  const { estado, postulaciones, error, reintentar } = useMisPostulaciones();

  // /login solo existe sin sesión (Stack.Protected en app/_layout.tsx): con una sesión
  // que el servicio rechazó se cierra la sesión y el guard lleva solo al login.
  const iniciarSesion = async () => {
    if (!estaAutenticado) {
      router.push('/login');
      return;
    }
    const cierre = await cerrarSesion();
    if (!cierre.exito && !cierre.sesionLocalCerrada) {
      Alert.alert('No se pudo cerrar la sesión', cierre.error);
    }
  };

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const irAPublicaciones = () => router.replace('/(tabs)');

  const enListado = !idPublicacion;

  const opcionesHeader = {
    headerShown: true,
    title: enListado ? 'Mis postulaciones' : 'Mi postulación',
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

  if (estado === 'cargando') {
    return (
      <>
        <Stack.Screen options={opcionesHeader} />
        <View style={styles.vacio}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.vacioTexto}>Cargando tus postulaciones…</Text>
        </View>
      </>
    );
  }

  if (estado === 'error') {
    const requiereSesion = !!error && ERRORES_DE_SESION.includes(error.codigo);
    return (
      <>
        <Stack.Screen options={opcionesHeader} />
        <Mensaje
          icono="cloud-offline-outline"
          titulo="No pudimos cargar tus postulaciones"
          texto={error?.error ?? 'Inténtalo otra vez en un momento.'}
        >
          {requiereSesion ? (
            <CustomButton titulo="Iniciar sesión" onPress={iniciarSesion} />
          ) : null}
          <CustomButton
            titulo="Reintentar"
            variante={requiereSesion ? 'contorno' : undefined}
            onPress={reintentar}
          />
        </Mensaje>
      </>
    );
  }

  // --- Listado: sin publicación indicada ----------------------------------
  if (enListado) {
    if (postulaciones.length === 0) {
      return (
        <>
          <Stack.Screen options={opcionesHeader} />
          <Mensaje
            icono="document-text-outline"
            titulo="Aún no tienes postulaciones"
            texto="Cuando postules a una publicación de arrendador, podrás ver aquí cómo va tu solicitud."
          >
            <CustomButton titulo="Ver publicaciones" onPress={irAPublicaciones} />
          </Mensaje>
        </>
      );
    }

    return (
      <>
        <Stack.Screen options={opcionesHeader} />
        <ScrollView
          style={styles.pantalla}
          contentContainerStyle={styles.contenido}
          showsVerticalScrollIndicator={false}
        >
          {postulaciones.map((postulacion) => (
            <Pressable
              key={postulacion.idPostulacion}
              style={styles.tarjetaListado}
              accessibilityRole="button"
              accessibilityLabel={`Ver postulación a ${postulacion.tituloPublicacion ?? 'la publicación'}`}
              onPress={() =>
                router.push({
                  pathname: '/postulaciones',
                  params: { idPublicacion: String(postulacion.idPublicacion) },
                } as Href)
              }
            >
              <PostulacionCard postulacion={postulacion} />
            </Pressable>
          ))}
        </ScrollView>
      </>
    );
  }

  // --- Detalle: "Mi postulación" de una publicación ------------------------
  // Si hubo varias postulaciones a la misma publicación (p. ej. una cancelada y
  // otra nueva), el backend las entrega de la más reciente a la más antigua.
  const postulacion = postulaciones.find((p) => p.idPublicacion === Number(idPublicacion));

  if (!postulacion) {
    return (
      <>
        <Stack.Screen options={opcionesHeader} />
        <Mensaje
          icono="document-text-outline"
          titulo="No encontramos tu postulación"
          texto="Aún no te has postulado a esta publicación o esta no existe."
        >
          <CustomButton titulo="Ver mis postulaciones" onPress={() => router.replace('/postulaciones')} />
          <CustomButton titulo="Volver a publicaciones" variante="contorno" onPress={irAPublicaciones} />
        </Mensaje>
      </>
    );
  }

  const chat = chatPorEstadoPostulacion[postulacion.estado];

  return (
    <>
      <Stack.Screen options={opcionesHeader} />
      <ScrollView
        style={styles.pantalla}
        contentContainerStyle={styles.contenido}
        showsVerticalScrollIndicator={false}
      >
        <PostulacionCard postulacion={postulacion} />

        <Text style={styles.seccionTitulo}>Estado de la postulación</Text>
        <LineaEstadoPostulacion estado={postulacion.estado} />

        {postulacion.motivo ? (
          <View style={styles.motivo}>
            <Text style={styles.motivoTitulo}>Motivo</Text>
            <Text style={styles.motivoTexto}>{postulacion.motivo}</Text>
          </View>
        ) : null}

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
            titulo="Ver mis postulaciones"
            variante="contorno"
            onPress={() => router.replace('/postulaciones')}
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
    gap: 10,
  },
  tarjetaListado: {
    marginBottom: 12,
  },
  motivo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 16,
  },
  motivoTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: paletaPublicacion.textoPrincipal,
    marginBottom: 4,
  },
  motivoTexto: {
    fontSize: 14,
    lineHeight: 20,
    color: paletaPublicacion.textoSecundario,
  },
});
