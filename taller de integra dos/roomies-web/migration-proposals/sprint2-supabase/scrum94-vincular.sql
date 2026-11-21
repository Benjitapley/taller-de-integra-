-- Propuesta para haycupo-v1 tras la etapa aditiva de Sprint 2.
-- Ejecutar como operador dentro de la misma transacción que la tabla temporal.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
    IF current_setting('roomies.scrum94_approved', true) IS DISTINCT FROM 'reviewed'
       OR COALESCE(current_setting('roomies.backup_verified', true), '') !~ '^[a-f0-9]{64}$' THEN
        RAISE EXCEPTION 'Se requiere revisión del lote y evidencia del respaldo restaurado';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_temp.scrum94_vinculos) THEN
        RAISE EXCEPTION 'No se cargaron pares de identidad revisados';
    END IF;
    IF EXISTS (
        SELECT FROM pg_temp.scrum94_vinculos
        GROUP BY supabase_user_id HAVING count(*) > 1
    ) OR EXISTS (
        SELECT FROM pg_temp.scrum94_vinculos
        GROUP BY id_usuario HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'El lote contiene UUID o identificadores Roomies repetidos';
    END IF;
END
$$;

-- Serializa la asociación frente a altas de perfil y otras escrituras de identidad.
LOCK TABLE haycupo.usuario, auth_users.identidad IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
    -- Mantiene vigente la revisión del UUID durante la transacción.
    PERFORM a.id
        FROM auth.users a JOIN pg_temp.scrum94_vinculos v ON v.supabase_user_id = a.id
        ORDER BY a.id FOR SHARE OF a;

    IF EXISTS (
        SELECT FROM pg_temp.scrum94_vinculos v
        LEFT JOIN auth.users a ON a.id = v.supabase_user_id
        LEFT JOIN haycupo.usuario u ON u.id_usuario = v.id_usuario
        WHERE v.supabase_user_id IS NULL OR v.id_usuario IS NULL OR v.id_usuario <= 0
           OR a.id IS NULL OR a.email_confirmed_at IS NULL OR a.deleted_at IS NOT NULL
           OR u.id_usuario IS NULL OR NULLIF(btrim(u.nombre), '') IS NULL
    ) THEN
        RAISE EXCEPTION 'El lote contiene una cuenta Auth no elegible o un perfil Roomies inválido';
    END IF;
    IF EXISTS (
        SELECT FROM pg_temp.scrum94_vinculos v
        JOIN auth_users.identidad i
          ON i.supabase_user_id = v.supabase_user_id OR i.id_usuario = v.id_usuario
        WHERE (i.supabase_user_id, i.id_usuario) <> (v.supabase_user_id, v.id_usuario)
    ) THEN
        RAISE EXCEPTION 'El lote entra en conflicto con una identidad ya vinculada';
    END IF;
END
$$;

WITH inserted AS (
    INSERT INTO auth_users.identidad (supabase_user_id, id_usuario)
    SELECT supabase_user_id, id_usuario FROM pg_temp.scrum94_vinculos
    ON CONFLICT (supabase_user_id) DO NOTHING
    RETURNING 1
)
SELECT count(*) AS vinculos_nuevos,
       (SELECT count(*) FROM pg_temp.scrum94_vinculos) - count(*) AS vinculos_ya_existentes
FROM inserted;

DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_temp.scrum94_vinculos v
        WHERE NOT EXISTS (
            SELECT FROM auth_users.identidad i
            WHERE i.supabase_user_id = v.supabase_user_id AND i.id_usuario = v.id_usuario
        )
    ) THEN
        RAISE EXCEPTION 'La verificación posterior no encontró todos los pares del lote';
    END IF;
END
$$;
