# Roomies — ¿Hay cupo?

<p align="center">
  <img
    width="220"
    alt="Roomies"
    src="https://github.com/user-attachments/assets/3b35a250-6802-4ef9-a1f6-03fc079aecd5"
  />
</p>

Alias: El Tinder de arriendos
# Autores
*Taller de Integracion IV:*
- Gustavo Martinez
- Javier Poblete
- Matias Araya
- Abdiel Molina

*Taller de Integracion II:*
- Benjamin Cabrera
- Gabriel Yamaguchi
- Francisco Valderrama
- Gerlac Reyes
- Cristoper Parra

# Sobre el proyecto
**Problematica**: 

Encontrar con quién compartir departamento y lograr un buen ambiente es un desafío constante. Actualmente, las personas se enfrentan a tres grandes obstáculos:

- *Búsqueda fragmentada:* La información sobre habitaciones y posibles *roomies* está dispersa en múltiples redes sociales, haciendo el proceso lento y poco eficiente.
- *Falta de confianza:* No existen mecanismos formales para validar perfiles o conocer los hábitos de un compañero antes de mudarse juntos.
- *Gestión informal del hogar:* Una vez establecido el arriendo, la organización de tareas y reglas suele llevarse por canales informales, lo que frecuentemente deriva en roces y desgaste en la convivencia.

**Nuestro Objetivo**:

Roomies nace para transformar la experiencia de compartir vivienda mediante tres pilares:
- *Búsqueda inteligente y centralizada:* Una plataforma que permite filtrar, encontrar y conectar con *roomies* altamente compatibles en un solo lugar.
- *Gestión integral de arriendos:* Herramientas simplificadas para publicar espacios, explorar ofertas y administrar postulaciones o invitaciones de manera transparente.
- *Convivencia estructurada y confiable:* Un ecosistema interno con chat, asignación de tareas, reglas claras y un sistema de evaluaciones al finalizar el arriendo, diseñado para construir una comunidad basada en la responsabilidad.
  
# Funcionalidades Principales

La plataforma está dividida en módulos que acompañan todo el ciclo de vida del arriendo:

**1. Búsqueda y Conexión (Matchmaking)**
- Búsqueda avanzada de *roomies* y arriendos mediante filtros de compatibilidad.
- Sistema de conexión (match) para iniciar conversaciones con potenciales compañeros de vivienda.
- Perfiles detallados con preferencias de convivencia.

**2. Gestión de Arriendos**
- **Para Usuarios:** Posibilidad de subir un arriendo encontrado externamente para buscar con quién compartirlo, y postular a ofertas existentes.
- **Para Arrendadores:** Creación de publicaciones formales, revisión de postulantes y preselección.

**3. Módulo de Convivencia (Una vez arrendado)**
- Tablero de asignación de tareas del hogar y recordatorios.
- Chat interno en tiempo real para los habitantes del inmueble.
- Definición de reglas de convivencia claras.
- Sistema de evaluación mutua al finalizar el arriendo para construir reputación.

**4. Seguridad y Administración**
- Verificación de identidad de los usuarios.
- Sistema de reportes y moderación de publicaciones para mantener un entorno seguro.


# Tecnologia
### Frontend
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Next JS](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![React Native](https://img.shields.io/badge/react_native-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)

### Backend y Base de Datos
![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)

### Despliegue
![Vercel](https://img.shields.io/badge/vercel-%23000000.svg?style=for-the-badge&logo=vercel&logoColor=white)
![Expo](https://img.shields.io/badge/expo-1C1E24?style=for-the-badge&logo=expo&logoColor=white)
![Render](https://img.shields.io/badge/Render-%46E3B7.svg?style=for-the-badge&logo=render&logoColor=white)

# Instalacion

Sigue estos pasos para levantar el entorno de desarrollo de Roomies en tu máquina local.

Para TI2, abre [Roomies Web](taller-de-integra-dos/roomies-web/frontend-next/README.md).
Ejecuta Docker Compose desde `taller-de-integra-dos/roomies-web` y los comandos de Next.js desde su subcarpeta `frontend-next`.
Los siguientes pasos con Expo corresponden a la aplicación móvil.

### Requisitos Previos
Asegúrate de tener instalado:
- [Node.js](https://nodejs.org/) (v18 o superior recomendado)
- [Docker y Docker Compose](https://www.docker.com/) (para levantar los microservicios)
- [Expo CLI](https://docs.expo.dev/) o la app Expo Go en tu celular (para el entorno móvil)


### 1. Clonar el repositorio (git clone [inserte link del repositorio]

### 2. Instalar las dependencias:

npm install

### 3. Configurar las variables de entorno:

Crear un archivo .env.local a partir de .env.example y completar las credenciales correspondientes de Supabase y la URL de la API, cuando esté disponible.

### 4. Iniciar el entorno de desarrollo:

npx expo start

Una vez iniciado Expo, puedes escanear el código QR con Expo Go compatible con el SDK del proyecto para abrir la aplicación en tu dispositivo móvil.


# Capturas

<p align="center">
  <img width="49%" src="https://github.com/user-attachments/assets/b8ccfbc1-221b-4114-9266-a27661753c1a" alt="Captura 1" />
  <img width="49%" src="https://github.com/user-attachments/assets/70abb965-ba56-4c24-8002-8c04b25f5f79" alt="Captura 2" />
</p>

<p align="center">
  <img width="49%" src="https://github.com/user-attachments/assets/aae2f070-707d-4332-bba0-5c340ee33693" alt="Captura 3" />
  <img width="49%" src="https://github.com/user-attachments/assets/b8e692c7-537e-4222-ae42-e89d0c4052c3" alt="Captura 4" />
</p>

