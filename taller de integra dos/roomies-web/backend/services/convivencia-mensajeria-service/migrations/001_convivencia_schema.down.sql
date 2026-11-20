-- Destructiva: solo rollback explícito de un esquema vacío/desechable con respaldo.
BEGIN;
DROP TRIGGER pertenencia_capacidad ON convivencia_mensajeria.pertenencia;
DROP FUNCTION convivencia_mensajeria.validar_cupo();
DROP TABLE convivencia_mensajeria.outbox;
DROP TABLE convivencia_mensajeria.pertenencia;
DROP TABLE convivencia_mensajeria.arriendo;
DROP TABLE convivencia_mensajeria.incorporacion;
DROP SCHEMA convivencia_mensajeria;
COMMIT;
