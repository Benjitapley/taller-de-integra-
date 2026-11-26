import React, { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { aValoresFormulario } from "@/adapters/publicacionPropiaAdapter";
import { CustomButton } from "@/components/CustomButton";
import { FormularioPublicacion } from "@/components/publicaciones/FormularioPublicacion";
import { GaleriaFotosEdicion } from "@/components/publicaciones/GaleriaFotosEdicion";
import { PasoPublicacion } from "@/components/publicaciones/PasoPublicacion";
import { MAX_IMAGENES_ARRENDADOR } from "@/constants/contratoPublicacion";
import { paletaPublicacion } from "@/constants/origenPublicacion";
import { useFormularioPublicacion } from "@/hooks/useFormularioPublicacion";
import { consultarPublicacionPropia, editarPublicacion } from "@/services/publicacionesService";
import { obtenerComunas, obtenerRegiones } from "@/services/regionesService";
import { colors } from "@/theme/colors";
import { mensajeDeError } from "@/types/erroresServidor";
import type { FormularioPublicacionValores } from "@/types/Publicacion";
import type { ImagenRemota, PublicacionPropia } from "@/types/PublicacionPropia";
import { generarClave } from "@/utils/claveIdempotencia";

type Carga =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; publicacion: PublicacionPropia; valores: FormularioPublicacionValores };

const MENSAJE_409 =
  "No se pudo guardar: la capacidad no puede ser menor que los integrantes actuales, las reglas ya no se pueden cambiar, el aviso cambió desde otro lugar o hay una aceptación en curso. Recarga el aviso e inténtalo de nuevo.";

