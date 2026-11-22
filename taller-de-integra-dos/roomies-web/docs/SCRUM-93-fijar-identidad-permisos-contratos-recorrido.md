# SCRUM-93 — Fijar identidad, permisos y contratos del recorrido

**Fecha:** 17 de noviembre de 2026.  
**Estado:** Contratos fijados, unificados y compartidos entre TI2 (Web y Servicios) y TI4 (Móvil).  
**Rama:** `SCRUM-93-·-Fijar-identidad,-permisos-y-contratos-del-recorrido`.  

---

## 1. Contexto, objetivo y participantes

Hasta esta entrega, las rutas y modelos entre los componentes del sistema operaban bajo contratos provisionales descritos expresamente en el código como:
> `Contratos LOCALES v1; no sustituyen los DTO compartidos pendientes con TI4.` (`local_users.py`).

Esto generaba divergencias de integración:
- **TI4 (Aplicación Móvil Expo/React Native)** consumía `GET /usuarios/me` y `PATCH /usuarios/me` (del esquema preliminar de SCRUM-77), mientras que en `SCRUM-85` debió recurrir a `POST /local/v1/perfil/inicializacion` para la provisión del perfil. Adicionalmente, el API Gateway en Render devolvía `404` en `/usuarios/me` en modo enrutado y `405 Method Not Allowed` en preconsultas CORS `OPTIONS` desde Expo Web (`http://localhost:8081`).
- **TI2 (Web Next.js y BFF)** consumía `/local/v1/perfil` en modo Supabase o `/api/perfil` en modo legacy (`SCRUM-78` / `SCRUM-111`).
- **Servicios de Backend** (`auth-users-service`, `listado-applications-service`, `match-conexion-service`) validaban tokens y aislaban datos pero carecían de un catálogo formal único de rutas canónicas para web y móvil.

**Objetivo de SCRUM-93:**
Fijar el acuerdo técnico definitivo de identidad, matriz de permisos y contratos comunes del recorrido para clientes web, móvil y microservicios, eliminando el estado de "contratos pendientes" y asegurando compatibilidad bidireccional y sin fricción de CORS.

---

## 2. Identidad y ciclo de vida de sesión

### 2.1. Proveedor de identidad y tokens
- **Emisor:** Supabase Auth (`GoTrue`).
- **Transporte de credenciales:** Cabecera HTTP `Authorization: Bearer <access_token>`.
- **Formato del token:** JWT firmado con algoritmo asimétrico (`RS256` o `ES256`), con validación mediante claves públicas obtenidas vía JWKS (`/auth/v1/.well-known/jwks.json`).
- **Audiencia requerida:** `authenticated`.
- **Claim principal de identidad:** `sub` (identificador UUID v4 asignado por Supabase).
- **Control de expiración:** Claims `exp` e `iat` con un margen de tolerancia (*leeway*) de 5 segundos para absorber desfases de reloj.

### 2.2. Resolución de identidad de negocio
Los servicios desacoplados no consultan directamente la base de datos de Auth ni asumen identificadores numéricos desde el cliente. El servicio `auth-users-service` expone la ruta interna de resolución:

- **Endpoint interno:** `GET /internal/v1/identidad`
- **Autorización:** `Bearer <access_token>`
- **Respuesta (JSON):**
  ```json
  {
    "subject": "1786a4dd-f811-4cc0-8ed2-a4e6eb9db131",
    "user_id": 12,
    "email_confirmed": true,
    "administrator": false
  }
  ```
- **Mapeo:** La tupla se encapsula internamente en el objeto inmutable de dominio `Actor(subject, user_id, email_confirmed, administrator)`.

### 2.3. Ciclo de vida: Provisión y revocación
```
[Registro en Supabase]
         │
         ▼
[Confirmación de Correo Electrónico]
         │
         ▼
[POST /api/v1/perfil/inicializacion]  <── (Alta con nombre y fecha de nacimiento)
         │
         ▼
[Perfil Creado en haycupo.usuario]
         │
         ▼
[Sesión Activa: Acceso Pleno al Recorrido]
         │
         ▼
[POST /api/v1/sesion/revocar]          <── (Cierre de sesión: invalida session_id)
```

1. **Inicialización / Provisión (`POST /api/v1/perfil/inicializacion` y `/local/v1/perfil/inicializacion`):**
   - Requiere `Authorization: Bearer <token>`.
   - Verifica que `email_confirmed` sea `true`.
   - Recibe `{ "nombre": str, "fecha_nacimiento": "YYYY-MM-DD" }`.
   - Valida mayoría de edad (edad calculada entre 18 y 120 años).
   - Inserta idempotentemente la fila de perfil en `haycupo.usuario` vinculada al `supabase_user_id`.
   - Responde `HTTP 200/201`: `{"id_usuario": int, "inicializado": true}`.
