\set ON_ERROR_STOP on
BEGIN;
\ir ../checks/target.sql
\ir ../checks/provisioned.sql
\ir ../checks/auth-base.sql
\ir ../checks/auth-shape.sql
\ir ../checks/auth-permissions.sql
\ir ../checks/listado-shape.sql
\ir ../checks/listado-cut.sql
\ir ../checks/listado-permissions.sql
SET LOCAL ROLE sql_listado_applications;

DO $test$
DECLARE
    v_publication bigint;
    v_image bigint;
    v_application bigint;
    v_region integer;
    v_commune integer;
    v_operation constant uuid := '10100000-0000-4000-8000-000000000034';
    v_lock bigint := hashtextextended('scrum101:listado:synthetic',0);
BEGIN
    IF current_user <> 'sql_listado_applications'
       OR has_schema_privilege(current_user,'listado_applications','CREATE') IS DISTINCT FROM false
       OR NOT row_security_active('listado_applications.publicacion') THEN
        RAISE EXCEPTION 'Runtime o RLS inesperados';
    END IF;
    SELECT id_region,id_comuna INTO STRICT v_region,v_commune
    FROM listado_applications.comuna ORDER BY id_comuna LIMIT 1;
    INSERT INTO listado_applications.publicacion
        (id_usuario,tipo,titulo,descripcion,precio,ubicacion,cupos_totales,categoria,tipo_vivienda,
         mascota,permitir_comentarios,id_region,id_comuna,reglas,ocupacion_confirmada,version_ocupacion)
    VALUES (101030,'Arrendador','Ensayo SCRUM-101','Sintético',100000,'CUT',2,'ofrezco','casa',
            'no',false,v_region,v_commune,'[]',0,0)
    RETURNING id_publicacion INTO STRICT v_publication;
    UPDATE listado_applications.publicacion SET titulo='Ensayo editado',version_capacidad=version_capacidad+1
        WHERE id_publicacion=v_publication;
    PERFORM p.* FROM listado_applications.publicacion p
        JOIN listado_applications.comuna c USING (id_region,id_comuna)
        WHERE p.id_publicacion=v_publication AND version_capacidad=2
        ORDER BY p.fecha_publicacion DESC,p.id_publicacion DESC FOR UPDATE OF p;
    IF NOT FOUND THEN RAISE EXCEPTION 'Feed, edición o bloqueo fallidos'; END IF;

    INSERT INTO listado_applications.postulacion (id_publicacion,id_usuario)
    VALUES (v_publication,101031) RETURNING id_postulacion INTO STRICT v_application;
    PERFORM * FROM listado_applications.postulacion WHERE id_postulacion=v_application FOR UPDATE;
    UPDATE listado_applications.postulacion SET estado='Preseleccionada',actualizada_en=clock_timestamp()
        WHERE id_postulacion=v_application;

    INSERT INTO listado_applications.imagen_publicacion
        (id_publicacion,url,orden,id_usuario,bucket,object_path,mime,size_bytes)
    VALUES (v_publication,'https://example.invalid/scrum101.png',0,101030,'publicaciones','synthetic/scrum101','image/png',16)
    RETURNING id_imagen INTO STRICT v_image;
    UPDATE listado_applications.imagen_publicacion SET orden=1 WHERE id_imagen=v_image;
    INSERT INTO listado_applications.publication_image_operation
        (id_usuario,operation_key,fingerprint,id_publicacion,base_version,plan)
    VALUES (101030,v_operation,repeat('a',64),v_publication,0,'{}');
    UPDATE listado_applications.publication_image_operation SET estado='Complete',touched_at=clock_timestamp()
        WHERE id_usuario=101030 AND operation_key=v_operation;
    UPDATE listado_applications.publicacion SET version_imagenes=version_imagenes+1
        WHERE id_publicacion=v_publication;
    INSERT INTO listado_applications.publication_image_cleanup (object_path)
    VALUES ('synthetic/scrum101') ON CONFLICT DO NOTHING;
    DELETE FROM listado_applications.imagen_publicacion WHERE id_imagen=v_image;
    DELETE FROM listado_applications.publication_image_cleanup WHERE object_path='synthetic/scrum101';
    IF NOT FOUND THEN RAISE EXCEPTION 'Limpieza de imagen fallida'; END IF;

    INSERT INTO listado_applications.admision_operacion
       (id_operacion,id_actor,id_postulacion,id_publicacion,id_usuario,version_capacidad,solicitud)
    VALUES (v_operation,101030,v_application,v_publication,101031,2,'{}');
    INSERT INTO listado_applications.admision_reserva (id_operacion) VALUES (v_operation);
    IF NOT EXISTS (SELECT FROM listado_applications.admision_reserva r
        JOIN listado_applications.admision_operacion o USING (id_operacion)
        WHERE o.id_publicacion=v_publication AND r.estado='Reservada')
    THEN RAISE EXCEPTION 'Reserva ausente'; END IF;
    IF NOT pg_try_advisory_lock(v_lock) THEN RAISE EXCEPTION 'Bloqueo asesor no disponible'; END IF;
    UPDATE listado_applications.admision_operacion SET estado='Confirmada',ultimo_intento=clock_timestamp(),
        http_status=200,resultado='{}' WHERE id_operacion=v_operation;
    IF NOT pg_advisory_unlock(v_lock) THEN RAISE EXCEPTION 'No se liberó el bloqueo'; END IF;
    UPDATE listado_applications.admision_reserva SET estado='Confirmada',id_arriendo=101032,proyeccion='{}'
        WHERE id_operacion=v_operation;
    UPDATE listado_applications.postulacion SET estado='Aceptada',id_arriendo=101032
        WHERE id_postulacion=v_application;

    INSERT INTO listado_applications.outbox (event_key,id_usuario,referencia_id,estado)
    VALUES ('synthetic-scrum101',101031,v_application,'Aceptada') ON CONFLICT DO NOTHING;
    INSERT INTO listado_applications.outbox (event_key,id_usuario,referencia_id,estado)
    VALUES ('synthetic-scrum101',101031,v_application,'Aceptada') ON CONFLICT DO NOTHING;
    IF FOUND THEN RAISE EXCEPTION 'Outbox duplicada'; END IF;
    UPDATE listado_applications.outbox SET enviado=true WHERE event_key='synthetic-scrum101';

    BEGIN
        INSERT INTO listado_applications.postulacion (id_publicacion,id_usuario) VALUES (v_publication,101031);
        RAISE EXCEPTION 'Se permitió una postulación vigente duplicada';
    EXCEPTION WHEN SQLSTATE '23505' THEN NULL;
    END;
    BEGIN
        INSERT INTO listado_applications.postulacion (id_publicacion,id_usuario) VALUES (-101,101031);
        RAISE EXCEPTION 'Se permitió una publicación inexistente';
    EXCEPTION WHEN SQLSTATE '23503' THEN NULL;
    END;
    BEGIN
        UPDATE listado_applications.publicacion SET precio=-1 WHERE id_publicacion=v_publication;
        RAISE EXCEPTION 'Se permitió un precio negativo';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;
