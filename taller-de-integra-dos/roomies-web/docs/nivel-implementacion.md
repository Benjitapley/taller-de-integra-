# Roomies TI2: avance frente al backlog de Sprint 3

Corte: 23/11/2026. Alcance: 34 tareas TI2, SCRUM-93 a SCRUM-126, del backlog v1.4. No incluye las tareas móviles posteriores. Consulta directa de Jira y Git; no se cambiaron estados de Jira.

## Medida reproducible

**Cierre registrado en Jira: 9/34 = 26,5 %.** Cada tarea pesa lo mismo. No representa horas ejecutadas ni porcentaje de funcionamiento del producto.

| Estado | Tareas | Porcentaje |
| --- | ---: | ---: |
| Finalizado | 9 | 26,5 % |
| En revisión | 9 | 26,5 % |
| En curso | 5 | 14,7 % |
| Por hacer | 11 | 32,4 % |

Finalizadas o en revisión: 18/34 = 52,9 %. Las revisiones no se cuentan como aceptación. La estimación anterior del 40 % usaba ocho bloques del README y otro alcance; no es comparable.

## Diferencia entre Jira, integración y entorno

- 112 y 113 están integradas; 112 todavía figura En revisión en Jira.
- La rama 111 incorpora POST/GET/PATCH /api/usuarios/me y PUT /api/usuarios/me/foto, BFF, Storage y una migración aditiva de Auth. La prueba con una cuenta real y una nueva sesión se registra por separado.
- La reconciliación conserva id_propietario del detalle autorizado, resuelve los conflictos del frontend y retira la carpeta TI2 duplicada con espacios. La ruta es taller-de-integra-dos/roomies-web, igual que main.
- Los avances recientes de la 100 siguen en su rama; no se integran aquí.
- Convivencia y Reportes no se activaron en el entorno compartido local por indicación del usuario; se conservan sus implementaciones.
- Las pruebas con SQL temporal y proveedores externos ficticios no acreditan producción. El cierre remoto permanece en 98/116 y en los hitos de despliegue.

## Estado consultado en Jira

| Tarea | Alcance | Estado |
| --- | --- | --- |
| [SCRUM-93](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-93) | Fijar identidad, permisos y contratos del recorrido | Finalizado |
| [SCRUM-94](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-94) | Adaptar perfil y migración de identidad al contrato común | En revisión |
| [SCRUM-95](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-95) | Crear el servicio de reportes y el envío por usuario | En revisión |
| [SCRUM-96](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-96) | Implementar revisión administrativa y trazabilidad de reportes | En revisión |
| [SCRUM-97](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-97) | Conectar notificaciones mínimas y entrega deduplicada | En revisión |
| [SCRUM-98](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-98) | Verificar seguridad, perfil y reportes en el entorno final | Por hacer |
| [SCRUM-99](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-99) | Cerrar la reconciliación de ramas y publicar el anexo técnico | Finalizado |
| [SCRUM-100](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-100) | Validar Kubero y fijar la topología de despliegue | En curso |
| [SCRUM-101](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-101) | Ensayar y ejecutar la migración de negocio a PostgreSQL Kubero | Por hacer |
| [SCRUM-102](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-102) | Desplegar Gateway y servicios separados con persistencia duradera | En curso |
| [SCRUM-103](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-103) | Asegurar las llamadas internas y sus reintentos | Por hacer |
| [SCRUM-104](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-104) | publicar el candidato integrado y verificar operación | Por hacer |
| [SCRUM-105](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-105) | Preparar el contrato y la base de Convivencia en reemplazo inicial | Finalizado |
| [SCRUM-106](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-106) | Alinear publicaciones, imágenes y paginación al contrato | Finalizado |
| [SCRUM-107](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-107) | Completar aceptación con incorporación y recuperación | Finalizado |
| [SCRUM-108](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-108) | Cerrar edición, cancelaciones y estados de postulaciones | Finalizado |
| [SCRUM-109](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-109) | Implementar tareas compartidas con permisos y reasignación | En curso |
| [SCRUM-110](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-110) | Comprobar concurrencia y consistencia del recorrido | Por hacer |
| [SCRUM-111](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-111) | Preparar web para el contrato de cuenta y perfil | En revisión |
| [SCRUM-112](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-112) | Completar la gestión de postulantes y el ingreso desde web | En revisión |
| [SCRUM-113](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-113) | Añadir envío y seguimiento de reportes en web | Finalizado |
| [SCRUM-114](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-114) | Conectar el panel administrador de reportes | En curso |
| [SCRUM-115](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-115) | Completar navegación y paginación de listas privadas | Por hacer |
| [SCRUM-116](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-116) | Validar el recorrido web y la persistencia de extremo a extremo | Por hacer |
| [SCRUM-117](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-117) | Preparar las interfaces del recorrido y sus estados | En revisión |
| [SCRUM-118](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-118) | Conectar catálogo y formularios al nuevo DTO y cursor | En revisión |
| [SCRUM-119](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-119) | Conectar Mi arriendo e integrantes | En revisión |
| [SCRUM-120](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-120) | Implementar chat de convivencia persistido en web | En curso |
| [SCRUM-121](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-121) | Conectar tareas compartidas y prueba cruzada | Por hacer |
| [SCRUM-122](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-122) | Conectar retiro por arrendador y revocar la experiencia activa | Implementado; aceptacion SQL/integrada pendiente ([evidencia](SCRUM-122.md)) |
| [SCRUM-123](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-123) | Coordinar aceptación móvil y verificar todas las paginaciones | Por hacer |
| [SCRUM-124](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-124) | Implementar ingreso, pertenencia y consulta de arriendo | Finalizado |
| [SCRUM-125](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-125) | Persistir chat de convivencia con paginación y autorización | Finalizado |
| [SCRUM-126](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-126) | Implementar retiro exclusivo por dueño y sus efectos | Por hacer |
