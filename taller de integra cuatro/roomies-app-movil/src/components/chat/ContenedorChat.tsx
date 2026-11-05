import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CompositorMensaje from "@/components/chat/CompositorMensaje";
import ListaMensajes from "@/components/chat/ListaMensajes";
import type { MensajeConvivencia } from "@/types/Convivencia";

// M4-D10 — contenedor único de las dos pantallas de chat (conversación contextual y chat del arriendo). Reúne lo que antes estaba duplicado y sin resolver en ambas

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
  mensajes: MensajeConvivencia[];
  texto: string;
  onCambiarTexto: (texto: string) => void;
  onEnviar: () => void;
};

export default function ContenedorChat({
  encabezado,
  mensajes,
  texto,
  onCambiarTexto,
  onEnviar,
}: Props) {
  const insets = useSafeAreaInsets();
  const tecladoVisible = useTecladoVisible();
  const refRaiz = useRef<View>(null);
  const refScroll = useRef<ScrollView>(null);
  const primerAjuste = useRef(true);
  const [desfaseVertical, setDesfaseVertical] = useState(0);


  function medirDesfase() {
    if (Platform.OS !== "ios") return;
    refRaiz.current?.measureInWindow((_x, y) => setDesfaseVertical(Math.max(y, 0)));
  }

  function irAlFinal(animado: boolean) {
    refScroll.current?.scrollToEnd({ animated: animado });
  }

  function alCambiarContenido(_ancho: number, alto: number) {
    if (alto === 0) return;
    irAlFinal(!primerAjuste.current);
    primerAjuste.current = false;
  }

  return (
    <View ref={refRaiz} collapsable={false} style={styles.raiz} onLayout={medirDesfase}>
      <KeyboardAvoidingView
        style={styles.raiz}
        behavior={COMPORTAMIENTO_TECLADO}
        keyboardVerticalOffset={desfaseVertical}
      >
        {encabezado}

        <ScrollView
          ref={refScroll}
          contentContainerStyle={styles.contenedorScroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={alCambiarContenido}
          onLayout={() => irAlFinal(false)}
        >
          <ListaMensajes mensajes={mensajes} />
        </ScrollView>

        <View
          style={[styles.zonaCompositor, { paddingBottom: tecladoVisible ? 0 : insets.bottom }]}
        >
          <CompositorMensaje valor={texto} onCambiarValor={onCambiarTexto} onEnviar={onEnviar} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: "#F9FAFB" },
  contenedorScroll: { padding: 16, gap: 10 },
  zonaCompositor: { backgroundColor: "#fff" },
});
