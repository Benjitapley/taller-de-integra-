import React, { useState, useMemo } from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import { usuariosMock } from '../mocks/usuarios'; 
import { UsuarioCard } from './Usuario_Card';
import FiltrosPersonasModal from './FiltrosPersonasModal';
import type { FiltrosPersona } from '../types/Usuario';
import BarraBusqueda from './BarraBusqueda';

export default function BuscadorPersonas() {
    const [busqueda, setBusqueda] = useState("");
    const [modalVisible, setModalVisible] = useState(false);
    const [filtros, setFiltros] = useState<FiltrosPersona>({});

    const usuariosFiltrados = useMemo(() => {
        return usuariosMock.filter((usuario) => {
            // Filtro por texto  
            const termino = busqueda.trim().toLowerCase();
            const coincideTexto = !termino || 
                usuario.nombre.toLowerCase().includes(termino) || 
                (usuario.ocupacion && usuario.ocupacion.toLowerCase().includes(termino));

            if (!coincideTexto) return false;

            // Filtro por Zona de Interés
            if (filtros.zonaInteres && !usuario.zonaInteres.toLowerCase().includes(filtros.zonaInteres.toLowerCase())) {
                return false;
            }
            // Filtro por Presupuesto
            if (filtros.presupuestoMaximo && usuario.presupuesto > filtros.presupuestoMaximo) {
                return false;
            }
            // Filtro por Verificación
            if (filtros.soloVerificados && usuario.estadoVerificacion !== 'Verificada') {
                return false;
            }
            return true;
        });
    }, [filtros, busqueda]);

    const hayFiltrosActivos = filtros.zonaInteres || filtros.presupuestoMaximo || filtros.soloVerificados;

    return (
        <View style={styles.contenedor}>
            <BarraBusqueda 
                valor={busqueda}
                onCambiarValor={setBusqueda}
                onPresionarFiltros={() => setModalVisible(true)}
                placeholder="Buscar por nombre u ocupación..."
            />

            {(busqueda !== "" || hayFiltrosActivos) && (
                <View style={styles.resumenBusqueda}>
                    <Text style={styles.resumenTexto}>
                        {usuariosFiltrados.length}{" "}
                        {usuariosFiltrados.length === 1 ? "persona encontrada" : "personas encontradas"}
                    </Text>
                </View>
            )}

            <View style={styles.encabezadoListado}>
                <Text style={styles.tituloListado}>Personas disponibles</Text>
                <Text style={styles.cantidadListado}>
                    {usuariosFiltrados.length}
                </Text>
            </View>
            
            <FiltrosPersonasModal 
                visible={modalVisible} 
                onClose={() => setModalVisible(false)}
                filtrosActuales={filtros}
                onAplicar={(nuevosFiltros) => setFiltros(nuevosFiltros)}
            />

            <FlatList 
                data={usuariosFiltrados}
                keyExtractor={(item) => item.idUsuario.toString()}
                renderItem={({ item }) => <UsuarioCard usuario={item} />}
                contentContainerStyle={{ paddingBottom: 16, gap: 16 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.sinResultados}>
                        <Text style={styles.sinResultadosTitulo}>No encontramos personas</Text>
                        <Text style={styles.sinResultadosTexto}>Prueba con otra búsqueda o modifica los filtros.</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    contenedor: { 
        flex: 1, 
        padding: 16, 
        gap: 12,
        backgroundColor: '#f9fafb'
    },
    resumenBusqueda: {
        backgroundColor: "#EEF2FF",
        borderRadius: 10,
        padding: 10,
    },
    resumenTexto: {
        fontSize: 12,
        color: "#4F46E5",
    },
    encabezadoListado: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 4,
    },
    tituloListado: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111827",
    },
    cantidadListado: {
        minWidth: 24,
        textAlign: "center",
        backgroundColor: "#EEF2FF",
        color: "#4F46E5",
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 3,
        fontSize: 12,
        fontWeight: "700",
    },
    sinResultados: {
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        padding: 20,
        alignItems: "center",
        marginTop: 20
    },
    sinResultadosTitulo: {
        fontSize: 14,
        fontWeight: "700",
        color: "#111827",
    },
    sinResultadosTexto: {
        marginTop: 4,
        fontSize: 12,
        color: "#6B7280",
        textAlign: "center",
    },
});