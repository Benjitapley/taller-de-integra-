#!/bin/sh
# Solo inicialización del volumen local vacío; nunca administra Supabase remoto.
set -eu
for value in "$ROOMIES_AUTH_SQL_PASSWORD" "$ROOMIES_LISTADO_SQL_PASSWORD" "$ROOMIES_MATCH_SQL_PASSWORD"; do
  case "$value" in *[!a-f0-9]*|'') echo 'Las contraseñas SQL locales deben ser hexadecimales.' >&2; exit 1;; esac
  test "${#value}" -ge 32 || exit 1
done
psql --username "$POSTGRES_USER" --dbname roomies_sprint2_disposable --set ON_ERROR_STOP=1 \
  --set auth_pass="$ROOMIES_AUTH_SQL_PASSWORD" --set listado_pass="$ROOMIES_LISTADO_SQL_PASSWORD" \
  --set match_pass="$ROOMIES_MATCH_SQL_PASSWORD" <<'SQL'
ALTER ROLE sql_auth_users PASSWORD :'auth_pass';
ALTER ROLE sql_listado_applications PASSWORD :'listado_pass';
ALTER ROLE sql_match_conexion PASSWORD :'match_pass';
SQL
