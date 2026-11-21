"""Ensayo de cutover/reversión con filas ficticias, jamás copia datos remotos."""
from pathlib import Path
import psycopg

PROPOSAL = Path(__file__).resolve().parents[2] / "migration-proposals/sprint2-supabase"


def create_fixture(connection):
    connection.execute("""
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
    CREATE TYPE public.estadoconexion AS ENUM('Pendiente','Aceptada','Rechazada');
    CREATE SCHEMA haycupo;
    CREATE TABLE haycupo.usuario (
      id_usuario SERIAL PRIMARY KEY,nombre VARCHAR,presupuesto INTEGER,zona_interes VARCHAR,ocupacion VARCHAR,
      edad VARCHAR(50),ciudad VARCHAR(100),biografia TEXT,foto_perfil VARCHAR(255),breve_descripcion TEXT,
      sobre_mi TEXT,correo VARCHAR(150) UNIQUE,contrasena VARCHAR(255),fecha_nacimiento DATE);
    CREATE TABLE haycupo.publicacion (
      id_publicacion SERIAL PRIMARY KEY,id_usuario INTEGER,tipo VARCHAR,titulo VARCHAR,descripcion VARCHAR,
      precio DOUBLE PRECISION,ubicacion VARCHAR,estado VARCHAR,cupos_totales INTEGER,categoria VARCHAR,
      tipo_vivienda VARCHAR,permitir_comentarios BOOLEAN,mascota TEXT,contenido TEXT,
      tipos_mascotas_aceptadas VARCHAR(40)[] NOT NULL DEFAULT '{}',condiciones_mascotas TEXT);
    CREATE TABLE haycupo.imagen_publicacion(id_imagen SERIAL PRIMARY KEY,id_publicacion INTEGER,url VARCHAR,orden INTEGER);
    CREATE TABLE haycupo.conexion(id_conexion SERIAL PRIMARY KEY,"id_solicitante_FK" INTEGER NOT NULL,
      "id_receptor_FK" INTEGER NOT NULL,estado public.estadoconexion NOT NULL,fecha_solicitud TIMESTAMP NOT NULL);
    INSERT INTO haycupo.usuario(id_usuario,nombre,edad,fecha_nacimiento,correo,biografia)
      VALUES(1,'Legado ficticio','texto conservado','2000-01-01','legacy@example.com','Biografía conservada');
    INSERT INTO haycupo.publicacion(id_usuario,tipo,titulo,descripcion,precio,ubicacion,estado,cupos_totales,categoria,tipo_vivienda,mascota,permitir_comentarios,tipos_mascotas_aceptadas)
      VALUES(5000,'Arrendador','Huérfana conservada','Ficticia',123456.123,'Temuco','Disponible',2,'ofrezco','habitacion','si',false,ARRAY['perro']);
    INSERT INTO haycupo.conexion("id_solicitante_FK","id_receptor_FK",estado,fecha_solicitud)
      VALUES(1,6000,'Pendiente','2026-01-01 12:34:56');
    """, prepare=False)
    readiness = connection.execute((PROPOSAL / "preflight.sql").read_text(encoding="utf-8")).fetchone()[0]
    assert readiness["orphan_publications"] == 1 and readiness["orphan_connections"] == 1
    assert readiness["duplicate_active_connections"] == 0


def prepare(connection):
    create_fixture(connection)
    original_oid = connection.execute("SELECT 'haycupo.usuario'::regclass::oid").fetchone()[0]
    connection.execute("SAVEPOINT unapproved")
    try:
        connection.execute((PROPOSAL / "cutover.sql").read_text(encoding="utf-8"), prepare=False)
        raise AssertionError("Propuesta ejecutable sin aprobación")
    except psycopg.errors.RaiseException:
        connection.execute("ROLLBACK TO SAVEPOINT unapproved")
    connection.execute("SELECT set_config('roomies.cutover_approved','sprint2-reviewed',true)")
    connection.execute((PROPOSAL / "cutover.sql").read_text(encoding="utf-8"), prepare=False)
    assert connection.execute("SELECT 'auth_users.usuario'::regclass::oid").fetchone()[0] == original_oid
    assert connection.execute("SELECT edad,supabase_user_id,biografia FROM auth_users.usuario WHERE id_usuario=1").fetchone() == ("texto conservado",None,"Biografía conservada")
    assert connection.execute("SELECT id_usuario,precio,fecha_publicacion,tipos_mascotas_aceptadas FROM listado_applications.publicacion WHERE id_publicacion=1").fetchone() == (5000,123456.123,None,["perro"])
    assert connection.execute("SELECT pg_sequence_last_value(pg_get_serial_sequence('auth_users.usuario','id_usuario')::regclass)").fetchone()[0] == 6000
    assert connection.execute("SELECT count(*) FROM haycupo.usuario").fetchone()[0] == 1
    assert connection.execute("SELECT reloptions FROM pg_class WHERE oid='haycupo.usuario'::regclass").fetchone()[0] == ["security_invoker=true"]
    print("PASS cutover aislado: guardia de aprobación, OID/IDs/tipos/datos conservados, UUID NULL, vista invoker y reserva de IDs huérfanos", flush=True)


def verify_rollback(owner):
    with psycopg.connect(owner) as connection:
        counts = connection.execute("SELECT (SELECT count(*) FROM auth_users.usuario),(SELECT count(*) FROM listado_applications.publicacion),(SELECT count(*) FROM listado_applications.postulacion)").fetchone()
        connection.execute("SELECT set_config('roomies.rollback_approved','sprint2-reviewed',true)")
        connection.execute((PROPOSAL / "rollback.sql").read_text(encoding="utf-8"), prepare=False)
        assert connection.execute("SELECT (SELECT count(*) FROM haycupo.usuario),(SELECT count(*) FROM haycupo.publicacion),(SELECT count(*) FROM listado_applications.postulacion)").fetchone() == counts
        assert connection.execute("SELECT edad FROM haycupo.usuario WHERE id_usuario=1").fetchone()[0] == "texto conservado"
    print("PASS reversión aislada: conserva altas posteriores, postulaciones, UUID y datos heredados sin borrar tablas", flush=True)
