// src/app/index.tsx
import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, Image, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PublicationCard } from '../components/Publicacion_Card';
import { publicacionesService } from '../publicacionesService';

const { width } = Dimensions.get('window');
// Calculamos el ancho de las tarjetas para que quepan 3 dejando márgenes
const CARD_WIDTH = (width - 64) / 3; 

export default function Inicio() {
  const [publicaciones, setPublicaciones] = useState<Publication[]>([]);
  const [cargando, setCargando] = useState(true);

  // useEffect se ejecuta automáticamente al abrir la pantalla
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const datos = await publicacionesService.obtenerTodas();
        setPublicaciones(datos);
      } catch (error) {
        alert('Hubo un problema al cargar los arriendos');
      } finally {
        setCargando(false);
      }
    };

    cargarDatos();
  }, []);

  if (cargando) {
    return <ActivityIndicator size="large" color="#4B3FCA" style={{ marginTop: 50 }} />;
  }

  return (
    // Tu código de FlatList aquí, usando el estado "publicaciones"
    <FlatList
      data={publicaciones}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <PublicationCard publicacion={item} />}
    />
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