-- Ejecutar una sola vez desde SQL Editor con permisos de propietario.
-- Crear primero las dos cuentas reales en Authentication > Users.
-- Reemplazar NULL con los UUID de John y Sebas: 'uuid-real'::uuid.
-- No contiene ni requiere contraseñas. La operación es atómica.
begin;
do $$
declare
  john_id uuid := null;
  sebas_id uuid := null;
begin
  if john_id is null or sebas_id is null or john_id = sebas_id then
    raise exception 'Asigna los UUID reales y distintos de John y Sebas antes de ejecutar.';
  end if;
  if (select count(*) from auth.users where id in (john_id, sebas_id)) <> 2 then
    raise exception 'Primero crea ambas cuentas en Supabase Auth.';
  end if;
  insert into public.user_profiles(user_id, partner_id, display_name)
  select john_id, id, 'John' from public.partners where code='john';
  insert into public.user_profiles(user_id, partner_id, display_name)
  select sebas_id, id, 'Sebas' from public.partners where code='sebas';
end;
$$;
commit;
