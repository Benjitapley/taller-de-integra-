import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import AppHeader from "@/components/AppHeader";
import BarraBusqueda from "@/components/BarraBusqueda";
import { CustomButton } from "@/components/CustomButton";
import { ContenidoPerfil } from "@/components/perfil/ContenidoPerfil";
import { FormularioEditarPerfil } from "@/components/perfil/FormularioEditarPerfil";
import { useAuth } from "@/hooks/useAuth";
import { usePerfilPropio } from "@/hooks/usePerfilPropio";

export default function Perfil() {
  const { cerrarSesion, usuarioActual } = useAuth();
  const { estado, reintentar, reflejarPerfilGuardado } = usePerfilPropio();
  const [busqueda, setBusqueda] = useState("");
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [errorCierre, setErrorCierre] = useState("");
  const [identidadEnEdicion, setIdentidadEnEdicion] = useState<string | null>(null);
  const [identidadGuardada, setIdentidadGuardada] = useState<string | null>(null);
  const cierreEnCurso = useRef(false);
  const perfil = estado.tipo === "resultado" && estado.resultado.exito
    ? estado.resultado.perfil
    : null;
  const identidadId = usuarioActual?.identidad.id;

  useFocusEffect(useCallback(() => () => {
    setIdentidadEnEdicion(null);
    setIdentidadGuardada(null);
  }, []));

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
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenedor} keyboardShouldPersistTaps="handled">
      <AppHeader fotoUsuarioUrl={perfil?.fotoPerfilUrl ?? undefined} />
      <BarraBusqueda valor={busqueda} onCambiarValor={setBusqueda} />
      <Text style={styles.titulo}>Mi perfil</Text>
      {perfil && identidadId && identidadEnEdicion === identidadId ? (
        <FormularioEditarPerfil
          key={identidadId}
          perfil={perfil}
          identidadId={identidadId}
          onGuardado={(actualizado) => {
            reflejarPerfilGuardado(actualizado);
            setIdentidadEnEdicion(null);
            setIdentidadGuardada(identidadId);
          }}
          onCancelar={(requiereConsulta) => {
            setIdentidadEnEdicion(null);
            if (requiereConsulta) reintentar();
          }}
        />
      ) : (
        <>
          {perfil && identidadId ? (
            <CustomButton
              titulo="Editar perfil"
              iconoIzquierdo="create-outline"
              variante="contorno"
              onPress={() => {
                setIdentidadGuardada(null);
                setIdentidadEnEdicion(identidadId);
              }}
            />
          ) : null}
          {identidadId && identidadGuardada === identidadId ? (
            <Text accessibilityLiveRegion="polite" style={styles.avisoGuardado}>Perfil actualizado.</Text>
          ) : null}
          <ContenidoPerfil estado={estado} onReintentar={reintentar} />
        </>
      )}
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
  avisoGuardado: { color: "#166534", fontSize: 14 },
});
