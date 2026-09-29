export interface Publication {
  id: string;
  tipo: 'Arriendo' | 'Se busca';
  titulo: string;
  precio: number;
  ubicacion: string;
  capacidad: number;
  imagenUrl?: string; // Opcional porque los "Se busca" a veces no tienen foto
  tiempoPublicacion: string;
}

export const mockPublications: Publication[] = [
    {
        id: '1',
        tipo: 'Arriendo',
        titulo: 'Casa en el barrio...',
        precio: 1500000,
        ubicacion: 'Santiago',
        capacidad: 4,
        imagenUrl: 'https://kettererpropiedades.cl/wp-content/uploads/2022/09/IMG_0510.jpg',
        tiempoPublicacion: '2 días'
    },
    {
        id: '2',
        tipo: 'Arriendo',
        titulo: 'Apartamento en el centro',
        precio: 1500000,
        ubicacion: 'Santiago',
        capacidad: 4,
        imagenUrl: 'https://www.toppropiedades.cl/imagenes/b_c891u2520co10cebf.jpg',
        tiempoPublicacion: '2 días'
    },
    {
        id: '3',
        tipo: 'Se busca',
        titulo: 'Se busca roomie, depa amplio',
        precio: 170000,
        ubicacion: 'Cerca del metro',
        capacidad: 1,
        tiempoPublicacion: 'hace 3 días',
  }

]