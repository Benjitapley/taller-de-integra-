-- Privilegios mínimos del servicio. El rol login se provisiona externamente.
GRANT USAGE ON SCHEMA auth_users TO sql_auth_users;
GRANT SELECT ON TABLE auth_users.usuario TO sql_auth_users;
GRANT INSERT (supabase_user_id, nombre, fecha_nacimiento)
    ON TABLE auth_users.usuario TO sql_auth_users;
GRANT UPDATE (edad, ocupacion, ciudad, breve_descripcion, sobre_mi)
    ON TABLE auth_users.usuario TO sql_auth_users;
GRANT USAGE ON SEQUENCE auth_users.usuario_id_usuario_seq TO sql_auth_users;
