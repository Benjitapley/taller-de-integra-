import { useEffect, useRef, useState, type ReactNode } from "react";
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CompositorMensaje from "@/components/chat/CompositorMensaje";
import ListaMensajes, { type HistorialChat } from "@/components/chat/ListaMensajes";
import type { MensajeConvivencia } from "@/types/Convivencia";


const COMPORTAMIENTO_TECLADO = Platform.OS === "ios" ? "padding" : "height";

function useTecladoVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const evMostrar = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const evOcultar = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const alMostrar = Keyboard.addListener(evMostrar, () => setVisible(true));
    const alOcultar = Keyboard.addListener(evOcultar, () => setVisible(false));
    return () => {
      alMostrar.remove();
      alOcultar.remove();
    };
  }, []);

  return visible;
}

type Props = {
  encabezado?: ReactNode;
  /** Orden cronologico ascendente (el mas antiguo primero). */
  mensajes: MensajeConvivencia[];
  texto: string;
  onCambiarTexto: (texto: string) => void;
  onEnviar: () => void;
  // --- M4S3-D02 (todo opcional) ---
  onReintentar?: (clave: string) => void;
  onDescartar?: (clave: string) => void;
  /** Control del historial paginado hacia atras; sin el, la lista no pagina. */
  historial?: HistorialChat;
  /** Franja sobre la lista (por ejemplo, error al actualizar). */
  aviso?: ReactNode;
  /** Se muestra en lugar de la lista cuando no hay mensajes. */
  vacio?: ReactNode;
  compositorDeshabilitado?: boolean;
  soloTexto?: boolean;
};

export default function ContenedorChat({
  encabezado,
  mensajes,
  texto,
  onCambiarTexto,
  onEnviar,
  onReintentar,
  onDescartar,
  historial,
  aviso,
  vacio,
  compositorDeshabilitado,
  soloTexto,
}: Props) {
  const insets = useSafeAreaInsets();
  const tecladoVisible = useTecladoVisible();
  const refRaiz = useRef<View>(null);
  const refLista = useRef<FlatList<MensajeConvivencia>>(null);
  const [desfaseVertical, setDesfaseVertical] = useState(0);

  function medirDesfase() {
    if (Platform.OS !== "ios") return;
    refRaiz.current?.measureInWindow((_x, y) => setDesfaseVertical(Math.max(y, 0)));
  }

  function alEnviar() {
    onEnviar();
    // La lista esta invertida: el desplazamiento 0 es el mensaje mas nuevo (abajo).
    refLista.current?.scrollToOffset({ offset: 0, animated: true });
  }

  const sinMensajes = mensajes.length === 0 && vacio !== undefined;

  return (
    <View ref={refRaiz} collapsable={false} style={styles.raiz} onLayout={medirDesfase}>
      <KeyboardAvoidingView
        style={styles.raiz}
        behavior={COMPORTAMIENTO_TECLADO}
        keyboardVerticalOffset={desfaseVertical}
      >
        {encabezado}
        {aviso}

        {sinMensajes ? (
          <View style={styles.zonaVacia}>{vacio}</View>
        ) : (
          <ListaMensajes
            mensajes={mensajes}
            onReintentar={onReintentar}
            onDescartar={onDescartar}
            historial={historial}
            listaRef={refLista}
          />
        )}

        <View style={[styles.zonaCompositor, { paddingBottom: tecladoVisible ? 0 : insets.bottom }]}>
          <CompositorMensaje
            valor={texto}
            onCambiarValor={onCambiarTexto}
            onEnviar={alEnviar}
            deshabilitado={compositorDeshabilitado}
            soloTexto={soloTexto}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: "#F9FAFB" },
  zonaVacia: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  zonaCompositor: { backgroundColor: "#fff" },
});
