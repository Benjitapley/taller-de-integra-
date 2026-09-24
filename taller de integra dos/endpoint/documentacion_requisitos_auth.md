# Sistema Roomies
## Requisitos de autenticacion y acceso

Asignatura: Taller de Integracion II  
Version: 1.0  
Alcance: registro, inicio de sesion y gestion de la sesion del usuario

---

## 3. Stakeholders, actores y casos de uso

### 3.1. Stakeholders

| Stakeholder | Interes / necesidad |
| --- | --- |
| Personas que buscan roomie | Crear una cuenta e ingresar de forma segura para utilizar Roomies. |
| Personas que buscan arriendo | Mantener sus datos de acceso y continuar su flujo dentro de la plataforma. |
| Roomies | Consultar y actualizar su informacion basica mediante la pantalla de perfil. |
| Equipo de desarrollo | Implementar una interfaz de autenticacion coherente con el mockup y preparada para consumir la API. |

### 3.2. Actores del sistema

- **A1 - Usuario:** persona mayor de edad que se registra, inicia y cierra sesion.
- **A2 - API de autenticacion:** servicio responsable de registrar credenciales, validar el acceso y devolver la informacion del usuario autenticado.

Un mismo usuario utiliza las funciones de registro, inicio de sesion y perfil desde el cliente web.

### 3.3. Modelo de casos de uso

Los casos de uso incluidos en este alcance son:

- Registrar usuario.
- Iniciar sesion.
- Cerrar sesion.
- Consultar perfil.
- Actualizar perfil.

El cliente web consume una capa API comun. En la implementacion actual, dicha capa esta representada por `mockApi` y persiste los datos en `localStorage`, manteniendo la misma separacion de responsabilidades que tendra la API REST definitiva.

---

## 4. Requisitos especificos

### 4.1. Requisitos funcionales (FR)

#### 4.1.1. Gestion de cuentas y acceso

**FR-AUTH-01:** El sistema debe mostrar una pantalla de registro y una pantalla de inicio de sesion con la estructura visual definida en el mockup de Figma.

**FR-AUTH-02:** El sistema debe permitir registrar un usuario mediante nombre completo, correo electronico y contrasena.

**FR-AUTH-03:** El sistema debe validar que los campos obligatorios esten completos antes de enviar el registro.

**FR-AUTH-04:** El sistema debe validar que la contrasena de registro tenga al menos seis caracteres.

**FR-AUTH-05:** El sistema debe rechazar el registro cuando el correo electronico ya se encuentre asociado a otra cuenta.

**FR-AUTH-06:** El sistema debe enviar los datos de registro a la capa API de autenticacion.

**FR-AUTH-07:** El sistema debe permitir iniciar sesion mediante correo electronico y contrasena.

**FR-AUTH-08:** El sistema debe enviar las credenciales a la capa API y mostrar un mensaje cuando sean invalidas.

**FR-AUTH-09:** Al iniciar sesion correctamente, el sistema debe conservar la sesion activa y redirigir al usuario a la pantalla principal.

**FR-AUTH-10:** El sistema debe permitir mostrar u ocultar la contrasena mediante un icono de ojo.

**FR-AUTH-11:** El sistema debe permitir cerrar sesion y eliminar la sesion activa del cliente.

#### 4.1.2. Gestion de perfil

**FR-AUTH-12:** El sistema debe mostrar el nombre y correo del usuario autenticado en la pantalla de perfil.

**FR-AUTH-13:** El sistema debe permitir actualizar nombre, correo, telefono, ciudad y biografia.

**FR-AUTH-14:** El sistema debe enviar los cambios del perfil a la capa API y mostrar el resultado de la operacion.

**FR-AUTH-15:** El sistema debe limpiar mensajes de validacion y datos temporales al cambiar entre registro e inicio de sesion.

---

## 5. Casos de uso detallados

### 5.1. UC-AUTH-01 - Registrar usuario

**Actor principal:** Usuario  
**Objetivo:** Crear una cuenta en el sistema.

