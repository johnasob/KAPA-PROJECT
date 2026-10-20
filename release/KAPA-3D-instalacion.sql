-- Instalación o actualización de KAPA 3D. Ejecutar en SQL Editor de Supabase.
-- Conserva los datos existentes y puede repetirse. No contiene contraseñas.
begin;
do $kapa_install$
begin
  if to_regclass('public.business_settings') is null then
    if to_regclass('public.partners') is not null or to_regclass('public.user_profiles') is not null or to_regclass('public.audit_log') is not null then
      raise exception 'Hay una instalación inicial incompleta. No se modificó la base de datos.';
    end if;
    execute $kapa_foundations$create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('john', 'sebas')),
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  share_basis_points integer not null default 5000 check (share_basis_points = 5000),
  created_at timestamptz not null default now()
);

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  partner_id uuid not null unique references public.partners(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  role text not null default 'admin' check (role = 'admin'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.user_profiles where user_id = (select auth.uid()) and active and role = 'admin');
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create table public.business_settings (
  singleton boolean primary key default true check (singleton),
  business_name text not null default 'KAPA 3D' check (length(trim(business_name)) between 1 and 80),
  currency text not null default 'COP' check (currency = 'COP'),
  timezone text not null default 'America/Bogota' check (timezone = 'America/Bogota'),
  default_deposit_percent numeric(5,2) not null default 50 check (default_deposit_percent between 0 and 100),
  low_stock_grams numeric(10,2) not null default 200 check (low_stock_grams > 0 and low_stock_grams <= 1000000),
  critical_stock_grams numeric(10,2) not null default 100 check (critical_stock_grams >= 0 and critical_stock_grams < low_stock_grams),
  reference_filament_kg_cost numeric(14,2) not null default 90000 check (reference_filament_kg_cost between 0 and 999999999999),
  energy_kwh_cost numeric(14,2) check (energy_kwh_cost between 0 and 999999999999),
  labor_hour_cost numeric(14,2) check (labor_hour_cost between 0 and 999999999999),
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete restrict,
  entity text not null,
  record_id text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  old_record jsonb,
  new_record jsonb,
  occurred_at timestamptz not null default now()
);
create index audit_log_occurred_at_idx on public.audit_log(occurred_at desc, id desc);
create index audit_log_actor_idx on public.audit_log(actor_id);

create table private.mutation_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  operation text not null,
  payload jsonb not null,
  response jsonb not null,
  created_at timestamptz not null default now()
);
revoke all on all tables in schema private from public, anon, authenticated;

insert into public.partners (code, display_name) values ('john', 'John'), ('sebas', 'Sebas');
insert into public.business_settings (singleton) values (true);

create function private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_record jsonb; after_record jsonb;
begin
  if tg_op <> 'INSERT' then before_record := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then after_record := to_jsonb(new); end if;
  insert into public.audit_log(actor_id, entity, record_id, operation, old_record, new_record)
  values (auth.uid(), tg_table_name,
    coalesce(after_record->>'user_id', before_record->>'user_id', after_record->>'id', before_record->>'id', 'business'),
    tg_op, before_record, after_record);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.audit_change() from public, anon, authenticated;
create trigger audit_settings after update on public.business_settings for each row execute function private.audit_change();
create trigger audit_profiles after insert or update or delete on public.user_profiles for each row execute function private.audit_change();
create trigger audit_partners after update on public.partners for each row execute function private.audit_change();

alter table public.partners enable row level security;
alter table public.user_profiles enable row level security;
alter table public.business_settings enable row level security;
alter table public.audit_log enable row level security;
alter table private.mutation_requests enable row level security;

