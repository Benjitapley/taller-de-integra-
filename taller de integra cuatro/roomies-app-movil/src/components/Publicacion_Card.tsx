import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card } from './Card';
import { colors } from '@/theme/colors';
import type { Publicacion } from '@/types/Publicacion';
import { TITULO_PUBLICACION, configPorOrigen, paletaPublicacion } from '@/constants/origenPublicacion';

interface PublicacionCardProps {
    publicacion: Publicacion;
    onPress?: () => void;
    onPressMenu?: () => void;
}

type Fila = { icono: keyof typeof Ionicons.glyphMap; texto: string };

function textoCupos(publicacion: Publicacion): string {
    const libres = publicacion.cuposDisponibles;
    if (libres <= 0) return 'Sin cupos disponibles';

    if (publicacion.tipo === 'Arrendador') {
        return `${libres} ${libres === 1 ? 'cupo disponible' : 'cupos disponibles'}`;
    }
    return libres === 1 ? 'Se busca 1 roomie' : `Se buscan ${libres} roomies`;
}

function IconoCircular({ nombre, tamano }: { nombre: keyof typeof Ionicons.glyphMap; tamano: number }) {
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
}) => {
    const router = useRouter();
    const config = configPorOrigen[publicacion.tipo];
    const imagenUrl = publicacion.imagenPrincipalUrl;

    const irAlDetalle = () =>
        router.push({
            pathname: '/publicaciones/[id]',
            params: { id: String(publicacion.idPublicacion) },
        });

    const filas: Fila[] = [
        { icono: 'people', texto: textoCupos(publicacion) },
        { icono: 'cash', texto: `${publicacion.precio} CLP` },
        { icono: 'location', texto: publicacion.ubicacion },
    ];

    const encabezado = (
        <View style={styles.encabezado}>
            <Text style={styles.etiqueta}>{TITULO_PUBLICACION}</Text>
            <Text style={styles.tipo}>{config.tipo}</Text>
        </View>
    );

    const resumen = (
        <View style={styles.filas}>
            {filas.map((fila) => (
                <View key={fila.icono} style={styles.fila}>
                    <Ionicons name={fila.icono} size={16} color={colors.primary} />
                    <Text style={styles.filaTexto} numberOfLines={1}>
                        {fila.texto}
                    </Text>
                </View>
            ))}
        </View>
    );

    const descripcion = (
        <Text style={styles.descripcion} numberOfLines={3}>
            {publicacion.descripcion}
        </Text>
    );

    return (
        <Card
            onPress={onPress ?? irAlDetalle}
            style={styles.card}
        >
            <View style={styles.recorte} accessible accessibilityLabel={`${config.etiqueta}: ${publicacion.titulo}`}>
                <View style={styles.cuerpo}>
                    {imagenUrl ? (
                        <>
                            <Image source={{ uri: imagenUrl }} style={styles.imagen} resizeMode="cover" />
                            <View style={styles.info}>
                                <View style={styles.cabecera}>
                                    <IconoCircular nombre={config.icono} tamano={44} />
                                    {encabezado}
                                </View>
                                {resumen}
                                {descripcion}
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.columnaIcono}>
                                <IconoCircular nombre={config.icono} tamano={52} />
                            </View>
                            <View style={styles.info}>
                                {encabezado}
                                {resumen}
                                {descripcion}
                            </View>
                        </>
                    )}
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
    },
    recorte: {
        borderRadius: 11,
        overflow: 'hidden',
    },
    cuerpo: {
        flexDirection: 'row',
    },
    imagen: {
        width: '38%',
        minHeight: 160,
    },
    columnaIcono: {
        paddingTop: 14,
        paddingLeft: 14,
    },
    info: {
        flex: 1,
        padding: 14,
    },
    cabecera: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    circulo: {
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    encabezado: {
        flexShrink: 1,
    },
    etiqueta: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.primary,
    },
    tipo: {
        fontSize: 13,
        color: paletaPublicacion.textoSecundario,
        marginTop: 2,
    },
    filas: {
        marginTop: 2,
        marginBottom: 8,
    },
    fila: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    filaTexto: {
        flex: 1,
        fontSize: 14,
        color: paletaPublicacion.textoPrincipal,
        marginLeft: 8,
    },
    descripcion: {
        fontSize: 13,
        lineHeight: 18,
        color: paletaPublicacion.textoPrincipal,
    },
    descripcion: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 8,
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