export default function EditarPublicacion() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const router = useRouter();
  const [intento, setIntento] = useState(0);
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });

  useEffect(() => {
    let vigente = true;
    setCarga({ estado: "cargando" });

    async function cargar() {
      const resultado = await consultarPublicacionPropia(id);
      if (!vigente) return;
      if (!resultado.exito) {
        setCarga({ estado: "error", mensaje: mensajeDeError(resultado) });
        return;
      }
      const publicacion = resultado.datos;

      // El formulario arma `ubicacion` con los NOMBRES de región y comuna: si el servicio
      // solo entregó ids, se completan con el catálogo antes de mostrar el formulario.
      let { nombreRegion, nombreComuna } = publicacion;
      if ((!nombreRegion || !nombreComuna) && publicacion.idRegion !== null && publicacion.idComuna !== null) {
        const [regiones, comunas] = await Promise.all([
          obtenerRegiones(),
          obtenerComunas(publicacion.idRegion),
        ]);
        if (!vigente) return;
        if (!regiones.exito || !comunas.exito) {
          setCarga({ estado: "error", mensaje: "No pudimos cargar la región y la comuna del aviso." });
          return;
        }
        nombreRegion = regiones.datos.find((r) => r.idRegion === publicacion.idRegion)?.nombre ?? "";
        nombreComuna = comunas.datos.find((c) => c.idComuna === publicacion.idComuna)?.nombre ?? "";
      }
      setCarga({
        estado: "listo",
        publicacion,
        valores: aValoresFormulario(publicacion, { nombreRegion, nombreComuna }),
      });
    }

    void cargar();

    return () => {
      vigente = false;
    };
  }, [id, intento]);

  const recargar = () => setIntento((n) => n + 1);

  if (carga.estado === "cargando") {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (carga.estado === "error") {
    return (
      <View style={styles.centro}>
        <Text accessibilityRole="alert" style={styles.mensaje}>{carga.mensaje}</Text>
        <CustomButton titulo="Reintentar" iconoIzquierdo="refresh-outline" onPress={recargar} />
        <CustomButton titulo="Volver" variante="contorno" onPress={() => router.back()} />
      </View>
    );
  }

  const { publicacion, valores } = carga;
  if (publicacion.estado === "Cerrada" || publicacion.tipo !== "Arrendador") {
    return (
      <View style={styles.centro}>
        <Text style={styles.mensaje}>
          {publicacion.estado === "Cerrada"
            ? "Esta publicación está cerrada y ya no se puede editar."
            : "Solo se pueden editar publicaciones de arrendador."}
        </Text>
        <CustomButton titulo="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  return <Editor publicacion={publicacion} valoresIniciales={valores} onRecargar={recargar} />;
}

interface EditorProps {
  publicacion: PublicacionPropia;
  valoresIniciales: FormularioPublicacionValores;
  onRecargar: () => void;
}

function Editor({ publicacion, valoresIniciales, onRecargar }: EditorProps) {
  const router = useRouter();
  const formulario = useFormularioPublicacion("Arrendador", valoresIniciales);

  const [paso, setPaso] = useState<"datos" | "fotos">("datos");
  const [remotas, setRemotas] = useState<ImagenRemota[]>(publicacion.imagenes);
  const [nuevas, setNuevas] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  // El ref bloquea el doble toque al instante; el estado solo cambia la interfaz.
  const guardandoRef = useRef(false);
  // Una clave por cambio: se reutiliza si se reintenta lo mismo (timeout, red) y se
  // cambia si cambia algo, porque el servidor responde 409 a una clave con otro cuerpo.
  const claveRef = useRef<{ huella: string; clave: string } | null>(null);

  function continuar() {
    if (formulario.validarFormulario()) setPaso("fotos");
  }

  async function guardar() {
    if (guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);

    const conservadas = remotas.map((r) => r.idImagen);
    const huella = JSON.stringify([formulario.valores, conservadas, nuevas]);
    if (!claveRef.current || claveRef.current.huella !== huella) {
      claveRef.current = { huella, clave: generarClave() };
    }

    const resultado = await editarPublicacion(publicacion.idPublicacion, formulario.valores, {
      idsConservados: conservadas,
      nuevasUris: nuevas,
      claveIdempotencia: claveRef.current.clave,
    });

    guardandoRef.current = false;
    setGuardando(false);

    if (resultado.exito) {
      claveRef.current = null;
      Alert.alert("Cambios guardados", "Tu publicación se actualizó.", [
        { text: "Aceptar", onPress: () => router.back() },
      ], { cancelable: false });
      return;
    }
    if (resultado.codigo === "respuesta_invalida" && (resultado.estadoHttp ?? 0) < 300) {
      Alert.alert(
        "Revisa tu publicación",
        "No pudimos confirmar el resultado. Es posible que los cambios se hayan guardado: revisa tu lista antes de volver a intentarlo.",
      );
      return;
    }

    if (resultado.estadoHttp === 409) {
      const mensaje = resultado.codigoServidor ? mensajeDeError(resultado) : MENSAJE_409;
      Alert.alert("No se pudo guardar", mensaje, [
        { text: "Seguir editando", style: "cancel" },
        { text: "Recargar aviso", onPress: onRecargar },
      ]);
      return;
    }

    Alert.alert("No se pudo guardar", mensajeDeError(resultado));
  }

  if (paso === "datos") {
    return (
      <FormularioPublicacion
        valores={formulario.valores}
        errores={formulario.errores}
        onCambiar={formulario.cambiarCampo}
        onCambiarVarios={formulario.cambiarCampos}
        borradorListo={formulario.borradorListo}
        onContinuar={continuar}
        tituloPantalla="Editar publicación"
        totalPasos={2}
        textoBoton="Continuar"
      />
    );
  }

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenedor} showsVerticalScrollIndicator={false}>
      <Text style={styles.titulo}>Editar publicación</Text>
      <PasoPublicacion paso={2} total={2} etiqueta="Fotos" />

      <Text style={styles.ayuda}>
        Puedes tener hasta {MAX_IMAGENES_ARRENDADOR} fotos. La primera es la principal. Quitar una foto no la
        borra hasta que guardes los cambios.
      </Text>

      <GaleriaFotosEdicion
        remotas={remotas}
        nuevas={nuevas}
        limite={MAX_IMAGENES_ARRENDADOR}
        deshabilitado={guardando}
        onQuitarRemota={(idImagen) => setRemotas((actuales) => actuales.filter((r) => r.idImagen !== idImagen))}
        onQuitarNueva={(uri) => setNuevas((actuales) => actuales.filter((u) => u !== uri))}
        onAgregar={(uris) => setNuevas((actuales) => [...actuales, ...uris])}
      />

      <View style={styles.acciones}>
        <CustomButton
          titulo={guardando ? "Guardando..." : "Guardar cambios"}
          iconoIzquierdo="checkmark-outline"
          deshabilitado={guardando}
          onPress={guardar}
        />
        <CustomButton
          titulo="Volver a los datos"
          variante="contorno"
          deshabilitado={guardando}
          onPress={() => setPaso("datos")}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenedor: { padding: 16, paddingBottom: 32, gap: 12 },
  centro: { flex: 1, padding: 24, gap: 16, justifyContent: "center", backgroundColor: colors.background },
  mensaje: { fontSize: 15, lineHeight: 22, textAlign: "center", color: paletaPublicacion.textoSecundario },
  titulo: { fontSize: 24, fontWeight: "800", color: colors.primary },
  ayuda: { fontSize: 12, lineHeight: 17, color: paletaPublicacion.textoSecundario },
  acciones: { gap: 12, marginTop: 12 },
});
