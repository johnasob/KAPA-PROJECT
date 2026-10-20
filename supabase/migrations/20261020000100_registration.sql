begin;

create table public.registration_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  created_at timestamptz not null default now()
);
alter table public.registration_requests enable row level security;
revoke all on public.registration_requests from public, anon, authenticated;
grant select on public.registration_requests to authenticated;
create policy registration_read on public.registration_requests for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

create function private.capture_registration() returns trigger
language plpgsql security definer set search_path = '' as $$
declare requested_name text;
begin
  requested_name := trim(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Usuario'));
  if length(requested_name) not between 1 and 80 then
    raise exception 'El nombre debe tener entre 1 y 80 caracteres' using errcode='22023';
  end if;
  insert into public.registration_requests(user_id, display_name) values (new.id, requested_name);
  return new;
end;
$$;
revoke all on function private.capture_registration() from public, anon, authenticated;
create trigger capture_kapa_registration after insert on auth.users for each row execute function private.capture_registration();

-- Conservar las cuentas existentes; solo agregar sus solicitudes si aún no
-- tienen un perfil del negocio. No se concede ningún permiso automáticamente.
insert into public.registration_requests(user_id, display_name, created_at)
select u.id, left(coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'),''), nullif(split_part(u.email,'@',1),''), 'Usuario'),80), coalesce(u.created_at,now())
from auth.users u where not exists(select 1 from public.user_profiles p where p.user_id=u.id);

create function public.get_pending_registrations(p_limit integer default 20, p_offset integer default 0)
returns table(user_id uuid, display_name text, email text, created_at timestamptz, email_confirmed boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset < 0 then
    raise exception 'Paginación inválida' using errcode='22023';
  end if;
  return query select r.user_id, r.display_name, u.email::text, r.created_at, u.email_confirmed_at is not null
  from public.registration_requests r join auth.users u on u.id=r.user_id
  where not exists (select 1 from public.user_profiles p where p.user_id=r.user_id)
  order by r.created_at, r.user_id limit p_limit offset p_offset;
end;
$$;
revoke all on function public.get_pending_registrations(integer,integer) from public, anon;
grant execute on function public.get_pending_registrations(integer,integer) to authenticated;

create function public.approve_registration(p_user_id uuid, p_partner_code text)
returns public.user_profiles language plpgsql security definer set search_path = '' as $$
declare chosen_partner public.partners; chosen_request public.registration_requests;
  existing_profile public.user_profiles; result_profile public.user_profiles; confirmed_at timestamptz;
begin
  if not private.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
  select * into chosen_partner from public.partners where code=p_partner_code for update;
  if not found then raise exception 'Socio inválido' using errcode='22023'; end if;
  select email_confirmed_at into confirmed_at from auth.users where id=p_user_id for update;
  if not found then raise exception 'Usuario inexistente' using errcode='22023'; end if;
  if confirmed_at is null then raise exception 'Confirma el correo antes de habilitar el acceso' using errcode='PT422'; end if;
  select * into existing_profile from public.user_profiles where user_id=p_user_id;
  if found then
    if existing_profile.partner_id=chosen_partner.id and existing_profile.active then return existing_profile; end if;
    raise exception 'La cuenta ya tiene una asignación' using errcode='PT409';
  end if;
  if exists(select 1 from public.user_profiles where partner_id=chosen_partner.id) then
    raise exception 'El socio ya tiene una cuenta vinculada' using errcode='PT409';
  end if;
  select * into chosen_request from public.registration_requests where user_id=p_user_id;
  if not found then raise exception 'Solicitud inexistente' using errcode='22023'; end if;
  insert into public.user_profiles(user_id, partner_id, display_name)
  values (p_user_id, chosen_partner.id, chosen_request.display_name) returning * into result_profile;
  return result_profile;
end;
$$;
revoke all on function public.approve_registration(uuid,text) from public, anon;
grant execute on function public.approve_registration(uuid,text) to authenticated;

comment on table public.registration_requests is 'Registro pendiente, sin acceso al negocio. Identidad confirmada y autorización de un administrador antes de vincular.';
commit;
