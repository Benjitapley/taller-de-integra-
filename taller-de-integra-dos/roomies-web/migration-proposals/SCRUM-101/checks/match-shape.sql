DO $check$
DECLARE
    history oid := 'match_conexion.relacion_aceptada'::regclass;
    operational oid := 'match_conexion.conexion'::regclass;
    fn oid := 'match_conexion.registrar_relacion_aceptada()'::regprocedure;
    namespace_oid oid := 'match_conexion'::regnamespace;
BEGIN
    IF (SELECT count(*) FROM pg_class WHERE relnamespace = namespace_oid) <> 6
       OR EXISTS (SELECT FROM pg_class WHERE relnamespace = namespace_oid
                  AND (relowner <> 'scrum101_owner'::regrole OR relkind NOT IN ('r','S','i')))
       OR NOT EXISTS (SELECT FROM pg_class WHERE oid = history AND relkind = 'r'
                      AND relrowsecurity AND NOT relforcerowsecurity)
       OR (SELECT array_agg(attname::text ORDER BY attnum) FROM pg_attribute
           WHERE attrelid = history AND attnum > 0 AND NOT attisdropped
             AND atttypid = 'bigint'::regtype AND attnotnull)
           IS DISTINCT FROM ARRAY['usuario_menor','usuario_mayor']
       OR (SELECT count(*) FROM pg_attribute WHERE attrelid = history AND attnum > 0 AND NOT attisdropped) <> 2
       OR (SELECT count(*) FROM pg_constraint WHERE conrelid = history AND convalidated AND pg_get_constraintdef(oid) IN (
              'PRIMARY KEY (usuario_menor, usuario_mayor)', 'CHECK ((usuario_menor > 0))',
              'CHECK ((usuario_mayor > usuario_menor))')) <> 3
       OR EXISTS (SELECT FROM pg_constraint WHERE connamespace = namespace_oid AND (contype = 'f' OR NOT convalidated))
       OR (SELECT count(*) FROM pg_proc WHERE pronamespace = namespace_oid) <> 1
       OR NOT EXISTS (
           SELECT FROM pg_proc WHERE oid = fn AND prosecdef AND proowner = 'scrum101_owner'::regrole
               AND prorettype = 'trigger'::regtype AND pronargs = 0
               AND proconfig = ARRAY['search_path=pg_catalog, pg_temp']
       )
       OR (SELECT count(*) FROM pg_trigger WHERE tgrelid IN (history,operational)) <> 1
       OR NOT EXISTS (
           SELECT FROM pg_trigger WHERE tgrelid = operational AND tgname = 'guardar_relacion_aceptada'
               AND tgfoid = fn AND tgtype = 21 AND tgenabled = 'O' AND NOT tgisinternal
       ) THEN RAISE EXCEPTION 'SCRUM-101: forma, propietarios o seguridad del historial inesperados'; END IF;

    IF EXISTS (
        SELECT FROM match_conexion.conexion c WHERE c.estado = 'Aceptada'
          AND c."id_solicitante_FK" > 0 AND c."id_receptor_FK" > 0
          AND NOT EXISTS (
              SELECT FROM match_conexion.relacion_aceptada h
              WHERE h.usuario_menor = LEAST(c."id_solicitante_FK", c."id_receptor_FK")
                AND h.usuario_mayor = GREATEST(c."id_solicitante_FK", c."id_receptor_FK")
          )
    ) THEN RAISE EXCEPTION 'SCRUM-101: falta una aceptación válida en el historial'; END IF;
END;
$check$;
