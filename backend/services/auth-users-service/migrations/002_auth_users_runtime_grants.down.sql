REVOKE USAGE ON SEQUENCE auth_users.usuario_id_usuario_seq FROM sql_auth_users;
REVOKE UPDATE (edad, ocupacion, ciudad, breve_descripcion, sobre_mi)
    ON TABLE auth_users.usuario FROM sql_auth_users;
REVOKE INSERT (supabase_user_id, nombre, fecha_nacimiento)
    ON TABLE auth_users.usuario FROM sql_auth_users;
REVOKE SELECT ON TABLE auth_users.usuario FROM sql_auth_users;
REVOKE USAGE ON SCHEMA auth_users FROM sql_auth_users;
