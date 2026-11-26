import { useEffect, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image, type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CustomButton } from "@/components/CustomButton";
import { PasoPublicacion } from "@/components/publicaciones/PasoPublicacion";
import {
  LIMITE_FOTOS_POR_ORIGEN,
  MAX_MEGAPIXELES_FOTO,
  TAMANO_MAX_FOTO_MB,
  lugarFotosPorOrigen,
} from "@/constants/fotosPublicacion";
import { paletaPublicacion, textosFormularioPorOrigen } from "@/constants/origenPublicacion";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/theme/colors";
import { armarParametrosBorrador, leerBorradorDesdeParams } from "@/utils/borradorPublicacion";
import { guardarFotosPersistidas, leerBorradorPersistido } from "@/utils/borradorPersistente";
import { guardarFotosBorrador, limpiarFotosBorrador } from "@/utils/fotosBorrador";
import { motivoRechazoFoto } from "@/utils/validarFotoPublicacion";

const COLUMNAS = 3;
const SEPARACION = 10;

// Paso 2 de 3: fotos de la publicación (opcionales).
//
// Las fotos viven en el estado de ESTA pantalla y, además, se guardan en el borrador
// persistente (utils/borradorPersistente.ts) para que sobrevivan a un reinicio:
// - Al ir a la vista previa, esta pantalla sigue montada debajo en la pila; al
//   volver desde la vista previa las fotos siguen aquí.
// - Al volver al formulario esta pantalla se desmonta (se limpia la copia en
//   memoria) y al entrar de nuevo se recuperan las del borrador.
// Una URI guardada puede haber dejado de existir (cache limpiado): se comprueba.
const fotoExiste = (uri: string) =>
  new Promise<boolean>((resolver) => {
    Image.getSize(uri, () => resolver(true), () => resolver(false));
  });