2. **Revocación de sesión (`POST /api/v1/sesion/revocar` y `/local/v1/sesion/revocar`):**
   - Extrae el claim `session_id` del token verificado.
   - Registra el `session_id` en la tabla de revocaciones, impidiendo reutilización de tokens activos aunque no hayan expirado numéricamente.
   - Responde `HTTP 200`: `{"success": true}`.

---

## 3. Matriz de permisos y control de acceso

El sistema impone un control de acceso basado en 4 niveles de privilegios:

| Nivel | Rol / Estado | Identificación y Requisitos | Capacidades en el Recorrido | Rutas Permitidas |
|:---:|:---|:---|:---|:---|
| **0** | **Público / Anónimo** | Sin token en cabecera o token omitido. | Exploración del catálogo, búsqueda general, visualización de avisos públicos, fotos e inspección de salud. | `GET /health`<br>`GET /api/publicaciones`<br>`GET /api/publicaciones/buscar`<br>`GET /api/publicaciones/{id}/detalle`<br>`GET /api/publicaciones/{id}/cupos`<br>`GET /api/v1/usuarios/publicos`<br>`GET /conexiones/usuarios/buscar`<br>`GET /imagenes/*` |
| **1** | **Autenticado (Correo Pendiente)** | Bearer JWT válido; `email_confirmed == false`. | Consultar su identidad, provisionar perfil inicial si no existe, o revocar su sesión. **Bloqueado** para crear contenido o interactuar con terceros. | Nivel 0 +<br>`GET /internal/v1/identidad`<br>`POST /api/v1/perfil/inicializacion`<br>`GET /usuarios/me` / `GET /api/v1/perfil`<br>`POST /api/v1/sesion/revocar` |
| **2** | **Autenticado Verificado (Usuario Pleno)** | Bearer JWT válido; `email_confirmed == true`. | Recorrido completo: editar perfil y foto, crear y gestionar avisos propios, postular a arriendos, gestionar postulantes de sus avisos, enviar y responder solicitudes de conexión. | Nivel 1 +<br>`PATCH /usuarios/me` / `PATCH /api/v1/perfil`<br>`PUT /api/v1/perfil` (foto multipart)<br>`GET /api/mis-publicaciones`<br>`GET /api/publicaciones/{id}`<br>`POST /api/publicaciones`<br>`PUT /api/publicaciones/{id}`<br>`PATCH /api/publicaciones/{id}/cerrar`<br>`POST /api/publicaciones/{id}/postulaciones`<br>`GET /api/postulaciones/mias`<br>`GET /api/publicaciones/{id}/postulantes`<br>`PATCH /api/postulaciones/{id}/estado`<br>`POST /conexiones/`<br>`GET /conexiones/recibidas,enviadas,aceptadas`<br>`PUT /conexiones/{id}`<br>`DELETE /conexiones/{id}`<br>`GET /api/v1/notificaciones` |
| **3** | **Administrador** | Bearer JWT válido; `administrator == true` (listado en `ROOMIES_ADMIN_SUBJECTS` o `ADMIN_USER_IDS`). | Monitoreo y métricas globales consolidadas del sistema y catálogo administrativo completo. | Nivel 2 +<br>`GET /api/admin/resumen`<br>`GET /api/admin/publicaciones`<br>`GET /internal/v1/resumen` (en cada servicio) |

> **Comportamiento ante denegación:**
> - Intento de operación de Nivel 2 con correo no verificado: responde `HTTP 403 Forbidden` con detalle `{"detail": "Confirma tu correo antes de continuar."}`.
> - Intento de operación de Nivel 3 sin rol administrativo: responde `HTTP 403 Forbidden` con detalle `{"detail": "Acceso administrativo no permitido."}`.
> - Ausencia o invalidez de Bearer en rutas protegidas: responde `HTTP 401 Unauthorized`.

---

## 4. Contratos comunes del recorrido

A continuación se detallan los contratos acordados. Cada ruta canónica (`/api/v1/...` o `/usuarios/...`) se mantiene con alias compatible (`/local/v1/...`) en el Gateway y servicios.

### 4.1. Módulo de Perfil y Cuenta

#### 4.1.1. Consulta de Perfil Propio
- **Ruta canónica:** `GET /usuarios/me`  
  *(Alias compatible: `GET /api/v1/perfil` y `GET /local/v1/perfil`)*
