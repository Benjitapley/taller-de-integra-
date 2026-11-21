import type { EstadoPublicacion, Publicacion, TipoPublicacion } from "@/types/Publicacion";


export interface PublicacionBackendAPI {
    id: number;
    title: string;
    description: string;
    location_address: string;
    monthly_price: number | string;
    available_spots: number;
    created_at: string;
}


// El contrato orientativo de B07 no entrega autor, origen, estado ni cupos
// totales. Conservamos su resumen sin inventar los datos de una Publicacion.
// Falta contrastarlo con el contrato publicado antes de conectarlo a la API.
export type ResumenPublicacionBackend = Pick<
    Publicacion,
    'idPublicacion' | 'titulo' | 'descripcion' | 'ubicacion' | 'precio' | 'cuposDisponibles'
>;

export const adaptarPublicacion = (data: PublicacionBackendAPI): ResumenPublicacionBackend => {
    return {
        idPublicacion: data.id,
        titulo: data.title,
        descripcion: data.description,
        ubicacion: data.location_address,
        precio: typeof data.monthly_price === 'string' ? parseFloat(data.monthly_price) : data.monthly_price,
        cuposDisponibles: data.available_spots,
    };
};

export const adaptarListaPublicaciones = (lista: PublicacionBackendAPI[]): ResumenPublicacionBackend[] => {
    return lista.map((item) => adaptarPublicacion(item));
}

// ---------------------------------------------------------------------------
// Listado real: GET /api/publicaciones (Listado, vía Gateway).
// ---------------------------------------------------------------------------
const TIPOS: TipoPublicacion[] = ['Arrendador', 'Compartida'];
const ESTADOS: EstadoPublicacion[] = ['Disponible', 'Activa', 'Cerrada'];

function urlImagen(imagen: string, urlBase: string): string {
    if (/^https?:\/\//.test(imagen)) return imagen;
    return `${urlBase.replace(/\/+$/, '')}${imagen.startsWith('/') ? '' : '/'}${imagen}`;
}

/** Convierte una publicación de GET /api/publicaciones; devuelve null si no tiene la forma esperada. */
export function adaptarPublicacionListado(dato: unknown, urlBase: string): Publicacion | null {
    if (typeof dato !== 'object' || dato === null) return null;
    const p = dato as Record<string, unknown>;
    const precio = Number(p.precio);

    if (
        typeof p.id !== 'number' ||
        typeof p.titulo !== 'string' ||
        typeof p.descripcion !== 'string' ||
        typeof p.ubicacion !== 'string' ||
        !Number.isFinite(precio) ||
        !TIPOS.includes(p.tipo as TipoPublicacion) ||
        !ESTADOS.includes(p.estado as EstadoPublicacion) ||
        typeof p.cupos_totales !== 'number' ||
        typeof p.cupos_disponibles !== 'number'
    ) {
        return null;
    }

    return {
        idPublicacion: p.id,
        tipo: p.tipo as TipoPublicacion,
        titulo: p.titulo,
        descripcion: p.descripcion,
        precio,
        ubicacion: p.ubicacion,
        estado: p.estado as EstadoPublicacion,
        cuposTotales: p.cupos_totales,
        cuposDisponibles: p.cupos_disponibles,
        imagenPrincipalUrl:
            typeof p.imagen === 'string' && p.imagen ? urlImagen(p.imagen, urlBase) : undefined,
    };
}