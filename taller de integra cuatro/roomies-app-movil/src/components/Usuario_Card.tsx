import React from 'react';
import { useRouter } from 'expo-router';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colors } from '@/theme/colors';
import { paletaPublicacion } from '@/constants/origenPublicacion';
import type { Usuario } from '@/types/Usuario';

interface UsuarioCardProps {
    usuario: Usuario;
    onPress?: () => void;
}


function formatoPrecio(precio: number): string {
    return `$${String(precio).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CLP`;
}

function calcularEdad(fechaNacimiento: string): number {
    const nacimiento = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const aunNoCumple =
        hoy.getMonth() < nacimiento.getMonth() ||
        (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
    if (aunNoCumple) edad--;
    return edad;
}

export const UsuarioCard: React.FC<UsuarioCardProps> = ({ usuario, onPress }) => {
    const verificado = usuario.estadoVerificacion === 'Verificada';
    const colorEstado = verificado ? colors.success : colors.warning;
    const router = useRouter();
    const irAlPerfil = () =>
        router.push({
            pathname: '/usuario/[id]',
            params: { id: String(usuario.idUsuario) },
        });

    return (
        <Card onPress={onPress ?? irAlPerfil} style={styles.card}>
            <View style={styles.cuerpo}>
                <View style={styles.cabecera}>
                    {usuario.fotoPerfilUrl ? (
                        <Image source={{ uri: usuario.fotoPerfilUrl }} style={styles.foto} />
                    ) : (
                        <View style={[styles.foto, styles.fotoVacia]}>
                            <Ionicons name="person" size={28} color={colors.primary} />
                        </View>
                    )}

                    <View style={styles.datos}>
                        <Text style={styles.nombre} numberOfLines={1}>
                            {usuario.nombre}, {calcularEdad(usuario.fechaNacimiento)}
                        </Text>
                        <Text style={styles.texto}>{usuario.ocupacion}</Text>
                        <View style={styles.fila}>
                            <Ionicons
                                name={verificado ? 'checkmark-circle' : 'time-outline'}
                                size={16}
                                color={colorEstado}
                            />
                            <Text style={styles.filaTexto}>{usuario.estadoVerificacion}</Text>
                        </View>
                    </View>

                    {usuario.calificacionPromedio !== undefined ? (
                        <View style={styles.fila}>
                            <Ionicons name="star" size={16} color={colors.warning} />
                            <Text style={styles.calificacion}>
                                {usuario.calificacionPromedio.toFixed(1)}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <Text style={styles.presupuesto}>{formatoPrecio(usuario.presupuesto)}</Text>

                <View style={styles.fila}>
                    <Ionicons name="location-outline" size={16} color={paletaPublicacion.textoSecundario} />
                    <Text style={styles.filaTexto} numberOfLines={1}>
                        {usuario.zonaInteres}
                    </Text>
                </View>
            </View>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        padding: 0,
        borderRadius: 14,
    },
    cuerpo: {
        padding: 16,
    },
    cabecera: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    foto: {
        width: 64,
        height: 64,
        borderRadius: 32,
    },
    fotoVacia: {
        backgroundColor: paletaPublicacion.fondoSuave,
        alignItems: 'center',
        justifyContent: 'center',
    },
    datos: {
        flex: 1,
        marginLeft: 12,
    },
    nombre: {
        fontSize: 18,
        fontWeight: '700',
        color: paletaPublicacion.textoPrincipal,
    },
    texto: {
        fontSize: 14,
        color: paletaPublicacion.textoSecundario,
        marginVertical: 2,
    },
    fila: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filaTexto: {
        flex: 1,
        fontSize: 14,
        color: paletaPublicacion.textoSecundario,
        marginLeft: 6,
    },
    calificacion: {
        fontSize: 14,
        fontWeight: '700',
        color: paletaPublicacion.textoPrincipal,
        marginLeft: 4,
    },
    presupuesto: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.primary,
        marginTop: 14,
        marginBottom: 8,
    },
});    