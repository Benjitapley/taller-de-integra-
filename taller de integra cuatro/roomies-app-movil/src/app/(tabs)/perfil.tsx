import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import AppHeader from "@/components/AppHeader";
import BarraBusqueda from "@/components/BarraBusqueda";
import { PublicacionCard } from "@/components/Publicacion_Card";
import { configPorOrigen } from "@/constants/origenPublicacion";
import type { Evaluacion } from "@/types/Evaluacion";
import type { Publicacion } from "@/types/Publicacion";
import type { TipoPublicacion } from "@/types/Publicacion";
import type { UsuarioPerfil } from "@/types/Usuario";


type PerfilUsuario = UsuarioPerfil & {
  ubicacion: string;
  edad: number;
  estadoPublicacion: TipoPublicacion;
  stats: NonNullable<UsuarioPerfil["stats"]>;
  preferencias: string[];
  buscaEn: string[];
  fotoPerfilUrl: string;
  calificacionPromedio: number;
  cantidadEvaluaciones: number;
  bio: string;
};

const USUARIO_MOCK: PerfilUsuario = {
  idUsuario: 1,
  rol: "Usuario",
  nombre: "Sofía Muñoz",
  email: "sofia.munoz@example.com",
  fechaNacimiento: "2001-04-18",
  estadoVerificacion: "Verificada",
  presupuesto: 220000,
  zonaInteres: "Temuco Centro",
  ocupacion: "Estudiante",
  fotoPerfilUrl: "https://i.pravatar.cc/300?img=47",
  calificacionPromedio: 4.8,
  cantidadEvaluaciones: 12,
  ubicacion: "Temuco, Chile",
  edad: 25,
  estadoPublicacion: "Compartida",
  bio: "Estudiante de Ingeniería Civil. Ordenada, responsable y tranquila. Me gusta el deporte, la música y los animales.",
  stats: { publicaciones: 2, mensajes: 14, guardados: 8, evaluaciones: 12 },
  preferencias: ["No fuma", "No tiene mascotas", "Ordenada", "Responsable"],
  buscaEn: ["Temuco Centro", "Avenida Alemania"],
};

const PUBLICACIONES_MOCK: Publicacion[] = [
  {
    idPublicacion: 2,
    idUsuario: 1,
    tipo: "Compartida",
    titulo: "Busco roomie para departamento",
    descripcion: "Busco una persona responsable para compartir gastos y convivencia.",
    precio: 190000,
    ubicacion: "Temuco Centro",
    estado: "Disponible",
    cuposTotales: 2,
    cuposDisponibles: 1,
    imagenPrincipalUrl: "https://picsum.photos/seed/roomies-perfil/600/400",
  },
];

const EVALUACIONES_MOCK: Evaluacion[] = [
  {
    idEvaluacion: 1,
    evaluadorNombre: "Camila Soto",
    evaluadorFotoUrl: "https://i.pravatar.cc/300?img=47",
    puntuacion: 5.0,
    fechaEvaluacion: "2026-08-15",
    comentario:
      "Muy responsable y buena convivencia.",
  },
];

const OPCIONES_PREFERENCIAS = [
  "No fuma",
  "No tiene mascotas",
  "Ordenado",
  "Responsable",
  "Sociable",
  "Tranquilo",
];


function TarjetaPrincipal({
  usuario,
  onPresionarEditar,
}: {
  usuario: PerfilUsuario;
  onPresionarEditar: () => void;
}) {
  return (
    <View style={styles.tarjeta}>
      <View style={styles.filaPrincipal}>
        <Image source={{ uri: usuario.fotoPerfilUrl }} style={styles.avatarGrande} />
        <View style={styles.infoPrincipal}>
          <Text style={styles.nombre}>{usuario.nombre}</Text>
          <View style={styles.filaEstrellas}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={styles.calificacionTexto}>
              {usuario.calificacionPromedio.toFixed(1)} ({usuario.cantidadEvaluaciones} evaluaciones)
            </Text>
          </View>
          <View style={[styles.badgeEstado, { backgroundColor: `${configPorOrigen[usuario.estadoPublicacion].color}1A` }]}>
            <Ionicons
              name={configPorOrigen[usuario.estadoPublicacion].icono}
              size={12}
              color={configPorOrigen[usuario.estadoPublicacion].color}
            />
            <Text style={[styles.badgeEstadoTexto, { color: configPorOrigen[usuario.estadoPublicacion].color }]}>
              {configPorOrigen[usuario.estadoPublicacion].etiqueta}
            </Text>
          </View>
        </View>
        <Pressable style={styles.botonEditar} onPress={onPresionarEditar}>
          <Ionicons name="pencil" size={14} color="#4F46E5" />
          <Text style={styles.botonEditarTexto}>Editar perfil</Text>
        </Pressable>
      </View>

      <View style={styles.filaDatos}>
        <View style={styles.dato}>
          <Ionicons name="location-outline" size={14} color="#6B7280" />
          <Text style={styles.datoTexto}>{usuario.ubicacion}</Text>
        </View>
        <View style={styles.dato}>
          <Ionicons name="calendar-outline" size={14} color="#6B7280" />
          <Text style={styles.datoTexto}>{usuario.edad} años</Text>
        </View>
        <View style={styles.dato}>
          <Ionicons name="briefcase-outline" size={14} color="#6B7280" />
          <Text style={styles.datoTexto}>{usuario.ocupacion}</Text>
        </View>
      </View>

      <Text style={styles.bio}>{usuario.bio}</Text>
    </View>
  );
}

