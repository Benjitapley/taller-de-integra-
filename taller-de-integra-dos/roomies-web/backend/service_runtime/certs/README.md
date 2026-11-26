# CA de PostgreSQL Supabase

`prod-ca-2021.crt` es un certificado público descargado el 26/11/2026 desde el enlace oficial **Download certificate** del Dashboard del proyecto autorizado:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

- SHA-256 del archivo: `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.
- Válido hasta el 26/04/2031 a las 10:56:53 UTC.
- Los Dockerfiles de Auth/Listado/Convivencia copian este directorio como parte del runtime compartido. En esos contenedores usar `sslmode=verify-full&sslrootcert=/app/backend/service_runtime/certs/prod-ca-2021.crt` en el DSN.
- Se verificó el cliente PostgreSQL contra el pooler del proyecto con este certificado. No sustituye claves, contraseñas, certificados privados ni validación del hostname. Revisar la renovación del certificado antes de que expire o si Supabase cambia su CA.

Referencias oficiales: [SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement), [conexión con psql](https://supabase.com/docs/guides/database/psql).
