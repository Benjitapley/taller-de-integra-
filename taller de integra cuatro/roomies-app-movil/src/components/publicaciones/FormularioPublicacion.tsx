import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CustomButton } from "@/components/CustomButton";
import { CustomInput } from "@/components/CustomInput";
import { InterruptorFormulario } from "@/components/publicaciones/InterruptorFormulario";
import { PasoPublicacion } from "@/components/publicaciones/PasoPublicacion";
import { SelectorDesplegable } from "@/components/publicaciones/SelectorDesplegable";
import { SelectorTipoVivienda } from "@/components/publicaciones/SelectorTipoVivienda";
import {
  ENVIAR_ENLACE_REFERENCIA,
  ENVIAR_PERMITIR_COMENTARIOS,
} from "@/constants/camposPublicacion";
import {
  MAX_CARACTERES_DESCRIPCION,
  MAX_CARACTERES_REGLA,
  MAX_CARACTERES_TITULO,
  MAX_DIGITOS_CUPOS,
  MAX_DIGITOS_PRECIO,
  MAX_REGLAS_ARRENDADOR,
} from "@/constants/contratoPublicacion";
import { useUbicacionPublicacion } from "@/hooks/useUbicacionPublicacion";
import { paletaPublicacion, textosFormularioPorOrigen } from "@/constants/origenPublicacion";
import { colors } from "@/theme/colors";
import type {
  ErroresFormularioPublicacion,
  FormularioPublicacionValores,
} from "@/types/Publicacion";

interface FormularioPublicacionProps {
  valores: FormularioPublicacionValores;
  errores?: ErroresFormularioPublicacion;
  onCambiar: <K extends keyof FormularioPublicacionValores>(
    campo: K,
    valor: FormularioPublicacionValores[K],
  ) => void;
  /** Cambia varios campos a la vez (región/comuna con sus nombres). */
  onCambiarVarios: (cambios: Partial<FormularioPublicacionValores>, automatico?: boolean) => void;
  onContinuar: () => void;
  /** false mientras se aplica el borrador guardado. */
  borradorListo?: boolean;
  borradorRecuperado?: boolean;
  onDescartarBorrador?: () => void;
}

const soloDigitos = (texto: string) => texto.replace(/\D/g, "");
const soloDigitosPrecio = (texto: string) => soloDigitos(texto).slice(0, MAX_DIGITOS_PRECIO);

const formatearMiles = (digitos: string) =>
  digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const FormularioPublicacion: React.FC<
  FormularioPublicacionProps