revoke all on public.partners, public.user_profiles, public.business_settings, public.audit_log from public, anon, authenticated;
grant select on public.partners, public.user_profiles, public.business_settings, public.audit_log to authenticated;
create policy admin_read_partners on public.partners for select to authenticated using ((select private.is_admin()));
create policy admin_read_profiles on public.user_profiles for select to authenticated using ((select private.is_admin()));
create policy admin_read_settings on public.business_settings for select to authenticated using ((select private.is_admin()));
create policy admin_read_audit on public.audit_log for select to authenticated using ((select private.is_admin()));

create function public.update_business_settings(p_changes jsonb, p_expected_version bigint, p_request_id uuid)
returns public.business_settings language plpgsql security definer set search_path = '' as $$
declare
  current_settings public.business_settings;
  result_settings public.business_settings;
  previous_request private.mutation_requests;
  request_payload jsonb;
begin
  if not private.is_admin() then raise exception 'Acceso denegado' using errcode = '42501'; end if;
  if p_request_id is null or p_expected_version is null or p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'Solicitud inválida' using errcode = '22023';
  end if;
  if p_changes = '{}'::jsonb or exists (
    select 1 from jsonb_object_keys(p_changes) as keys(key) where key not in
    ('business_name', 'default_deposit_percent', 'low_stock_grams', 'critical_stock_grams', 'reference_filament_kg_cost', 'energy_kwh_cost', 'labor_hour_cost')
  ) then raise exception 'Campos de configuración no permitidos' using errcode = '22023'; end if;
  select * into strict current_settings from public.business_settings where singleton for update;
  request_payload := jsonb_build_object('changes', p_changes, 'version', p_expected_version);
  select * into previous_request from private.mutation_requests where request_id = p_request_id;
  if found then
    if previous_request.actor_id <> auth.uid() or previous_request.operation <> 'update_settings' or previous_request.payload <> request_payload then
      raise exception 'Identificador de solicitud reutilizado' using errcode = '22023';
    end if;
    select * into result_settings from jsonb_populate_record(null::public.business_settings, previous_request.response);
    return result_settings;
  end if;
  if current_settings.version <> p_expected_version then
    raise exception 'La configuración cambió. Recarga antes de guardar.' using errcode = 'PT409';
  end if;
  select * into result_settings from jsonb_populate_record(current_settings, p_changes);
  update public.business_settings set
    business_name = trim(result_settings.business_name),
    default_deposit_percent = result_settings.default_deposit_percent,
    low_stock_grams = result_settings.low_stock_grams,
    critical_stock_grams = result_settings.critical_stock_grams,
    reference_filament_kg_cost = result_settings.reference_filament_kg_cost,
    energy_kwh_cost = result_settings.energy_kwh_cost,
    labor_hour_cost = result_settings.labor_hour_cost,
    version = current_settings.version + 1, updated_at = now()
  where singleton returning * into result_settings;
  insert into private.mutation_requests(request_id, actor_id, operation, payload, response)
  values (p_request_id, auth.uid(), 'update_settings', request_payload, to_jsonb(result_settings));
  return result_settings;
end;
$$;
revoke all on function public.update_business_settings(jsonb,bigint,uuid) from public, anon;
grant execute on function public.update_business_settings(jsonb,bigint,uuid) to authenticated;

comment on table public.partners is 'Socios reales, sin saldos iniciales. Participación fija 50/50.';
comment on table public.audit_log is 'Registro inmutable para clientes. Sin claves, contraseñas ni datos de auth.';
comment on function public.update_business_settings is 'Escritura atómica, auditada, idempotente y con control optimista de versión.';$kapa_foundations$;
  end if;
  if to_regprocedure('private.is_admin()') is null or to_regclass('public.user_profiles') is null then
    raise exception 'La base de datos no tiene los fundamentos completos de KAPA.';
  end if;
  if to_regclass('public.registration_requests') is null then
    execute $kapa_registration$create table public.registration_requests (
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

comment on table public.registration_requests is 'Registro pendiente, sin acceso al negocio. Identidad confirmada y autorización de un administrador antes de vincular.';$kapa_registration$;
  end if;
end;
$kapa_install$;
commit;
