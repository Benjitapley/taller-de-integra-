import type { Ionicons } from '@expo/vector-icons';
import type { TipoVivienda } from '@/types/Publicacion';

type NombreIcono = keyof typeof Ionicons.glyphMap;

export const OPCIONES_TIPO_VIVIENDA: readonly {
  valor: TipoVivienda;
  etiqueta: string;
  icono: NombreIcono;
}[] = [
  { valor: 'casa', etiqueta: 'Casa', icono: 'home-outline' },
  { valor: 'departamento', etiqueta: 'Departamento', icono: 'business-outline' },
  { valor: 'habitacion', etiqueta: 'Habitación', icono: 'bed-outline' },
];

export const esTipoVivienda = (texto: string): texto is TipoVivienda =>
  OPCIONES_TIPO_VIVIENDA.some((opcion) => opcion.valor === texto);
