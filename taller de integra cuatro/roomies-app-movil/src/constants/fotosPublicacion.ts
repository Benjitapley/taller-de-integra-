import type { TipoPublicacion } from '@/types/Publicacion';

export const LIMITE_FOTOS_POR_ORIGEN: Record<TipoPublicacion, number> = {
  Compartida: 3,
  Arrendador: 5,
};

export const TAMANO_MAX_FOTO_MB = 5;
export const TAMANO_MAX_FOTO_BYTES = TAMANO_MAX_FOTO_MB * 1024 * 1024;

export const MIMES_FOTO_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const EXTENSIONES_FOTO_PERMITIDAS = ['jpg', 'jpeg', 'png', 'webp'];

export const lugarFotosPorOrigen: Record<TipoPublicacion, string> = {
  Compartida: 'del lugar',
  Arrendador: 'del espacio',
};