- **Nivel de permiso:** Nivel 1 (Autenticado).
- **Respuesta satisfactoria (`HTTP 200 OK`):**
  ```json
  {
    "nombre": "Francisca Silva",
    "edad": 23,
    "ocupacion": "Estudiante de Ingeniería",
    "ciudad": "Temuco",
    "breve_descripcion": "Tranquila, ordenada y enfocada en mis estudios.",
    "sobre_mi": "Me gusta cocinar los fines de semana y compartir un café.",
    "foto_perfil": "/imagenes/u_9f83b1238491c34a123f84712039ba21.jpg",
    "verificado": true,
    "edad_calculada": true
  }
  ```
- **Campos nulables:** `ocupacion`, `ciudad`, `breve_descripcion`, `sobre_mi`, `foto_perfil` aceptan `null` o valor vacío cuando el usuario no los ha ingresado.
- **Inmutabilidad:** `nombre`, `edad`, `verificado` y `edad_calculada` no son editables por el usuario.

#### 4.1.2. Edición Parcial de Perfil (JSON)
- **Ruta canónica:** `PATCH /usuarios/me`  
  *(Alias compatible: `PATCH /api/v1/perfil` y `PATCH /local/v1/perfil`)*
- **Nivel de permiso:** Nivel 2 (Correo confirmado).
- **Cabeceras:** `Content-Type: application/json`
- **Cuerpo de solicitud (JSON):**
  ```json
  {
    "ocupacion": "Diseñadora Gráfica",
    "ciudad": "Temuco",
    "breve_descripcion": "Busco habitación iluminada para teletrabajo.",
    "sobre_mi": "Vegetariana, tengo una gata educada.",
    "presupuesto": 280000,
    "zona_interes": "Avenida Alemania"
  }
  ```
  *Nota:* Las claves omitidas no se modifican; enviar `null` o texto vacío borra el campo correspondiente. Campos como `presupuesto` y `zona_interes` son admitidos opcionalmente.
- **Respuesta satisfactoria (`HTTP 200 OK`):** Retorna el DTO de perfil actualizado.

#### 4.1.3. Actualización Completa de Perfil y Fotografía (Multipart)
- **Ruta canónica:** `PUT /api/v1/perfil`  
  *(Alias compatible: `PUT /local/v1/perfil`)*
- **Nivel de permiso:** Nivel 2 (Correo confirmado).
- **Cabeceras:** `Content-Type: multipart/form-data`
- **Campos del formulario:**
  - `ocupacion`: string (máx 100).
  - `ciudad`: string (máx 100).
  - `breve_descripcion`: string (máx 255).
  - `sobre_mi`: string (máx 5000).
  - `edad`: string opcional (debe coincidir con la edad calculada si se envía).
  - `foto`: archivo binario opcional (JPEG, PNG o WEBP; máx 5 MB).
- **Respuesta satisfactoria (`HTTP 200 OK`):** `{"success": true}`.

---

### 4.2. Módulo de Publicaciones y Catálogo

#### 4.2.1. Catálogo General y Búsqueda
- **Ruta:** `GET /api/publicaciones` y `GET /api/publicaciones/buscar`
- **Nivel de permiso:** Nivel 0 (Público).
- **Parámetros de consulta (Query Params):**
  - `consulta` (opcional, string máx 250): Texto libre de búsqueda.
  - `precio_min` (opcional, número >= 0): Precio mínimo.
  - `precio_max` (opcional, número >= 0): Precio máximo.
  - `cupos_min` / `personas` (opcional, entero >= 1): Cantidad mínima de cupos/habitaciones.
  - `tipo_vivienda` / `tipo` (opcional): `"casa"` | `"departamento"` | `"habitacion"`.
  - `mascota` / `mascotas` (opcional): `"si"` | `"no"`.
  - `categoria` (opcional): `"ofrezco"` | `"busco"`.
  - `limite` (opcional, defecto 100, rango 1..100).
  - `offset` (opcional, defecto 0).
- **Respuesta (`HTTP 200 OK`):** Lista de publicaciones:
  ```json
  [
    {
      "id": 14,
      "titulo": "Habitación individual cerca de UCT Campus San Francisco",
      "tipo": "habitacion",
      "descripcion": "Incluye gastos comunes, wifi y lavandería.",
      "precio": 180000.0,
      "ubicacion": "Manuel Montt, Temuco",
      "estado": "Activa",
      "cupos_totales": 1,
      "cupos": 1,
      "cupos_disponibles": 1,
      "tipo_vivienda": "departamento",
      "categoria": "ofrezco",
      "mascota": "no",
      "permitir_comentarios": true,
      "imagen": "/imagenes/p_4b2c19a8f276182c091d848123049182.jpg",
      "fecha_publicacion": "2026-11-10T14:30:00Z"
    }
  ]
  ```

