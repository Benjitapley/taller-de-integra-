\set ON_ERROR_STOP on
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(101, 10);
\ir checks/target.sql
\ir checks/provisioned.sql
\ir checks/auth-base.sql
\ir checks/auth-shape.sql
\ir checks/auth-permissions.sql
SET LOCAL scrum101.listado_stage = '030';
\ir checks/listado-base.sql
SET LOCAL ROLE scrum101_owner;

-- Base derivada del bootstrap local, sin roles ni otros dominios.
CREATE SCHEMA listado_applications;
CREATE TABLE listado_applications.publicacion (
 id_publicacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_usuario BIGINT NOT NULL,
 tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Arrendador','Compartida')),
 titulo VARCHAR(200) NOT NULL CHECK (length(btrim(titulo)) > 0),
 descripcion VARCHAR(5000) NOT NULL, contenido VARCHAR(5000),
 precio NUMERIC(14,2) NOT NULL CHECK (precio >= 0), ubicacion VARCHAR(250) NOT NULL,
 estado VARCHAR(20) NOT NULL DEFAULT 'Disponible' CHECK (estado IN ('Disponible','Activa','Cerrada')),
 cupos_totales INTEGER NOT NULL CHECK (cupos_totales > 0),
 categoria VARCHAR(20) NOT NULL CHECK (categoria IN ('busco','ofrezco')),
 tipo_vivienda VARCHAR(20) NOT NULL CHECK (tipo_vivienda IN ('casa','departamento','habitacion')),
 mascota VARCHAR(2) NOT NULL CHECK (mascota IN ('si','no')),
 permitir_comentarios BOOLEAN NOT NULL DEFAULT FALSE,
 fecha_publicacion TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX publicacion_feed ON listado_applications.publicacion(fecha_publicacion DESC,id_publicacion DESC);
CREATE INDEX publicacion_owner ON listado_applications.publicacion(id_usuario);
CREATE TABLE listado_applications.imagen_publicacion (
 id_imagen BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_publicacion BIGINT NOT NULL REFERENCES listado_applications.publicacion(id_publicacion),
 url TEXT NOT NULL, orden INTEGER NOT NULL DEFAULT 0 CHECK (orden >= 0)
);
CREATE TABLE listado_applications.postulacion (
 id_postulacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_publicacion BIGINT NOT NULL REFERENCES listado_applications.publicacion(id_publicacion),
 id_usuario BIGINT NOT NULL,
 estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','Preseleccionada','Aceptada','Rechazada','Cancelada')),
 motivo VARCHAR(1000), fecha_postulacion TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 actualizada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX postulacion_vigente ON listado_applications.postulacion(id_publicacion,id_usuario)
 WHERE estado IN ('Pendiente','Preseleccionada','Aceptada');
CREATE INDEX postulacion_usuario ON listado_applications.postulacion(id_usuario);
CREATE TABLE listado_applications.outbox (
 event_key VARCHAR(150) PRIMARY KEY, id_usuario BIGINT NOT NULL,
 referencia_id BIGINT NOT NULL, estado VARCHAR(20) NOT NULL,
 enviado BOOLEAN NOT NULL DEFAULT FALSE
);

RESET ROLE;
COMMIT;
