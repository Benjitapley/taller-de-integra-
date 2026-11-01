import type { UsuarioPerfil } from "@/types/Usuario";

/**
 * Credenciales ficticias utilizadas por MOB-05.
 * No representan autenticación real ni deben usarse como datos de producción.
 */
export interface CredencialMock {
  usuario: UsuarioPerfil;
  password: string;
}

export const credencialesMock: CredencialMock[] = [
  {
    usuario: {
      idUsuario: 1,
      rol: "Usuario",
      nombre: "Sofía Muñoz",
      email: "sofia.munoz@example.com",
      fechaNacimiento: "2001-04-18",
      estadoVerificacion: "Verificada",
      presupuesto: 220000,
      zonaInteres: "Temuco Centro",
      ocupacion: "Estudiante",
      fotoPerfilUrl: "https://i.pravatar.cc/300?img=47",
      calificacionPromedio: 4.8,
    },
    password: "123456",
  },
];

export const credencialesDemo = {
  email: "sofia.munoz@example.com",
  password: "123456",
};
