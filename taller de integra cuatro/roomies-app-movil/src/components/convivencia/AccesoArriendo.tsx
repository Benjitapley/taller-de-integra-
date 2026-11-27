import { useCallback, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { solicitarJson } from "@/services/httpClient";
import { useAuth } from "@/hooks/useAuth";

/** Rechecks real membership on entry/resume; denial unmounts private screen state. */
export default function AccesoArriendo({ children }: { children: ReactNode }) {
  const { sesion } = useAuth();
  const token = sesion?.access_token;
  const [scope, setScope] = useState(token);
  const [rentalId, setRentalId] = useState<number | null>(null);
  const [state, setState] = useState<"loading" | "allowed" | "denied" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    setScope(token); setState("loading");
    let live = true;
    let checking = false;
    let generation = attempt;
    async function check() {
      if (checking) return;
      checking = true;
      const request = ++generation;
      const result = await solicitarJson("/api/arriendos/mio");
      checking = false;
      if (!live || request !== generation) return;
      if (!result.exito) {
        if (result.codigo === "sin_sesion" || [401, 403, 404].includes(result.estadoHttp ?? 0)) {
          setState("denied");
        } else setState("error");
        return;
      }
      const rental = result.datos as { id_arriendo?: number; estado?: string } | null;
      if (!rental || !Number.isSafeInteger(rental.id_arriendo) || Number(rental.id_arriendo) < 1) { setState("error"); return; }
      if (rental.estado === "Finalizado") { setState("denied"); return; }
      if (rental.estado !== 'Activo') { setState('error'); return; }
      setRentalId(Number(rental.id_arriendo));
      setState("allowed");
    }
    void check();
    const interval = setInterval(() => { if (AppState.currentState === "active") void check(); }, 5000);
    const subscription = AppState.addEventListener("change", next => { if (next === "active") void check(); });
    return () => { live = false; generation++; clearInterval(interval); subscription.remove(); };
  }, [token, attempt]));
  if (state === "allowed" && scope === token) return <View key={`${token}:${rentalId}`} style={{ flex: 1 }}>{children}</View>;
  return <View style={styles.container}>
    {state === "loading" ? <><ActivityIndicator color="#4F46E5" /><Text>Verificando acceso al arriendo…</Text></> : <>
      <Text accessibilityRole="header" style={styles.title}>{state === "denied" ? "Sin arriendo activo" : "No pudimos verificar tu acceso"}</Text>
      <Text>{state === "denied" ? "El chat y las tareas solo están disponibles para integrantes activos." : "Comprueba tu conexión y vuelve a intentarlo."}</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => setAttempt(value => value + 1)}><Text style={styles.buttonText}>Reintentar</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.dismissTo("/(tabs)/buscar")}><Text>Ir a Buscar</Text></Pressable>
    </>}
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 18, backgroundColor: "#FAF9FF" },
  title: { fontSize: 22, fontWeight: "700", color: "#4F46E5" },
  button: { padding: 14, borderRadius: 14, backgroundColor: "#4F46E5", alignItems: "center" },
  buttonText: { color: "white", fontWeight: "700" },
});