function FilaEstadisticas({ usuario }: { usuario: PerfilUsuario }) {
  const items = [
    { icono: "home-outline" as const, valor: usuario.stats.publicaciones, etiqueta: "Publicaciones" },
    { icono: "chatbubble-outline" as const, valor: usuario.stats.mensajes, etiqueta: "Mensajes" },
    { icono: "heart-outline" as const, valor: usuario.stats.guardados, etiqueta: "Guardados" },
    { icono: "ribbon-outline" as const, valor: usuario.stats.evaluaciones, etiqueta: "Evaluaciones" },
  ];
  return (
    <View style={styles.filaStats}>
      {items.map((item) => (
        <View key={item.etiqueta} style={styles.stat}>
          <Ionicons name={item.icono} size={18} color="#4F46E5" />
          <Text style={styles.statValor}>{item.valor}</Text>
          <Text style={styles.statEtiqueta}>{item.etiqueta}</Text>
        </View>
      ))}
    </View>
  );
}

function TarjetaSobreMi({ usuario }: { usuario: PerfilUsuario }) {
  return (
    <View style={styles.tarjeta}>
      <View style={styles.filaTituloSeccion}>
        <Ionicons name="person-outline" size={16} color="#4F46E5" />
        <Text style={styles.tituloSeccion}>Sobre mí</Text>
      </View>
      {usuario.preferencias.map((preferencia) => (
        <View key={preferencia} style={styles.filaPreferencia}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#6B7280" />
          <Text style={styles.preferenciaTexto}>{preferencia}</Text>
        </View>
      ))}
      <View style={styles.subBloque}>
        <View style={styles.filaIconoTexto}>
          <Ionicons name="location-outline" size={14} color="#4F46E5" />
          <Text style={styles.subBloqueTitulo}>Busco en</Text>
        </View>
        <Text style={styles.subBloqueTexto}>{usuario.buscaEn.join(", ")}</Text>
      </View>
      <View style={styles.subBloque}>
        <View style={styles.filaIconoTexto}>
          <Ionicons name="cash-outline" size={14} color="#4F46E5" />
          <Text style={styles.subBloqueTitulo}>Presupuesto</Text>
        </View>
        <Text style={styles.subBloqueTexto}>
          Máx. ${usuario.presupuesto.toLocaleString("es-CL")} CLP
        </Text>
      </View>
    </View>
  );
}

function TarjetaPublicacionesActivas({ publicaciones }: { publicaciones: Publicacion[] }) {
  return (
    <View style={styles.tarjeta}>
      <View style={styles.filaTituloSeccion}>
        <Ionicons name="document-text-outline" size={16} color="#4F46E5" />
        <Text style={styles.tituloSeccion}>Publicaciones activas</Text>
      </View>
      <View style={{ gap: 12 }}>
        {publicaciones.map((publicacion) => (
          <PublicacionCard
            key={publicacion.idPublicacion}
            publicacion={publicacion}
          />
        ))}
      </View>
    </View>
  );
}

function TarjetaEvaluaciones({ evaluaciones }: { evaluaciones: Evaluacion[] }) {
  const { width } = useWindowDimensions();
  const anchoTarjeta = width - 32 - 32;
  const [indiceActual, setIndiceActual] = useState(0);

  function alTerminarScroll(evento: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndiceActual(Math.round(evento.nativeEvent.contentOffset.x / anchoTarjeta));
  }

  return (
    <View style={styles.tarjeta}>
      <View style={styles.filaTituloSeccion}>
        <Ionicons name="star-outline" size={16} color="#4F46E5" />
        <Text style={styles.tituloSeccion}>Evaluaciones recibidas</Text>
      </View>
      <FlatList
        data={evaluaciones}
        keyExtractor={(evaluacion) => evaluacion.idEvaluacion.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={alTerminarScroll}
        renderItem={({ item }) => (
          <View style={{ width: anchoTarjeta }}>
            <View style={styles.filaEvaluador}>
              <Image
                source={{ uri: item.evaluadorFotoUrl }}
                style={styles.avatarEvaluador}
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.evaluadorNombre}>
                  {item.evaluadorNombre}
                </Text>

                <View style={styles.filaEstrellas}>
                  <Ionicons name="star" size={12} color="#F59E0B" />

                  <Text style={styles.calificacionTexto}>
                    {item.puntuacion.toFixed(1)}
                  </Text>
                </View>
              </View>

              <Text style={styles.evaluacionFecha}>
                {item.fechaEvaluacion}
              </Text>
            </View>

            <Text style={styles.evaluacionComentario}>
              {item.comentario}
            </Text>
          </View>
        )}
      />
      {evaluaciones.length > 1 && (
        <View style={styles.filaPuntos}>
          {evaluaciones.map((evaluacion, indice) => (
            <View key={evaluacion.idEvaluacion} style={[styles.punto, indice === indiceActual && styles.puntoActivo]} />
          ))}
        </View>
      )}
    </View>
  );
}


