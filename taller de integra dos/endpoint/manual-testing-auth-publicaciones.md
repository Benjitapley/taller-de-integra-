# Plan y Guia de Pruebas Manuales: Auth y Publicaciones

**Proyecto:** ¿Hay cupo? / Roomies  
**Rama:** `test/QA-01-pruebas-auth`  
**Tarea:** Apoyar pruebas manuales de los flujos de auth/publicaciones  
**Fecha:** 2026-09-27

---

## 1. Objetivo

Este documento sirve como guia practica para realizar la **ejecucion de pruebas manuales** en la aplicacion. Cubre los flujos principales del sistema:

1. **Autenticacion y Perfil de Usuario (Auth):** Registro de usuarios, inicio de sesion, mostrar/ocultar contrasena, mantenimiento de la sesion, edicion de perfil y cierre de sesion.
2. **Creacion y Gestion de Publicaciones:** Formulario de publicacion, seleccion de categorias y tipos de vivienda, subida de imagenes, autocompletado de ubicacion y validaciones del sistema.

---

## 2. Entorno y Requisitos Previos

### Para probar Auth (Frontend Local)

- **Archivo principal:** `taller de integra dos/endpoint/pagina_haycupo/Auth_app/auth_app.html`
- **Navegador:** Chrome, Firefox o Edge usando las herramientas de desarrollador (F12) para inspeccionar `localStorage` y la consola.

### Para probar Publicaciones (Backend FastAPI + Frontend HTML)

- **Python 3.10+** con dependencias instaladas (`main/requirements.txt`):
  ```bash
  pip install fastapi uvicorn psycopg httpx pillow
  ```
- **Variables de Entorno para Pruebas Locales:**
  ```env
  DATABASE_URL=postgresql://usuario:password@localhost:5432/nombre_bd
  MODO_PRUEBA_LOCAL=1
  PUBLICACION_AUTOR_ID=1
  GEOAPIFY_API_KEY=tu_api_key_opcional
  ```
- **Como iniciar el servidor:**
  ```bash
  cd main
  uvicorn main:app --reload --port 8000
  ```

---

## 3. Matriz de Casos de Prueba Manuales

### 3.1. Flujo de Autenticacion (Auth)

| ID             | Caso de Prueba                                | Precondiciones                                  | Pasos de Ejecucion                                                                                                                                | Resultado Esperado                                                                        | Estado                  |
| -------------- | --------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------- |
| **CP-AUTH-01** | Registro exitoso de usuario                   | Estar en `auth_app.html`, vista "Crear cuenta". | 1. Ingresar Nombre Completo.<br>2. Ingresar un correo unico.<br>3. Ingresar contrasena de 6 o mas caracteres.<br>4. Hacer clic en "Crear cuenta". | Registro exitoso, cambio al formulario de Login con mensaje de confirmacion.              | `[ ] PASS` / `[ ] FAIL` |
| **CP-AUTH-02** | Registro con campos obligatorios vacios       | Formulario de Registro abierto.                 | 1. Dejar los campos vacios.<br>2. Hacer clic en "Crear cuenta".                                                                                   | El sistema muestra un mensaje advirtiendo completar los campos obligatorios.              | `[ ] PASS` / `[ ] FAIL` |
| **CP-AUTH-03** | Registro con contrasena corta (<6 caracteres) | Formulario de Registro abierto.                 | 1. Ingresar nombre y correo.<br>2. Escribir una contrasena corta (menos de 6 caracteres).<br>3. Hacer clic en "Crear cuenta".                     | Mensaje de error indicando que la contrasena debe tener al menos 6 caracteres.            | `[ ] PASS` / `[ ] FAIL` |
| **CP-AUTH-04** | Registro con correo ya existente              | Tener un usuario registrado previamente.        | 1. Intentar registrar un usuario con un correo existente.<br>2. Hacer clic en "Crear cuenta".                                                     | Rechazo del registro indicando que el correo ya esta registrado.                          | `[ ] PASS` / `[ ] FAIL` |
| **CP-AUTH-05** | Mostrar u ocultar contrasena                  | Formulario de Login o Registro abierto.         | 1. Escribir texto en el campo contrasena.<br>2. Hacer clic en el icono del ojo.                                                                   | El campo alterna entre texto oculto (`••••••`) y texto visible.                           | `[ ] PASS` / `[ ] FAIL` |
| **CP-AUTH-06** | Inicio de sesion exitoso                      | Contar con credenciales validas.                | 1. Ingresar correo y contrasena correctos.<br>2. Hacer clic en "Iniciar sesion".                                                                  | Login exitoso, guardado de la sesion en `localStorage` y redireccion a `hayCupo.html`.    | `[ ] PASS` / `[ ] FAIL` |
| **CP-AUTH-07** | Inicio de sesion con credenciales incorrectas | Formulario de Login abierto.                    | 1. Ingresar correo valido pero contrasena incorrecta.<br>2. Hacer clic en "Iniciar sesion".                                                       | Mensaje de error ("Credenciales incorrectas") sin recargar la pagina ni borrar el correo. | `[ ] PASS` / `[ ] FAIL` |
| **CP-AUTH-08** | Consulta y edicion de Perfil                  | Tener sesion activa iniciada.                   | 1. Ir a la vista de Perfil.<br>2. Modificar telefono, ciudad o biografia.<br>3. Guardar cambios.                                                  | Los datos actualizados se guardan correctamente y se muestra mensaje de confirmacion.     | `[ ] PASS` / `[ ] FAIL` |
| **CP-AUTH-09** | Cierre de sesion (Logout)                     | Tener sesion activa iniciada.                   | 1. Hacer clic en "Cerrar sesion".                                                                                                                 | La sesion se elimina de `localStorage` y se regresa a la pantalla inicial.                | `[ ] PASS` / `[ ] FAIL` |

