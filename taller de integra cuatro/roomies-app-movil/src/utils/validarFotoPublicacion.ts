import {
  EXTENSIONES_FOTO_PERMITIDAS,
  MAX_PIXELES_FOTO,
  MIMES_FOTO_PERMITIDOS,
  TAMANO_MAX_FOTO_BYTES,
} from '@/constants/fotosPublicacion';

export interface FotoElegida {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
}

export type MotivoRechazoFoto = 'formato' | 'tamano' | 'resolucion';

const extensionDe = (texto?: string | null): string | undefined => {
  if (!texto) return undefined;
  const sinParametros = texto.split(/[?#]/)[0];
  return /\.([a-z0-9]+)$/i.exec(sinParametros)?.[1].toLowerCase();
};

// Devuelve null si la foto es válida. Si el selector no informa el formato o el
// peso o las dimensiones (pasa en algunas plataformas) no se rechaza: el backend vuelve a validar.
export function motivoRechazoFoto(foto: FotoElegida): MotivoRechazoFoto | null {
  const mime = foto.mimeType?.toLowerCase();
  if (mime) {
    if (!MIMES_FOTO_PERMITIDOS.includes(mime)) return 'formato';
  } else {
    const extension = extensionDe(foto.fileName) ?? extensionDe(foto.uri);
    if (extension && !EXTENSIONES_FOTO_PERMITIDAS.includes(extension)) {
      return 'formato';
    }
  }

  if (typeof foto.fileSize === 'number' && foto.fileSize > TAMANO_MAX_FOTO_BYTES) {
    return 'tamano';
  }

  if (
    typeof foto.width === 'number' &&
    typeof foto.height === 'number' &&
    foto.width * foto.height > MAX_PIXELES_FOTO
  ) {
    return 'resolucion';
  }

  return null;
}
