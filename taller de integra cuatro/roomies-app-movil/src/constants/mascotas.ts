import type { TipoMascota } from '@/types/Publicacion';

// Opciones del selector de mascotas. Los `valor` son exactamente los que acepta
// `tipos_mascotas_aceptadas` en la API de TI2 (publicaciones_service/schemas.py),
// así que no se transforman al enviar.
export const OPCIONES_MASCOTAS: readonly { valor: TipoMascota; etiqueta: string }[] = [
  { valor: 'perro', etiqueta: 'Perro' },
  { valor: 'gato', etiqueta: 'Gato' },
  { valor: 'ave', etiqueta: 'Ave' },
  { valor: 'tortuga', etiqueta: 'Tortuga' },
  { valor: 'conejo', etiqueta: 'Conejo' },
  { valor: 'pez', etiqueta: 'Pez' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export const esTipoMascota = (texto: string): texto is TipoMascota =>
  OPCIONES_MASCOTAS.some((opcion) => opcion.valor === texto);

export const etiquetaMascota = (valor: TipoMascota): string =>
  OPCIONES_MASCOTAS.find((opcion) => opcion.valor === valor)?.etiqueta ?? valor;

// La API admite hasta 2000 caracteres; en el celular basta con menos.
export const MAX_CARACTERES_CONDICIONES_MASCOTAS = 300;
