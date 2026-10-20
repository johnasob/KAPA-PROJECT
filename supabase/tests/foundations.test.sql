begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(26);

-- Fixtures aislados dentro de esta transacción. ROLLBACK restaura todos los
-- perfiles, parámetros e historiales previos, incluso después de otra suite.
delete from public.user_profiles;
delete from private.mutation_requests;
update public.business_settings set business_name='KAPA 3D',
  default_deposit_percent=50, low_stock_grams=200, critical_stock_grams=100,
  reference_filament_kg_cost=90000, energy_kwh_cost=null, labor_hour_cost=null, version=1;
delete from public.audit_log;

insert into auth.users(id, email) values
 ('10000000-0000-0000-0000-000000000001', 'john-fixture@kapa.test'),
 ('10000000-0000-0000-0000-000000000002', 'sebas-fixture@kapa.test'),
 ('10000000-0000-0000-0000-000000000003', 'outsider-fixture@kapa.test');
insert into public.user_profiles(user_id, partner_id, display_name)
select '10000000-0000-0000-0000-000000000001', id, 'John' from public.partners where code = 'john';
insert into public.user_profiles(user_id, partner_id, display_name)
select '10000000-0000-0000-0000-000000000002', id, 'Sebas' from public.partners where code = 'sebas';

select is((select count(*)::integer from public.partners), 2, 'Dos socios iniciales');
select is((select sum(share_basis_points)::integer from public.partners), 10000, 'Participación total del 100 %');
select is((select column_default::numeric from information_schema.columns where table_schema='public' and table_name='business_settings' and column_name='default_deposit_percent'), 50.00, 'Anticipo predeterminado en el esquema del 50 %');
set local role anon;
select throws_ok('select * from public.business_settings', '42501', null, 'Anónimo no puede leer configuración');
reset role;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
set local role authenticated;
select is((select count(*)::integer from public.business_settings), 0, 'Cuenta ajena no ve configuración');
select is((select count(*)::integer from public.partners), 0, 'Cuenta ajena no ve socios');
select is((select count(*)::integer from public.user_profiles), 0, 'Cuenta ajena no ve perfiles');
select is((select count(*)::integer from public.audit_log), 0, 'Cuenta ajena no ve auditoría');
select throws_ok($$select public.update_business_settings('{"business_name":"Intrusión"}',1,'20000000-0000-0000-0000-000000000001')$$, '42501', 'Acceso denegado', 'Cuenta ajena no puede invocar escritura');

reset role;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local role authenticated;
select is((select count(*)::integer from public.business_settings), 1, 'John ve configuración');
select is((select count(*)::integer from public.partners), 2, 'John ve ambos socios');
select throws_ok($$update public.business_settings set business_name='Directo'$$, '42501', null, 'John no puede omitir la RPC');
select throws_ok($$update public.user_profiles set active=true$$, '42501', null, 'No se pueden autoasignar permisos');
select is((public.update_business_settings('{"business_name":"KAPA prueba"}',1,'20000000-0000-0000-0000-000000000002')).version, 2::bigint, 'RPC actualiza versión');
select is((public.update_business_settings('{"business_name":"KAPA prueba"}',1,'20000000-0000-0000-0000-000000000002')).version, 2::bigint, 'Reintento idéntico devuelve resultado original');
select is((select count(*)::integer from public.audit_log where entity='business_settings'), 1, 'Reintento no duplica auditoría');
select throws_ok($$select public.update_business_settings('{"business_name":"Otro"}',1,'20000000-0000-0000-0000-000000000002')$$, '22023', 'Identificador de solicitud reutilizado', 'No se reutiliza una solicitud con otro contenido');
select throws_ok($$select public.update_business_settings('{"business_name":"Otro"}',1,'20000000-0000-0000-0000-000000000003')$$, 'PT409', 'La configuración cambió. Recarga antes de guardar.', 'Versiones antiguas no sobrescriben cambios');
select throws_ok($$select public.update_business_settings('{"default_deposit_percent":-1}',2,'20000000-0000-0000-0000-000000000004')$$, '23514', null, 'No se permiten porcentajes negativos');
select throws_ok($$select public.update_business_settings('{"critical_stock_grams":201}',2,'20000000-0000-0000-0000-000000000005')$$, '23514', null, 'No se permiten alertas incoherentes');
select throws_ok($$select public.update_business_settings('{"version":99}',2,'20000000-0000-0000-0000-000000000006')$$, '22023', 'Campos de configuración no permitidos', 'No se pueden editar campos internos');
select throws_ok('delete from public.audit_log', '42501', null, 'Auditoría inmutable para socios');
select is((select business_name from public.business_settings), 'KAPA prueba', 'Errores no modifican la configuración');
reset role;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
set local role authenticated;
select is((select business_name from public.business_settings), 'KAPA prueba', 'Sebas ve los cambios de John');
reset role;
update public.user_profiles set active=false where user_id='10000000-0000-0000-0000-000000000001';
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local role authenticated;
select is((select count(*)::integer from public.business_settings), 0, 'Revocar perfil bloquea lecturas sin cambiar token');
select throws_ok($$select public.update_business_settings('{"business_name":"Inactivo"}',2,'20000000-0000-0000-0000-000000000007')$$, '42501', 'Acceso denegado', 'Revocar perfil bloquea escrituras');
select * from finish();
rollback;
