-- M4-A04 / BR-01: ejecutar en el proyecto personal de pruebas y después
-- seleccionar public.validar_edad_registro en Auth > Auth Hooks > Before User Created.
-- Crear la función NO activa el hook. En el proyecto compartido, coordinar con TI2.
begin;

create or replace function public.validar_edad_registro(event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  valor_fecha jsonb := event #> '{user,user_metadata,fecha_nacimiento}';
  texto_fecha text := event #>> '{user,user_metadata,fecha_nacimiento}';
  nacimiento date;
  -- Reloj del servidor: no depende del reloj manipulable del dispositivo.
  hoy date := (current_timestamp at time zone 'UTC')::date;
  edad integer;
  error_fecha constant jsonb := '{"error":{"http_code":400,"message":"ROOMIES_FECHA_NACIMIENTO_INVALIDA"}}'::jsonb;
begin
  if valor_fecha is null or jsonb_typeof(valor_fecha) <> 'string'
     or texto_fecha !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return error_fecha;
  end if;

  begin
    -- El cast date rechaza fechas inexistentes; no normalizar con to_date.
    nacimiento := texto_fecha::date;
  exception
    when datetime_field_overflow or invalid_datetime_format then
      return error_fecha;
  end;

  if nacimiento > hoy then
    return error_fecha;
  end if;

  -- Comparación de mes/día: para 29/02 en años no bisiestos se cumple el 01/03,
  -- igual que en la validación actual del formulario.
  edad := extract(year from hoy)::integer - extract(year from nacimiento)::integer;
  if extract(month from hoy) < extract(month from nacimiento)
     or (extract(month from hoy) = extract(month from nacimiento)
         and extract(day from hoy) < extract(day from nacimiento)) then
    edad := edad - 1;
  end if;

  if edad < 18 then
    return '{"error":{"http_code":400,"message":"ROOMIES_EDAD_MINIMA"}}'::jsonb;
  end if;

  return '{}'::jsonb;
end;
$$;

revoke execute on function public.validar_edad_registro(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.validar_edad_registro(jsonb) to supabase_auth_admin;

comment on function public.validar_edad_registro(jsonb) is
  'Before User Created: exige fecha_nacimiento AAAA-MM-DD y 18 años cumplidos (día UTC). Valida la edad declarada, no la identidad.';

commit;
