// src/app/index.tsx
import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PublicationCard } from '../components/Publicacion_Card';
import { mockPublications } from '../data/mockPublications';

const { width } = Dimensions.get('window');
// Calculamos el ancho de las tarjetas para que quepan 3 dejando márgenes
const CARD_WIDTH = (width - 64) / 3; 

export default function Inicio() {
    const [busquedaUbicacion, setBusquedaUbicacion] = useState('');

    const renderFiltros = () => (
        <View>
            {/* Header Principal */}
            <View style={styles.headerTop}>
                <View>
                    <Text style={styles.logo}>¿Hay cupo?</Text>
                    <Text style={styles.subtitulo}>Encuentra compañeros de casa o arriendos disponibles</Text>
                </View>
                {/* Aquí iría la ilustración del sofá que pide el mockup */}
                <View style={styles.placeholderIlustracion}>
                    <Image  source={require('../../assets/images/sofa.png')}
                            style={styles.imagenSofa}
                            resizeMode="contain"
                    />
                </View>
            </View>

            {/* Tarjetas de Filtros (Fila de 3) */}
            <View style={styles.filtrosRow}>
                {/* Filtro 1: Personas */}
                <View style={styles.filtroCard}>
                    <View style={styles.filtroHeader}>
                        <Ionicons name="people" size={18} color="#4B3FCA" />
                        <Text style={styles.filtroTitulo}>Personas</Text>
                    </View>
                    {[1, 2, 3].map((num) => (
                        <View key={num} style={styles.filtroOpcion}>
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                                <Ionicons name={num === 1 ? "person" : "people"} size={14} color="#6B7280" />
                                <Text style={styles.filtroOpcionTexto}>{num} Persona{num > 1 && 's'}</Text>
                            </View>
                            <View style={styles.badge}><Text style={styles.badgeText}>{num}</Text></View>
                        </View>
                    ))}
                </View>

                {/* Filtro 2: Departamento / Casa */}
                <View style={styles.filtroCard}>
                    <View style={styles.filtroHeader}>
                        <Ionicons name="home" size={18} color="#4B3FCA" />
                        <Text style={styles.filtroTitulo}>Departamento / Casa</Text>
                    </View>
                    <View style={styles.dropdownInput}>
                        <Text style={{color: '#2D2D2D'}}>Casa</Text>
                        <Ionicons name="chevron-down" size={16} color="#6B7280" />
                    </View>
                </View>

                {/* Filtro 3: Ubicación */}
                <View style={styles.filtroCard}>
                    <View style={styles.filtroHeader}>
                        <Ionicons name="location" size={18} color="#4B3FCA" />
                        <Text style={styles.filtroTitulo}>Ubicación</Text>
                    </View>
                    <View style={styles.searchInputWrapper}>
                        <TextInput 
                            style={styles.searchInput}
                            placeholder="Buscar ubicación..."
                            value={busquedaUbicacion}
                            onChangeText={setBusquedaUbicacion}
                        />
                        <Ionicons name="search" size={16} color="#9CA3AF" />
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.pantalla}>
            <Stack.Screen options={{ headerShown: false }} />

            <FlatList
                ListHeaderComponent={renderFiltros}
                data={mockPublications}
                keyExtractor={(item) => item.id}
                numColumns={3} // Esto transforma la lista en una cuadrícula
                columnWrapperStyle={styles.filaGrid} // Espaciado entre columnas
                renderItem={({ item }) => (
                    <View style={{ width: CARD_WIDTH }}>
                        <PublicationCard publicacion={item} />
                    </View>
                )}
                contentContainerStyle={styles.lista}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: '#F8F9FA' },
    lista: { padding: 16, gap: 16 },
    filaGrid: { gap: 16, justifyContent: 'flex-start' },
    
    // Header Principal
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 8 },
    logo: { fontSize: 32, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
    subtitulo: { fontSize: 14, color: '#4B5563' },
    placeholderIlustracion: { width: 260, height: 90, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    imagenSofa: { width: '350%', height: '100%', 'padding': 75},
    
    // Filtros
    filtrosRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
    filtroCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', minHeight: 140 },
    filtroHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    filtroTitulo: { fontSize: 14, fontWeight: '700', color: '#4B3FCA' },
    
    // Elementos internos de filtros
    filtroOpcion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F3F1FF', padding: 8, borderRadius: 8, marginBottom: 6 },
    filtroOpcionTexto: { fontSize: 13, color: '#4B3FCA', fontWeight: '500' },
    badge: { backgroundColor: '#E0D4FF', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontSize: 10, color: '#4B3FCA', fontWeight: 'bold' },
    dropdownInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', padding: 12, borderRadius: 8 },
    searchInputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, borderRadius: 8, height: 44 },
    searchInput: { flex: 1, fontSize: 14, color: '#2D2D2D' }
});