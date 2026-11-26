DO $check$
DECLARE
    spec record;
    principal record;
    column_row record;
    operation text;
    object_oid oid;
    expected_columns text[];
    listed boolean;
    can_delete boolean;
    expected_policies integer := 0;
    runtime_oid oid := 'sql_listado_applications'::regrole;
BEGIN
    FOR principal IN SELECT oid, rolname FROM pg_roles WHERE rolname IN (
        'sql_auth_users','sql_listado_applications','sql_match_conexion','sql_convivencia_mensajeria','sql_reportes'
    ) LOOP
        listed := principal.oid = runtime_oid;
        IF has_schema_privilege(principal.oid, 'listado_applications', 'USAGE') IS DISTINCT FROM listed
           OR has_schema_privilege(principal.oid, 'listado_applications', 'CREATE, USAGE WITH GRANT OPTION')
        THEN RAISE EXCEPTION 'SCRUM-101: ACL de esquema inesperada para %', principal.rolname; END IF;
        FOR object_oid IN SELECT oid FROM pg_class
            WHERE relnamespace = 'listado_applications'::regnamespace AND relkind = 'S'
        LOOP
            IF has_sequence_privilege(principal.oid, object_oid, 'USAGE') IS DISTINCT FROM listed
               OR has_sequence_privilege(principal.oid, object_oid, 'SELECT, UPDATE, USAGE WITH GRANT OPTION')
            THEN RAISE EXCEPTION 'SCRUM-101: ACL de secuencia inesperada para %', principal.rolname; END IF;
        END LOOP;

        FOR spec IN SELECT * FROM (VALUES
            ('publicacion', 'id_publicacion,id_usuario,tipo,titulo,descripcion,contenido,precio,ubicacion,estado,cupos_totales,categoria,tipo_vivienda,mascota,permitir_comentarios,fecha_publicacion,id_region,id_comuna,reglas,ocupacion_confirmada,version_ocupacion,version_imagenes,version_capacidad', 'id_usuario,tipo,titulo,descripcion,precio,ubicacion,cupos_totales,categoria,tipo_vivienda,mascota,permitir_comentarios,id_region,id_comuna,reglas,ocupacion_confirmada,version_ocupacion', 'tipo,titulo,descripcion,precio,ubicacion,estado,cupos_totales,categoria,tipo_vivienda,mascota,permitir_comentarios,id_region,id_comuna,reglas,ocupacion_confirmada,version_ocupacion,version_imagenes,version_capacidad', false),
            ('imagen_publicacion', 'id_imagen,id_publicacion,url,orden,id_usuario,bucket,object_path,mime,size_bytes', 'id_publicacion,url,orden,id_usuario,bucket,object_path,mime,size_bytes', 'orden', true),
            ('postulacion', 'id_postulacion,id_publicacion,id_usuario,estado,motivo,fecha_postulacion,actualizada_en,id_arriendo', 'id_publicacion,id_usuario', 'estado,motivo,actualizada_en,id_arriendo', false),
            ('outbox', 'event_key,id_usuario,referencia_id,estado,enviado', 'event_key,id_usuario,referencia_id,estado', 'enviado', false),
            ('region', 'id_region,nombre', '', '', false),
            ('comuna', 'id_comuna,id_region,nombre', '', '', false),
            ('publication_image_operation', 'id_usuario,operation_key,fingerprint,id_publicacion,base_version,plan,estado,touched_at', 'id_usuario,operation_key,fingerprint,id_publicacion,base_version,plan', 'estado,id_publicacion,touched_at', false),
            ('publication_image_cleanup', 'object_path,created_at', 'object_path', '', true),
            ('admision_operacion', 'id_operacion,id_actor,id_postulacion,id_publicacion,id_usuario,version_capacidad,solicitud,estado,codigo_error,http_status,respuesta,resultado,creado_en,ultimo_intento', 'id_operacion,id_actor,id_postulacion,id_publicacion,id_usuario,version_capacidad,solicitud', 'estado,codigo_error,http_status,respuesta,resultado,ultimo_intento', false),
            ('admision_reserva', 'id_operacion,estado,id_arriendo,proyeccion', 'id_operacion', 'estado,id_arriendo,proyeccion', false)
        ) AS expected(table_name, read_cols, insert_cols, update_cols, delete_allowed)
        LOOP
            object_oid := to_regclass('listado_applications.' || spec.table_name);
            can_delete := listed AND spec.delete_allowed;
            FOREACH operation IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
                IF has_table_privilege(principal.oid, object_oid, operation) IS DISTINCT FROM (can_delete AND operation = 'DELETE')
                   OR has_table_privilege(principal.oid, object_oid, operation || ' WITH GRANT OPTION')
                THEN RAISE EXCEPTION 'SCRUM-101: ACL de tabla inesperada para %, %, %', principal.rolname, spec.table_name, operation; END IF;
            END LOOP;
            IF has_any_column_privilege(principal.oid, object_oid, 'REFERENCES')
            THEN RAISE EXCEPTION 'SCRUM-101: REFERENCES fuera del contrato'; END IF;

            FOREACH operation IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
                expected_columns := string_to_array(CASE operation WHEN 'SELECT' THEN spec.read_cols
                    WHEN 'INSERT' THEN spec.insert_cols WHEN 'UPDATE' THEN spec.update_cols ELSE '' END, ',');
                IF operation <> 'DELETE' THEN
                    FOR column_row IN SELECT attname, attnum FROM pg_attribute
                        WHERE attrelid = object_oid AND attnum > 0 AND NOT attisdropped
                    LOOP
                        IF has_column_privilege(principal.oid, object_oid, column_row.attnum, operation)
                             IS DISTINCT FROM (listed AND column_row.attname::text = ANY(expected_columns))
                           OR has_column_privilege(principal.oid, object_oid, column_row.attnum, operation || ' WITH GRANT OPTION')
                        THEN RAISE EXCEPTION 'SCRUM-101: ACL de columna inesperada para %, %.%, %',
                            principal.rolname, spec.table_name, column_row.attname, operation; END IF;
                    END LOOP;
                END IF;
                IF listed AND (cardinality(expected_columns) > 0 OR (operation = 'DELETE' AND can_delete)) THEN
                    expected_policies := expected_policies + 1;
                    IF NOT EXISTS (
                        SELECT FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
                        WHERE c.oid = object_oid AND c.relrowsecurity AND p.polroles = ARRAY[runtime_oid]
                          AND p.polpermissive AND p.polname = 'runtime_' || lower(operation)
                          AND p.polcmd::text = CASE operation WHEN 'SELECT' THEN 'r' WHEN 'INSERT' THEN 'a' WHEN 'UPDATE' THEN 'w' ELSE 'd' END
                          AND pg_get_expr(p.polqual,p.polrelid) IS NOT DISTINCT FROM CASE WHEN operation <> 'INSERT' THEN 'true' END
                          AND pg_get_expr(p.polwithcheck,p.polrelid) IS NOT DISTINCT FROM CASE WHEN operation IN ('INSERT','UPDATE') THEN 'true' END
                    ) THEN RAISE EXCEPTION 'SCRUM-101: política inesperada en % para %', spec.table_name, operation; END IF;
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
    IF (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relnamespace = 'listado_applications'::regnamespace) <> expected_policies
    THEN RAISE EXCEPTION 'SCRUM-101: conjunto de políticas inesperado'; END IF;
END;
$check$;
