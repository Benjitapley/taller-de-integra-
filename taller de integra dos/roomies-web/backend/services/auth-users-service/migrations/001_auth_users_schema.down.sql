-- Reversión destructiva: solo en roomies_auth_users_dev local aislada o en
-- roomies_auth_users_test local aislada mediante pruebas opt-in. No está
-- autorizada para producción.
DROP TABLE auth_users.usuario;
DROP SCHEMA auth_users;