END;
$test$;

DO $test$
DECLARE
    rejected_sql text;
BEGIN
    FOREACH rejected_sql IN ARRAY ARRAY[
        'UPDATE listado_applications.publicacion SET id_usuario=0 WHERE false',
        'DELETE FROM listado_applications.publicacion WHERE false',
        'UPDATE listado_applications.region SET nombre=''prohibido'' WHERE false',
        'DELETE FROM listado_applications.postulacion WHERE false',
        'UPDATE listado_applications.admision_operacion SET id_actor=0 WHERE false',
        'SELECT id_usuario FROM auth_users.usuario WHERE false'
    ] LOOP
        BEGIN
            EXECUTE rejected_sql;
            RAISE EXCEPTION 'Operación prohibida aceptada: %', rejected_sql;
        EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
        END;
    END LOOP;
END;
$test$;

RESET ROLE;
DO $test$
DECLARE
    principal text;
BEGIN
    FOREACH principal IN ARRAY ARRAY['sql_auth_users','sql_match_conexion','sql_convivencia_mensajeria','sql_reportes'] LOOP
        EXECUTE format('SET LOCAL ROLE %I',principal);
        BEGIN
            PERFORM id_publicacion FROM listado_applications.publicacion WHERE false;
            RAISE EXCEPTION 'Acceso cruzado aceptado para %', principal;
        EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
        END;
        RESET ROLE;
    END LOOP;
END;
$test$;
ROLLBACK;