> = ({
  valores,
  errores = {},
  onCambiar,
  onCambiarVarios,
  onContinuar,
  borradorListo = true,
  borradorRecuperado = false,
  onDescartarBorrador,
}) => {
  const textos = textosFormularioPorOrigen[valores.tipo];
  const scrollRef = useRef<ScrollView>(null);
  const [reglaNueva, setReglaNueva] = useState("");
  const [errorRegla, setErrorRegla] = useState<string>();

  const ubicacion = useUbicacionPublicacion({
    idRegion: valores.idRegion,
    idComuna: valores.idComuna,
    activo: borradorListo,
    onFijar: onCambiarVarios,
  });

  const agregarRegla = () => {
    const texto = reglaNueva.trim();
    if (!texto) return;
    if (valores.reglas.length >= MAX_REGLAS_ARRENDADOR) {
      setErrorRegla(`Máximo ${MAX_REGLAS_ARRENDADOR} reglas.`);
      return;
    }
    setErrorRegla(undefined);
    onCambiar("reglas", [...valores.reglas, texto]);
    setReglaNueva("");
  };

  const quitarRegla = (indice: number) => {
    setErrorRegla(undefined);
    onCambiar("reglas", valores.reglas.filter((_, i) => i !== indice));
  };

  const bajarAlFinal = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 250);
  };

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.contenedor}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>{textos.tituloPantalla}</Text>
          <View style={styles.paso}>
            <PasoPublicacion paso={1} etiqueta="Información" />
          </View>
        </View>

        {borradorRecuperado && (
          <View style={styles.borrador}>
            <Text style={styles.notaTexto}>Recuperamos tu borrador.</Text>
            {onDescartarBorrador && (
              <Pressable onPress={onDescartarBorrador} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.descartar}>Empezar de nuevo</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.campos}>
          <CustomInput
            etiqueta="Título de publicación"
            icono="pricetag-outline"
            mostrarIconoInterior={false}
            value={valores.titulo}
            onChangeText={(t) => onCambiar("titulo", t)}
            placeholder={textos.placeholderTitulo}
            maxLength={MAX_CARACTERES_TITULO}
            error={errores.titulo}
          />

          <SelectorTipoVivienda
            valor={valores.tipoVivienda}
            onCambiar={(v) => onCambiar("tipoVivienda", v)}
            error={errores.tipoVivienda}
          />

          <CustomInput
            etiqueta="Precio mensual por persona (CLP)"
            icono="cash-outline"
            mostrarIconoInterior={false}
            value={formatearMiles(valores.precio)}
            onChangeText={(t) => onCambiar("precio", soloDigitosPrecio(t))}
            placeholder="190.000"
            keyboardType="number-pad"
            // 12 dígitos más 3 puntos de miles: el límite real lo pone soloDigitosPrecio.
            maxLength={MAX_DIGITOS_PRECIO + 4}
            error={errores.precio}
          />

          <SelectorDesplegable
            etiqueta="Región"
            icono="map-outline"
            placeholder="Elige la región"
            opciones={ubicacion.regiones.map((r) => ({ id: r.idRegion, nombre: r.nombre }))}
            valor={valores.idRegion}
            onCambiar={(o) => ubicacion.elegirRegion(o.id, o.nombre)}
            cargando={ubicacion.cargandoRegiones}
            error={errores.idRegion ?? ubicacion.errorRegiones}
            onReintentar={ubicacion.errorRegiones ? ubicacion.reintentarRegiones : undefined}
          />

          <SelectorDesplegable
            etiqueta="Comuna"
            icono="location-outline"
            placeholder={valores.idRegion ? "Elige la comuna" : "Primero elige la región"}
            opciones={ubicacion.comunas.map((c) => ({ id: c.idComuna, nombre: c.nombre }))}
            valor={valores.idComuna}
            onCambiar={(o) => ubicacion.elegirComuna(o.id, o.nombre)}
            cargando={ubicacion.cargandoComunas}
            deshabilitado={!valores.idRegion}
            error={errores.idComuna ?? ubicacion.errorComunas}
            onReintentar={ubicacion.errorComunas ? ubicacion.reintentarComunas : undefined}
          />

          <CustomInput
            etiqueta="Capacidad total"
            icono="people-outline"
            mostrarIconoInterior={false}
            value={valores.cupos}
            onChangeText={(t) => onCambiar("cupos", soloDigitos(t).slice(0, MAX_DIGITOS_CUPOS))}
            placeholder="1"
            keyboardType="number-pad"
            maxLength={MAX_DIGITOS_CUPOS}
            error={errores.cupos}
          />

          <CustomInput
            etiqueta="Descripción"
            icono="document-text-outline"
            mostrarIconoInterior={false}
            value={valores.descripcion}
            onChangeText={(t) => onCambiar("descripcion", t)}
            placeholder="Describe el lugar y la convivencia..."
            multilinea
            maxLength={MAX_CARACTERES_DESCRIPCION}
            error={errores.descripcion}
            onFocus={bajarAlFinal}
          />

          <InterruptorFormulario
            etiqueta="¿Se aceptan mascotas?"
            icono="paw-outline"
            valor={valores.aceptaMascotas}
            onCambiar={(v) => onCambiar("aceptaMascotas", v)}
          />

          {ENVIAR_PERMITIR_COMENTARIOS && (
            <InterruptorFormulario
              etiqueta="Permitir comentarios"
              icono="chatbubble-ellipses-outline"
              descripcion="Otras personas podrán comentar en tu publicación."
              valor={valores.permitirComentarios}
              onCambiar={(v) => onCambiar("permitirComentarios", v)}
            />
          )}

          {valores.tipo === "Arrendador" && (
            <View style={styles.reglas}>
              <CustomInput
                etiqueta="Reglas de la casa (opcional)"
                icono="list-outline"
                mostrarIconoInterior={false}
                value={reglaNueva}
                onChangeText={(t) => {
                  setReglaNueva(t);
                  setErrorRegla(undefined);
                }}
                placeholder="Ej: No fumar dentro de la casa"
                maxLength={MAX_CARACTERES_REGLA}
                ayuda={`${valores.reglas.length} de ${MAX_REGLAS_ARRENDADOR} reglas. Escribe una y toca «Agregar regla».`}
                returnKeyType="done"
                onSubmitEditing={agregarRegla}
                error={errorRegla ?? errores.reglas}
                onFocus={bajarAlFinal}
              />
              <Pressable
                onPress={agregarRegla}
                accessibilityRole="button"
                accessibilityLabel="Agregar regla"
                style={styles.botonRegla}
              >
                <Text style={styles.descartar}>Agregar regla</Text>
              </Pressable>
              {valores.reglas.map((regla, i) => (
                <View key={`${i}-${regla}`} style={styles.filaRegla}>
                  <Text style={styles.reglaTexto}>{regla}</Text>
                  <Pressable
                    onPress={() => quitarRegla(i)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar regla ${i + 1}`}
                  >
                    <Text style={styles.descartar}>Quitar</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {textos.mostrarEnlace && ENVIAR_ENLACE_REFERENCIA && (
            <CustomInput
              etiqueta="Enlace de referencia (opcional)"
              icono="link-outline"
              mostrarIconoInterior={false}
              value={valores.enlaceReferencia}
              onChangeText={(t) => onCambiar("enlaceReferencia", t)}
              placeholder="Pega un enlace solo si quieres"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              error={errores.enlaceReferencia}
              onFocus={bajarAlFinal}
            />
          )}

          {textos.nota && (
            <View style={styles.nota}>
              <Text style={styles.notaTexto}>{textos.nota}</Text>
            </View>
          )}
        </View>
        <CustomButton
          titulo="Continuar"
          iconoDerecho="arrow-forward"
          onPress={onContinuar}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contenedor: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
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
  campos: {
    width: "100%",
  },
  nota: {
    padding: 12,
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
  borrador: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: paletaPublicacion.fondoSuave,
  },
  descartar: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  reglas: {
    marginBottom: 8,
  },
  botonRegla: {
    alignSelf: "flex-start",
    marginTop: -8,
    marginBottom: 10,
  },
  filaRegla: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reglaTexto: {
    flex: 1,
    fontSize: 14,
    color: paletaPublicacion.textoPrincipal,
  },
});