function CampoTexto({
  etiqueta,
  valor,
  onCambiar,
  teclado,
  multilinea,
  estiloContenedor,
}: {
  etiqueta: string;
  valor: string;
  onCambiar: (texto: string) => void;
  teclado?: "default" | "numeric";
  multilinea?: boolean;
  estiloContenedor?: object;
}) {
  return (
    <View style={estiloContenedor}>
      <Text style={styles.etiquetaCampo}>{etiqueta}</Text>
      <TextInput
        value={valor}
        onChangeText={onCambiar}
        keyboardType={teclado}
        multiline={multilinea}
        style={[styles.inputEditar, multilinea && styles.inputEditarMultilinea]}
      />
    </View>
  );
}

function TarjetaEditarPerfil({
  usuario,
  onGuardar,
  onCancelar,
}: {
  usuario: PerfilUsuario;
  onGuardar: (usuario: PerfilUsuario) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [edad, setEdad] = useState(String(usuario.edad));
  const [ocupacion, setOcupacion] = useState(usuario.ocupacion);
  const [ubicacion, setUbicacion] = useState(usuario.ubicacion);
  const [bio, setBio] = useState(usuario.bio);
  const [buscaEnTexto, setBuscaEnTexto] = useState(usuario.buscaEn.join(", "));
  const [presupuesto, setPresupuesto] = useState(String(usuario.presupuesto));
  const [preferencias, setPreferencias] = useState<string[]>(usuario.preferencias);

  function alternarPreferencia(opcion: string) {
    setPreferencias((actual) =>
      actual.includes(opcion) ? actual.filter((p) => p !== opcion) : [...actual, opcion]
    );
  }

  function guardar() {
    onGuardar({
      ...usuario,
      nombre: nombre.trim() || usuario.nombre,
      edad: Number(edad) || usuario.edad,
      ocupacion,
      ubicacion,
      bio,
      buscaEn: buscaEnTexto.split(",").map((z) => z.trim()).filter(Boolean),
      presupuesto: Number(presupuesto) || usuario.presupuesto,
      preferencias,
    });
  }

  return (
    <View style={styles.tarjeta}>
      <View style={styles.filaTituloSeccion}>
        <Ionicons name="create-outline" size={16} color="#4F46E5" />
        <Text style={styles.tituloSeccion}>Editar perfil</Text>
      </View>

      <CampoTexto etiqueta="Nombre" valor={nombre} onCambiar={setNombre} />
      <View style={styles.filaDosCampos}>
        <CampoTexto etiqueta="Edad" valor={edad} onCambiar={setEdad} teclado="numeric" estiloContenedor={{ flex: 1 }} />
        <CampoTexto etiqueta="Ocupación" valor={ocupacion} onCambiar={setOcupacion} estiloContenedor={{ flex: 2 }} />
      </View>
      <CampoTexto etiqueta="Ubicación" valor={ubicacion} onCambiar={setUbicacion} />
      <CampoTexto etiqueta="Bio" valor={bio} onCambiar={setBio} multilinea />
      <CampoTexto etiqueta="Busco en (separado por comas)" valor={buscaEnTexto} onCambiar={setBuscaEnTexto} />
      <CampoTexto etiqueta="Presupuesto máximo (CLP)" valor={presupuesto} onCambiar={setPresupuesto} teclado="numeric" />

      <Text style={styles.etiquetaCampo}>Preferencias</Text>
      <View style={styles.filaChipsPreferencias}>
        {OPCIONES_PREFERENCIAS.map((opcion) => {
          const activa = preferencias.includes(opcion);
          return (
            <Pressable
              key={opcion}
              style={[styles.chipPreferencia, activa && styles.chipPreferenciaActiva]}
              onPress={() => alternarPreferencia(opcion)}
            >
              <Text style={[styles.chipPreferenciaTexto, activa && styles.chipPreferenciaTextoActiva]}>
                {opcion}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.filaBotonesEditar}>
        <Pressable style={styles.botonCancelar} onPress={onCancelar}>
          <Text style={styles.botonCancelarTexto}>Cancelar</Text>
        </Pressable>
        <Pressable style={styles.botonGuardar} onPress={guardar}>
          <Text style={styles.botonGuardarTexto}>Guardar</Text>
        </Pressable>
      </View>
    </View>
  );
}


export default function Perfil() {
  const [usuario, setUsuario] = useState<PerfilUsuario>(USUARIO_MOCK);
  const [editando, setEditando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={styles.contenedor}>
      <AppHeader fotoUsuarioUrl={usuario.fotoPerfilUrl} />
      <BarraBusqueda valor={busqueda} onCambiarValor={setBusqueda} />

      {editando ? (
        <TarjetaEditarPerfil
          usuario={usuario}
          onGuardar={(nuevo) => {
            setUsuario(nuevo);
            setEditando(false);
          }}
          onCancelar={() => setEditando(false)}
        />
      ) : (
        <>
          <TarjetaPrincipal usuario={usuario} onPresionarEditar={() => setEditando(true)} />
          <FilaEstadisticas usuario={usuario} />
          <TarjetaSobreMi usuario={usuario} />
          <TarjetaPublicacionesActivas publicaciones={PUBLICACIONES_MOCK} />
          <TarjetaEvaluaciones evaluaciones={EVALUACIONES_MOCK} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#F9FAFB" },
  contenedor: { padding: 16, gap: 16 },
  tarjeta: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    gap: 8,
  },
  filaPrincipal: { flexDirection: "row", gap: 12 },
  avatarGrande: { width: 64, height: 64, borderRadius: 32 },
  infoPrincipal: { flex: 1, gap: 4 },
  nombre: { fontSize: 18, fontWeight: "700", color: "#111827" },
  filaEstrellas: { flexDirection: "row", alignItems: "center", gap: 4 },
  calificacionTexto: { fontSize: 13, color: "#4B5563" },
  badgeEstado: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#D1FAE5",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  badgeEstadoTexto: { color: "#059669", fontSize: 12, fontWeight: "600" },
  botonEditar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#4F46E5",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  botonEditarTexto: { color: "#4F46E5", fontSize: 12, fontWeight: "600" },
  filaDatos: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 4 },
  dato: { flexDirection: "row", alignItems: "center", gap: 4 },
  datoTexto: { fontSize: 13, color: "#6B7280" },
  bio: { fontSize: 13, color: "#374151", marginTop: 4 },
  filaStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 14,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValor: { fontSize: 16, fontWeight: "700", color: "#111827" },
  statEtiqueta: { fontSize: 11, color: "#6B7280", textAlign: "center" },
  filaTituloSeccion: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  tituloSeccion: { fontSize: 15, fontWeight: "700", color: "#111827" },
  filaPreferencia: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  preferenciaTexto: { fontSize: 13, color: "#374151" },
  subBloque: { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10, marginTop: 8, gap: 2 },
  filaIconoTexto: { flexDirection: "row", alignItems: "center", gap: 6 },
  subBloqueTitulo: { fontSize: 13, fontWeight: "600", color: "#111827" },
  subBloqueTexto: { fontSize: 13, color: "#4B5563" },
  filaEvaluador: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarEvaluador: { width: 40, height: 40, borderRadius: 20 },
  evaluadorNombre: { fontSize: 14, fontWeight: "600", color: "#111827" },
  evaluacionFecha: { fontSize: 12, color: "#9CA3AF" },
  evaluacionComentario: { fontSize: 13, color: "#374151", marginTop: 8 },
  filaPuntos: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D1D5DB" },
  puntoActivo: { backgroundColor: "#4F46E5", width: 16 },

  // Edición
  etiquetaCampo: { fontSize: 12, fontWeight: "600", color: "#6B7280", marginTop: 10, marginBottom: 4 },
  inputEditar: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  inputEditarMultilinea: { minHeight: 70, textAlignVertical: "top" },
  filaDosCampos: { flexDirection: "row", gap: 10 },
  filaChipsPreferencias: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chipPreferencia: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipPreferenciaActiva: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
  chipPreferenciaTexto: { fontSize: 12, color: "#374151" },
  chipPreferenciaTextoActiva: { color: "#fff", fontWeight: "600" },
  filaBotonesEditar: { flexDirection: "row", gap: 10, marginTop: 16 },
  botonCancelar: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  botonCancelarTexto: { color: "#374151", fontWeight: "600" },
  botonGuardar: { flex: 1, backgroundColor: "#4F46E5", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  botonGuardarTexto: { color: "#fff", fontWeight: "600" },
});
