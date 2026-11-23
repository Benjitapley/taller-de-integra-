import type { Usuario, UsuarioPerfil } from '@/types/Usuario';

/** Usuarios candidatos para las vistas de búsqueda/conexión. */
export const usuariosMock: Usuario[] = [
  {
    idUsuario: 1,
    rol: 'Usuario',
    nombre: 'Sofía Muñoz',
    fechaNacimiento: '2001-04-18',
    estadoVerificacion: 'Verificada',
    presupuesto: 220000,
    zonaInteres: 'Temuco Centro',
    ocupacion: 'Estudiante',
    fotoPerfilUrl: 'https://i.pravatar.cc/300?img=47',
    calificacionPromedio: 4.8,
  },
  {
    idUsuario: 2,
    rol: 'Usuario',
    nombre: 'Tomás Rojas',
    fechaNacimiento: '1999-11-02',
    estadoVerificacion: 'Verificada',
    presupuesto: 250000,
    zonaInteres: 'Avenida Alemania',
    ocupacion: 'Ambos',
    fotoPerfilUrl: 'https://i.pravatar.cc/300?img=12',
    calificacionPromedio: 4.5,
  },
  {
    idUsuario: 3,
    rol: 'Usuario',
    nombre: 'Valentina Pérez',
    fechaNacimiento: '2002-07-24',
    estadoVerificacion: 'Verificada',
    presupuesto: 180000,
    zonaInteres: 'Universidad Católica de Temuco',
    ocupacion: 'Estudiante',
    fotoPerfilUrl: 'https://i.pravatar.cc/300?img=32',
    calificacionPromedio: 4.7,
  },
  {
    idUsuario: 4,
    rol: 'Usuario',
    nombre: 'Diego Soto',
    fechaNacimiento: '1998-02-15',
    estadoVerificacion: 'Pendiente',
    presupuesto: 300000,
    zonaInteres: 'Portal Temuco',
    ocupacion: 'Trabajador',
    fotoPerfilUrl: 'https://i.pravatar.cc/300?img=68',
  },
];

/** Perfil ficticio para probar las primeras pantallas de perfil. */
export const usuarioPerfilMock: UsuarioPerfil = {
  idUsuario: 1,
  rol: 'Usuario',
  nombre: 'Sofía Muñoz',
  email: 'sofia.munoz@example.com',
  fechaNacimiento: '2001-04-18',
  estadoVerificacion: 'Verificada',
  presupuesto: 220000,
  zonaInteres: 'Temuco Centro',
  ocupacion: 'Estudiante',
  fotoPerfilUrl: 'https://i.pravatar.cc/300?img=47',
  calificacionPromedio: 4.8,
};
