import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { CustomButton } from "@/components/CustomButton";
import { useAuth } from "@/hooks/useAuth";
import type { ResultadoConfirmacion } from "@/types/Auth";

export default function ConfirmacionRegistro() {
  const enlace = Linking.useLinkingURL();
  const { confirmarRegistro } = useAuth();
  const [resultado, setResultado] = useState<ResultadoConfirmacion | null>(null);
  const solicitud = useRef<Promise<ResultadoConfirmacion> | null>(null);

  useEffect(() => {
    let vigente = true;

    // Una sola operación por montaje, incluso con los efectos dobles de StrictMode.
    if (!solicitud.current) {
      if (Platform.OS === "web") {
        // Quitar tokens de la barra de direcciones conservando el estado del router.
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }
      solicitud.current = confirmarRegistro(enlace ?? "");
    }
    solicitud.current.then((respuesta) => {
      if (!vigente) return;
      if (Platform.OS === "web") {
        // Expo Router conserva el hash como parámetro '#'. Actualizar también
        // su estado para que no restaure los tokens al sincronizar la URL.
        router.setParams({ "#": "" });
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }
      setResultado(respuesta);
    });

    return () => {
      vigente = false;
    };
  }, [enlace, confirmarRegistro]);

  // La primera vista debe coincidir durante el render estático y la hidratación web.
  const cargando = resultado === null;
  const confirmado = resultado?.exito === true;

  return (
    <View style={styles.pantalla}>
      <View style={styles.contenedor} accessibilityLiveRegion="polite">
        {cargando ? <ActivityIndicator size="large" color="#4B3FCA" /> : null}
        <Text style={styles.titulo}>
          {cargando ? "Confirmando tu correo…" : confirmado ? "Correo confirmado" : "Revisa el enlace"}
        </Text>
        <Text style={styles.mensaje}>
          {cargando
            ? "Estamos verificando tu registro."
            : confirmado
              ? "Tu dirección está confirmada y la sesión está iniciada."
              : resultado && !resultado.exito
                ? resultado.error
                : "Abre el enlace de confirmación que recibiste por correo."}
        </Text>
        {!cargando ? (
          <CustomButton
            titulo={confirmado ? "Continuar" : "Ir a iniciar sesión"}
            onPress={() => router.replace(confirmado ? "/(tabs)" : "/login")}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F7FF",
    padding: 28,
  },
  contenedor: { width: "100%", maxWidth: 520, gap: 20 },
  titulo: {
    color: "#4B3FCA",
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
  },
  mensaje: { color: "#374151", fontSize: 16, lineHeight: 24, textAlign: "center" },
});
