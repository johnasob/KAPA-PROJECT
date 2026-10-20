import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const body = (path) =>
  readFileSync(path, "utf8")
    .replace(/^begin;\s*/i, "")
    .replace(/\s*commit;\s*$/i, "");
const foundations = body("supabase/migrations/20261019000100_foundations.sql");
const registration = body(
  "supabase/migrations/20261020000100_registration.sql",
);
const operations = body("supabase/migrations/20261021000100_operations.sql");
const refinements = body(
  "supabase/migrations/20261022000100_workflow_refinements.sql",
);
const installer = `-- KAPA 3D: instalación o actualización completa. Ejecutar en SQL Editor.
-- Conserva cuentas, perfiles, configuración y operaciones existentes.
-- No requiere claves ni contraseñas. Si hay una instalación parcial, revierte todo.
begin;
do $kapa_install$
declare table_name text;
begin
  if to_regclass('public.business_settings') is null then
    if to_regclass('public.partners') is not null or to_regclass('public.user_profiles') is not null or to_regclass('public.audit_log') is not null then
      raise exception 'Hay una instalación inicial incompleta. No se modificó la base de datos.';
    end if;
    execute $kapa_foundations$${foundations}$kapa_foundations$;
  end if;
  if to_regprocedure('private.is_admin()') is null or to_regclass('public.user_profiles') is null then
    raise exception 'Faltan los fundamentos completos de KAPA. No se modificó la base de datos.';
  end if;
  if to_regclass('public.registration_requests') is null then
    execute $kapa_registration$${registration}$kapa_registration$;
  end if;
  if to_regclass('public.orders') is null then
    if to_regclass('public.inventory_lots') is not null or to_regclass('public.cash_entries') is not null or to_regclass('public.customers') is not null then
      raise exception 'Hay módulos instalados parcialmente. No se reemplazaron tablas ni datos.';
    end if;
    execute $kapa_operations$${operations}$kapa_operations$;
  end if;
  if to_regclass('public.opening_balances') is null then
    execute $kapa_refinements$${refinements}$kapa_refinements$;
  end if;
  foreach table_name in array array['order_line_payments','order_deliveries','opening_balances','print_experiments','customers','suppliers','products','printers','materials','inventory_lots','quotes','quote_lines','orders','order_lines','material_reservations','production_runs','inventory_movements','purchases','debts','debt_installments','maintenance_records','cash_entries','debt_payments','settlements','partner_allocations','partner_advances','advance_compensations','partner_withdrawals','order_files'] loop
    if to_regclass('public.'||table_name) is null then raise exception 'Falta la tabla %. No se modificaron datos existentes.',table_name; end if;
  end loop;
  if to_regprocedure('public.business_operate(text,jsonb,uuid)') is null or to_regprocedure('public.business_read(text,text,integer,date,date,uuid)') is null or to_regprocedure('public.business_report(text,date,date,integer)') is null then
    raise exception 'Faltan funciones de los módulos. No se modificaron datos existentes.';
  end if;
end;
$kapa_install$;
notify pgrst, 'reload schema';
commit;
`;
mkdirSync("release", { recursive: true });
writeFileSync("release/KAPA-3D-instalacion.sql", installer);
console.log("Instalador completo de Supabase generado; no se creó ningún ZIP.");
