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


export const adaptarPublicacion = (data: PublicacionBackendAPI): Publicacion => {
    return {
        idPublicacion: String(data.id),
        titulo: data.title,
        descripcion: data.description,
        ubicacion: data.location_address,
        precio: typeof data.monthly_price === 'string' ? parseFloat(data.monthly_price) : data.monthly_price,
        cuposDisponibles: data.available_spots,
        // Puedes agregar más campos que requiera tu tipo Publicacion original
    };
};

export const adaptarListaPublicaciones = (lista: PublicacionBackendAPI[]): Publicacion[] => {
    return lista.map((item) => adaptarPublicacion(item));
}