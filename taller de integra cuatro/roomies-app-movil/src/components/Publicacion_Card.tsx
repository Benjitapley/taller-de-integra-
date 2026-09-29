// src/components/Publicacion_Card.tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Publication } from '../data/mockPublications';

interface PublicationCardProps {
    publicacion: Publication;
    onPress?: () => void;
}

const formatearPrecio = (precio: number) =>
    `${precio.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CLP`;

export const PublicationCard: React.FC<PublicationCardProps> = ({ publicacion, onPress }) => {
    const { tipo, titulo, precio, ubicacion, capacidad, imagenUrl, tiempoPublicacion } = publicacion;
    const esArriendo = tipo === 'Arriendo';

    return (
        <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.9}>
            <View style={styles.contenidoCentral}>
                {/* Si es arriendo muestra imagen, si es búsqueda no */}
                {esArriendo && imagenUrl ? (
                    <Image source={{ uri: imagenUrl }} style={styles.imagen} />
                ) : null}

                <View style={styles.info}>
                    <View style={styles.encabezadoTipo}>
                        <View style={[styles.iconoTipo, { backgroundColor: esArriendo ? '#4B3FCA' : '#FFFFFF', borderWidth: esArriendo ? 0 : 2, borderColor: '#4B3FCA' }]}>
                            <Ionicons name={esArriendo ? 'home' : 'search'} size={18} color={esArriendo ? '#FFFFFF' : '#4B3FCA'} />
                        </View>
                        <Text style={[styles.tipoTexto, { color: '#4B3FCA' }]}>{tipo}</Text>
                    </View>

                    {esArriendo ? (
                        <>
                            <View style={styles.dato}><Ionicons name="person" size={14} color="#6B7280" /><Text style={styles.datoTexto}>{capacidad} Personas</Text></View>
                            <View style={styles.dato}><Ionicons name="cash" size={14} color="#6B7280" /><Text style={styles.datoTexto}>{formatearPrecio(precio)}</Text></View>
                            <View style={styles.dato}><Ionicons name="location" size={14} color="#6B7280" /><Text style={styles.datoTexto}>{ubicacion}</Text></View>
                        </>
                    ) : (
                        <Text style={styles.descripcionBusqueda} numberOfLines={4}>{titulo}</Text>
                    )}
                </View>
            </View>

            {/* Footer igual al diseño */}
            <View style={styles.footer}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                    <Text style={styles.publicado}>Publicado {tiempoPublicacion}</Text>
                </View>
                <Ionicons name="ellipsis-vertical" size={16} color="#4B3FCA" />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        overflow: 'hidden',
        // Sombra sutil
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    contenidoCentral: {
        flexDirection: 'row',
        padding: 12,
        minHeight: 140,
    },
    imagen: {
        width: 120,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#E5E7EB',
    },
    info: {
        flex: 1,
        justifyContent: 'flex-start',
        gap: 6,
    },
    encabezadoTipo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    iconoTipo: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tipoTexto: {
        fontSize: 16,
        fontWeight: '700',
    },
    dato: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    datoTexto: {
        fontSize: 13,
        color: '#4B5563',
        fontWeight: '500',
    },
    descripcionBusqueda: {
        fontSize: 13,
        color: '#4B5563',
        lineHeight: 18,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F9FAFB',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    publicado: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
});