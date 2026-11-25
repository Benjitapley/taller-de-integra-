\set ON_ERROR_STOP on
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(101, 10);
\ir checks/target.sql
\ir checks/provisioned.sql
\ir checks/auth-base.sql
SET LOCAL ROLE scrum101_owner;

ALTER TABLE auth_users.usuario
    ADD COLUMN presupuesto integer CHECK (presupuesto >= 0),
    ADD COLUMN zona_interes varchar(250);

CREATE TABLE auth_users.notificacion (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario bigint NOT NULL REFERENCES auth_users.usuario (id_usuario),
    event_key varchar(150) NOT NULL UNIQUE,
    tipo varchar(50) NOT NULL,
    referencia_id bigint NOT NULL,
    estado varchar(20) NOT NULL,
    creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE auth_users.sesion_revocada (
    session_id uuid PRIMARY KEY,
    subject uuid NOT NULL REFERENCES auth_users.usuario (supabase_user_id),
    revocada_en timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE auth_users.perfil_comun (
    supabase_user_id uuid PRIMARY KEY,
    genero text CHECK (genero IN ('Hombre', 'Mujer', 'Otro', 'Prefiero_no_indicarlo')),
    id_region_interes integer CHECK (id_region_interes > 0),
    id_comuna_interes integer CHECK (id_comuna_interes > 0),
    CHECK (id_comuna_interes IS NULL OR id_region_interes IS NOT NULL)
);

CREATE TABLE auth_users.foto_limpieza (
    reference text PRIMARY KEY,
    subject uuid NOT NULL,
    creada_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
COMMIT;
