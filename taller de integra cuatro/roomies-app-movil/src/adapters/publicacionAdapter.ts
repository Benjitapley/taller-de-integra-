import type { Publicacion } from "@/types/Publicacion";


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
