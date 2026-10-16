import { Stack } from "expo-router";
import { AuthProvider } from "@/hooks/useAuth";

export default function RootLayout() {
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
        <Stack.Screen
          name="arriendo/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="chats/index"
          options={{
            headerShown: true,
            title: "Chats",
            headerTintColor: "#4F46E5",
          }}
        />
      </Stack>
    </AuthProvider>
  );
}
