/**
 * M4-A04: comprobación manual del Before User Created en el proyecto de pruebas.
 * Ejecutar desde la raíz móvil:
 * node --env-file=.env.local scripts/comprobar-edad-supabase.mjs
 *
 * Hace UN POST real a Auth, evitando las validaciones de la app.
 * Solo se considera correcta la respuesta 400 con ROOMIES_EDAD_MINIMA.
 */
import { randomBytes, randomUUID } from "node:crypto";

async function comprobarEdad() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const clave = process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim();
  if (!url || !clave?.startsWith("sb_publishable_")) {
    throw new Error("Configura la URL y la clave publishable en .env.local.");
  }

  const endpoint = new URL("/auth/v1/signup", url);
  if (!["https:", "http:"].includes(endpoint.protocol)) {
    throw new Error("La URL del proyecto debe usar HTTP o HTTPS.");
  }

  // Dirección única en un dominio reservado para ejemplos; no usa correos personales.
  const email = `roomies-a04-menor-${randomUUID()}@example.com`;
  const fechaNacimiento = `${new Date().getUTCFullYear() - 10}-01-01`;
  // Una contraseña aleatoria que cumple la composición configurada. No se imprime.
  const password = `${randomBytes(24).toString("base64url")}aA1!`;

  console.log("Proyecto:", endpoint.origin);
  console.log("Correo de prueba:", email);
  console.log("Fecha declarada:", fechaNacimiento);

  const respuesta = await fetch(endpoint, {
    method: "POST",
    headers: { apikey: clave, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      data: { nombre: "Prueba A04 menor", fecha_nacimiento: fechaNacimiento },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const datos = await respuesta.json().catch(() => ({}));
  const mensaje = [datos.msg, datos.message, datos.error_description, datos.error]
    .find((valor) => typeof valor === "string") ?? "";

  console.log("HTTP:", respuesta.status);
  if (respuesta.status === 400 && mensaje.includes("ROOMIES_EDAD_MINIMA")) {
    console.log("CORRECTO: Supabase rechazó el registro por edad mediante el hook.");
    console.log("Resultado:", "ROOMIES_EDAD_MINIMA");
    console.log("Comprueba en Authentication > Users que no existe el correo de prueba.");
    return;
  }

  process.exitCode = 1;
  if (respuesta.ok) {
    console.error("FALLO: Auth aceptó la solicitud. Revisa que el hook correcto esté habilitado.");
    console.error("Busca el correo de prueba en Authentication > Users y retira esa cuenta si apareció.");
  } else {
    console.error("NO CONCLUYENTE: Auth rechazó la solicitud por otro motivo.");
    if (typeof datos.code === "string") console.error("Código:", datos.code);
    if (mensaje) console.error("Mensaje:", mensaje.slice(0, 400));
    console.error("Un error de contraseña, correo o límite no acredita la validación de edad.");
  }
  // No volcar la respuesta completa: una aceptación inesperada podría incluir tokens.
}

comprobarEdad().catch(() => {
  console.error("No se pudo completar la comprobación. Revisa .env.local, la conexión y la versión de Node.");
  process.exitCode = 1;
});
