-- Shared read-only capture. Call inside a guarded transaction.
WITH footprint AS (
    SELECT jsonb_build_object(
        'incorporacion', (SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY id_operacion),'[]'::jsonb)
            FROM convivencia_mensajeria.incorporacion i),
        'arriendo', (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY id_arriendo),'[]'::jsonb)
            FROM convivencia_mensajeria.arriendo a),
        'pertenencia', (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY id_pertenencia),'[]'::jsonb)
            FROM convivencia_mensajeria.pertenencia p),
        'outbox', (SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY id_outbox),'[]'::jsonb)
            FROM convivencia_mensajeria.outbox o),
        'conversacion', (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY id_conversacion),'[]'::jsonb)
            FROM convivencia_mensajeria.conversacion c),
        'mensaje', (SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY id_mensaje),'[]'::jsonb)
            FROM convivencia_mensajeria.mensaje m)
    ) AS rows
)
SELECT rows::text AS fixture_rows
FROM footprint \gset
