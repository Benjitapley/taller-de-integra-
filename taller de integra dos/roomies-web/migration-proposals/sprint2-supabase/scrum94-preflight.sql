-- Solo lectura. Ejecutar tras verificar que el destino usa el layout haycupo-v1.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

SELECT
    (SELECT count(*) FROM haycupo.usuario) AS perfiles_roomies,
    (SELECT count(*) FROM auth_users.identidad) AS perfiles_vinculados,
    (SELECT count(*) FROM haycupo.usuario u
     WHERE NOT EXISTS (SELECT FROM auth_users.identidad i WHERE i.id_usuario = u.id_usuario))
        AS perfiles_roomies_sin_vinculo,
    (SELECT count(*) FROM haycupo.usuario WHERE fecha_nacimiento IS NULL)
        AS perfiles_sin_fecha_de_nacimiento,
    (SELECT count(*) FROM haycupo.usuario WHERE NULLIF(btrim(nombre), '') IS NULL)
        AS perfiles_sin_nombre,
    (SELECT count(*) FROM auth.users a
     WHERE a.email_confirmed_at IS NOT NULL AND a.deleted_at IS NULL
       AND NOT EXISTS (SELECT FROM auth_users.identidad i WHERE i.supabase_user_id = a.id))
        AS cuentas_auth_confirmadas_sin_perfil,
    (SELECT count(*) FROM auth_users.identidad i
     WHERE NOT EXISTS (SELECT FROM auth.users a WHERE a.id = i.supabase_user_id AND a.deleted_at IS NULL))
        AS vinculos_sin_cuenta_auth_activa;

COMMIT;
