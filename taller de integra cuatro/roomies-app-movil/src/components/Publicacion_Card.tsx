import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card } from './Card';
import { GaleriaFotos } from '@/components/publicaciones/GaleriaFotos';
import { colors } from '@/theme/colors';
import type { Publicacion } from '@/types/Publicacion';
import { configPorOrigen, estiloPorTipo, paletaPublicacion } from '@/constants/origenPublicacion';

interface PublicacionCardProps {
    publicacion: Publicacion;
    onPress?: () => void;
    onPressMenu?: () => void;
    /**
     * Borrador que todavía no existe en el backend (M4-C05): la tarjeta no es
     * tocable (no hay detalle al que ir), muestra la descripción completa para
     * poder revisarla y no dice "Publicado hace...".
     */
    modoVistaPrevia?: boolean;
    /** Varias fotos (la primera es la principal). Si se omite se usa imagenPrincipalUrl. */
    imagenesUrls?: string[];
}

type NombreIcono = keyof typeof Ionicons.glyphMap;

function textoCupos(publicacion: Publicacion): string {
    const libres = publicacion.cuposDisponibles;
    if (libres <= 0) return 'Sin cupos disponibles';
    return `${libres} ${libres === 1 ? 'cupo disponible' : 'cupos disponibles'}`;
}

function formatoPrecio(precio: number): string {
    return `$${String(precio).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CLP`;
}

function IconoCircular({ nombre, tamano }: { nombre: NombreIcono; tamano: number }) {
    return (
        <View style={[styles.circulo, { width: tamano, height: tamano, borderRadius: tamano / 2 }]}>
            <Ionicons name={nombre} size={tamano * 0.5} color={colors.background} />
        </View>
    );
}

export const PublicacionCard: React.FC<PublicacionCardProps> = ({
    publicacion,
    onPress,
    onPressMenu,
    modoVistaPrevia = false,
    imagenesUrls,
}) => {
    const router = useRouter();
    const config = configPorOrigen[publicacion.tipo];
    const estilo = estiloPorTipo[publicacion.tipo];
    const imagenes =
        imagenesUrls && imagenesUrls.length > 0
            ? imagenesUrls
            : publicacion.imagenPrincipalUrl
              ? [publicacion.imagenPrincipalUrl]
              : [];
    const imagenUrl = imagenes[0];

    const irAlDetalle = () =>
        router.push({
            pathname: '/publicacion/[id]',
            params: { id: String(publicacion.idPublicacion) },
        });

    return (
        <Card
            onPress={modoVistaPrevia ? undefined : (onPress ?? irAlDetalle)}
            style={styles.card}
        >
            <View style={styles.recorte} accessible accessibilityLabel={`${config.etiqueta}: ${publicacion.titulo}`}>
                <View style={styles.cuerpo}>
                    {imagenes.length > 1 ? (
                        <GaleriaFotos urls={imagenes} altura={styles.imagen.height} />
                    ) : imagenUrl ? (
                        <Image source={{ uri: imagenUrl }} style={styles.imagen} resizeMode="cover" />
                    ) : (
                        <View style={[styles.imagen, styles.imagenVacia]}>
                            <IconoCircular nombre={config.icono} tamano={52} />
                        </View>
                    )}

                    <View style={styles.info}>
                        <View style={styles.cabecera}>
                            <Ionicons name={estilo.icono} size={16} color={estilo.color} />
                            <Text style={[styles.etiqueta, { color: estilo.color }]}>{estilo.texto}</Text>
                            <View style={[styles.chipTipo, { backgroundColor: `${estilo.color}1A` }]}>
                                <Text style={[styles.chipTipoTexto, { color: estilo.color }]}>{config.tipo}</Text>
                            </View>
                        </View>

                        <Text style={styles.titulo} numberOfLines={2}>
                            {publicacion.titulo}
                        </Text>

                        <View style={styles.fila}>
                            <Ionicons name="people-outline" size={16} color={paletaPublicacion.textoSecundario} />
                            <Text style={styles.filaTexto} numberOfLines={1}>
                                {textoCupos(publicacion)}
                            </Text>
                        </View>

                        <Text style={styles.precio}>{formatoPrecio(publicacion.precio)}</Text>

                        <View style={styles.fila}>
                            <Ionicons name="location-outline" size={16} color={paletaPublicacion.textoSecundario} />
                            <Text style={styles.filaTexto} numberOfLines={1}>
                                {publicacion.ubicacion}
                            </Text>
                        </View>

                        <Text
                            style={styles.descripcion}
                            numberOfLines={modoVistaPrevia ? undefined : 3}
                        >
                            {publicacion.descripcion}
                        </Text>

                        {modoVistaPrevia ? null : (
                            <Text style={styles.publicado}>Publicado hace recientemente</Text>
                        )}
                    </View>
                </View>

                {onPressMenu ? (
                    <View style={styles.footer}>
                        <TouchableOpacity
                            onPress={onPressMenu}
                            hitSlop={12}
                            accessibilityLabel="Más opciones"
                        >
                            <Ionicons name="ellipsis-vertical" size={18} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                ) : null}
            </View>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        padding: 0,
        borderRadius: 14,
    },
    recorte: {
        borderRadius: 13,
        overflow: 'hidden',
    },
    cuerpo: {
        padding: 16,
    },
    imagen: {
        width: '100%',
        height: 160,
        borderRadius: 10,
    },
    imagenVacia: {
        backgroundColor: paletaPublicacion.fondoSuave,
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: {
        marginTop: 14,
    },
    cabecera: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    chipTipo: {
        marginLeft: 'auto',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
    },
    chipTipoTexto: {
        fontSize: 12,
        fontWeight: '600',
    },
    circulo: {
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    etiqueta: {
        fontSize: 14,
        fontWeight: '700',
        marginLeft: 6,
    },
    titulo: {
        fontSize: 18,
        fontWeight: '700',
        color: paletaPublicacion.textoPrincipal,
        marginBottom: 8,
    },
    precio: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.primary,
        marginTop: 6,
        marginBottom: 8,
    },
    fila: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filaTexto: {
        flex: 1,
        fontSize: 14,
        color: paletaPublicacion.textoSecundario,
        marginLeft: 8,
    },
    descripcion: {
        fontSize: 14,
        lineHeight: 20,
        color: paletaPublicacion.textoPrincipal,
        marginTop: 10,
    },
    publicado: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 12,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        backgroundColor: paletaPublicacion.fondoSuave,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
});
