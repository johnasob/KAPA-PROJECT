-- Solo el propietario del proyecto ejecuta esta consulta en SQL Editor una vez.
-- Cambia únicamente el correo. Primero regístrate y confirma tu correo en KAPA 3D.
-- No requiere UUID ni contraseñas; no puede ejecutarse desde el frontend.
begin;
do $$
declare
  owner_email text := 'ESCRIBE_AQUI_TU_CORREO';
  selected_user uuid;
  selected_name text;
  selected_partner uuid;
begin
  if owner_email='ESCRIBE_AQUI_TU_CORREO' or position('@' in owner_email)=0 then
    raise exception 'Escribe tu correo en owner_email.';
  end if;
  lock table public.user_profiles in exclusive mode;
  if exists(select 1 from public.user_profiles) then
    raise exception 'Ya hay una cuenta asignada. Un administrador debe habilitarte desde Socios y equipo.';
  end if;
  select u.id,r.display_name into selected_user,selected_name
  from auth.users u join public.registration_requests r on r.user_id=u.id
  where lower(u.email)=lower(trim(owner_email)) and u.email_confirmed_at is not null;
  if selected_user is null then
    raise exception 'Primero regístrate con ese correo y confírmalo.';
  end if;
  select id into strict selected_partner from public.partners where code='john';
  insert into public.user_profiles(user_id,partner_id,display_name)
  values (selected_user,selected_partner,selected_name);
end;
$$;
commit;
