import { Stack } from "expo-router";
import { useEffect } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { iniciarCicloSesionSupabase } from "@/lib/supabase";

export default function RootLayout() {
  useEffect(() => iniciarCicloSesionSupabase(), []);

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="publicacion/[id]/index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="registro" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="convivencia/tareas"
          options={{
            headerShown: true,
            title: "Tareas de convivencia",
            headerTintColor: "#4F46E5",
          }}
        />
      </Stack>
    </AuthProvider>
  );
}