#### 4.2.2. Detalle de Aviso
- **Público:** `GET /api/publicaciones/{id}/detalle` (retorna el DTO de la publicación).
- **Cupos:** `GET /api/publicaciones/{id}/cupos` (retorna `id`, `estado`, `cupos_totales`, `cupos_disponibles`).
- **Propietario:** `GET /api/publicaciones/{id}` (requiere Nivel 2 y ser el dueño del aviso).

#### 4.2.3. Creación de Aviso
- **Ruta:** `POST /api/publicaciones`
- **Nivel de permiso:** Nivel 2 (Correo confirmado).
- **Cabeceras:** `Content-Type: multipart/form-data`
- **Campos del formulario:**
  - `titulo` (string 1..255, obligatorio).
  - `descripcion` (string 1..5000, obligatorio).
  - `ubicacion` (string 1..255, obligatorio).
  - `precio` (entero positivo en texto, ej. `"220000"`).
  - `tipo` (tipo de origen o vivienda, ej. `"Arrendador"`, `"Compartida"` o `"casa"`).
  - `categoria` (`"ofrezco"` para arriendos, `"busco"` para compartir).
  - `tipo_vivienda` (`"casa"`, `"departamento"`, `"habitacion"`).
  - `mascota` (`"si"` o `"no"`).
  - `cupos_totales` (entero positivo 1..99).
  - `permitir_comentarios` (`"true"` o `"false"`).
  - `imagen` (archivo opcional de imagen, máx 5 MB).
- **Respuesta (`HTTP 201 Created`):**
  ```json
  {
    "id": 15,
    "mensaje": "Publicación creada"
  }
  ```

#### 4.2.4. Gestión de Aviso Propio
- **Mis publicaciones:** `GET /api/mis-publicaciones` (Nivel 2; retorna los avisos creados por el usuario).
- **Edición:** `PUT /api/publicaciones/{id}` (Nivel 2; actualiza los campos mediante multipart).
- **Cierre:** `PATCH /api/publicaciones/{id}/cerrar` (Nivel 2; pasa el estado a `"Cerrada"`, impidiendo nuevas postulaciones).

---

### 4.3. Módulo de Postulaciones

#### 4.3.1. Postular a un Aviso
- **Ruta:** `POST /api/publicaciones/{id}/postulaciones`
- **Nivel de permiso:** Nivel 2 (Correo confirmado).
- **Regla:** El usuario no puede postular a su propio aviso ni duplicar postulación activa.
- **Respuesta (`HTTP 201 Created`):**
  ```json
  {
    "id_postulacion": 42,
    "id_publicacion": 14,
    "id_usuario": 12,
    "estado": "Pendiente",
    "fecha_postulacion": "2026-11-17T20:45:00Z"
  }
  ```

#### 4.3.2. Mis Postulaciones Enviadas
- **Ruta:** `GET /api/postulaciones/mias`
- **Nivel de permiso:** Nivel 2.
- **Respuesta (`HTTP 200 OK`):** Lista de postulaciones ordenadas de más reciente a más antigua con `id_postulacion`, `id_publicacion`, `id_usuario`, `estado` (`"Pendiente"`, `"Preseleccionada"`, `"Aceptada"`, `"Rechazada"`, `"Cancelada"`), `fecha_postulacion`, `titulo` y `motivo`.

#### 4.3.3. Ver y Decidir Candidatos (Dueño del Aviso)
- **Consultar candidatos:** `GET /api/publicaciones/{id}/postulantes`
- **Decidir estado de postulación:** `PATCH /api/postulaciones/{id}/estado`
  - **Cuerpo JSON:**
    ```json
    {
      "estado": "Preseleccionada",
      "motivo": "Cumple con el perfil de estudiante solicitado."
    }
    ```
  - **Valores permitidos de estado:** `"Preseleccionada"`, `"Aceptada"`, `"Rechazada"`, `"Cancelada"`.
  - **Respuesta (`HTTP 200 OK`):**
    ```json
    {
      "id_postulacion": 42,
      "estado": "Preseleccionada",
      "incorporacion_pendiente": false
    }
    ```

---

### 4.4. Módulo de Conexiones y Match

- **Enviar solicitud:** `POST /conexiones/` con `{ "id_receptor_FK": int }`. Responde `HTTP 201 Created`.
- **Bandejas:**
  - `GET /conexiones/recibidas`: Solicitudes pendientes de responder.
  - `GET /conexiones/enviadas`: Solicitudes emitidas pendientes de aprobación.
  - `GET /conexiones/aceptadas`: Contactos activos conectados mutuamente.
