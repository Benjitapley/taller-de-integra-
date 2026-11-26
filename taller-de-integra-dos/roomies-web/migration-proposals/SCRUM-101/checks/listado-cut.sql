-- Verifica contenido ordenado por ID, con separador ASCII 31 entre campos.
DO $check$
BEGIN
    IF (SELECT count(*) = 16 AND encode(sha256(convert_to(
          string_agg(id_region::text || chr(31) || nombre, chr(10) ORDER BY id_region), 'UTF8')), 'hex')
          = 'd56dc26e0c18ee71d03e55f442f0ec51ee1600c80786d42886bba88a0908d670' FROM listado_applications.region) IS DISTINCT FROM true
       OR (SELECT count(*) = 346 AND encode(sha256(convert_to(
          string_agg(id_comuna::text || chr(31) || id_region::text || chr(31) || nombre, chr(10) ORDER BY id_comuna), 'UTF8')), 'hex')
          = '45ab8f423b98bb9943803f585895cb34f187e12d2fd30bb386936912d18cc5f7' FROM listado_applications.comuna) IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'SCRUM-101: contenido CUT distinto del seed histórico';
    END IF;
END;
$check$;
