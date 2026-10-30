# Cliente HTTP autenticado — M4-A07 / SCRUM-40

Responsable: Gustavo Martínez. Implementación del 29 de octubre de 2026.
Requisitos: NFR-01, NFR-02, NFR-11, NFR-12. Dependencias: A05 y A06 fusionadas.

## Alcance y estado

`src/services/httpClient.ts` implementa `solicitarJson()` para la API de TI2 usando
Fetch. Reutiliza el cliente Supabase de A02 y consulta su sesión en cada petición
protegida. No inicia ni cierra sesiones, no emite tokens y no crea perfiles.

El cliente y sus pruebas controladas están implementados. La URL de API, OpenAPI,
aceptación del JWT de Supabase y contratos de perfil siguen pendientes de confirmación
de TI2. No se declara integrada la API real ni terminadas A08/A09 por estas pruebas.
Las pantallas aún no consumen este módulo, por lo que A07 no cambia visualmente Perfil.

Gustavo compartió una propuesta comunicada a TI2: Supabase Auth gestionaría registro,
login, correo y sesiones; FastAPI gestionaría permisos y datos, validando esos JWT.
Coincide con el backlog móvil; no acredita que el backend ya esté adaptado o desplegado.

## Configuración cuando TI2 entregue un entorno

Completar en `.env.local` la variable documentada, vacía, en `.env.example`:

```dotenv
EXPO_PUBLIC_API_URL=https://api-del-equipo.example.invalid
```

Es un ejemplo, no una dirección operativa. Esta URL corresponde a FastAPI/Gateway,
no al proyecto de Supabase. No incluye contraseñas, claves de servicio ni tokens.
Expo incluye las variables `EXPO_PUBLIC_*` en el bundle. Recargar completamente la
app tras cambiar el entorno y utilizar HTTPS en el entorno remoto confirmado.

La base puede incluir un prefijo, por ejemplo `/api/v1`. Las rutas recibidas deben
empezar con `/` y se añaden a ese prefijo. Si la base termina en `/api/v1`, la ruta
`/recurso` solicita `/api/v1/recurso`. No repetir el prefijo en ambos lugares.
Se rechazan URLs externas y rutas que escapen del prefijo de la API configurada.

En un teléfono, `localhost` se refiere al teléfono: para una API local hay que usar
la dirección accesible del PC y coordinar red/puerto. En web, TI2 debe autorizar el
origen de Expo y las cabeceras/métodos requeridos mediante CORS. Un error CORS puede
presentarse al cliente como error de red; no se corrige agregando cabeceras de servidor
al cliente ni enviando credenciales de la base de datos.

## Uso y contrato local

```ts
import { solicitarJson } from "@/services/httpClient";

// Sustituir por una ruta que confirme TI2; no se define aquí el contrato de perfil.
const resultado = await solicitarJson("/ruta-confirmada");
if (!resultado.exito) {
  // La pantalla puede mostrar resultado.error y actuar según codigo/estadoHttp.
  return resultado;
}
// resultado.datos es unknown: validar su estructura antes de construir el modelo.
```

Las peticiones son protegidas por defecto. `autenticada: false` permite una petición
pública sin consultar Supabase ni añadir Authorization. Se aceptan GET, POST, PUT,
PATCH y DELETE mediante `metodo`; `cuerpo` se serializa como JSON y no se admite en GET.
Este cliente no implementa subida de archivos/FormData; A11 requiere su contrato propio.

Para peticiones protegidas se obtiene `session.access_token` con `getSession()` y
se envía como `Authorization: Bearer ...`. No se usa la clave publishable como Bearer,
no se conserva una copia del token y no se registran cabeceras ni cuerpos en consola.
El SDK puede renovar la sesión si corresponde. No se hace una renovación forzada
ni un reintento automático de la operación ante cada 401.

Los tipos están en `src/types/Http.ts`. Una respuesta satisfactoria contiene `datos`
y `estadoHttp`; `204` produce `datos: null`. JSON válido no equivale a un perfil válido:
el adaptador de A08 deberá validar nombres, tipos y campos disponibles de la respuesta.

