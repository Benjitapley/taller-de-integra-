# Reconciliación de Ramas y Reparto Sprint 3 (M4S3-B01)


### Verificación técnica de la base (lint y tsc)
- **npx expo lint:** Aprobado sin errores ni advertencias.
- **npx tsc --noEmit:** Reporta 13 errores de tipado preexistentes en 4 archivos de la base (sin modificar en B01 para no intervenir trabajo ajeno; cada dueño los corregirá en su ficha):
  - src/app/(tabs)/_layout.tsx (4 errores en prop color de Ionicons — asignar a B05).
  - src/components/chat/ContenedorChat.tsx (6 errores en useRef<View> / useRef<ScrollView> — asignar a Matías en D02).
  - src/components/publicaciones/FormularioPublicacion.tsx (2 errores en useRef<ScrollView> — asignar a Abdiel en C01).
  - src/lib/supabase.ts (1 error en tipo de AppState.currentState — asignar a Gustavo en A01).


## 1. Tabla de reutilización del Sprint 2
| Módulo / Tareas | Estado en Sprint 3 | Residual / Destino |
| :--- | :--- | :--- |
| **A01–A07** (Auth y httpClient) | Reutilizado completo | Verificar integración real contra Gateway en M4S3-A01 |
| **A08–A09** (Perfil propio) | Reutilizado parcial | Conectar DTO nuevo y edición PATCH en M4S3-A02 |
| **B01–B10** (Búsqueda y detalle) | Reutilizado UI y tarjetas | Reemplazar mocks en publicacionesService.ts por API paginada (M4S3-B02/B03) |
| **B11 / SCRUM-55** (Personas) | **Fuera de alcance TI2 v1.4** | Código preservado; retirar acceso operativo en M4S3-B05 |
| **C01–C11** (Publicar y postular) | Reutilizado | Ampliar fotos/edición/cierre (C01-C02) y gestión de postulantes (C03-C04); Compartida excluida |
| **D01–D10** (Convivencia/Chat/Tareas) | Reutilizado UI base | Reemplazar mocks por API real y revocación (M4S3-D01 a D04); excluir chat exploratorio y recordatorios |


## 2. Reparto de archivos por integrante (prevención de conflictos)
* **Gustavo Martínez:** src/hooks/useAuth.tsx, src/lib/supabase.ts, src/services/httpClient.ts, src/services/usuariosService.ts, src/app/(tabs)/perfil.tsx, src/services/reportesService.ts, src/services/notificacionesService.ts.
* **Javier Poblete:** src/app/(tabs)/buscar.tsx, src/app/(tabs)/index.tsx, src/app/publicacion/[id]/index.tsx, src/app/_layout.tsx, src/services/arriendosService.ts (expulsiones), docs/contracts/, docs/qa/candidato-movil.md.
* **Abdiel Molina:** src/app/publicacion/crear/, src/app/publicaciones/, src/services/postulacionesService.ts, src/app/postulaciones/index.tsx.
* **Matías Araya:** src/app/arriendo/, src/app/convivencia/, src/components/chat/, src/services/conversacionesService.ts, src/services/tareasService.ts.
* **Archivo compartido:** src/services/publicacionesService.ts (Javier implementa lectura/listado/detalle; Abdiel implementa creación/edición/cierre).