- **Responder solicitud:** `PUT /conexiones/{id}` con `{ "estado": "Aceptada" | "Rechazada" }`.
- **Cancelar o eliminar:** `DELETE /conexiones/{id}`. Responde `HTTP 204 No Content`.
- **Búsqueda pública de candidatos (Personas):**
  - `GET /api/v1/usuarios/publicos` y `GET /conexiones/usuarios/buscar`
  - Filtros: `presupuesto_max`, `zona`, `ocupacion`. Retorna listado de perfiles públicos con avatar y datos básicos.

---

### 4.5. Módulo de Administración

- **Resumen métrico global:** `GET /api/admin/resumen`
  - **Nivel de permiso:** Nivel 3 (Administrador verificado).
  - **Respuesta (`HTTP 200 OK`):**
    ```json
    {
      "usuarios": 84,
      "publicaciones": 32,
      "conexiones": 19
    }
    ```
- **Catálogo administrativo paginado:** `GET /api/admin/publicaciones?limite=20&pagina=1`
  - **Respuesta (`HTTP 200 OK`):**
    ```json
    {
      "items": [
        {
          "id": 1,
          "titulo": "Arriendo central",
          "precio": 250000.0,
          "ubicacion": "Temuco Centro",
          "estado": "Activa",
          "cupos_totales": 2
        }
      ],
      "pagina": 1,
      "hay_mas": false
    }
    ```

---

## 5. Integración del API Gateway y soporte CORS

### 5.1. Enrutamiento transparente hacia microservicios
El API Gateway (`backend/api-gateway/app/local_routes.py`) enruta las solicitudes preservando cabeceras y métodos hacia sus destinos internos:
1. `upstream` (`AUTH_USERS_UPSTREAM_URL`): `/usuarios/me`, `/(?:local|api)/v1/perfil*`, `/(?:local|api)/v1/sesion/*`, `/imagenes/u_*`.
2. `listado_upstream` (`LISTADO_UPSTREAM_URL`): `/api/publicaciones*`, `/api/mis-publicaciones`, `/api/postulaciones*`, `/api/admin/publicaciones`, `/imagenes/p_*`.
3. `match_upstream` (`MATCH_UPSTREAM_URL`): `/conexiones/*`.

### 5.2. Solución de CORS y preconsultas OPTIONS
Se implementó el manejador de preconsultas `cors_preflight` en el Gateway:
- **Métodos permitidos:** `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
- **Cabeceras permitidas:** `Authorization, Content-Type, Accept, Accept-Language, x-roomies-service, x-haycupo-csrf`.
- **Comportamiento:**
  - Si una solicitud `OPTIONS` contiene la cabecera `Origin` (enviada automáticamente por Expo Web en `http://localhost:8081` o Next.js en `http://localhost:3000`), el Gateway responde `HTTP 204 No Content` con cabeceras `Access-Control-Allow-Origin: <origin>` y `Access-Control-Max-Age: 86400`.
  - En respuestas satisfactorias o de error con `Origin`, el Gateway adjunta `Access-Control-Allow-Origin` de forma transparente.
  - Si una solicitud `OPTIONS` se invoca sin `Origin` (ej. prueba CLI estricta), el Gateway mantiene `HTTP 405 Method Not Allowed`, conservando el aislamiento y las validaciones de seguridad existentes.

### 5.3. Coordinación de tamaños máximos
- **Gateway:** Límite configurado a **6 MB** (`6291456` bytes) en modo local / Supabase.
- **Servicios:** Carga máxima de fotografías de avisos y perfiles establecida en **5 MB**.

---

## 6. Verificación y validación

| Suite / Verificación | Casos Ejecutados | Resultado |
|:---|:---:|:---:|
| **Reglas de Auth / Users** (`test_auth.py`) | 9 | **9 aprobados** |
| **Reglas de Listado / Publications** (`test_listado.py`) | 18 | **18 aprobados** |
| **Reglas de Match / Conexiones** (`test_match.py`) | 6 | **6 aprobados** |
| **Configuración y Runtime de Servicios** (`test_runtime.py`) | 10 | **10 aprobados** |
| **Rutas y DTOs de Perfil** (`test_profiles.py`) | 28 | **28 aprobados** |
| **Total comprobado sin dependencias externas** | **71** | **71/71 aprobados** (100%) |

**Conclusión:**
Con esta definición e implementación, los contratos comunes del recorrido quedan **fijados, unificados y plenamente operativos** para el equipo de desarrollo, cerrando la brecha entre TI2 y TI4 planteada en **SCRUM-93**.