**Precondiciones:**

- El usuario no debe tener una cuenta registrada con el mismo correo.
- La pantalla de registro debe estar disponible.

**Postcondiciones:**

- La cuenta queda registrada mediante la capa API.
- El usuario puede iniciar sesion.
- El sistema muestra la pantalla de login para continuar el flujo.

**Flujo principal:**

1. El usuario selecciona `Crear cuenta`.
2. El sistema muestra nombre, correo y contrasena.
3. El usuario completa los datos.
4. El sistema valida los campos obligatorios.
5. El sistema valida la longitud minima de la contrasena.
6. El cliente envia la solicitud de registro a la API.
7. La API confirma la creacion de la cuenta.
8. El sistema limpia el formulario y redirige al login.

**Flujos alternativos:**

- **A1:** Si falta un dato obligatorio, el sistema muestra un mensaje de validacion.
- **A2:** Si la contrasena tiene menos de seis caracteres, el sistema rechaza el registro.
- **A3:** Si el correo ya existe, el sistema informa el conflicto y mantiene al usuario en el registro.

### 5.2. UC-AUTH-02 - Iniciar sesion

**Actor principal:** Usuario  
**Objetivo:** Acceder a la plataforma con una cuenta registrada.

**Precondiciones:**

- El usuario debe tener una cuenta registrada.
- La pantalla de login debe estar disponible.

**Postcondiciones:**

- La API valida las credenciales.
- El sistema conserva la sesion activa.
- El usuario es redirigido a la pantalla principal de Roomies.

**Flujo principal:**

1. El usuario ingresa su correo y contrasena.
2. El usuario selecciona `Iniciar sesion`.
3. El sistema valida que ambos campos esten completos.
4. El cliente envia las credenciales a la API.
5. La API devuelve el usuario autenticado.
6. El sistema guarda la sesion y redirige a `hayCupo.html`.

**Flujos alternativos:**

- **A1:** Si falta el correo o la contrasena, el sistema solicita completar los campos.
- **A2:** Si las credenciales no coinciden, el sistema muestra un mensaje de error sin abandonar el login.

### 5.3. UC-AUTH-03 - Consultar y actualizar perfil

**Actor principal:** Usuario  
**Objetivo:** Consultar y modificar la informacion editable del perfil.

**Precondiciones:**

- El usuario debe haber iniciado sesion.

**Postcondiciones:**

- La informacion validada queda actualizada mediante la capa API.
- El sistema muestra una confirmacion del cambio.

**Flujo principal:**

1. El sistema carga la informacion del usuario autenticado.
2. El usuario modifica los campos editables.
3. El usuario selecciona `Guardar cambios`.
4. El sistema valida nombre y correo.
5. El cliente envia la actualizacion a la API.
6. El sistema actualiza la vista del perfil y muestra el resultado.

---

## 6. Criterios de aceptacion del alcance

| ID | Requisito | Criterio de aceptacion |
| --- | --- | --- |
| CA-AUTH-01 | Registro | Un usuario puede completar el registro con datos validos y luego volver al login. |
| CA-AUTH-02 | Registro duplicado | Un correo registrado no puede crear una segunda cuenta. |
| CA-AUTH-03 | Login | Un usuario con credenciales validas llega a la pantalla principal. |
| CA-AUTH-04 | Login invalido | Las credenciales invalidas muestran un mensaje y mantienen visible el formulario. |
| CA-AUTH-05 | Contrasena | El icono de ojo alterna entre mostrar y ocultar la contrasena. |
| CA-AUTH-06 | Perfil | El usuario autenticado puede consultar y guardar los campos editables del perfil. |

## 7. Trazabilidad del alcance

| Caso de uso | Requisitos relacionados |
| --- | --- |
| UC-AUTH-01 | FR-AUTH-01 a FR-AUTH-06 |
| UC-AUTH-02 | FR-AUTH-01, FR-AUTH-07 a FR-AUTH-11 |
| UC-AUTH-03 | FR-AUTH-12 a FR-AUTH-15 |