export default function Fotos() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { sesion } = useAuth();
  const idUsuario = sesion?.user.id ?? null;

  const [fotos, setFotos] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [abriendoGaleria, setAbriendoGaleria] = useState(false);
  const [anchoGrilla, setAnchoGrilla] = useState(0);
  const [hidratado, setHidratado] = useState(false);
  const borradorParams = useRef(leerBorradorDesdeParams(params));

  // Recupera las fotos del borrador guardado (solo las que siguen existiendo).
  useEffect(() => {
    let vigente = true;
    async function recuperar() {
      const guardado = idUsuario ? await leerBorradorPersistido(idUsuario) : null;
      const existentes: string[] = [];
      for (const uri of guardado?.fotos ?? []) {
        if (await fotoExiste(uri)) existentes.push(uri);
      }
      if (!vigente) return;
      // No pisa fotos que la persona ya haya elegido mientras tanto.
      setFotos((actuales) => (actuales.length > 0 ? actuales : existentes));
      setHidratado(true);
    }
    recuperar();
    return () => {
      vigente = false;
    };
  }, [idUsuario]);

  // La vista previa lee las fotos desde memoria (no por la ruta). Se mantienen
  // sincronizadas mientras esta pantalla está montada y se descartan al salir.
  useEffect(() => {
    if (!hidratado) return; // antes de recuperar, [] no debe pisar el borrador
    guardarFotosBorrador(fotos);
    if (idUsuario && borradorParams.current) {
      guardarFotosPersistidas(idUsuario, fotos, borradorParams.current);
    }
  }, [fotos, hidratado, idUsuario]);
  useEffect(() => limpiarFotosBorrador, []);

  const volver = () =>
    router.canGoBack() ? router.back() : router.replace("/");

  const opcionesHeader = {
    headerShown: true,
    title: "Crear publicación",
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

  // Si se abre la ruta sin pasar por el formulario no hay origen ni datos.
  const borrador = leerBorradorDesdeParams(params);

  if (!borrador) {
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

  // Constante nueva (no nula) para que también valga dentro de las funciones de abajo.
  const valores = borrador;
  const limite = LIMITE_FOTOS_POR_ORIGEN[valores.tipo];
  const textos = textosFormularioPorOrigen[valores.tipo];
  const restantes = limite - fotos.length;
  const lado =
    anchoGrilla > 0
      ? Math.floor((anchoGrilla - SEPARACION * (COLUMNAS - 1)) / COLUMNAS)
      : 0;

  const medirGrilla = (e: LayoutChangeEvent) =>
    setAnchoGrilla(e.nativeEvent.layout.width);

  async function agregarFotos() {
    if (abriendoGaleria || restantes <= 0) return;
    setError(undefined);
    setAbriendoGaleria(true);

    try {
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: restantes > 1,
        selectionLimit: restantes,
        quality: 0.8,
      });
      if (resultado.canceled) return;

      const nuevas: string[] = [];
      let formatoInvalido = false;
      let muyPesada = false;
      let resolucionAlta = false;
      let sobraron = false;

      for (const asset of resultado.assets) {
        const motivo = motivoRechazoFoto(asset);
        if (motivo === "formato") {
          formatoInvalido = true;
        } else if (motivo === "tamano") {
          muyPesada = true;
        } else if (motivo === "resolucion") {
          resolucionAlta = true;
        } else if (fotos.includes(asset.uri) || nuevas.includes(asset.uri)) {
          // Misma foto elegida dos veces: se ignora sin molestar al usuario.
        } else if (nuevas.length >= restantes) {
          sobraron = true;
        } else {
          nuevas.push(asset.uri);
        }
      }

      if (nuevas.length > 0) setFotos((anteriores) => [...anteriores, ...nuevas]);

      const avisos: string[] = [];
      if (formatoInvalido) avisos.push("Solo se aceptan fotos JPG, PNG o WEBP.");
      if (muyPesada) avisos.push(`Cada foto debe pesar máximo ${TAMANO_MAX_FOTO_MB} MB.`);
      if (resolucionAlta) avisos.push(`Cada foto debe tener como máximo ${MAX_MEGAPIXELES_FOTO} megapíxeles.`);
      if (sobraron) avisos.push(`Solo puedes subir hasta ${limite} fotos.`);
      if (avisos.length > 0) setError(avisos.join(" "));
    } catch {
      setError("No se pudo abrir la galería. Inténtalo de nuevo.");
    } finally {
      setAbriendoGaleria(false);
    }
  }

  function quitarFoto(uri: string) {
    setError(undefined);
    setFotos((anteriores) => anteriores.filter((u) => u !== uri));
  }

  function continuar() {
    router.push({
      pathname: "/publicacion/crear/previa",
      params: armarParametrosBorrador(valores),
    });
  }

  return (
    <>
      <Stack.Screen options={opcionesHeader} />
      <ScrollView
        style={styles.pantalla}
        contentContainerStyle={styles.contenedor}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>{textos.tituloPantalla}</Text>
          <View style={styles.paso}>
            <PasoPublicacion paso={2} etiqueta="Fotos" />
          </View>
        </View>

        <View style={styles.filaEtiqueta}>
          <Ionicons name="images-outline" size={16} color={colors.primary} />
          <Text style={styles.etiqueta}>
            Fotos <Text style={styles.opcional}>(opcional)</Text>
          </Text>
        </View>
        <Text style={styles.ayuda}>
          Puedes subir hasta {limite} fotos {lugarFotosPorOrigen[valores.tipo]}.
          Esto ayudará a que más personas se interesen.
        </Text>

        <View style={styles.grilla} onLayout={medirGrilla}>
          {lado > 0 &&
            Array.from({ length: limite }, (_, i) => {
              const uri = fotos[i];
              const caja = { width: lado, height: lado };

              if (uri) {
                return (
                  <View key={uri} style={[styles.ranura, caja]}>
                    <Image source={{ uri }} style={styles.foto} resizeMode="cover" />
                    {i === 0 && (
                      <View style={styles.chipPrincipal}>
                        <Text style={styles.chipPrincipalTexto}>Principal</Text>
                      </View>
                    )}
                    <Pressable
                      onPress={() => quitarFoto(uri)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar foto ${i + 1}`}
                      style={styles.botonQuitar}
                    >
                      <Ionicons name="close" size={16} color="#FFFFFF" />
                    </Pressable>
                  </View>
                );
              }

              return (
                <Pressable
                  key={`vacia-${i}`}
                  onPress={agregarFotos}
                  disabled={abriendoGaleria}
                  accessibilityRole="button"
                  accessibilityLabel="Subir foto"
                  style={[styles.ranura, styles.ranuraVacia, caja]}
                >
                  <Ionicons name="image-outline" size={26} color={colors.primary} />
                  <Text style={styles.ranuraTitulo}>Subir foto</Text>
                  <Text style={styles.ranuraDetalle}>JPG, PNG o WEBP</Text>
                  <Text style={styles.ranuraDetalle}>
                    Máx. {TAMANO_MAX_FOTO_MB} MB
                  </Text>
                </Pressable>
              );
            })}
        </View>

        <Text style={styles.contador}>
          {fotos.length} de {limite} fotos
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.nota}>
          <Text style={styles.notaTexto}>
            La primera foto será la principal de tu publicación.
          </Text>
        </View>

        <CustomButton
          titulo="Continuar"
          iconoDerecho="arrow-forward"
          onPress={continuar}
        />
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
  encabezado: {
    marginBottom: 20,
  },
  titulo: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
  },
  paso: {
    marginTop: 6,
  },
  filaEtiqueta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  etiqueta: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  opcional: {
    fontWeight: "400",
    color: paletaPublicacion.textoSecundario,
  },
  ayuda: {
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 17,
    color: paletaPublicacion.textoSecundario,
  },
  grilla: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SEPARACION,
  },
  ranura: {
    borderRadius: 12,
    overflow: "hidden",
  },
  ranuraVacia: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    padding: 6,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#C4BDF5",
    backgroundColor: paletaPublicacion.fondoSuave,
  },
  ranuraTitulo: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  ranuraDetalle: {
    fontSize: 10,
    color: paletaPublicacion.textoSecundario,
  },
  foto: {
    width: "100%",
    height: "100%",
  },
  chipPrincipal: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  chipPrincipalTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  botonQuitar: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  contador: {
    marginTop: 10,
    fontSize: 12,
    color: paletaPublicacion.textoSecundario,
  },
  error: {
    marginTop: 6,
    fontSize: 12,
    color: "#B91C1C",
  },
  nota: {
    padding: 12,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: paletaPublicacion.fondoSuave,
  },
  notaTexto: {
    fontSize: 12,
    color: paletaPublicacion.textoSecundario,
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
