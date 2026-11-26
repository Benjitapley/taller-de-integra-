DO $check$
DECLARE
    spec record;
    object_oid oid;
    actual_columns text;
    actual_types text;
BEGIN
    IF NOT EXISTS (SELECT FROM pg_namespace WHERE nspname = 'listado_applications'
                   AND nspowner = 'scrum101_owner'::regrole)
       OR (SELECT count(*) FROM pg_class WHERE relnamespace = 'listado_applications'::regnamespace AND relkind = 'r') <> 10
       OR (SELECT count(*) FROM pg_class WHERE relnamespace = 'listado_applications'::regnamespace AND relkind = 'S') <> 3
       OR EXISTS (SELECT FROM pg_class WHERE relnamespace = 'listado_applications'::regnamespace
                  AND (relowner <> 'scrum101_owner'::regrole OR relkind NOT IN ('r','S','i')))
       OR EXISTS (SELECT FROM pg_proc WHERE pronamespace = 'listado_applications'::regnamespace)
       OR EXISTS (SELECT FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                  WHERE c.relnamespace = 'listado_applications'::regnamespace AND NOT t.tgisinternal)
    THEN RAISE EXCEPTION 'SCRUM-101: inventario o propietarios de Listado inesperados'; END IF;

    FOR spec IN SELECT * FROM (VALUES
        ('publicacion', 'id_publicacion,id_usuario,tipo,titulo,descripcion,contenido,precio,ubicacion,estado,cupos_totales,categoria,tipo_vivienda,mascota,permitir_comentarios,fecha_publicacion,id_region,id_comuna,reglas,ocupacion_confirmada,version_ocupacion,version_imagenes,version_capacidad', 'int8,int8,varchar,varchar,varchar,varchar,int8,varchar,varchar,int4,varchar,varchar,varchar,bool,timestamptz,int4,int4,jsonb,int4,int8,int8,int8'),
        ('imagen_publicacion', 'id_imagen,id_publicacion,url,orden,id_usuario,bucket,object_path,mime,size_bytes', 'int8,int8,text,int4,int8,text,text,text,int8'),
        ('postulacion', 'id_postulacion,id_publicacion,id_usuario,estado,motivo,fecha_postulacion,actualizada_en,id_arriendo', 'int8,int8,int8,varchar,varchar,timestamptz,timestamptz,int8'),
        ('outbox', 'event_key,id_usuario,referencia_id,estado,enviado', 'varchar,int8,int8,varchar,bool'),
        ('region', 'id_region,nombre', 'int4,text'),
        ('comuna', 'id_comuna,id_region,nombre', 'int4,int4,text'),
        ('publication_image_operation', 'id_usuario,operation_key,fingerprint,id_publicacion,base_version,plan,estado,touched_at', 'int8,uuid,bpchar,int8,int8,jsonb,text,timestamptz'),
        ('publication_image_cleanup', 'object_path,created_at', 'text,timestamptz'),
        ('admision_operacion', 'id_operacion,id_actor,id_postulacion,id_publicacion,id_usuario,version_capacidad,solicitud,estado,codigo_error,http_status,respuesta,resultado,creado_en,ultimo_intento', 'uuid,int8,int8,int8,int8,int8,jsonb,text,text,int4,jsonb,jsonb,timestamptz,timestamptz'),
        ('admision_reserva', 'id_operacion,estado,id_arriendo,proyeccion', 'uuid,text,int8,jsonb')
    ) AS expected(table_name, column_names, column_types)
    LOOP
        object_oid := to_regclass('listado_applications.' || spec.table_name);
        SELECT string_agg(a.attname::text, ',' ORDER BY a.attnum), string_agg(t.typname::text, ',' ORDER BY a.attnum)
        INTO actual_columns, actual_types FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
        WHERE a.attrelid = object_oid AND a.attnum > 0 AND NOT a.attisdropped;
        IF actual_columns IS DISTINCT FROM spec.column_names OR actual_types IS DISTINCT FROM spec.column_types
        THEN RAISE EXCEPTION 'SCRUM-101: columnas o tipos inesperados en %', spec.table_name; END IF;
    END LOOP;

    FOR spec IN SELECT * FROM (VALUES ('publicacion','id_publicacion'), ('imagen_publicacion','id_imagen'),
        ('postulacion','id_postulacion')) AS expected(table_name,column_name)
    LOOP
        IF pg_get_serial_sequence('listado_applications.' || spec.table_name, spec.column_name)
            IS DISTINCT FROM ('listado_applications.' || spec.table_name || '_' || spec.column_name || '_seq')
           OR NOT EXISTS (SELECT FROM pg_attribute
               WHERE attrelid = to_regclass('listado_applications.' || spec.table_name)
                 AND attname = spec.column_name AND attidentity = 'a')
        THEN RAISE EXCEPTION 'SCRUM-101: identidad inesperada en %', spec.table_name; END IF;
    END LOOP;

    FOR spec IN SELECT * FROM (VALUES
        ('publicacion','PRIMARY KEY (id_publicacion)'),
        ('imagen_publicacion','PRIMARY KEY (id_imagen)'),
        ('postulacion','PRIMARY KEY (id_postulacion)'),
        ('outbox','PRIMARY KEY (event_key)'),
        ('region','PRIMARY KEY (id_region)'),
        ('comuna','PRIMARY KEY (id_comuna)'),
        ('comuna','UNIQUE (id_region, id_comuna)'),
        ('publication_image_operation','PRIMARY KEY (id_usuario, operation_key)'),
        ('publication_image_cleanup','PRIMARY KEY (object_path)'),
        ('admision_operacion','PRIMARY KEY (id_operacion)'),
        ('admision_reserva','PRIMARY KEY (id_operacion)')
    ) AS expected(table_name, definition)
    LOOP
        IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid = to_regclass('listado_applications.' || spec.table_name)
                       AND convalidated AND pg_get_constraintdef(oid) = spec.definition)
        THEN RAISE EXCEPTION 'SCRUM-101: PK o unicidad inesperada en %', spec.table_name; END IF;
    END LOOP;

    FOR spec IN SELECT * FROM (VALUES
        ('publicacion','FOREIGN KEY (id_region, id_comuna) REFERENCES listado_applications.comuna(id_region, id_comuna)'),
        ('comuna','FOREIGN KEY (id_region) REFERENCES listado_applications.region(id_region)'),
        ('imagen_publicacion','FOREIGN KEY (id_publicacion) REFERENCES listado_applications.publicacion(id_publicacion)'),
        ('postulacion','FOREIGN KEY (id_publicacion) REFERENCES listado_applications.publicacion(id_publicacion)'),
        ('admision_operacion','FOREIGN KEY (id_postulacion) REFERENCES listado_applications.postulacion(id_postulacion)'),
        ('admision_reserva','FOREIGN KEY (id_operacion) REFERENCES listado_applications.admision_operacion(id_operacion)')
    ) AS expected(table_name, definition)
    LOOP
        IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid = to_regclass('listado_applications.' || spec.table_name)
                       AND contype = 'f' AND convalidated AND pg_get_constraintdef(oid) = spec.definition)
        THEN RAISE EXCEPTION 'SCRUM-101: FK inesperada en %', spec.table_name; END IF;
    END LOOP;
    IF (SELECT count(*) FROM pg_constraint WHERE connamespace = 'listado_applications'::regnamespace AND contype = 'f') <> 6
       OR EXISTS (SELECT FROM pg_constraint WHERE connamespace = 'listado_applications'::regnamespace AND NOT convalidated)
    THEN RAISE EXCEPTION 'SCRUM-101: restricciones adicionales o sin validar'; END IF;

    FOR spec IN SELECT * FROM (VALUES
        ('publicacion_feed',false,false), ('publicacion_owner',false,false),
        ('postulacion_vigente',true,true), ('postulacion_usuario',false,false),
        ('imagen_publicacion_object_path',true,true), ('publication_image_operation_recovery',false,true),
        ('admision_postulacion_vigente',true,true), ('admision_recuperacion',false,true),
        ('admision_publicacion',false,false)
    ) AS expected(index_name, unique_index, partial_index)
    LOOP
        IF NOT EXISTS (SELECT FROM pg_index WHERE indexrelid = to_regclass('listado_applications.' || spec.index_name)
                       AND indisvalid AND indisunique = spec.unique_index AND (indpred IS NOT NULL) = spec.partial_index)
        THEN RAISE EXCEPTION 'SCRUM-101: índice inesperado: %', spec.index_name; END IF;
    END LOOP;
END;
$check$;
