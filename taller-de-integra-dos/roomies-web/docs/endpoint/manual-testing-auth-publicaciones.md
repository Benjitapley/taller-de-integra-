# QA web de Roomies Sprint 2

Usar la web Next.js y el Gateway del entorno de pruebas acordado. Preparar dos
cuentas de prueba con correo accesible, A para publicar y B para postular.
Registrar para cada fila ambiente, commit, resultado y evidencia sin incluir
contraseñas, cookies ni códigos de correo.

| Prueba | Pasos | Resultado esperado |
| --- | --- | --- |
| Registro y confirmación | Registrar A y B en la web. Abrir el enlace o ingresar el código recibido. | La confirmación es visible y ambas cuentas pueden iniciar sesión. |
| Inicio y cierre de sesión | Iniciar sesión con A, recargar Inicio y cerrar sesión. Intentar abrir Perfil después. | La sesión se conserva al recargar. Perfil redirige al acceso al cerrar sesión. |
| Perfil y foto | Editar perfil con A, subir una foto y recargar. Abrir Perfil con B. | Los cambios y la foto de A se conservan. B solo ve su perfil privado. |
| Crear y encontrar un aviso | Publicar un aviso de arrendador con foto y cupos. Buscarlo en Inicio y abrirlo con B. | El aviso, la foto y los datos se muestran correctamente. |
| Gestionar aviso propio | Abrir Mis publicaciones con A, editar el aviso y recargar. Intenta abrir la pantalla de edición con B. | El cambio persiste y B no puede editarlo. |
| Postulación | Postular con B y revisar Mis postulaciones. Con A, abrir Ver postulantes y preseleccionar a B. | Ambas cuentas ven el estado correspondiente. |
| Cerrar publicación | Cerrar el aviso con A e intentar postular con B. | El aviso se muestra cerrado en Mis publicaciones y se impiden nuevas postulaciones. |
| Buscar y conectar | Buscar a B en la pestaña Personas, enviar solicitud con A y responder desde Mis conexiones con B. | Ambas cuentas ven el estado de la conexión. |

Las páginas de este recorrido se sirven desde Next.js. Las rutas antiguas
`/acceso`, `/legacy/*` y las de recursos HTML retirados devuelven 404.
