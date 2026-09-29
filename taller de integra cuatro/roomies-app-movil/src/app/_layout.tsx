import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
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
  );
}
