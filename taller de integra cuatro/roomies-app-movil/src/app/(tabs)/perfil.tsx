import { router } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import AppHeader from "@/components/AppHeader";
import BarraBusqueda from "@/components/BarraBusqueda";
import { CustomButton } from "@/components/CustomButton";
import { ContenidoPerfil } from "@/components/perfil/ContenidoPerfil";
import { useAuth } from "@/hooks/useAuth";
import { usePerfilPropio } from "@/hooks/usePerfilPropio";

export default function Perfil() {
  const { cerrarSesion } = useAuth();
  const { estado, reintentar } = usePerfilPropio();
  const [busqueda, setBusqueda] = useState("");
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [errorCierre, setErrorCierre] = useState("");
  const cierreEnCurso = useRef(false);
  const perfil = estado.tipo === "resultado" && estado.resultado.exito
    ? estado.resultado.perfil
    : null;

  async function manejarCierreSesion() {
    if (cierreEnCurso.current) return;
    cierreEnCurso.current = true;
    setCerrandoSesion(true);
    setErrorCierre("");
    try {
      const resultado = await cerrarSesion();
      if (resultado.exito) {
        router.replace("/login");
      } else if (resultado.sesionLocalCerrada) {
        router.replace({ pathname: "/login", params: { aviso: "cierre_local" } });
      } else {
        setErrorCierre(resultado.error);
      }
    } catch {
      setErrorCierre("No pudimos cerrar sesión. Inténtalo nuevamente.");
    } finally {
      cierreEnCurso.current = false;
      setCerrandoSesion(false);
    }
  }

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenedor}>
      <AppHeader fotoUsuarioUrl={perfil?.fotoPerfilUrl ?? undefined} />
      <BarraBusqueda valor={busqueda} onCambiarValor={setBusqueda} />
      <Text style={styles.titulo}>Mi perfil</Text>
      <ContenidoPerfil estado={estado} onReintentar={reintentar} />
      {errorCierre ? (
        <Text accessibilityRole="alert" style={styles.errorCierre}>{errorCierre}</Text>
      ) : null}
      <CustomButton
        titulo="Cerrar sesión"
        iconoIzquierdo="log-out-outline"
        variante="contorno"
        onPress={manejarCierreSesion}
        cargando={cerrandoSesion}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#F9FAFB" },
  contenedor: { padding: 16, gap: 16 },
  titulo: { fontSize: 22, fontWeight: "700", color: "#111827" },
  errorCierre: { color: "#B42318", fontSize: 13, textAlign: "center" },
});
