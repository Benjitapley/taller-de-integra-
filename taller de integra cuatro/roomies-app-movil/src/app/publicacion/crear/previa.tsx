import React, { useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CustomButton } from "@/components/CustomButton";
import { PublicacionCard } from "@/components/Publicacion_Card";
import { PasoPublicacion } from "@/components/publicaciones/PasoPublicacion";
import {
  ENVIAR_ENLACE_REFERENCIA,
  ENVIAR_PERMITIR_COMENTARIOS,
} from "@/constants/camposPublicacion";
import { paletaPublicacion } from "@/constants/origenPublicacion";
import { OPCIONES_TIPO_VIVIENDA } from "@/constants/tipoVivienda";
import { useAuth } from "@/hooks/useAuth";
import { consultarPublicacionCreada, crearPublicacion } from "@/services/publicacionesService";
import { colors } from "@/theme/colors";
import type { Publicacion } from "@/types/Publicacion";
import { armarParametrosBorrador, leerBorradorDesdeParams } from "@/utils/borradorPublicacion";
import { descartarBorradorPersistido } from "@/utils/borradorPersistente";
import { mensajeDeError } from "@/types/erroresServidor";
import { claveParaBorrador, olvidarClaveBorrador } from "@/utils/claveIdempotencia";
import { leerFotosBorrador, limpiarFotosBorrador } from "@/utils/fotosBorrador";

function FilaDetalle({
  icono,
  texto,
  secundario,
}: {
  icono: React.ComponentProps<typeof Ionicons>["name"];
  texto: string;
  secundario?: string;
}) {
  return (
    <View style={styles.filaDetalle}>
      <Ionicons name={icono} size={18} color={colors.primary} />
      <View style={styles.textosDetalle}>
        <Text style={styles.detalleTexto}>{texto}</Text>
        {secundario ? <Text style={styles.detalleSecundario}>{secundario}</Text> : null}
      </View>
    </View>
  );
}

