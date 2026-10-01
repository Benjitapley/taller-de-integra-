import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
    valor: string;
    onChangeText: (texto: string) => void;
    onPressFiltros: () => void;
    filtrosActivos?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
     valor, 
     onChangeText, 
     onPressFiltros, 
     filtrosActivos = false 
}) => {
    return (
        <View style={styles.contenedor}>
            <View style={styles.inputWrapper}>
                <Ionicons name="search-outline" size={18} color="#9CA3AF" />
                <TextInput
                    style={styles.input}
                    placeholder="Buscar..."
                    placeholderTextColor="#9CA3AF"
                    value={valor}
                    onChangeText={onChangeText}
                    autoCapitalize="none"
                />
            </View>
            <TouchableOpacity
                style={[styles.botonFiltros, filtrosActivos && styles.botonFiltrosActivo]}
                onPress={onPressFiltros}
                activeOpacity={0.8}
            >
                <Ionicons 
                    name="options-outline"
                    size={18}
                    color={filtrosActivos ? "#FFFFFF" : "#4B3FCA"}
                />
                <Text style={[styles.textoFiltros, filtrosActivos && styles.textoFiltrosActivo]}>
                    Filtros
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    contenedor: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 44,
        paddingHorizontal: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        gap: 8,
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: '#2D2D2D',
    },
    botonFiltros: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 44,
        paddingHorizontal: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#4B3FCA',
        borderRadius: 8,
        gap: 6,
    },
    botonFiltrosActivo: {
        backgroundColor: '#4B3FCA',
    },
    textoFiltros: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B3FCA',
    },
    textoFiltrosActivo: {
        color: '#FFFFFF',
    },
});