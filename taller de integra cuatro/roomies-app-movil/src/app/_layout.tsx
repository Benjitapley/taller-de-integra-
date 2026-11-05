import { Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CustomButton } from "@/components/CustomButton";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { iniciarCicloSesionSupabase } from "@/lib/supabase";

export default function RootLayout() {
  useEffect(() => iniciarCicloSesionSupabase(), []);

  return (
    <AuthProvider>
      <NavegacionPrincipal />
    </AuthProvider>
  );
}

function NavegacionPrincipal() {
  const { estaAutenticado, restaurandoSesion, errorRestauracion, reintentarRestauracion } = useAuth();

  // No montar pantallas ni ejecutar redirecciones hasta resolver la sesión inicial.
  // También mantiene el enlace original de /auth/callback disponible para A04.
  if (restaurandoSesion || errorRestauracion) {
    return (
      <View style={styles.pantallaCarga}>
        <View style={styles.contenidoCarga} accessibilityLiveRegion="polite">
          {restaurandoSesion ? <ActivityIndicator size="large" color="#4B3FCA" /> : null}
          <Text accessibilityRole={errorRestauracion ? "alert" : undefined} style={styles.mensajeCarga}>
            {errorRestauracion ?? "Recuperando tu sesión…"}
          </Text>
          {errorRestauracion ? (
            <CustomButton titulo="Reintentar" onPress={reintentarRestauracion} />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="publicacion/[id]/index" />
      <Stack.Protected guard={!estaAutenticado}>
        <Stack.Screen name="login" />
        <Stack.Screen name="registro" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
      <Stack.Protected guard={estaAutenticado}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="convivencia/tareas"
          options={{
            headerShown: true,
            title: "Tareas de convivencia",
            headerTintColor: "#4F46E5",
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  pantallaCarga: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F7FF",
    padding: 28,
  },
  contenidoCarga: { width: "100%", maxWidth: 440, gap: 20, alignItems: "center" },
  mensajeCarga: { color: "#374151", fontSize: 16, lineHeight: 24, textAlign: "center" },
});