export default function Previa() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { cerrarSesion, sesion } = useAuth();
  const idUsuario = sesion?.user.id ?? null;
  // El ref bloquea el doble toque al instante; el estado solo cambia la interfaz.
  const publicandoRef = useRef(false);
  const [publicando, setPublicando] = useState(false);

  // Al "Volver a editar" regresa al paso anterior (Fotos), que sigue montado con
  // sus fotos y el formulario conserva lo escrito porque nunca se desmonta.
  const volver = () => {
    if (publicandoRef.current) return; // no salir con un envío en curso
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/publicar");
  };

  const opcionesHeader = {
    headerShown: true,
    title: "Vista previa",
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

  // Si se abre la ruta sin pasar por el formulario, o con datos que no pasan la
  // validación, no hay nada que mostrar.
  const valores = leerBorradorDesdeParams(params);

  if (!valores) {
    return (
      <>
        <Stack.Screen options={opcionesHeader} />
        <View style={styles.vacio}>
          <Text style={styles.vacioTexto}>
            No hay datos para mostrar. Completa el formulario primero.
          </Text>
          <CustomButton
            titulo="Ir a publicar"
            onPress={() => router.replace("/(tabs)/publicar")}
          />
        </View>
      </>
    );
  }

  const fotos = leerFotosBorrador(valores.tipo);
  const enlace = valores.enlaceReferencia.trim();
  const vivienda = OPCIONES_TIPO_VIVIENDA.find((o) => o.valor === valores.tipoVivienda);

  // Publicación solo para dibujar la tarjeta: aún no existe en el backend,
  // por eso el id es 0 y los cupos libres son los ingresados.
  const publicacion: Publicacion = {
    idPublicacion: 0,
    idUsuario: 0,
    tipo: valores.tipo,
    titulo: valores.titulo.trim(),
    descripcion: valores.descripcion.trim(),
    precio: Number(valores.precio),
    ubicacion: `${valores.nombreComuna}, ${valores.nombreRegion}`,
    estado: "Disponible",
    cuposTotales: Number(valores.cupos),
    cuposDisponibles: Number(valores.cupos),
    imagenPrincipalUrl: fotos[0],
  };

  // Crea la publicación según su origen. Las reglas de negocio las valida
  // el backend; aquí solo se interpreta su respuesta. Un error nunca se trata
  // como creación exitosa.
  const publicar = async () => {
    if (publicandoRef.current) return;
    publicandoRef.current = true;
    setPublicando(true);

    // Una clave por borrador: si el envío se repite con lo mismo (timeout, red, doble
    // toque), el servidor devuelve la misma respuesta en vez de crear un duplicado.
    // Si algo cambió, la huella cambia y se usa una clave nueva.
    const huella = JSON.stringify(armarParametrosBorrador(valores)) + "|" + fotos.join("|");
    const resultado = await crearPublicacion(valores, undefined, {
      imagenesUris: fotos,
      claveIdempotencia: claveParaBorrador(huella),
    });

    if (resultado.exito) {
      // 201 confirmado: el borrador ya no hace falta. Luego se consulta el detalle.
      olvidarClaveBorrador();
      limpiarFotosBorrador();
      if (idUsuario) await descartarBorradorPersistido(idUsuario);
      const detalle = await consultarPublicacionCreada(resultado.datos.id);

      publicandoRef.current = false;
      setPublicando(false);

      // Se cierra el flujo de creación para que "atrás" no vuelva a un formulario lleno.
      router.dismissAll();
      if (!detalle.exito) {
        // La publicación existe (el POST respondió 201): no se ofrece crearla otra vez.
        Alert.alert(
          "Publicación creada",
          "Tu publicación se creó, pero no pudimos cargar su detalle ahora. Revísala en unos momentos.",
        );
        return;
      }
      router.push({
        pathname: "/publicacion/[id]",
        params: { id: String(detalle.idPublicacion) },
      });
      return;
    }

    publicandoRef.current = false;
    setPublicando(false);

    // Sin sesión o sesión rechazada por el servicio. /login está protegido por
    // `Stack.Protected guard={!estaAutenticado}` en app/_layout.tsx, así que no
    // se puede navegar hasta allí con la sesión activa: se cierra la sesión y
    // el guard lleva solo a la pantalla de login.
    // (`sesion_no_disponible` es un fallo pasajero al leer la sesión: no cierra
    // nada y cae en el aviso genérico de abajo, con opción de reintentar.)
    if (resultado.codigo === "sin_sesion" || resultado.codigo === "no_autorizado") {
      Alert.alert(
        "Tu sesión no es válida",
        "Vuelve a iniciar sesión para publicar. Al hacerlo se cierra esta pantalla y tendrás que completar el formulario de nuevo.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Iniciar sesión",
            onPress: async () => {
              const cierre = await cerrarSesion();
              if (!cierre.exito && !cierre.sesionLocalCerrada) {
                Alert.alert("No se pudo cerrar la sesión", cierre.error);
              }
            },
          },
        ],
      );
      return;
    }

    // Respuesta 2xx ilegible: la publicación pudo haberse creado.
    if (resultado.codigo === "respuesta_invalida" && (resultado.estadoHttp ?? 0) < 300) {
      Alert.alert(
        "Revisa tus publicaciones",
        "No pudimos confirmar el resultado. Es posible que la publicación se haya creado: revisa antes de volver a intentarlo.",
      );
      return;
    }

    Alert.alert("No se pudo publicar", mensajeDeError(resultado));
  };

  return (
    <>
      <Stack.Screen options={opcionesHeader} />
      <ScrollView
        style={styles.pantalla}
        contentContainerStyle={styles.contenedor}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.filaBorrador}>
          <PasoPublicacion
            paso={3}
            etiqueta="Revisa tu publicación"
            mostrarBarra={false}
          />
          <View style={styles.chipBorrador}>
            <Text style={styles.chipBorradorTexto}>Borrador</Text>
          </View>
        </View>
        <PublicacionCard
          publicacion={publicacion}
          imagenesUrls={fotos}
          modoVistaPrevia
        />

        {vivienda ? (
          <View style={styles.detalles}>
            <FilaDetalle icono={vivienda.icono} texto={vivienda.etiqueta} />
            <FilaDetalle
              icono="paw-outline"
              texto={valores.aceptaMascotas ? "Se aceptan mascotas" : "No se aceptan mascotas"}
            />
            {ENVIAR_PERMITIR_COMENTARIOS && (
              <FilaDetalle
                icono="chatbubbles-outline"
                texto={
                  valores.permitirComentarios
                    ? "Se permiten comentarios"
                    : "Comentarios desactivados"
                }
              />
            )}
            {valores.reglas.length > 0 && (
              <FilaDetalle
                icono="list-outline"
                texto={`${valores.reglas.length} ${valores.reglas.length === 1 ? "regla" : "reglas"} de la casa`}
              />
            )}
          </View>
        ) : null}

        {ENVIAR_ENLACE_REFERENCIA && valores.tipo === "Compartida" && enlace ? (
          <View style={styles.filaEnlace}>
            <Ionicons
              name="link-outline"
              size={16}
              color={paletaPublicacion.textoSecundario}
            />
            <Text style={styles.enlaceTexto} numberOfLines={1}>
              {enlace}
            </Text>
          </View>
        ) : null}

        <Text style={styles.aviso}>
          Así la verán otros usuarios una vez publicada.
        </Text>

        <View style={styles.acciones}>
          <CustomButton
            titulo={publicando ? "Publicando..." : "Publicar ahora"}
            deshabilitado={publicando}
            onPress={publicar}
          />
          <CustomButton
            titulo="Volver a editar"
            variante="contorno"
            deshabilitado={publicando}
            onPress={volver}
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
  contenedor: {
    padding: 16,
    paddingBottom: 32,
  },
  filaBorrador: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  chipBorrador: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
  },
  chipBorradorTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },
  detalles: {
    marginTop: 14,
    padding: 12,
    gap: 10,
    borderRadius: 12,
    backgroundColor: paletaPublicacion.fondoSuave,
  },
  filaDetalle: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  textosDetalle: {
    flex: 1,
  },
  detalleTexto: {
    fontSize: 14,
    color: paletaPublicacion.textoPrincipal,
  },
  detalleSecundario: {
    marginTop: 2,
    fontSize: 12,
    color: paletaPublicacion.textoSecundario,
  },
  filaEnlace: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  enlaceTexto: {
    flex: 1,
    fontSize: 14,
    color: paletaPublicacion.textoSecundario,
  },
  aviso: {
    marginTop: 14,
    marginBottom: 16,
    fontSize: 14,
    color: paletaPublicacion.textoSecundario,
  },
  acciones: {
    gap: 12,
  },
  vacio: {
    flex: 1,
    padding: 16,
    gap: 16,
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  vacioTexto: {
    fontSize: 15,
    textAlign: "center",
    color: paletaPublicacion.textoSecundario,
  },
});
