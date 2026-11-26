import React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { CustomButton } from '@/components/CustomButton';
import { LineaEstadoPostulacion } from '@/components/postulaciones/LineaEstadoPostulacion';
import { PostulacionCard } from '@/components/postulaciones/PostulacionCard';
import { paletaPublicacion } from '@/constants/origenPublicacion';
import { useAuth } from '@/hooks/useAuth';
import { useDetallePostulacion } from '@/hooks/useDetallePostulacion';
import { useMisPostulaciones } from '@/hooks/useMisPostulaciones';
import { puedeRetirarse } from '@/services/postulacionesService';
import { colors } from '@/theme/colors';
import { mensajeDeRetiro } from '@/types/erroresServidor';
import { type Postulacion } from '@/types/Postulacion';

// M4-C11: postulaciones reales (GET /api/postulaciones/mias).
// - /postulaciones                   -> listado de mis postulaciones.
// - /postulaciones?idPublicacion=4   -> "Mi postulación" de esa publicación (a
//   donde lleva "Ver mi postulación" del detalle y cada tarjeta del listado).
// Muestra el estado que recibe del backend. La única acción es retirar una
// postulación Pendiente o Preseleccionada (M4S3-C03); la aceptación o el rechazo
// los decide siempre el arrendador, y la app nunca los fuerza.

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
  const {
    estado,
    postulaciones,
    error,
    reintentar,
    hayMas,
    cargandoMas,
    errorMas,
    cargarMas,
    idRetirando,
    retirar,
  } = useMisPostulaciones();

  // Si hubo varias postulaciones a la misma publicación (p. ej. una cancelada y
  // otra nueva), el backend las entrega de la más reciente a la más antigua.
  const postulacionEnLista = idPublicacion
    ? postulaciones.find((p) => p.idPublicacion === Number(idPublicacion))
    : undefined;
  // GET /api/postulaciones/{id}: estado más reciente de esa postulación. Los hooks
  // se llaman antes de cualquier retorno anticipado de la pantalla.
  const detallePostulacion = useDetallePostulacion(
    postulacionEnLista?.idPostulacion,
    postulacionEnLista?.estado,
  );

  // Confirma, retira y explica el resultado. El POST no se repite solo: si la
  // respuesta fue ambigua el servicio ya consultó el estado, y si no se pudo
  // confirmar se avisa que se puede reintentar sin riesgo.
  const confirmarRetiro = (postulacion: Postulacion) => {
    Alert.alert(
      'Retirar postulación',
      'Se cancelará tu postulación y el arrendador dejará de verla como abierta. Podrás volver a postular después.',
      [
        { text: 'Conservar', style: 'cancel' },
        {
          text: 'Retirar',
          style: 'destructive',
          onPress: async () => {
            const resultado = await retirar(postulacion.idPostulacion);
            if (!resultado) return;
            if (resultado.exito) {
              Alert.alert('Postulación retirada', 'Tu postulación quedó cancelada.');
              return;
            }
            if (resultado.codigo === 'sin_sesion' || resultado.codigo === 'no_autorizado') {
              Alert.alert('Inicia sesión', resultado.error);
              return;
            }
            const ambiguo =
              resultado.codigo === 'red' ||
              resultado.codigo === 'tiempo_agotado' ||
              resultado.codigo === 'respuesta_invalida';
            Alert.alert(
              'No se pudo retirar',
              ambiguo
                ? 'No pudimos confirmar el retiro. Revisamos el estado y tu postulación sigue abierta: puedes intentarlo otra vez.'
                : mensajeDeRetiro(resultado),
            );
          },
        },
      ],
    );
  };

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
            <View key={postulacion.idPostulacion} style={styles.tarjetaListado}>
              <Pressable
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
              {puedeRetirarse(postulacion.estado) ? (
                <View style={styles.accionTarjeta}>
                  <CustomButton
                    titulo={idRetirando === postulacion.idPostulacion ? 'Retirando…' : 'Retirar postulación'}
                    variante="contorno"
                    deshabilitado={idRetirando !== null}
                    onPress={() => confirmarRetiro(postulacion)}
                  />
                </View>
              ) : null}
            </View>
          ))}

          {errorMas ? (
            <Text style={styles.errorMas}>{errorMas.error}</Text>
          ) : null}
          {hayMas ? (
            <View style={styles.accionTarjeta}>
              <CustomButton
                titulo={cargandoMas ? 'Cargando…' : errorMas ? 'Reintentar' : 'Ver más postulaciones'}
                variante="contorno"
                deshabilitado={cargandoMas}
                onPress={() => void cargarMas()}
              />
            </View>
          ) : null}
        </ScrollView>
      </>
    );
  }

  // --- Detalle: "Mi postulación" de una publicación ------------------------
  // El detalle del servidor manda sobre la fila de la lista cuando ya llegó.
  const postulacion = detallePostulacion ?? postulacionEnLista;

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

  const irAMiArriendo = () => router.push('/arriendo' as Href);

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
        <LineaEstadoPostulacion estado={postulacion.estado} motivo={postulacion.motivo} />

        {postulacion.motivo ? (
          <View style={styles.motivo}>
            <Text style={styles.motivoTitulo}>Motivo</Text>
            <Text style={styles.motivoTexto}>{postulacion.motivo}</Text>
          </View>
        ) : null}

        {postulacion.estado === 'Aceptada' ? (
          <View style={styles.accion}>
            <CustomButton titulo="Ir a Mi arriendo" onPress={irAMiArriendo} />
          </View>
        ) : null}

        {puedeRetirarse(postulacion.estado) ? (
          <View style={styles.accion}>
            <CustomButton
              titulo={idRetirando === postulacion.idPostulacion ? 'Retirando…' : 'Retirar postulación'}
              variante="contorno"
              deshabilitado={idRetirando !== null}
              onPress={() => confirmarRetiro(postulacion)}
            />
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
  accionTarjeta: {
    marginTop: 8,
  },
  errorMas: {
    fontSize: 13,
    color: '#B91C1C',
    textAlign: 'center',
    marginBottom: 8,
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
