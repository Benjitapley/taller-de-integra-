import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colors } from '../theme/colors';

type TipoPublicacion = 'arriendo' | 'se_busca' | 'se_necesita';

interface PublicacionCardProps {
    tipo: TipoPublicacion;
    titulo: string;
    imagenUrl?: string;
    precio?: string;
    ubicacion?: string;
    publicadoHace: string;
    onPress?: () => void;
    onPressMenu?: () => void;
}

const configPorTipo: Record<TipoPublicacion, { etiqueta: string; icono: keyof typeof Ionicons.glyphMap; color: string }> = {
    arriendo: { etiqueta: 'Arriendo', icono: 'home-outline', color: colors.primary },
    se_busca: { etiqueta: 'Se busca', icono: 'search-outline', color: colors.secondary },
    se_necesita: { etiqueta: 'Se necesita', icono: 'person-outline', color: colors.warning },
};

export const PublicacionCard: React.FC<PublicacionCardProps> = ({
    tipo,
    titulo,
    imagenUrl,
    precio,
    ubicacion,
    publicadoHace,
    onPress,
    onPressMenu,
}) => {
    const config = configPorTipo[tipo];

    return (
        <Card onPress={onPress} style={styles.card}>
            {imagenUrl && <Image source={{ uri: imagenUrl }} style={styles.imagen} />}

            <View style={styles.badge}>
                <Ionicons name={config.icono} size={14} color={config.color} />
                <Text style={[styles.badgeTexto, { color: config.color }]}>{config.etiqueta}</Text>
            </View>

            <Text style={styles.titulo} numberOfLines={2}>{titulo}</Text>

            {precio && <Text style={styles.precio}>{precio}</Text>}
            {ubicacion && (
                <View style={styles.filaUbicacion}>
                    <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                    <Text style={styles.ubicacion}>{ubicacion}</Text>
                </View>
            )}

            <View style={styles.footer}>
                <Text style={styles.publicadoHace}>Publicado hace {publicadoHace}</Text>
                {onPressMenu && (
                    <TouchableOpacity onPress={onPressMenu} hitSlop={8}>
                        <Ionicons name="ellipsis-vertical" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                )}
            </View>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        padding: 12,
    },
    imagen: {
        width: '100%',
        height: 120,
        borderRadius: 8,
        marginBottom: 8,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    badgeTexto: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
    titulo: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2D2D2D',
        marginBottom: 4,
    },
    precio: {
        fontSize: 15,
        fontWeight: '700',
        color: '#2D2D2D',
        marginBottom: 2,
    },
    filaUbicacion: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    ubicacion: {
        fontSize: 12,
        color: '#9CA3AF',
        marginLeft: 4,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    publicadoHace: {
        fontSize: 11,
        color: '#9CA3AF',
    },
});