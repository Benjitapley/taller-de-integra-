import React from 'react';
import { ScrollView, View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { CustomButton } from '@/components/CustomButton';
import { publicacionesMock, usuariosMock } from '@/mocks';
import {
    TITULO_PUBLICACION,
    configPorEstado,
    configPorOrigen,
    estiloPorTipo,
    paletaPublicacion,
} from '@/constants/origenPublicacion';

function formatoPrecio(precio: number): string {
    return `$${String(precio).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CLP`;
}

export default function PublicacionDetallePantalla() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const opcionesHeader = {
        headerShown: true,
        title: 'Publicación',
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerLeft: () => (
            <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                hitSlop={12}
                accessibilityLabel="Volver"
                style={{ paddingHorizontal: 12 }}
            >
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </Pressable>
        ),
    };

    // Datos simulados de mocks
    const publicacion = publicacionesMock.find((p) => p.idPublicacion === Number(id));

    if (!publicacion) {
        return (
            <View style={styles.vacio}>
                <Stack.Screen options={opcionesHeader} />
                <Ionicons name="alert-circle-outline" size={40} color={colors.primary} />
                <Text style={styles.vacioTitulo}>No encontramos esta publicación</Text>
                <Text style={styles.vacioTexto}>
                    Puede que ya no esté disponible. Vuelve al listado para ver otras.
                </Text>
                <View style={styles.vacioBoton}>
                    <CustomButton titulo="Volver" onPress={() => router.back()} />
                </View>
            </View>
        );
    }

    const config = configPorOrigen[publicacion.tipo];
    const estilo = estiloPorTipo[publicacion.tipo];
    const estado = configPorEstado[publicacion.estado];
    const autor = usuariosMock.find((u) => u.idUsuario === publicacion.idUsuario);
    const cuposTexto =
        publicacion.cuposDisponibles > 0
            ? `${publicacion.cuposDisponibles} de ${publicacion.cuposTotales} cupos disponibles`
            : 'Sin cupos disponibles';

    return (
        <>
            <Stack.Screen options={opcionesHeader} />
            <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
                {publicacion.imagenPrincipalUrl ? (
                    <Image
                        source={{ uri: publicacion.imagenPrincipalUrl }}
                        style={styles.imagen}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.imagen, styles.imagenVacia]}>
                        <Ionicons name="image-outline" size={40} color={colors.primary} />
                    </View>
                )}

                <View style={styles.panel}>
                    <View style={styles.cabecera}>
                        <View style={styles.circulo}>
                            <Ionicons name={config.icono} size={24} color={colors.background} />
                        </View>
                        <View style={styles.cabeceraTexto}>
                            <Text style={styles.etiqueta}>{TITULO_PUBLICACION}</Text>
                            <Text style={styles.tipo}>{config.tipo}</Text>
                        </View>
                        <View style={[styles.chipEstado, { backgroundColor: estado.fondo }]}>
                            <Text style={[styles.chipEstadoTexto, { color: estado.color }]}>
                                {estado.texto}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.etiquetaTipo}>
                        <Ionicons name={estilo.icono} size={18} color={estilo.color} />
                        <Text style={[styles.etiquetaTipoTexto, { color: estilo.color }]}>{estilo.texto}</Text>
                    </View>

                    <Text style={styles.titulo}>{publicacion.titulo}</Text>
                    <Text style={styles.precio}>{formatoPrecio(publicacion.precio)}</Text>

                    <View style={styles.bloque}>
                        <View style={styles.datoFila}>
                            <Ionicons name="people" size={18} color={colors.primary} />
                            <Text style={styles.datoTexto}>{cuposTexto}</Text>
                        </View>
                        <View style={[styles.datoFila, styles.datoFilaUltima]}>
                            <Ionicons name="location" size={18} color={colors.primary} />
                            <Text style={styles.datoTexto}>{publicacion.ubicacion}</Text>
                        </View>
                    </View>

                    <Text style={styles.seccionTitulo}>Descripción</Text>
                    <Text style={styles.descripcion}>{publicacion.descripcion}</Text>

                    {autor ? (
                        <>
                            <Text style={styles.seccionTitulo}>Publicado por</Text>
                            <View style={styles.autor}>
                                {autor.fotoPerfilUrl ? (
                                    <Image source={{ uri: autor.fotoPerfilUrl }} style={styles.avatar} />
                                ) : (
                                    <Ionicons name="person-circle" size={48} color={colors.primary} />
                                )}
                                <View style={styles.autorTexto}>
                                    <View style={styles.autorNombreFila}>
                                        <Text style={styles.autorNombre}>{autor.nombre}</Text>
                                        {autor.estadoVerificacion === 'Verificada' ? (
                                            <Ionicons
                                                name="checkmark-circle"
                                                size={16}
                                                color={colors.primary}
                                                style={styles.autorVerificado}
                                            />
                                        ) : null}
                                    </View>
                                    <Text style={styles.autorRol}>{config.rolPublicador}</Text>
                                </View>
                                {autor.calificacionPromedio !== undefined ? (
                                    <View style={styles.calificacion}>
                                        <Ionicons name="star" size={16} color={colors.primary} />
                                        <Text style={styles.calificacionTexto}>
                                            {autor.calificacionPromedio.toFixed(1)}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        </>
                    ) : null}

                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    contenido: {
        paddingBottom: 32,
    },
    imagen: {
        width: '100%',
        height: 260,
    },
    imagenVacia: {
        backgroundColor: paletaPublicacion.fondoSuave,
        alignItems: 'center',
        justifyContent: 'center',
    },
    panel: {
        marginTop: -24,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        backgroundColor: colors.background,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    cabecera: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    circulo: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    cabeceraTexto: {
        flex: 1,
    },
    etiqueta: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.primary,
    },
    tipo: {
        fontSize: 13,
        color: paletaPublicacion.textoSecundario,
        marginTop: 2,
    },
    chipEstado: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    chipEstadoTexto: {
        fontSize: 12,
        fontWeight: '600',
    },
    etiquetaTipo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    etiquetaTipoTexto: {
        fontSize: 15,
        fontWeight: '700',
        marginLeft: 6,
    },
    titulo: {
        fontSize: 22,
        fontWeight: '700',
        color: paletaPublicacion.textoPrincipal,
        marginBottom: 6,
    },
    precio: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.primary,
        marginBottom: 16,
    },
    bloque: {
        backgroundColor: paletaPublicacion.fondoSuave,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 8,
    },
    datoFila: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    datoFilaUltima: {
        marginBottom: 0,
    },
    datoTexto: {
        flex: 1,
        fontSize: 14,
        color: paletaPublicacion.textoPrincipal,
        marginLeft: 10,
    },
    seccionTitulo: {
        fontSize: 16,
        fontWeight: '700',
        color: paletaPublicacion.textoPrincipal,
        marginTop: 16,
        marginBottom: 8,
    },
    descripcion: {
        fontSize: 14,
        lineHeight: 21,
        color: paletaPublicacion.textoPrincipal,
    },
    autor: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: paletaPublicacion.fondoSuave,
        borderRadius: 12,
        padding: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    autorTexto: {
        flex: 1,
        marginLeft: 12,
    },
    autorNombreFila: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    autorNombre: {
        fontSize: 15,
        fontWeight: '600',
        color: paletaPublicacion.textoPrincipal,
    },
    autorVerificado: {
        marginLeft: 4,
    },
    autorRol: {
        fontSize: 13,
        color: paletaPublicacion.textoSecundario,
        marginTop: 2,
    },
    calificacion: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    calificacionTexto: {
        fontSize: 14,
        fontWeight: '600',
        color: paletaPublicacion.textoPrincipal,
        marginLeft: 4,
    },
    vacio: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: colors.background,
    },
    vacioTitulo: {
        fontSize: 18,
        fontWeight: '700',
        color: paletaPublicacion.textoPrincipal,
        marginTop: 12,
        marginBottom: 6,
        textAlign: 'center',
    },
    vacioTexto: {
        fontSize: 14,
        color: paletaPublicacion.textoSecundario,
        textAlign: 'center',
        marginBottom: 20,
    },
    vacioBoton: {
        width: '100%',
    },
});