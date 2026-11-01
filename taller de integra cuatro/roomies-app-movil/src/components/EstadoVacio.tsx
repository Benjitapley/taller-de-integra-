import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    titulo: string;
    mensaje: string;
    icono?: keyof typeof Ionicons.glyphMap;
}

export default function EstadoVacio({ 
    titulo, 
    mensaje, 
    icono = "search-outline" 
}: Props) {
    return (
        <View style={styles.contenedor}>
            <View style={styles.circuloIcono}>
                <Ionicons name={icono} size={32} color="#9CA3AF" />
            </View>
            <Text style={styles.titulo}>{titulo}</Text>
            <Text style={styles.mensaje}>{mensaje}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        padding: 32,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 16,
    },
    circuloIcono: {
        backgroundColor: "#F3F4F6",
        padding: 16,
        borderRadius: 50,
        marginBottom: 16,
    },
    titulo: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111827",
        textAlign: "center",
        marginBottom: 8,
    },
    mensaje: {
        fontSize: 14,
        color: "#6B7280",
        textAlign: "center",
        lineHeight: 20,
    },
});