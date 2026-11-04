/** Contratos del backend JWT adaptado desde 21e9ffa.
 * LoginResponse es una respuesta entre servidores: el adaptador web guarda
 * el JWT en una cookie HttpOnly y no lo devuelve al cliente.
 */
export type RegistroRequest = {
  nombre: string;
  correo: string;
  contrasena: string;
  /** Fecha de calendario YYYY-MM-DD. */
  fecha_nacimiento: string;
};
export type RegistroResponse = { success: true; message: string; verificacion_pendiente: true };
export type VerificacionRequest = { correo: string; codigo: string };
export type ReenviarCodigoRequest = { correo: string };
export type MessageResponse = { success: true; message: string };
export type LoginRequest = { correo: string; contrasena: string };
export type LoginResponse = {
  success: true;
  access_token: string;
  token_type: "bearer";
  user: { id: number; nombre: string; correo: string };
};
export type AuthErrorResponse = {
  detail: string | { loc: (string | number)[]; msg: string; type: string; ctx?: Record<string, unknown> }[];
};
export type AuthContracts = {
  "/auth/registro": { request: RegistroRequest; response: RegistroResponse; errorStatus: 400 | 409 | 422 | 429 | 503 };
  "/auth/verificar": { request: VerificacionRequest; response: MessageResponse; errorStatus: 400 | 404 | 422 | 429 | 503 };
  "/auth/reenviar-codigo": { request: ReenviarCodigoRequest; response: MessageResponse; errorStatus: 404 | 409 | 422 | 429 | 503 };
  "/auth/login": { request: LoginRequest; response: LoginResponse; errorStatus: 401 | 403 | 409 | 422 | 503 };
  "/auth/logout": { request: Record<string, never>; response: MessageResponse; errorStatus: 401 | 403 | 503 };
};

export type WebSessionResponse = { authenticated: true; user: { nombre: string } };
export type WebLoginResponse = { success: true };