| Código de error | Significado |
| --- | --- |
| `configuracion` | URL base ausente/inválida o variables de Auth ausentes. |
| `peticion_invalida` | Ruta, tiempo de espera o cuerpo no admitidos. |
| `sin_sesion` | El SDK no entregó un access token; no se hace fetch. |
| `sesion_no_disponible` | Falló la consulta de sesión; no se hace fetch. |
| `no_autorizado` | La API respondió 401. |
| `sin_permiso` | La API respondió 403. |
| `http` | Otro HTTP fallido; conserva el estado y muestra un mensaje genérico. |
| `respuesta_invalida` | HTTP satisfactorio con contenido que no se puede interpretar como JSON. |
| `red` | Falló el transporte HTTP. |
| `tiempo_agotado` | Se abortó fetch/lectura al superar el tiempo configurado. |

401/403 no ejecutan `signOut()` ni modifican el contexto de Auth. Una API todavía no
adaptada o configurada para otro emisor puede rechazar un token aunque Supabase conserve
una sesión válida. Los cuerpos de error del servidor no se muestran directamente.

Se solicita `credentials: "omit"` para el comportamiento web. React Native 0.86
documenta limitaciones con esa opción; las pruebas de Node no acreditan omisión
de cookies en nativo. El contrato de la API debe autenticar mediante el Bearer,
sin aceptar una cookie o un ID suministrado por el cliente como alternativa.

El límite HTTP predeterminado es de 15 segundos y puede ajustarse con `tiempoLimiteMs`.
Se libera el temporizador al terminar. Ese límite cubre fetch y lectura de la respuesta;
la posible renovación previa de sesión la administra el SDK de Supabase.

## Pruebas realizadas

Desde la raíz móvil:

```bash
npm run test:http
npx tsc --noEmit
npx expo lint
```

El 29 de octubre de 2026 pasaron las 15 pruebas, TypeScript y lint sin errores ni
advertencias. Las pruebas usan Node y la dependencia TypeScript ya instalada para
ejecutar el cliente real con SDK y transporte sustituidos por dobles controlados.
No cargan `.env.local`, no acceden al SDK real ni al fetch real, no envían peticiones
de red y usan tokens ficticios. No son una comprobación del despliegue de TI2.

Se comprobaron Bearer y destino; base/rutas inválidas; ausencia y fallo de sesión;
peticiones públicas; cambio de token entre llamadas; serialización PATCH; 401/403
sin logout; otros errores HTTP; JSON inválido; 204; red; timeout y opciones inválidas.
También se verificó que los detalles sensibles ficticios no aparecen en errores ni logs.

## Pendientes de integración con TI2

- Confirmar URL base, entorno y OpenAPI, además del proyecto/emisor Supabase que
  aceptará el backend y el vínculo entre UUID de Auth e ID de usuario Roomies.
- Resolver la diferencia observada el 29 de octubre: el backlog móvil especifica
  `GET/PATCH /usuarios/me`, mientras `dev-web` contiene `GET/PUT /api/perfil` y un
  validador de JWT propios con `sub` numérico. No se adapta el móvil a ese contrato
  alternativo sin confirmación del equipo.
- Acordar campos de respuesta y campos editables. Actualmente la UI móvil y el
  backend observado permiten editar edad; el registro/modelo móvil conserva fecha
  de nacimiento. No se decide aquí si se permite corregir esa fecha o cómo hacerlo.
- Acordar qué sucede si existe identidad Auth sin perfil y cómo se crea ese perfil.
- Probar una petición protegida real con el token de la app, comprobar su resultado
  y los errores 401/403 sin copiar el JWT a documentación, capturas o logs.
- Repetir la comprobación en web y Expo Go, incluyendo CORS/conectividad del entorno.

Una vez resuelto el contrato, A08 incorporará consulta y estados de perfil. A09 enviará
solo los campos editables acordados y comprobará persistencia volviendo a consultar.

## Referencias

- [Sesión del SDK Supabase](https://supabase.com/docs/reference/javascript/auth-getsession)
- [Verificación de JWT de Supabase](https://supabase.com/docs/guides/auth/jwts)
- [Variables de entorno de Expo](https://docs.expo.dev/guides/environment-variables/)
- [Fetch en React Native](https://reactnative.dev/docs/0.86/network)
- [Backend de perfil observado](https://github.com/Benjitapley/taller-de-integra-/blob/dev-web/backend/main/main.py)
- [Validador JWT observado](https://github.com/Benjitapley/taller-de-integra-/blob/dev-web/backend/auth_service/security.py)
