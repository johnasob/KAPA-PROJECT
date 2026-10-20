begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(19);
delete from public.user_profiles;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('31000000-0000-0000-0000-000000000001','john-registration@kapa.test',now(),'{"display_name":"John"}'),
 ('31000000-0000-0000-0000-000000000002','sebas-registration@kapa.test',now(),'{"display_name":"Sebas"}'),
 ('31000000-0000-0000-0000-000000000003','outsider-registration@kapa.test',now(),'{"display_name":"Extraño","role":"admin","partner_id":"john"}'),
 ('31000000-0000-0000-0000-000000000004','unconfirmed-registration@kapa.test',null,'{"display_name":"Sin confirmar"}');
select is((select display_name from public.registration_requests where user_id='31000000-0000-0000-0000-000000000002'),'Sebas','Conserva el nombre del registro');
select is((select count(*)::integer from public.user_profiles),0,'Registrarse no concede administración ni al primer usuario');
set local role anon;
select throws_ok('select * from public.registration_requests','42501',null,'Anónimos no leen solicitudes');
reset role;
set local request.jwt.claim.sub='31000000-0000-0000-0000-000000000003';
set local role authenticated;
select is((select count(*)::integer from public.registration_requests),1,'El usuario solo ve su propia solicitud');
select is((select count(*)::integer from public.business_settings),0,'Metadatos de admin no habilitan acceso');
select throws_ok('select * from public.get_pending_registrations()','42501','Acceso denegado','Terceros no enumeran correos');
select throws_ok($$select public.approve_registration('31000000-0000-0000-0000-000000000003','john')$$,'42501','Acceso denegado','Nadie puede aprobarse a sí mismo sin permisos');
select throws_ok($$update public.registration_requests set display_name='John'$$,'42501',null,'El cliente no modifica solicitudes directamente');
reset role;
insert into public.user_profiles(user_id,partner_id,display_name)
select '31000000-0000-0000-0000-000000000001',id,'John' from public.partners where code='john';
set local request.jwt.claim.sub='31000000-0000-0000-0000-000000000001';
set local role authenticated;
select is((select count(*)::integer from public.get_pending_registrations()),3,'El administrador ve cuentas pendientes');
select throws_ok('select * from public.get_pending_registrations(51,0)','22023','Paginación inválida','Limita el tamaño de consulta');
select throws_ok($$select public.approve_registration('31000000-0000-0000-0000-000000000004','sebas')$$,'PT422','Confirma el correo antes de habilitar el acceso','Exige correo confirmado');
select throws_ok($$select public.approve_registration('31000000-0000-0000-0000-000000000002','otro')$$,'22023','Socio inválido','Solo existen John y Sebas');
select is((public.approve_registration('31000000-0000-0000-0000-000000000002','sebas')).display_name,'Sebas','Vincula la cuenta por aprobación');
select is((public.approve_registration('31000000-0000-0000-0000-000000000002','sebas')).display_name,'Sebas','Reintentar no duplica la cuenta');
select is((select count(*)::integer from public.audit_log where entity='user_profiles' and record_id='31000000-0000-0000-0000-000000000002'),1,'Una sola auditoría para la aprobación');
select throws_ok($$select public.approve_registration('31000000-0000-0000-0000-000000000003','sebas')$$,'PT409','El socio ya tiene una cuenta vinculada','No reemplaza socios existentes');
select is((select count(*)::integer from public.get_pending_registrations()),2,'La cuenta aprobada sale de pendientes');
reset role;
set local request.jwt.claim.sub='31000000-0000-0000-0000-000000000002';
set local role authenticated;
select is((select count(*)::integer from public.business_settings),1,'El socio aprobado ya ve el negocio');
reset role;
set local request.jwt.claim.sub='31000000-0000-0000-0000-000000000003';
set local role authenticated;
select is((select count(*)::integer from public.business_settings),0,'El tercero sigue bloqueado');
select * from finish();
rollback;
