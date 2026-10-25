# Arquitectura del proyecto ¿Hay cupo?

## 1. Objetivo

Documentar la arquitectura actual del proyecto, delimitar las responsabilidades de sus módulos y registrar las tareas pendientes para facilitar el mantenimiento y reducir el acoplamiento.

## 2. Componentes

### 2.1. Aplicación principal

- **Ubicación:** `backend/main/`
- **Archivo de entrada:** `backend/main/main.py`
- **Tecnología:** Python y FastAPI.
- **Responsabilidades:**
  - Inicializar la aplicación e integrar sus routers.
  - Gestionar las rutas de perfiles y páginas que permanecen en el módulo principal.
  - Servir archivos estáticos del frontend.
  - Configurar el middleware y la integración con otros módulos.

Las rutas de publicaciones y ubicaciones se encuentran en módulos independientes dentro de `backend/main/routes/`.

### 2.2. Rutas de publicaciones

- **Ubicación:** `backend/main/routes/publicaciones.py`
- **Tecnología:** FastAPI.
- **Responsabilidades:**
  - Listar publicaciones.
  - Consultar las publicaciones del usuario.
  - Consultar una publicación por identificador.
  - Crear, actualizar y eliminar publicaciones.

El módulo define seis endpoints y se registra mediante `app.include_router()`.

### 2.3. Rutas de ubicaciones

- **Ubicación:** `backend/main/routes/ubicaciones.py`
- **Tecnologías:** FastAPI y HTTPX.
- **Responsabilidad:** buscar ubicaciones mediante `/api/ubicaciones`.

El router se integra en la aplicación principal mediante `app.include_router()`.

### 2.4. Servicio de autenticación

- **Ubicación:** `backend/auth_service/`
- **Archivo principal:** `backend/auth_service/main.py`
- **Componentes relacionados:** `database.py`, `security.py`, `models.py` y `email_service.py`.

Contiene funcionalidades de autenticación, registro y verificación de cuentas. Su configuración debe revisarse antes de modificar su funcionamiento o considerar su despliegue.

También existe el directorio raíz `auth-service/`. Su relación con `backend/auth_service/` debe verificarse antes de eliminar o consolidar archivos.

### 2.5. Servicio de conexiones

- **Ubicación:** `backend/match_conexion_service/`
- **Archivos principales:** `routes.py`, `database.py`, `models.py` y `schemas.py`.
- **Tecnologías:** Python, FastAPI y SQLAlchemy.

Gestiona solicitudes de conexión, respuestas a solicitudes y búsquedas relacionadas con usuarios y publicaciones. Sus rutas se integran en la aplicación principal.

### 2.6. Frontend

El repositorio contiene `frontend/` y `frontend-next/`. Queda pendiente verificar sus funciones, dependencias y uso efectivo.

### 2.7. Persistencia

Se identifican accesos a la base de datos mediante `psycopg` y SQLAlchemy en distintos módulos.

Debe revisarse cómo se configuran y comparten las conexiones y los modelos. No se debe asumir que ambos mecanismos pueden consolidarse sin analizar sus dependencias y pruebas.

Las credenciales y los secretos deben permanecer fuera del código y de la documentación versionada.

## 3. Estado de la separación arquitectónica

Las rutas de publicaciones y ubicaciones se extrajeron de `backend/main/main.py` a módulos específicos. La aplicación principal registra estos routers junto con los módulos de conexiones y autenticación.

Los módulos están separados por responsabilidad, pero siguen integrándose en la aplicación principal. Esto no implica que sean microservicios desplegables de forma independiente.

El módulo principal conserva responsabilidades de inicialización, integración, perfiles y páginas de la aplicación. Una separación adicional debe evaluarse según el alcance y las dependencias reales.

## 4. Principios de organización

- Mantener responsabilidades claras por módulo.
- Evitar duplicar funcionalidades existentes.
- Documentar las dependencias entre componentes.
- Mantener secretos y credenciales fuera del repositorio.
- Acompañar los cambios estructurales con pruebas.
- Diferenciar la configuración de desarrollo de la de producción.
- Revisar dependencias y usos antes de retirar código heredado.

## 5. Pendientes

- Revisar las responsabilidades y dependencias de `frontend/` y `frontend-next/`.
- Determinar la relación entre `auth-service/` y `backend/auth_service/`.
- Documentar la configuración y el uso compartido de la base de datos.
- Evaluar la separación adicional de las rutas de perfiles y otras responsabilidades del módulo principal.
- Revisar el manejo de errores, CORS y la configuración de cada componente.
- Documentar los procedimientos de instalación y ejecución.
- Evaluar la necesidad de un API Gateway independiente según los requisitos del sistema.

## 6. Validación

En la reorganización se ejecutó la suite aislada de pruebas del backend:

- **Resultado:** 63 pruebas aprobadas.
- **Errores de formato en la comprobación `git diff --check`:** ninguno.
- **Advertencias:** cuatro relacionadas con dependencias y configuraciones obsoletas.

Este resultado valida la suite ejecutada en el entorno de pruebas, pero no sustituye las pruebas de despliegue o producción.

## 7. Alcance

La extracción de las rutas de publicaciones y ubicaciones y la documentación de la arquitectura forman parte de esta reorganización. Los puntos pendientes no se consideran implementados hasta que se realicen y validen los cambios correspondientes.