---

### 3.2. Flujo de Publicaciones

| ID            | Caso de Prueba                                 | Precondiciones                                 | Pasos de Ejecucion                                                                                                                                                                                    | Resultado Esperado                                                                             | Estado                  |
| ------------- | ---------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------- |
| **CP-PUB-01** | Creacion de publicacion valida                 | Servidor local corriendo en `localhost:8000`.  | 1. Abrir `Creacion.html`.<br>2. Completar titulo, categoria, ubicacion, precio, tipo de vivienda, cupos y descripcion.<br>3. Adjuntar imagen valida (JPG, PNG o WEBP < 5MB).<br>4. Enviar formulario. | Respuesta HTTP 201 Created con el mensaje "Publicacion creada correctamente" y el ID generado. | `[ ] PASS` / `[ ] FAIL` |
| **CP-PUB-02** | Creacion de publicacion sin campos requeridos  | Formulario de creacion abierto.                | 1. Dejar titulo o ubicacion vacios.<br>2. Enviar formulario.                                                                                                                                          | El navegador o servidor bloquean el envio devolviendo error 422 Unprocessable Entity.          | `[ ] PASS` / `[ ] FAIL` |
| **CP-PUB-03** | Carga de archivo no valido como imagen         | Formulario de creacion abierto.                | 1. Seleccionar un archivo que no sea imagen (PDF, TXT, etc.).<br>2. Enviar formulario.                                                                                                                | Error HTTP 422 indicando "Usa una imagen JPG, PNG o WEBP".                                     | `[ ] PASS` / `[ ] FAIL` |
| **CP-PUB-04** | Carga de imagen superando tamano maximo (>5MB) | Formulario de creacion abierto.                | 1. Seleccionar una imagen mayor a 5 MB.<br>2. Enviar formulario.                                                                                                                                      | Error HTTP 413 indicando "La imagen debe pesar como maximo 5 MB".                              | `[ ] PASS` / `[ ] FAIL` |
| **CP-PUB-05** | Autocompletado de Ubicacion                    | `GEOAPIFY_API_KEY` configurada en el servidor. | 1. Escribir al menos 3 caracteres en la ubicacion.<br>2. Observar las opciones desplegadas.                                                                                                           | Se despliega la lista de sugerencias obtenida desde `/api/ubicaciones`.                        | `[ ] PASS` / `[ ] FAIL` |
| **CP-PUB-06** | Intento de publicacion sin autor autenticado   | Servidor con `MODO_PRUEBA_LOCAL=0`.            | 1. Enviar publicacion sin credenciales ni autor de prueba configurado.                                                                                                                                | Error HTTP 503 indicando falta de integracion de login.                                        | `[ ] PASS` / `[ ] FAIL` |

---

## 4. Checklist de Registro de Pruebas Manuales

Marcar con `[X]` cada prueba realizada durante la sesion de QA:

- [ ] **CP-AUTH-01**: Registro de nuevo usuario
- [ ] **CP-AUTH-02**: Validacion de campos requeridos en registro
- [ ] **CP-AUTH-03**: Validacion de tamano minimo de contrasena
- [ ] **CP-AUTH-04**: Control de correo duplicado
- [ ] **CP-AUTH-05**: Boton para mostrar/ocultar contrasena
- [ ] **CP-AUTH-06**: Inicio de sesion correcto
- [ ] **CP-AUTH-07**: Rechazo de login con datos incorrectos
- [ ] **CP-AUTH-08**: Ver y actualizar informacion de Perfil
- [ ] **CP-AUTH-09**: Cierre de sesion exitoso
- [ ] **CP-PUB-01**: Publicacion creada exitosamente
- [ ] **CP-PUB-02**: Validacion de datos obligatorios en publicacion
- [ ] **CP-PUB-03**: Bloqueo de formatos de imagen no soportados
- [ ] **CP-PUB-04**: Bloqueo de imagenes mayores a 5 MB
- [ ] **CP-PUB-05**: Funcionamiento del autocompletado de ubicacion
- [ ] **CP-PUB-06**: Proteccion de endpoint sin usuario autenticado

---

## 5. Reporte de Incidencias (Bugs)

Si encuentras algun error durante las pruebas, puedes registrarlo usando esta estructura:

```markdown
### Bug #ID - [Resumen del problema]

- **Flujo:** Auth / Publicaciones
- **Caso de Prueba:** CP-XXXX-XX
- **Pasos para reproducir:**
  1. ...
  2. ...
- **Resultado Obtenido:** [Lo que ocurrio]
- **Resultado Esperado:** [Lo que deberia haber ocurrido]
- **Captura o Log:** (opcional)
```
