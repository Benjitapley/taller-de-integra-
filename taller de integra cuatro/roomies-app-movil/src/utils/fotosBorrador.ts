import { LIMITE_FOTOS_POR_ORIGEN } from '@/constants/fotosPublicacion';
import type { TipoPublicacion } from '@/types/Publicacion';

// Las fotos del borrador se guardan en memoria y NO viajan como parámetro de
// ruta: en Android la ruta del archivo (file:///...) llegaba alterada a la vista
// previa y la foto salía en blanco aunque en el paso de Fotos se veía bien.
//
// La pantalla de Fotos es la dueña de la lista: la sincroniza mientras está
// montada y la limpia al desmontarse (volver al formulario descarta las fotos).
let fotosBorrador: string[] = [];

export function guardarFotosBorrador(fotos: string[]): void {
  fotosBorrador = [...fotos];
}

export function leerFotosBorrador(tipo: TipoPublicacion): string[] {
  return fotosBorrador.slice(0, LIMITE_FOTOS_POR_ORIGEN[tipo]);
}

export function limpiarFotosBorrador(): void {
  fotosBorrador = [];
}
