import type { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import type { EstadoPublicacion, TipoPublicacion } from '@/types/Publicacion';

type NombreIcono = keyof typeof Ionicons.glyphMap;

export const TITULO_PUBLICACION = 'Publicación';

export const configPorOrigen: Record<
  TipoPublicacion,
  {
    etiqueta: string;
    tipo: string;
    icono: NombreIcono;
    color: string;
    rolPublicador: string;
  }
> = {
  Arrendador: { etiqueta: 'Publicación arrendador', tipo: 'Arrendador', icono: 'home', color: colors.primary, rolPublicador: 'Arrendador' },
  Compartida: { etiqueta: 'Publicación compartida', tipo: 'Compartida', icono: 'search', color: '#059669', rolPublicador: 'Integrante del arriendo' },
};

export const estiloPorTipo: Record<TipoPublicacion, { texto: string; icono: NombreIcono; color: string }> = {
  Arrendador: { texto: 'Arriendo', icono: 'home-outline', color: colors.primary },
  Compartida: { texto: 'Se busca', icono: 'search-outline', color: colors.secondary },
};

export const configPorEstado: Record<
  EstadoPublicacion,
  { texto: string; color: string; fondo: string }
> = {
  Disponible: { texto: 'Disponible', color: '#15803D', fondo: '#DCFCE7' },
  Activa: { texto: 'Activa', color: colors.primary, fondo: '#EEEBFF' },
  Cerrada: { texto: 'Cerrada', color: '#B91C1C', fondo: '#FEE2E2' },
};

export const paletaPublicacion = {
  textoPrincipal: '#2D2D2D',
  textoSecundario: '#6B7280',
  fondoSuave: '#F3F1FF',
};

// Textos de Formularios dependiendo del origen de la publicación (Compartida o Arrendador)
export const textosFormularioPorOrigen: Record< 
  TipoPublicacion,
  {
    tituloPantalla: string;
    placeholderTitulo: string;
    mostrarEnlace: boolean;
    nota?: string;
  }
> = {
  Compartida: {
    tituloPantalla: 'Compartir una oportunidad',
    placeholderTitulo: 'Busco roomie para departamento',
    mostrarEnlace: true, // Enlace de publicacion externa (solo aplica a Compartida)
  },
  Arrendador: {
    tituloPantalla: 'Publicar un arriendo',
    placeholderTitulo: 'Depto. con habitación disponible',
    mostrarEnlace: false, 
    nota: 'Las reglas y condiciones se completarán en los próximos pasos.',
  },
};
