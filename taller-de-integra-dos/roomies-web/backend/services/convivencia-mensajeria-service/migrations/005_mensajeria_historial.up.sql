-- Orden cronológico con desempate estable; conserva mensajes e identidades.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE INDEX mensajes_historial_fecha
  ON convivencia_mensajeria.mensaje(id_conversacion,fecha_envio DESC,id_mensaje DESC);
COMMIT;
