begin;

create table public.customers (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 160),
 phone text not null default '', whatsapp text not null default '', city text not null default '', address text not null default '',
 notes text not null default '', active boolean not null default true, version integer not null default 1, created_at timestamptz not null default now()
);
create table public.suppliers (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 160), phone text not null default '', notes text not null default '', created_at timestamptz not null default now()
);
create table public.products (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 160), description text not null default '', model_url text not null default '', active boolean not null default true, created_at timestamptz not null default now()
);
create table public.printers (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120), model text not null,
 acquisition_cost numeric(16,2) check(acquisition_cost>=0), purchased_on date, useful_hours numeric(14,3) check(useful_hours>0),
 baseline_hours numeric(14,3) not null default 0 check(baseline_hours>=0), accumulated_hours numeric(14,3) not null default 0 check(accumulated_hours>=0), power_kw numeric(12,5) check(power_kw>=0), energy_rate numeric(14,2) check(energy_rate>=0),
 status text not null default 'available' check(status in ('available','printing','maintenance','inactive')), notes text not null default '', version integer not null default 1, created_at timestamptz not null default now()
);
insert into public.printers(name,model,notes) values ('Bambu Lab A1 Mini','Bambu Lab A1 Mini','Referencia inicial. Completa adquisición, vida útil y potencia con tus valores reales. No registra una compra ni una deuda.');
create table public.materials (
 id uuid primary key default gen_random_uuid(), brand text not null, kind text not null, color text not null, created_at timestamptz not null default now(), unique(brand,kind,color)
);
create table public.inventory_lots (
 id uuid primary key default gen_random_uuid(), material_id uuid not null references public.materials, initial_grams numeric(14,3) not null check(initial_grams>0),
 on_hand_grams numeric(14,3) not null check(on_hand_grams>=0), purchase_cost numeric(16,2) not null check(purchase_cost>=0),
 cost_per_gram numeric generated always as (purchase_cost/initial_grams) stored,
 purchased_on date not null, supplier_id uuid references public.suppliers, state text not null default 'active' check(state in ('active','inactive')), created_at timestamptz not null default now()
);
create table public.quotes (
 id uuid primary key default gen_random_uuid(), number bigint generated always as identity unique, customer_id uuid not null references public.customers,
 description text not null check(length(trim(description)) between 1 and 500), status text not null default 'draft' check(status in ('draft','converted','cancelled')),
 cost_total numeric(16,2) not null check(cost_total>=0), price_total numeric(16,2) not null check(price_total>=0),
 deposit_percent numeric(5,2) not null check(deposit_percent between 0 and 100), notes text not null default '', created_by uuid not null references auth.users, created_at timestamptz not null default now()
);
create table public.quote_lines (
 id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quotes, product_id uuid references public.products, description text not null,
 quantity integer not null check(quantity between 1 and 100000), printer_id uuid not null references public.printers,
 estimated_hours numeric(14,3) not null check(estimated_hours>0), unit_cost numeric(16,2) not null check(unit_cost>=0), unit_price numeric(16,2) not null check(unit_price>=0),
 cost_snapshot jsonb not null, material_snapshot jsonb not null
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), number bigint generated always as identity unique, quote_id uuid unique references public.quotes, customer_id uuid not null references public.customers,
 description text not null, status text not null default 'pending_deposit' check(status in ('pending_deposit','confirmed','design','ready','printing','finishing','ready_delivery','delivered','cancelled')),
 priority integer not null default 0 check(priority between 0 and 2), queue_position integer not null default 0,
 price_total numeric(16,2) not null check(price_total>=0), estimated_cost numeric(16,2) not null check(estimated_cost>=0), deposit_percent numeric(5,2) not null check(deposit_percent between 0 and 100),
 promised_at timestamptz not null, delivered_at timestamptz, cancelled_at timestamptz, notes text not null default '', reference_url text not null default '', model_url text not null default '',
 version integer not null default 1, created_by uuid not null references auth.users, created_at timestamptz not null default now()
);
create index orders_queue_idx on public.orders(status,priority desc,queue_position,created_at);
create index orders_customer_idx on public.orders(customer_id,created_at desc);
create table public.order_lines (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders, product_id uuid references public.products, description text not null,
 quantity integer not null check(quantity>0), printer_id uuid not null references public.printers, estimated_hours numeric(14,3) not null,
 unit_cost numeric(16,2) not null, unit_price numeric(16,2) not null, cost_snapshot jsonb not null, material_snapshot jsonb not null
);
create table public.material_reservations (
 order_id uuid not null references public.orders, lot_id uuid not null references public.inventory_lots, grams numeric(14,3) not null check(grams>=0), primary key(order_id,lot_id)
);
create table public.production_runs (
 id uuid primary key default gen_random_uuid(), order_line_id uuid not null references public.order_lines,
 printer_id uuid not null references public.printers, good_units integer not null check(good_units>=0), actual_hours numeric(14,3) not null check(actual_hours>0),
 material_cost numeric(16,2) not null, depreciation_cost numeric(16,2) not null, energy_cost numeric(16,2) not null, other_cost numeric(16,2) not null check(other_cost>=0),
 cost_total numeric(16,2) not null, details jsonb not null, notes text not null default '', reversed_at timestamptz, created_by uuid not null references auth.users, created_at timestamptz not null default now()
);
create table public.inventory_movements (
 id uuid primary key default gen_random_uuid(), lot_id uuid not null references public.inventory_lots, order_id uuid references public.orders, production_id uuid references public.production_runs,
 kind text not null check(kind in ('purchase','reserve','release','production','waste','adjustment','return','reversal')),
 delta_grams numeric(14,3) not null, reserved_delta numeric(14,3) not null default 0, expense_amount numeric(16,2) not null default 0,
 reason text not null, reverses_id uuid unique references public.inventory_movements, created_by uuid not null references auth.users, created_at timestamptz not null default now(),
 check(delta_grams<>0 or reserved_delta<>0)
);
create index inventory_movements_lot_idx on public.inventory_movements(lot_id,created_at desc);
create index production_line_idx on public.production_runs(order_line_id);
create table public.purchases (
 id uuid primary key default gen_random_uuid(), supplier_id uuid references public.suppliers, lot_id uuid unique references public.inventory_lots, printer_id uuid references public.printers,
 category text not null check(category in ('inventory','asset','operating')), description text not null, total numeric(16,2) not null check(total>0), paid_initial numeric(16,2) not null check(paid_initial>=0 and paid_initial<=total),
 purchased_on date not null, expense_amount numeric(16,2) not null default 0 check(expense_amount>=0), voided_at timestamptz, created_by uuid not null references auth.users, created_at timestamptz not null default now()
);
create table public.debts (
 id uuid primary key default gen_random_uuid(), supplier_id uuid references public.suppliers, purchase_id uuid unique references public.purchases, description text not null,
 principal numeric(16,2) not null check(principal>0), installment_count integer not null check(installment_count between 1 and 600), monthly_payment numeric(16,2) not null check(monthly_payment>0),
 next_due date not null, notes text not null default '', voided_at timestamptz, created_by uuid not null references auth.users, created_at timestamptz not null default now()
);
create table public.debt_installments (
 id uuid primary key default gen_random_uuid(), debt_id uuid not null references public.debts, number integer not null, due_on date not null, principal_due numeric(16,2) not null check(principal_due>=0), interest_due numeric(16,2) not null check(interest_due>=0), unique(debt_id,number)
);
create table public.maintenance_records (
 id uuid primary key default gen_random_uuid(), printer_id uuid not null references public.printers, description text not null, cost numeric(16,2) not null check(cost>=0),
 performed_on date not null, next_due date, notes text not null default '', created_by uuid not null references auth.users, created_at timestamptz not null default now()
);
create table public.cash_entries (
 id uuid primary key default gen_random_uuid(), amount numeric(16,2) not null check(amount<>0), category text not null,
 description text not null check(length(trim(description)) between 1 and 1000), method text not null check(length(trim(method)) between 1 and 80), occurred_on date not null check(occurred_on<=current_date),
 order_id uuid references public.orders, debt_id uuid references public.debts, purchase_id uuid references public.purchases, partner_id uuid references public.partners, maintenance_id uuid references public.maintenance_records,
 profit_effect numeric(16,2) not null default 0, reverses_id uuid unique references public.cash_entries, authorization_reason text not null default '', created_by uuid not null references auth.users, created_at timestamptz not null default now()
);
create index cash_entries_date_idx on public.cash_entries(occurred_on,id);
create index cash_entries_order_idx on public.cash_entries(order_id);
create table public.debt_payments (
 id uuid primary key default gen_random_uuid(), debt_id uuid not null references public.debts, installment_id uuid references public.debt_installments, principal_paid numeric(16,2) not null check(principal_paid>=0),
 interest_paid numeric(16,2) not null check(interest_paid>=0), paid_on date not null, created_by uuid not null references auth.users, created_at timestamptz not null default now(), check(principal_paid+interest_paid>0)
);
create table public.settlements (
 id uuid primary key default gen_random_uuid(), period_start date not null, period_end date not null check(period_end>=period_start and period_end<=current_date),
 profit_recognized numeric(16,2) not null check(profit_recognized>=0), reserved numeric(16,2) not null check(reserved>=0), distributed numeric(16,2) not null check(distributed>=0),
 reserve_release numeric(16,2) not null default 0 check(reserve_release>=0), notes text not null default '', created_by uuid not null references auth.users, created_at timestamptz not null default now()
);
create table public.partner_allocations (
 id uuid primary key default gen_random_uuid(), settlement_id uuid not null references public.settlements, partner_id uuid not null references public.partners, amount numeric(16,2) not null check(amount>=0), unique(settlement_id,partner_id)
);
create table public.partner_advances (
 id uuid primary key default gen_random_uuid(), partner_id uuid not null references public.partners, amount numeric(16,2) not null check(amount>0), cash_entry_id uuid unique not null references public.cash_entries, created_at timestamptz not null default now()
);
create table public.advance_compensations (
 id uuid primary key default gen_random_uuid(), advance_id uuid not null references public.partner_advances, allocation_id uuid not null references public.partner_allocations, amount numeric(16,2) not null check(amount>0), unique(advance_id,allocation_id)
);
create table public.partner_withdrawals (
 id uuid primary key default gen_random_uuid(), partner_id uuid not null references public.partners, amount numeric(16,2) not null check(amount>0), cash_entry_id uuid unique not null references public.cash_entries,
 authorized_overdraft boolean not null default false, authorization_reason text not null default '', created_at timestamptz not null default now()
);
create table public.order_files (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders, object_path text not null unique, name text not null, created_by uuid not null references auth.users, created_at timestamptz not null default now()
);
create index quote_lines_quote_idx on public.quote_lines(quote_id);
create index order_lines_order_idx on public.order_lines(order_id);
create index reservations_lot_idx on public.material_reservations(lot_id) where grams>0;
create index debt_payments_debt_idx on public.debt_payments(debt_id);
create index order_files_order_idx on public.order_files(order_id);
create index allocations_partner_idx on public.partner_allocations(partner_id);
create index advances_partner_idx on public.partner_advances(partner_id,created_at);
create index withdrawals_partner_idx on public.partner_withdrawals(partner_id,created_at);

-- Only the owner's RPCs may write. All operational tables are private to active partners.
do $$ declare t text; begin
 foreach t in array array['customers','suppliers','products','printers','materials','inventory_lots','quotes','quote_lines','orders','order_lines','material_reservations','production_runs','inventory_movements','purchases','debts','debt_installments','maintenance_records','cash_entries','debt_payments','settlements','partner_allocations','partner_advances','advance_compensations','partner_withdrawals','order_files'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy admin_read on public.%I for select to authenticated using ((select private.is_admin()))',t);
  execute format('create trigger audit_operation after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
 end loop;
end $$;

create function private.op_number(p jsonb, k text, fallback numeric default 0) returns numeric language plpgsql immutable set search_path='' as $$
declare v numeric; begin
 v:=coalesce(nullif(p->>k,'')::numeric,fallback);
 if v is null or v<0 or v>999999999999 or v::text in ('NaN','Infinity','-Infinity') then raise exception 'Valor numérico inválido: %',k using errcode='22023'; end if;
 return v;
end $$;
create function private.op_today() returns date language sql stable set search_path='' as $$select (now() at time zone 'America/Bogota')::date$$;
create function private.op_cash_balance() returns numeric language sql stable set search_path='' as $$select coalesce(sum(amount),0) from public.cash_entries$$;
create function private.op_paid(oid uuid) returns numeric language sql stable set search_path='' as $$select coalesce(sum(amount),0) from public.cash_entries where order_id=oid$$;
create function private.op_reserved(lid uuid) returns numeric language sql stable set search_path='' as $$select coalesce(sum(grams),0) from public.material_reservations where lot_id=lid$$;
create function private.op_debt_balance(did uuid) returns numeric language sql stable set search_path='' as $$select case when d.voided_at is not null then 0 else d.principal-coalesce((select sum(principal_paid) from public.debt_payments where debt_id=did),0) end from public.debts d where id=did$$;
create function private.op_production_cost(oid uuid) returns numeric language sql stable set search_path='' as $$select coalesce(sum(r.cost_total),0) from public.production_runs r join public.order_lines l on l.id=r.order_line_id where l.order_id=oid and r.reversed_at is null$$;

create function private.op_post_cash(p_amount numeric,p_category text,p_description text,p jsonb,oid uuid default null,did uuid default null,pid uuid default null,partner uuid default null,maint uuid default null,p_profit numeric default 0,reversed uuid default null) returns uuid
language plpgsql set search_path='' as $$
declare result uuid; d date:=coalesce(nullif(p->>'date','')::date,private.op_today()); begin
 p_amount:=round(p_amount,2);
 if p_amount=0 then return null; end if;
 if d>private.op_today() then raise exception 'Registra dinero recibido o pagado, no movimientos futuros.' using errcode='22023'; end if;
 if private.op_cash_balance()+p_amount<0 and (not coalesce((p->>'allow_negative_cash')::boolean,false) or length(trim(coalesce(p->>'authorization_reason','')))<10) then
  raise exception 'Caja insuficiente. Registra un aporte o autoriza expresamente el sobregiro con un motivo de al menos 10 caracteres.' using errcode='PT422';
 end if;
 insert into public.cash_entries(amount,category,description,method,occurred_on,order_id,debt_id,purchase_id,partner_id,maintenance_id,profit_effect,reverses_id,authorization_reason,created_by)
 values(round(p_amount,2),p_category,p_description,coalesce(nullif(p->>'method',''),'transferencia'),d,oid,did,pid,partner,maint,p_profit,reversed,coalesce(p->>'authorization_reason',''),auth.uid()) returning id into result;
 return result;
end $$;

create function private.op_create_debt(p jsonb,total numeric,purchase uuid default null) returns uuid language plpgsql set search_path='' as $$
declare did uuid; n integer:=coalesce(nullif(p->>'installments','')::integer,1); due date:=coalesce(nullif(p->>'next_due','')::date,private.op_today()+30); interest numeric:=private.op_number(p,'installment_interest'); piece numeric; i integer; begin
 if n not between 1 and 600 then raise exception 'Número de cuotas inválido' using errcode='22023'; end if;
 piece:=trunc(total/n,2);
 insert into public.debts(supplier_id,purchase_id,description,principal,installment_count,monthly_payment,next_due,notes,created_by)
 values(nullif(p->>'supplier_id','')::uuid,purchase,coalesce(nullif(p->>'description',''),'Compra financiada'),total,n,piece+interest,due,coalesce(p->>'notes',''),auth.uid()) returning id into did;
 for i in 1..n loop
  insert into public.debt_installments(debt_id,number,due_on,principal_due,interest_due) values(did,i,(due+(i-1)*interval '1 month')::date,case when i=n then total-piece*(n-1) else piece end,interest);
 end loop;
 return did;
end $$;

create function private.op_purchase(p jsonb,category text,total numeric,lid uuid default null,printer uuid default null) returns uuid language plpgsql set search_path='' as $$
declare pid uuid; paid numeric:=private.op_number(p,'paid',total); begin
 if total<=0 or paid>total then raise exception 'Compra o pago inicial inválido.' using errcode='22023'; end if;
 insert into public.purchases(supplier_id,lot_id,printer_id,category,description,total,paid_initial,purchased_on,expense_amount,created_by)
 values(nullif(p->>'supplier_id','')::uuid,lid,printer,category,coalesce(nullif(p->>'description',''),'Compra de '||category),total,paid,coalesce(nullif(p->>'date','')::date,private.op_today()),case when category='operating' and not coalesce((p->>'included_in_production')::boolean,false) then total else 0 end,auth.uid()) returning id into pid;
 perform private.op_post_cash(-paid,case category when 'inventory' then 'inventory_purchase' when 'asset' then 'asset_purchase' else 'operating_purchase' end,coalesce(p->>'description','Compra'),p,null,null,pid);
 if total>paid then perform private.op_create_debt(p,total-paid,pid); end if;
 return pid;
end $$;

-- Returns a complete, immutable unit cost snapshot. PostgreSQL numeric is authoritative.
create function private.op_cost(p jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare printer public.printers; settings public.business_settings; item jsonb; lot public.inventory_lots; grams numeric; materials numeric:=0; snapshots jsonb:='[]';
 hours numeric:=round(private.op_number(p,'hours'),3); labor numeric; painting numeric; extras numeric; dep numeric; energy numeric; total numeric; price numeric; begin
 select * into strict printer from public.printers where id=(p->>'printer_id')::uuid;
 select * into strict settings from public.business_settings;
 if printer.acquisition_cost is null or printer.useful_hours is null or printer.power_kw is null or coalesce(printer.energy_rate,settings.energy_kwh_cost) is null or settings.labor_hour_cost is null then
  raise exception 'Completa adquisición, vida útil, potencia, energía y mano de obra antes de cotizar.' using errcode='PT422';
 end if;
 if hours<=0 or jsonb_array_length(coalesce(p->'materials','[]'))=0 then raise exception 'Indica horas y al menos un filamento.' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p->'materials') loop
  select * into strict lot from public.inventory_lots where id=(item->>'lot_id')::uuid and state='active';
  grams:=round(private.op_number(item,'piece_grams')+private.op_number(item,'support_grams')+private.op_number(item,'waste_grams'),3);
  if grams<=0 then raise exception 'Los gramos deben ser positivos.' using errcode='22023'; end if;
  materials:=materials+grams*lot.purchase_cost/lot.initial_grams;
  snapshots:=snapshots||jsonb_build_array(item||jsonb_build_object('grams',grams,'cost_per_gram',lot.cost_per_gram));
 end loop;
 dep:=hours*printer.acquisition_cost/printer.useful_hours;
 energy:=hours*printer.power_kw*coalesce(printer.energy_rate,settings.energy_kwh_cost);
 labor:=private.op_number(p,'labor_hours')*settings.labor_hour_cost;
 painting:=private.op_number(p,'painting_hours')*settings.labor_hour_cost+private.op_number(p,'painting_materials');
 extras:=private.op_number(p,'supplies_cost')+private.op_number(p,'customization_cost')+private.op_number(p,'packaging_cost')+private.op_number(p,'other_cost');
 total:=round(materials+dep+energy+labor+painting+extras,2);
 price:=round(case when nullif(p->>'manual_price','') is not null then private.op_number(p,'manual_price') else total*private.op_number(p,'multiplier',3) end,2);
 return jsonb_build_object('material_cost',round(materials,2),'depreciation_cost',round(dep,2),'energy_cost',round(energy,2),'labor_cost',round(labor,2),'painting_cost',round(painting,2),'extras_cost',round(extras,2),'total',total,'price',price,'profit',price-total,'margin',case when price>0 then round((price-total)/price*100,4) else 0 end,'markup',case when total>0 then round((price-total)/total*100,4) else 0 end,'materials',snapshots,'inputs',p,'labor_rate',settings.labor_hour_cost,'depreciation_rate',printer.acquisition_cost/printer.useful_hours,'power_kw',printer.power_kw,'energy_rate',coalesce(printer.energy_rate,settings.energy_kwh_cost));
end $$;

create function private.op_reserve(oid uuid,lid uuid,amount numeric) returns void language plpgsql set search_path='' as $$
declare lot public.inventory_lots; old numeric:=0; delta numeric; begin
 amount:=round(amount,3);
 if amount<0 then raise exception 'Reserva inválida.' using errcode='22023'; end if;
 select * into strict lot from public.inventory_lots where id=lid for update;
 select grams into old from public.material_reservations where order_id=oid and lot_id=lid;
 old:=coalesce(old,0); delta:=amount-old;
 if amount>0 and lot.state<>'active' then raise exception 'El lote está inactivo.' using errcode='PT422'; end if;
 if lot.on_hand_grams-private.op_reserved(lid)+old<amount then raise exception 'Filamento disponible insuficiente para la reserva.' using errcode='PT422'; end if;
 insert into public.material_reservations(order_id,lot_id,grams) values(oid,lid,amount) on conflict(order_id,lot_id) do update set grams=excluded.grams;
 if delta<>0 then insert into public.inventory_movements(lot_id,order_id,kind,delta_grams,reserved_delta,reason,created_by) values(lid,oid,case when delta>0 then 'reserve' else 'release' end,0,delta,'Reserva de producción',auth.uid()); end if;
end $$;

create function private.op_realized(p_until date) returns numeric language sql stable set search_path='' as $$
 select
 coalesce((select sum(o.price_total-private.op_production_cost(o.id)) from public.orders o where o.status='delivered' and private.op_paid(o.id)>=o.price_total and greatest((o.delivered_at at time zone 'America/Bogota')::date,coalesce((select max(occurred_on) from public.cash_entries c where c.order_id=o.id),(o.delivered_at at time zone 'America/Bogota')::date))<=p_until),0)
 -coalesce((select sum(private.op_production_cost(id)) from public.orders where status='cancelled' and (cancelled_at at time zone 'America/Bogota')::date<=p_until),0)
 +coalesce((select sum(profit_effect) from public.cash_entries where occurred_on<=p_until),0)
 -coalesce((select sum(expense_amount) from public.purchases where category='operating' and voided_at is null and purchased_on<=p_until),0)
 -coalesce((select sum(expense_amount) from public.inventory_movements where (created_at at time zone 'America/Bogota')::date<=p_until),0)
$$;
create function private.op_partner_balance(pid uuid) returns numeric language sql stable set search_path='' as $$
 select coalesce((select sum(amount) from public.partner_allocations where partner_id=pid),0)
 -coalesce((select sum(c.amount) from public.advance_compensations c join public.partner_advances a on a.id=c.advance_id where a.partner_id=pid),0)
 -coalesce((select sum(amount) from public.partner_withdrawals where partner_id=pid),0)
$$;
create function private.op_pending_advances(pid uuid) returns numeric language sql stable set search_path='' as $$
 select coalesce((select sum(a.amount-coalesce((select sum(amount) from public.advance_compensations where advance_id=a.id),0)) from public.partner_advances a where partner_id=pid),0)
$$;

-- The public entry point checks permission and serializes mutations for the two administrators.
-- The shared request ledger makes retrying the same operation safe, including after a lost response.
create function public.business_operate(p_action text,p_data jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare previous private.mutation_requests; result jsonb; id uuid; related uuid; partner uuid; row_data jsonb; item jsonb; detail jsonb; snapshot jsonb; materials jsonb;
 printer public.printers; lot public.inventory_lots; q public.quotes; ord public.orders; line public.order_lines; run public.production_runs; movement public.inventory_movements; cash public.cash_entries; purchase public.purchases;
 amount numeric; paid numeric; principal numeric; interest numeric; grams numeric; old_grams numeric; units integer; hours numeric; cost numeric; cost_sum numeric; price_sum numeric;
 available numeric; reserved numeric; distributed numeric; allocation uuid; selected_installment uuid; advance record; settings public.business_settings; target_status text;
begin
 if not private.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_request_id is null or p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Solicitud inválida' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(71002026);
 select * into previous from private.mutation_requests where request_id=p_request_id;
 if found then
  if previous.actor_id<>auth.uid() or previous.operation<>p_action or previous.payload<>p_data then raise exception 'Identificador reutilizado con datos distintos.' using errcode='PT409'; end if;
  return previous.response;
 end if;
 select * into strict settings from public.business_settings for share;
 id:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());

 case p_action
 when 'customer_save' then
  if exists(select 1 from public.customers where customers.id=id and version<>coalesce((p_data->>'version')::integer,0)) then raise exception 'El cliente cambió. Actualiza los datos.' using errcode='PT409'; end if;
  insert into public.customers(id,name,phone,whatsapp,city,address,notes,active) values(id,trim(p_data->>'name'),coalesce(p_data->>'phone',''),coalesce(p_data->>'whatsapp',''),coalesce(p_data->>'city',''),coalesce(p_data->>'address',''),coalesce(p_data->>'notes',''),coalesce((p_data->>'active')::boolean,true))
  on conflict on constraint customers_pkey do update set name=excluded.name,phone=excluded.phone,whatsapp=excluded.whatsapp,city=excluded.city,address=excluded.address,notes=excluded.notes,active=excluded.active,version=customers.version+1;
 when 'supplier_create' then
  insert into public.suppliers(id,name,phone,notes) values(id,trim(p_data->>'name'),coalesce(p_data->>'phone',''),coalesce(p_data->>'notes',''));
 when 'product_create' then
  insert into public.products(id,name,description,model_url) values(id,trim(p_data->>'name'),coalesce(p_data->>'description',''),coalesce(p_data->>'model_url',''));
 when 'printer_save' then
  foreach target_status in array array['acquisition_cost','useful_hours','power_kw','energy_rate','baseline_hours'] loop if nullif(p_data->>target_status,'') is not null then perform private.op_number(p_data,target_status); end if; end loop;
  if exists(select 1 from public.printers where printers.id=id and version<>coalesce((p_data->>'version')::integer,0)) then raise exception 'La impresora cambió. Actualiza los datos.' using errcode='PT409'; end if;
  insert into public.printers(id,name,model,acquisition_cost,purchased_on,useful_hours,baseline_hours,accumulated_hours,power_kw,energy_rate,status,notes)
  values(id,trim(p_data->>'name'),coalesce(p_data->>'model',''),nullif(p_data->>'acquisition_cost','')::numeric,nullif(p_data->>'purchased_on','')::date,nullif(p_data->>'useful_hours','')::numeric,private.op_number(p_data,'baseline_hours'),private.op_number(p_data,'baseline_hours'),nullif(p_data->>'power_kw','')::numeric,nullif(p_data->>'energy_rate','')::numeric,coalesce(p_data->>'status','available'),coalesce(p_data->>'notes',''))
  on conflict on constraint printers_pkey do update set name=excluded.name,model=excluded.model,acquisition_cost=excluded.acquisition_cost,purchased_on=excluded.purchased_on,useful_hours=excluded.useful_hours,accumulated_hours=printers.accumulated_hours-printers.baseline_hours+excluded.baseline_hours,baseline_hours=excluded.baseline_hours,power_kw=excluded.power_kw,energy_rate=excluded.energy_rate,status=excluded.status,notes=excluded.notes,version=printers.version+1;
  if coalesce((p_data->>'register_purchase')::boolean,false) then
   if exists(select 1 from public.purchases where printer_id=id) then raise exception 'La compra de esta impresora ya fue registrada.' using errcode='PT409'; end if;
   perform private.op_purchase(p_data,'asset',private.op_number(p_data,'acquisition_cost'),null,id);
  end if;
 when 'maintenance_create' then
  amount:=private.op_number(p_data,'cost');
  insert into public.maintenance_records(id,printer_id,description,cost,performed_on,next_due,notes,created_by)
  values(id,(p_data->>'printer_id')::uuid,p_data->>'description',amount,coalesce(nullif(p_data->>'date','')::date,private.op_today()),nullif(p_data->>'next_due','')::date,coalesce(p_data->>'notes',''),auth.uid());
  update public.printers set status=coalesce(nullif(p_data->>'printer_status',''),'available'),version=version+1 where printers.id=(p_data->>'printer_id')::uuid;
  perform private.op_post_cash(-amount,'maintenance',p_data->>'description',p_data,null,null,null,null,id,-amount);
 when 'lot_purchase' then
  grams:=private.op_number(p_data,'initial_grams'); amount:=private.op_number(p_data,'total');
  insert into public.materials(brand,kind,color) values(trim(p_data->>'brand'),trim(p_data->>'kind'),trim(p_data->>'color')) on conflict(brand,kind,color) do update set brand=excluded.brand returning materials.id into related;
  insert into public.inventory_lots(id,material_id,initial_grams,on_hand_grams,purchase_cost,purchased_on,supplier_id) values(id,related,grams,grams,amount,coalesce(nullif(p_data->>'date','')::date,private.op_today()),nullif(p_data->>'supplier_id','')::uuid);
  perform private.op_purchase(p_data,'inventory',amount,id);
  insert into public.inventory_movements(lot_id,kind,delta_grams,reason,created_by) values(id,'purchase',grams,'Compra de rollo',auth.uid());
 when 'lot_state' then
  related:=(p_data->>'lot_id')::uuid;
  if p_data->>'state'='inactive' and private.op_reserved(related)>0 then raise exception 'Libera las reservas antes de desactivar el rollo.' using errcode='PT422'; end if;
  update public.inventory_lots set state=p_data->>'state' where inventory_lots.id=related;
  if not found then raise exception 'Rollo inexistente.' using errcode='22023'; end if;
 when 'inventory_adjust' then
  select * into strict lot from public.inventory_lots where inventory_lots.id=(p_data->>'lot_id')::uuid for update;
  grams:=round((p_data->>'delta_grams')::numeric,3);
  if grams=0 or abs(grams)>999999999 or grams::text in ('NaN','Infinity','-Infinity') or length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Indica gramos y un motivo de al menos 5 caracteres.' using errcode='22023'; end if;
  if lot.on_hand_grams+grams<private.op_reserved(lot.id) then raise exception 'El ajuste dejaría stock negativo o afectaría reservas.' using errcode='PT422'; end if;
  if p_data->>'kind' not in ('waste','adjustment','return') then raise exception 'Movimiento inválido' using errcode='22023'; end if;
  update public.inventory_lots set on_hand_grams=on_hand_grams+grams where inventory_lots.id=lot.id;
  insert into public.inventory_movements(id,lot_id,kind,delta_grams,expense_amount,reason,created_by) values(id,lot.id,p_data->>'kind',grams,greatest(-grams,0)*lot.purchase_cost/lot.initial_grams,p_data->>'reason',auth.uid());
 when 'inventory_reverse' then
  select * into strict movement from public.inventory_movements where inventory_movements.id=(p_data->>'movement_id')::uuid for update;
  if movement.kind not in ('waste','adjustment','return') then raise exception 'Las reservas se liberan desde el pedido y las producciones se revierten desde Producción.' using errcode='PT422'; end if;
  if exists(select 1 from public.inventory_movements where reverses_id=movement.id) then raise exception 'Este movimiento ya fue compensado.' using errcode='PT409'; end if;
  if length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Indica el motivo de la compensación.' using errcode='22023'; end if;
  select * into strict lot from public.inventory_lots where inventory_lots.id=movement.lot_id for update;
  if lot.on_hand_grams-movement.delta_grams<private.op_reserved(lot.id) then raise exception 'No hay stock libre suficiente para compensar.' using errcode='PT422'; end if;
  update public.inventory_lots set on_hand_grams=on_hand_grams-movement.delta_grams where inventory_lots.id=lot.id;
  insert into public.inventory_movements(id,lot_id,kind,delta_grams,expense_amount,reason,reverses_id,created_by) values(id,lot.id,'reversal',-movement.delta_grams,-movement.expense_amount,p_data->>'reason',movement.id,auth.uid());
 when 'quote_create' then
  cost_sum:=0; price_sum:=0;
  if jsonb_array_length(coalesce(p_data->'lines','[]')) not between 1 and 100 then raise exception 'Agrega entre 1 y 100 productos.' using errcode='22023'; end if;
  insert into public.quotes(id,customer_id,description,cost_total,price_total,deposit_percent,notes,created_by) values(id,(p_data->>'customer_id')::uuid,p_data->>'description',0,0,private.op_number(p_data,'deposit_percent',settings.default_deposit_percent),coalesce(p_data->>'notes',''),auth.uid());
  for item in select value from jsonb_array_elements(p_data->'lines') loop
   snapshot:=private.op_cost(item); units:=(item->>'quantity')::integer;
   insert into public.quote_lines(quote_id,product_id,description,quantity,printer_id,estimated_hours,unit_cost,unit_price,cost_snapshot,material_snapshot)
   values(id,nullif(item->>'product_id','')::uuid,item->>'description',units,(item->>'printer_id')::uuid,private.op_number(item,'hours'),(snapshot->>'total')::numeric,(snapshot->>'price')::numeric,snapshot,snapshot->'materials');
   cost_sum:=cost_sum+(snapshot->>'total')::numeric*units; price_sum:=price_sum+(snapshot->>'price')::numeric*units;
  end loop;
  update public.quotes set cost_total=cost_sum,price_total=price_sum where quotes.id=id;
 when 'quote_cancel' then
  update public.quotes set status='cancelled' where quotes.id=(p_data->>'quote_id')::uuid and status='draft';
  if not found then raise exception 'La cotización ya cambió de estado.' using errcode='PT409'; end if;
 when 'order_create' then
  select * into strict q from public.quotes where quotes.id=(p_data->>'quote_id')::uuid for update;
  if q.status<>'draft' then raise exception 'Esta cotización ya fue convertida o cancelada.' using errcode='PT409'; end if;
  insert into public.orders(id,quote_id,customer_id,description,priority,price_total,estimated_cost,deposit_percent,promised_at,notes,reference_url,model_url,created_by)
  values(id,q.id,q.customer_id,q.description,coalesce((p_data->>'priority')::integer,0),q.price_total,q.cost_total,q.deposit_percent,(p_data->>'promised_at')::timestamptz,coalesce(p_data->>'notes',q.notes),coalesce(p_data->>'reference_url',''),coalesce(p_data->>'model_url',''),auth.uid());
  insert into public.order_lines(order_id,product_id,description,quantity,printer_id,estimated_hours,unit_cost,unit_price,cost_snapshot,material_snapshot)
  select id,l.product_id,l.description,l.quantity,l.printer_id,l.estimated_hours,l.unit_cost,l.unit_price,l.cost_snapshot,l.material_snapshot from public.quote_lines l where quote_id=q.id;
  update public.quotes set status='converted' where quotes.id=q.id;
 when 'order_payment' then
  select * into strict ord from public.orders where orders.id=(p_data->>'order_id')::uuid for update;
  amount:=private.op_number(p_data,'amount'); paid:=private.op_paid(ord.id);
  if ord.status='cancelled' or amount<=0 or paid+amount>ord.price_total then raise exception 'El cobro debe ser positivo y no superar el saldo del pedido.' using errcode='PT422'; end if;
  id:=private.op_post_cash(amount,case when paid=0 then 'deposit' else 'order_payment' end,'Cobro pedido K-'||ord.number,p_data,ord.id);
 when 'order_reserve' then
  select * into strict ord from public.orders where orders.id=(p_data->>'order_id')::uuid for update;
  if ord.status in ('delivered','cancelled') then raise exception 'El pedido está cerrado.' using errcode='PT422'; end if;
  perform private.op_reserve(ord.id,(p_data->>'lot_id')::uuid,private.op_number(p_data,'grams'));
 when 'order_update' then
  select * into strict ord from public.orders where orders.id=(p_data->>'order_id')::uuid for update;
  if ord.version<>coalesce((p_data->>'version')::integer,0) then raise exception 'Otro socio cambió el pedido. Actualiza antes de guardar.' using errcode='PT409'; end if;
  if ord.status in ('delivered','cancelled') then raise exception 'El pedido está cerrado.' using errcode='PT422'; end if;
  if nullif(p_data->>'promised_at','') is not null and (p_data->>'promised_at')::timestamptz<>ord.promised_at and not coalesce((p_data->>'confirm_date_change')::boolean,false) then raise exception 'Confirma expresamente el cambio de fecha comprometida.' using errcode='PT422'; end if;
  target_status:=coalesce(p_data->>'status',ord.status);
  if target_status<>ord.status and not (
    (ord.status='pending_deposit' and target_status='confirmed') or
    (ord.status='confirmed' and target_status in ('design','ready')) or
    (ord.status='design' and target_status in ('confirmed','ready')) or
    (ord.status='ready' and target_status in ('design','printing')) or
    (ord.status='printing' and target_status in ('ready','finishing','ready_delivery')) or
    (ord.status='finishing' and target_status in ('printing','ready_delivery')) or
    (ord.status='ready_delivery' and target_status in ('finishing','delivered'))
  ) then raise exception 'Sigue el flujo del pedido: anticipo, confirmación, producción, acabado y entrega.' using errcode='PT422'; end if;
  if target_status='cancelled' then raise exception 'Usa la cancelación con devolución y liberación de reservas.' using errcode='PT422'; end if;
  if target_status='confirmed' and ord.status='pending_deposit' then
   if private.op_paid(ord.id)<round(ord.price_total*private.op_number(p_data,'deposit_percent',ord.deposit_percent)/100,2) and not coalesce((p_data->>'confirm_without_deposit')::boolean,false) then raise exception 'Falta el anticipo. Confirma expresamente si autorizas producir sin él.' using errcode='PT422'; end if;
   for item in select jsonb_build_object('lot_id',m->>'lot_id','grams',sum((m->>'grams')::numeric*l.quantity)) from public.order_lines l cross join lateral jsonb_array_elements(l.material_snapshot) m where l.order_id=ord.id group by m->>'lot_id' loop
    perform private.op_reserve(ord.id,(item->>'lot_id')::uuid,(item->>'grams')::numeric);
   end loop;
  end if;
  if target_status in ('ready_delivery','delivered') and exists(select 1 from public.order_lines l where l.order_id=ord.id and l.quantity>coalesce((select sum(good_units) from public.production_runs where order_line_id=l.id and reversed_at is null),0)) then raise exception 'Registra la producción real de todas las unidades antes de entregar.' using errcode='PT422'; end if;
  if target_status='delivered' and private.op_paid(ord.id)<ord.price_total and not coalesce((p_data->>'confirm_unpaid_delivery')::boolean,false) then raise exception 'Hay saldo pendiente. Autoriza expresamente la entrega a crédito.' using errcode='PT422'; end if;
  update public.orders set status=target_status,deposit_percent=private.op_number(p_data,'deposit_percent',ord.deposit_percent),priority=coalesce((p_data->>'priority')::integer,priority),queue_position=coalesce((p_data->>'queue_position')::integer,queue_position),promised_at=coalesce(nullif(p_data->>'promised_at','')::timestamptz,promised_at),notes=coalesce(p_data->>'notes',notes),delivered_at=case when target_status='delivered' then now() else null end,version=version+1 where orders.id=ord.id;
  if target_status='delivered' then for item in select jsonb_build_object('lot_id',lot_id) from public.material_reservations where order_id=ord.id and grams>0 loop perform private.op_reserve(ord.id,(item->>'lot_id')::uuid,0); end loop; end if;
 when 'order_cancel' then
  select * into strict ord from public.orders where orders.id=(p_data->>'order_id')::uuid for update;
  if ord.status in ('delivered','cancelled') then raise exception 'El pedido ya está cerrado.' using errcode='PT409'; end if;
  paid:=private.op_paid(ord.id);
  if paid>0 and not coalesce((p_data->>'refund_confirmed')::boolean,false) then raise exception 'Confirma que devolverás el dinero recibido antes de cancelar.' using errcode='PT422'; end if;
  perform private.op_post_cash(-paid,'refund','Devolución pedido K-'||ord.number,p_data,ord.id);
  for item in select jsonb_build_object('lot_id',lot_id) from public.material_reservations where order_id=ord.id and grams>0 loop perform private.op_reserve(ord.id,(item->>'lot_id')::uuid,0); end loop;
  update public.orders set status='cancelled',cancelled_at=now(),notes=notes||E'\nCancelación: '||coalesce(p_data->>'reason',''),version=version+1 where orders.id=ord.id;
 when 'production_create' then
  select * into strict line from public.order_lines where order_lines.id=(p_data->>'line_id')::uuid;
  select * into strict ord from public.orders where orders.id=line.order_id for update;
  if ord.status in ('pending_deposit','delivered','cancelled') then raise exception 'Confirma el pedido antes de producir. Los pedidos cerrados no admiten producción.' using errcode='PT422'; end if;
  units:=(p_data->>'good_units')::integer; hours:=round(private.op_number(p_data,'hours'),3);
  if units<0 or units+coalesce((select sum(good_units) from public.production_runs where order_line_id=line.id and reversed_at is null),0)>line.quantity then raise exception 'La producción excede las unidades pedidas.' using errcode='PT422'; end if;
  select * into strict printer from public.printers where printers.id=line.printer_id for update;
  if printer.status in ('maintenance','inactive') then raise exception 'La impresora no está disponible.' using errcode='PT422'; end if;
  snapshot:=private.op_cost(jsonb_build_object('printer_id',printer.id,'hours',hours,'materials',p_data->'materials','labor_hours',private.op_number(p_data,'labor_hours'),'painting_hours',private.op_number(p_data,'painting_hours'),'painting_materials',private.op_number(p_data,'painting_materials'),'supplies_cost',private.op_number(p_data,'supplies_cost'),'customization_cost',private.op_number(p_data,'customization_cost'),'packaging_cost',private.op_number(p_data,'packaging_cost'),'other_cost',private.op_number(p_data,'other_cost')));
  insert into public.production_runs(id,order_line_id,printer_id,good_units,actual_hours,material_cost,depreciation_cost,energy_cost,other_cost,cost_total,details,notes,created_by)
  values(id,line.id,printer.id,units,hours,(snapshot->>'material_cost')::numeric,(snapshot->>'depreciation_cost')::numeric,(snapshot->>'energy_cost')::numeric,(snapshot->>'total')::numeric-(snapshot->>'material_cost')::numeric-(snapshot->>'depreciation_cost')::numeric-(snapshot->>'energy_cost')::numeric,(snapshot->>'total')::numeric,snapshot,coalesce(p_data->>'notes',''),auth.uid());
  for item in select value from jsonb_array_elements(snapshot->'materials') loop
   grams:=(item->>'grams')::numeric;
   select * into strict lot from public.inventory_lots where inventory_lots.id=(item->>'lot_id')::uuid for update;
   select coalesce(sum(r.grams),0) into old_grams from public.material_reservations r where order_id=ord.id and lot_id=lot.id;
   if lot.on_hand_grams-private.op_reserved(lot.id)+old_grams<grams then raise exception 'Stock insuficiente para el consumo real; se respetan las reservas de otros pedidos.' using errcode='PT422'; end if;
   perform private.op_reserve(ord.id,lot.id,greatest(old_grams-grams,0));
   update public.inventory_lots set on_hand_grams=on_hand_grams-grams where inventory_lots.id=lot.id;
   insert into public.inventory_movements(lot_id,order_id,production_id,kind,delta_grams,reason,created_by) values(lot.id,ord.id,id,'production',-grams,'Producción real K-'||ord.number,auth.uid());
  end loop;
  update public.printers set accumulated_hours=accumulated_hours+hours,version=version+1 where printers.id=printer.id;
  update public.orders set status='printing',version=version+1 where orders.id=ord.id;
 when 'production_reverse' then
  select * into strict run from public.production_runs where production_runs.id=(p_data->>'production_id')::uuid for update;
  select * into strict line from public.order_lines where order_lines.id=run.order_line_id;
  select * into strict ord from public.orders where orders.id=line.order_id for update;
  if run.reversed_at is not null or ord.status in ('delivered','cancelled') then raise exception 'La producción ya fue compensada o el pedido está cerrado.' using errcode='PT409'; end if;
  if length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Explica el motivo de la compensación.' using errcode='22023'; end if;
  for movement in select * from public.inventory_movements where production_id=run.id and kind='production' loop
   update public.inventory_lots set on_hand_grams=on_hand_grams-movement.delta_grams where inventory_lots.id=movement.lot_id;
   insert into public.inventory_movements(lot_id,order_id,production_id,kind,delta_grams,reason,reverses_id,created_by) values(movement.lot_id,ord.id,run.id,'reversal',-movement.delta_grams,p_data->>'reason',movement.id,auth.uid());
  end loop;
  update public.production_runs set reversed_at=now() where production_runs.id=run.id;
  update public.printers set accumulated_hours=accumulated_hours-run.actual_hours,version=version+1 where printers.id=run.printer_id;
  update public.orders set version=version+1,status='ready' where orders.id=ord.id;
 when 'cash_create' then
  amount:=private.op_number(p_data,'amount'); target_status:=p_data->>'category';
  if amount<=0 then raise exception 'El valor debe ser positivo.' using errcode='22023'; end if;
  if target_status not in ('capital','other_income','direct_sale','expense','transport','shipping','energy','supplies','parts') then raise exception 'Categoría inválida. Registra cobros, compras, deudas y socios desde su operación específica.' using errcode='22023'; end if;
  partner:=nullif(p_data->>'partner_id','')::uuid;
  if target_status in ('capital','other_income','direct_sale') then
   cost:=case when target_status='capital' then 0 when target_status='direct_sale' then amount-private.op_number(p_data,'direct_cost') else amount end;
   id:=private.op_post_cash(amount,target_status,p_data->>'description',p_data,null,null,null,partner,null,cost);
  else id:=private.op_post_cash(-amount,target_status,p_data->>'description',p_data,null,null,null,null,null,case when coalesce((p_data->>'included_in_production')::boolean,false) then 0 else -amount end); end if;
 when 'cash_reverse' then
  select * into strict cash from public.cash_entries where cash_entries.id=(p_data->>'cash_id')::uuid for update;
  if cash.category not in ('capital','other_income','direct_sale','expense','transport','shipping','energy','supplies','parts','deposit','order_payment') or cash.reverses_id is not null then raise exception 'Esta operación se corrige desde su módulo de origen.' using errcode='PT422'; end if;
  if exists(select 1 from public.cash_entries where reverses_id=cash.id) then raise exception 'El movimiento ya fue compensado.' using errcode='PT409'; end if;
  if length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Explica el motivo de la compensación.' using errcode='22023'; end if;
  if cash.order_id is not null and private.op_paid(cash.order_id)<cash.amount then raise exception 'El cobro ya fue devuelto.' using errcode='PT422'; end if;
  id:=private.op_post_cash(-cash.amount,'reversal',p_data->>'reason',p_data,cash.order_id,null,null,cash.partner_id,null,-cash.profit_effect,cash.id);
 when 'purchase_create' then id:=private.op_purchase(p_data,'operating',private.op_number(p_data,'total'));
 when 'purchase_void' then
  select * into strict purchase from public.purchases where purchases.id=(p_data->>'purchase_id')::uuid for update;
  if purchase.voided_at is not null then raise exception 'La compra ya fue compensada.' using errcode='PT409'; end if;
  if length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Explica el motivo de la devolución.' using errcode='22023'; end if;
  paid:=purchase.paid_initial+coalesce((select sum(v.principal_paid) from public.debt_payments v join public.debts d on d.id=v.debt_id where d.purchase_id=purchase.id),0);
  if paid>0 and not coalesce((p_data->>'refund_confirmed')::boolean,false) then raise exception 'Confirma el reembolso real recibido del proveedor.' using errcode='PT422'; end if;
  if purchase.lot_id is not null then
   select * into strict lot from public.inventory_lots where inventory_lots.id=purchase.lot_id for update;
   if lot.on_hand_grams<>lot.initial_grams or private.op_reserved(lot.id)>0 then raise exception 'Solo puedes devolver un rollo completo, sin consumir ni reservar.' using errcode='PT422'; end if;
   select * into strict movement from public.inventory_movements where lot_id=lot.id and kind='purchase';
   update public.inventory_lots set on_hand_grams=0,state='inactive' where inventory_lots.id=lot.id;
   insert into public.inventory_movements(lot_id,kind,delta_grams,reason,reverses_id,created_by) values(lot.id,'reversal',-lot.initial_grams,p_data->>'reason',movement.id,auth.uid());
  end if;
  if purchase.printer_id is not null then
   select * into strict printer from public.printers where printers.id=purchase.printer_id for update;
   if printer.accumulated_hours>printer.baseline_hours or exists(select 1 from public.order_lines where printer_id=printer.id) then raise exception 'La impresora ya tiene producción o pedidos; revisa su retiro como activo, no como devolución inicial.' using errcode='PT422'; end if;
   update public.printers set status='inactive',version=version+1 where printers.id=printer.id;
  end if;
  perform private.op_post_cash(paid,'purchase_refund',p_data->>'reason',p_data,null,null,purchase.id);
  update public.purchases set voided_at=now() where purchases.id=purchase.id;
  update public.debts set voided_at=now() where purchase_id=purchase.id;
 when 'loan_create' then
  amount:=private.op_number(p_data,'amount'); id:=private.op_create_debt(p_data,amount);
  perform private.op_post_cash(amount,'loan',p_data->>'description',p_data,null,id);
 when 'debt_pay' then
  related:=(p_data->>'debt_id')::uuid;
  perform 1 from public.debts where debts.id=related for update;
  if not found then raise exception 'Deuda inexistente.' using errcode='22023'; end if;
  principal:=private.op_number(p_data,'principal'); interest:=private.op_number(p_data,'interest');
  selected_installment:=nullif(p_data->>'installment_id','')::uuid;
  if selected_installment is null then select i.id into selected_installment from public.debt_installments i where i.debt_id=related and (i.principal_due>coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0) or i.interest_due>coalesce((select sum(interest_paid) from public.debt_payments where installment_id=i.id),0)) order by i.number limit 1; end if;
  if principal>private.op_debt_balance(related) or principal+interest<=0 then raise exception 'El pago supera el capital pendiente o no es positivo.' using errcode='PT422'; end if;
  if selected_installment is null or not exists(select 1 from public.debt_installments where debt_installments.id=selected_installment and debt_id=related) then raise exception 'La cuota no corresponde a esta deuda o ya está pagada.' using errcode='22023'; end if;
  if exists(select 1 from public.debts where debts.id=related and voided_at is not null) then raise exception 'La deuda fue anulada con su compra.' using errcode='PT422'; end if;
  if principal>(select i.principal_due-coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0) from public.debt_installments i where i.id=selected_installment) then raise exception 'El capital excede el saldo de la cuota seleccionada. Abona las cuotas por separado.' using errcode='PT422'; end if;
  insert into public.debt_payments(id,debt_id,installment_id,principal_paid,interest_paid,paid_on,created_by) values(id,related,selected_installment,principal,interest,coalesce(nullif(p_data->>'date','')::date,private.op_today()),auth.uid());
  perform private.op_post_cash(-principal,'debt_principal','Abono a capital',p_data,null,related);
  perform private.op_post_cash(-interest,'interest','Intereses de financiación',p_data,null,related,null,null,null,-interest);
 when 'partner_advance' then
  partner:=(p_data->>'partner_id')::uuid; amount:=private.op_number(p_data,'amount');
  related:=private.op_post_cash(-amount,'partner_advance',p_data->>'description',p_data,null,null,null,partner);
  insert into public.partner_advances(id,partner_id,amount,cash_entry_id) values(id,partner,amount,related);
 when 'partner_withdraw' then
  partner:=(p_data->>'partner_id')::uuid; amount:=private.op_number(p_data,'amount');
  available:=private.op_partner_balance(partner)-private.op_pending_advances(partner);
  if amount>available and (not coalesce((p_data->>'authorize_overdraft')::boolean,false) or length(trim(coalesce(p_data->>'authorization_reason','')))<10) then raise exception 'El retiro supera la utilidad disponible del socio. Requiere autorización explícita y motivo.' using errcode='PT422'; end if;
  related:=private.op_post_cash(-amount,'partner_withdrawal',p_data->>'description',p_data,null,null,null,partner);
  insert into public.partner_withdrawals(id,partner_id,amount,cash_entry_id,authorized_overdraft,authorization_reason) values(id,partner,amount,related,amount>available,coalesce(p_data->>'authorization_reason',''));
 when 'settlement_create','reserve_release' then
  if coalesce(nullif(p_data->>'period_end','')::date,private.op_today())>private.op_today() then raise exception 'No puedes liquidar utilidades con una fecha futura.' using errcode='22023'; end if;
  if coalesce(nullif(p_data->>'period_end','')::date,private.op_today())<coalesce((select max(period_end) from public.settlements),'1900-01-01'::date) then raise exception 'La fecha no puede ser anterior a la última liquidación.' using errcode='PT422'; end if;
  reserved:=private.op_number(p_data,'reserve_amount');
  if p_action='reserve_release' then
   amount:=private.op_number(p_data,'amount');
   available:=private.op_realized(coalesce(nullif(p_data->>'period_end','')::date,private.op_today()))-coalesce((select sum(profit_recognized) from public.settlements),0);
   if amount<=0 or amount>greatest(0,coalesce((select sum(s.reserved-s.reserve_release) from public.settlements s),0)+least(available,0)) then raise exception 'Reserva empresarial insuficiente después de cubrir pérdidas no liquidadas.' using errcode='PT422'; end if;
   distributed:=trunc(amount/0.02)*0.02; reserved:=0; cost:=0;
   if distributed<=0 then raise exception 'La liberación mínima es de 0,02 COP para repartir mitades exactas.' using errcode='22023'; end if;
  else
   available:=private.op_realized(coalesce(nullif(p_data->>'period_end','')::date,private.op_today()))-coalesce((select sum(profit_recognized) from public.settlements),0);
   if available<=0 or reserved>available then raise exception 'No hay utilidad realizada sin liquidar suficiente.' using errcode='PT422'; end if;
   distributed:=trunc((available-reserved)/0.02)*0.02; reserved:=available-distributed; cost:=available; amount:=0;
  end if;
  insert into public.settlements(id,period_start,period_end,profit_recognized,reserved,distributed,reserve_release,notes,created_by) values(id,coalesce((select max(period_end) from public.settlements),coalesce(nullif(p_data->>'period_start','')::date,private.op_today())),coalesce(nullif(p_data->>'period_end','')::date,private.op_today()),cost,reserved,distributed,case when p_action='reserve_release' then distributed else 0 end,coalesce(p_data->>'notes',''),auth.uid());
  for partner in select partners.id from public.partners order by code loop
   insert into public.partner_allocations(settlement_id,partner_id,amount) values(id,partner,distributed/2) returning partner_allocations.id into allocation;
   available:=distributed/2;
   for advance in select a.id,a.amount-coalesce((select sum(c.amount) from public.advance_compensations c where c.advance_id=a.id),0) as pending from public.partner_advances a where a.partner_id=partner order by a.created_at,a.id loop
    paid:=least(available,advance.pending);
    if paid>0 then insert into public.advance_compensations(advance_id,allocation_id,amount) values(advance.id,allocation,paid); available:=available-paid; end if;
   end loop;
  end loop;
 when 'file_attach' then
  if not exists(select 1 from storage.objects where bucket_id='kapa-order-files' and name=p_data->>'object_path') or split_part(p_data->>'object_path','/',1)<>p_data->>'order_id' then raise exception 'Sube primero un archivo al pedido correspondiente.' using errcode='22023'; end if;
  insert into public.order_files(id,order_id,object_path,name,created_by) values(id,(p_data->>'order_id')::uuid,p_data->>'object_path',p_data->>'name',auth.uid());
 else raise exception 'Operación desconocida.' using errcode='22023';
 end case;
 result:=jsonb_build_object('id',id,'action',p_action);
 insert into private.mutation_requests(request_id,actor_id,operation,payload,response) values(p_request_id,auth.uid(),p_action,p_data,result);
 return result;
end $$;

revoke all on function public.business_operate(text,jsonb,uuid) from public,anon;
grant execute on function public.business_operate(text,jsonb,uuid) to authenticated;

create function private.op_lots() returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by purchased_on desc,id),'[]') from (
 select l.*,m.brand,m.kind,m.color,private.op_reserved(l.id) as reserved_grams,l.on_hand_grams-private.op_reserved(l.id) as available_grams,
 coalesce(s.name,'Sin proveedor') as supplier_name,
 (select sum(d.principal-coalesce((select sum(principal_paid) from public.debt_payments where debt_id=d.id),0)) from public.debts d join public.purchases p on p.id=d.purchase_id where p.lot_id=l.id) as debt_balance
 from public.inventory_lots l join public.materials m on m.id=l.material_id left join public.suppliers s on s.id=l.supplier_id order by l.purchased_on desc limit 1000
 ) x
$$;
create function private.op_partners() returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by code),'[]') from (
 select p.*,private.op_partner_balance(p.id) as balance,private.op_pending_advances(p.id) as pending_advances,
 coalesce((select sum(amount) from public.partner_allocations where partner_id=p.id),0) as allocated,
 coalesce((select sum(amount) from public.partner_advances where partner_id=p.id),0) as advances,
 coalesce((select sum(amount) from public.partner_withdrawals where partner_id=p.id),0) as withdrawals,
 coalesce((select sum(c.amount) from public.advance_compensations c join public.partner_advances a on a.id=c.advance_id where a.partner_id=p.id),0) as compensated,
 coalesce((select sum(amount) from public.cash_entries where partner_id=p.id and category='capital'),0) as contributions
 from public.partners p) x
$$;
create function private.op_summary(f date,t date) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
 'cash',private.op_cash_balance(),
 'sales_collected',coalesce((select sum(c.amount) from public.cash_entries c left join public.cash_entries orig on orig.id=c.reverses_id where c.occurred_on between f and t and (c.order_id is not null or c.category='direct_sale' or orig.category='direct_sale')),0),
 'receivables',coalesce((select sum(greatest(price_total-private.op_paid(id),0)) from public.orders where status<>'cancelled'),0),
 'realized_profit',private.op_realized(t)-private.op_realized(f-1),
 'cumulative_profit',private.op_realized(private.op_today()),
 'unsettled_profit',private.op_realized(private.op_today())-coalesce((select sum(profit_recognized) from public.settlements),0),
 'business_reserve',coalesce((select sum(reserved-reserve_release) from public.settlements),0),
 'estimated_profit',coalesce((select sum(price_total-greatest(estimated_cost,private.op_production_cost(id))) from public.orders where status not in ('delivered','cancelled')),0),
 'operating_expenses',coalesce((select -sum(c.profit_effect) from public.cash_entries c left join public.cash_entries orig on orig.id=c.reverses_id where coalesce(orig.category,c.category) not in ('other_income','direct_sale','capital') and c.occurred_on between f and t),0)+coalesce((select sum(expense_amount) from public.purchases where category='operating' and voided_at is null and purchased_on between f and t),0),
 'debt_balance',coalesce((select sum(private.op_debt_balance(id)) from public.debts),0),
 'active_orders',(select count(*) from public.orders where status not in ('delivered','cancelled')),
 'ready_orders',(select count(*) from public.orders where status='ready_delivery'),
 'overdue_orders',(select count(*) from public.orders where status not in ('delivered','cancelled') and promised_at<now()),
 'completed_orders',(select count(*) from public.orders where status='delivered' and (delivered_at at time zone 'America/Bogota')::date between f and t),
 'inventory_value',coalesce((select sum((on_hand_grams-private.op_reserved(id))*cost_per_gram) from public.inventory_lots where state='active'),0),
 'low_stock',(select count(*) from public.inventory_lots,public.business_settings where state='active' and on_hand_grams-private.op_reserved(id)<low_stock_grams),
 'income',coalesce((select sum(amount) from public.cash_entries where amount>0 and occurred_on between f and t),0),
 'outgoings',coalesce((select -sum(amount) from public.cash_entries where amount<0 and occurred_on between f and t),0)
 )
$$;

create function public.business_read(p_section text,p_search text default '',p_page integer default 0,p_from date default date_trunc('month',current_date)::date,p_to date default current_date,p_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; result jsonb; total bigint; off integer:=p_page*50; begin
 if not private.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_page is null or p_page<0 or p_page>200000 or p_from is null or p_to is null or p_from>p_to or p_to-p_from>3660 then raise exception 'Filtros inválidos. Usa un periodo de hasta diez años.' using errcode='22023'; end if;
 case p_section
 when 'catalog' then
  return jsonb_build_object('customers',coalesce((select jsonb_agg(to_jsonb(c)) from (select id,name,phone,whatsapp from public.customers where active order by name limit 1000)c),'[]'),
   'products',coalesce((select jsonb_agg(to_jsonb(c)) from (select * from public.products where active order by name limit 1000)c),'[]'),
   'suppliers',coalesce((select jsonb_agg(to_jsonb(c)) from (select * from public.suppliers order by name limit 1000)c),'[]'),
   'printers',coalesce((select jsonb_agg(to_jsonb(c)) from (select * from public.printers order by name limit 1000)c),'[]'),
   'lots',private.op_lots(),'partners',private.op_partners(),
   'catalog_truncated',(select count(*)>1000 from public.customers where active) or (select count(*)>1000 from public.inventory_lots));
 when 'inventory' then
  select count(*) into total from public.inventory_lots l join public.materials m on m.id=l.material_id where concat_ws(' ',m.brand,m.kind,m.color) ilike '%'||p_search||'%';
  select coalesce(jsonb_agg(x),'[]') into rows from (select to_jsonb(l)||jsonb_build_object('brand',m.brand,'kind',m.kind,'color',m.color,'reserved_grams',private.op_reserved(l.id),'available_grams',l.on_hand_grams-private.op_reserved(l.id),'supplier_name',s.name) x from public.inventory_lots l join public.materials m on m.id=l.material_id left join public.suppliers s on s.id=l.supplier_id where concat_ws(' ',m.brand,m.kind,m.color) ilike '%'||p_search||'%' order by l.created_at desc,l.id limit 50 offset off) q;
 when 'printers' then
  select count(*) into total from public.printers where concat_ws(' ',name,model) ilike '%'||p_search||'%';
  select coalesce(jsonb_agg(x),'[]') into rows from (select to_jsonb(p)||jsonb_build_object('depreciation_rate',p.acquisition_cost/nullif(p.useful_hours,0),'maintenance',coalesce((select jsonb_agg(to_jsonb(m)) from (select * from public.maintenance_records where printer_id=p.id order by performed_on desc limit 20)m),'[]'),'debt_balance',coalesce((select sum(private.op_debt_balance(d.id)) from public.debts d join public.purchases b on b.id=d.purchase_id where b.printer_id=p.id),0)) x from public.printers p where concat_ws(' ',name,model) ilike '%'||p_search||'%' order by p.created_at,p.id limit 50 offset off)q;
 when 'customers' then
  select count(*) into total from public.customers where concat_ws(' ',name,phone,city) ilike '%'||p_search||'%';
  select coalesce(jsonb_agg(x),'[]') into rows from (select to_jsonb(c)||jsonb_build_object('order_count',(select count(*) from public.orders where customer_id=c.id and status<>'cancelled'),'total_purchased',coalesce((select sum(price_total) from public.orders where customer_id=c.id and status='delivered'),0),'balance',coalesce((select sum(greatest(price_total-private.op_paid(id),0)) from public.orders where customer_id=c.id and status<>'cancelled'),0),'last_purchase',(select max(delivered_at) from public.orders where customer_id=c.id and status='delivered'),'orders',coalesce((select jsonb_agg(to_jsonb(o)) from (select id,number,description,status,price_total,private.op_paid(id) as paid,promised_at from public.orders where customer_id=c.id order by created_at desc limit 20)o),'[]'),'favorites',coalesce((select jsonb_agg(to_jsonb(a)) from (select l.description,sum(l.quantity) as quantity from public.order_lines l join public.orders o on o.id=l.order_id where o.customer_id=c.id and o.status='delivered' group by l.description order by sum(l.quantity) desc limit 5)a),'[]')) x from public.customers c where concat_ws(' ',name,phone,city) ilike '%'||p_search||'%' order by c.name,c.id limit 50 offset off)q;
 when 'quotes' then
  select count(*) into total from public.quotes q join public.customers c on c.id=q.customer_id where concat_ws(' ',q.description,c.name,q.number) ilike '%'||p_search||'%';
  select coalesce(jsonb_agg(x),'[]') into rows from (select to_jsonb(q)||jsonb_build_object('customer_name',c.name,'lines',(select jsonb_agg(to_jsonb(l)) from public.quote_lines l where quote_id=q.id)) x from public.quotes q join public.customers c on c.id=q.customer_id where concat_ws(' ',q.description,c.name,q.number) ilike '%'||p_search||'%' order by q.created_at desc,q.id limit 50 offset off)a;
 when 'orders','calendar' then
  select count(*) into total from public.orders o join public.customers c on c.id=o.customer_id where (p_id is null or o.id=p_id) and (p_section<>'calendar' or (o.promised_at at time zone 'America/Bogota')::date between p_from and p_to) and concat_ws(' ',o.description,c.name,o.number,o.status) ilike '%'||p_search||'%';
  select coalesce(jsonb_agg(x),'[]') into rows from (select to_jsonb(o)||jsonb_build_object('customer_name',c.name,'phone',c.phone,'whatsapp',c.whatsapp,'paid',private.op_paid(o.id),'balance',o.price_total-private.op_paid(o.id),'actual_cost',private.op_production_cost(o.id),
   'lines',(select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('produced',coalesce((select sum(good_units) from public.production_runs where order_line_id=l.id and reversed_at is null),0))), '[]') from public.order_lines l where order_id=o.id),
   'reservations',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.material_reservations r where order_id=o.id),
   'productions',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]') from public.production_runs r join public.order_lines l on l.id=r.order_line_id where l.order_id=o.id),
   'payments',(select coalesce(jsonb_agg(to_jsonb(v) order by v.created_at desc),'[]') from public.cash_entries v where order_id=o.id),
   'files',(select coalesce(jsonb_agg(to_jsonb(v)),'[]') from public.order_files v where order_id=o.id)) x
   from public.orders o join public.customers c on c.id=o.customer_id where (p_id is null or o.id=p_id) and (p_section<>'calendar' or (o.promised_at at time zone 'America/Bogota')::date between p_from and p_to) and concat_ws(' ',o.description,c.name,o.number,o.status) ilike '%'||p_search||'%' order by o.priority desc,o.queue_position,o.promised_at,o.id limit 50 offset off)a;
 when 'queue' then
  select count(*) into total from public.order_lines l join public.orders o on o.id=l.order_id where o.status not in ('delivered','cancelled');
  select coalesce(jsonb_agg(x),'[]') into rows from (select to_jsonb(z)||jsonb_build_object('estimated_finish',now()+z.running_hours*interval '1 hour') x from (
   select o.id as order_id,o.number,o.description,o.priority,o.queue_position,o.promised_at,p.name as printer_name,p.status as printer_status,l.printer_id,
   greatest(l.quantity-coalesce((select sum(good_units) from public.production_runs where order_line_id=l.id and reversed_at is null),0),0)*l.estimated_hours as remaining_hours,
   sum(greatest(l.quantity-coalesce((select sum(good_units) from public.production_runs where order_line_id=l.id and reversed_at is null),0),0)*l.estimated_hours) over(partition by l.printer_id order by o.priority desc,o.queue_position,o.promised_at,o.id,l.id) as running_hours
   from public.order_lines l join public.orders o on o.id=l.order_id join public.printers p on p.id=l.printer_id where o.status not in ('delivered','cancelled')
  )z order by priority desc,queue_position,promised_at limit 50 offset off)a;
 when 'cash' then
  select count(*) into total from public.cash_entries where occurred_on between p_from and p_to and concat_ws(' ',description,category) ilike '%'||p_search||'%';
  select coalesce(jsonb_agg(to_jsonb(c)),'[]') into rows from (select c.*,u.display_name as responsible,coalesce((select id::text from public.cash_entries where reverses_id=c.id),'') as reversed_by from public.cash_entries c left join public.user_profiles u on u.user_id=c.created_by where occurred_on between p_from and p_to and concat_ws(' ',description,category) ilike '%'||p_search||'%' order by occurred_on desc,c.created_at desc,c.id limit 50 offset off)c;
 when 'debts' then
  select count(*) into total from public.debts d where description ilike '%'||p_search||'%';
  select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('balance',private.op_debt_balance(d.id),'supplier_name',s.name,
   'installments',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('principal_paid',coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0),'interest_paid',coalesce((select sum(interest_paid) from public.debt_payments where installment_id=i.id),0)) order by i.number) from public.debt_installments i where i.debt_id=d.id),'[]'),
   'payments',coalesce((select jsonb_agg(to_jsonb(v) order by paid_on desc) from public.debt_payments v where debt_id=d.id),'[]'))),'[]') into rows from (select * from public.debts where description ilike '%'||p_search||'%' order by created_at desc,id limit 50 offset off)d left join public.suppliers s on s.id=d.supplier_id;
 when 'purchases' then
  select count(*) into total from public.purchases where purchased_on between p_from and p_to and description ilike '%'||p_search||'%';
  select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('supplier_name',s.name,'debt_balance',coalesce((select sum(private.op_debt_balance(id)) from public.debts where purchase_id=p.id),0))),'[]') into rows from (select * from public.purchases where purchased_on between p_from and p_to and description ilike '%'||p_search||'%' order by purchased_on desc,id limit 50 offset off)p left join public.suppliers s on s.id=p.supplier_id;
 when 'settlements' then
  select count(*) into total from public.settlements;
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into rows from (select * from public.settlements order by period_end desc,created_at desc limit 50 offset off)s;
 when 'inventory_history' then
  select count(*) into total from public.inventory_movements where (p_id is null or lot_id=p_id) and (created_at at time zone 'America/Bogota')::date between p_from and p_to;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (select i.*,m.brand,m.kind,m.color,u.display_name as responsible,(select id::text from public.inventory_movements where reverses_id=i.id) as reversed_by from public.inventory_movements i join public.inventory_lots l on l.id=i.lot_id join public.materials m on m.id=l.material_id left join public.user_profiles u on u.user_id=i.created_by where (p_id is null or i.lot_id=p_id) and (i.created_at at time zone 'America/Bogota')::date between p_from and p_to order by i.created_at desc,i.id limit 50 offset off)x;
 when 'dashboard' then
  return jsonb_build_object('summary',private.op_summary(p_from,p_to),'partners',private.op_partners(),
   'monthly',coalesce((select jsonb_agg(to_jsonb(m) order by month) from (
    select to_char(d,'YYYY-MM') as month,
     coalesce((select sum(amount) from public.cash_entries where amount>0 and occurred_on>=greatest(d::date,p_from) and occurred_on<=least((d+interval '1 month'-interval '1 day')::date,p_to)),0) as income,
     coalesce((select -sum(amount) from public.cash_entries where amount<0 and occurred_on>=greatest(d::date,p_from) and occurred_on<=least((d+interval '1 month'-interval '1 day')::date,p_to)),0) as expenses,
     coalesce((select sum(c.amount) from public.cash_entries c left join public.cash_entries orig on orig.id=c.reverses_id where (c.order_id is not null or c.category='direct_sale' or orig.category='direct_sale') and c.occurred_on>=greatest(d::date,p_from) and c.occurred_on<=least((d+interval '1 month'-interval '1 day')::date,p_to)),0) as sales,
     private.op_realized(least((d+interval '1 month'-interval '1 day')::date,p_to))-private.op_realized(greatest(d::date,p_from)-1) as profit,
     (select count(*) from public.orders where (created_at at time zone 'America/Bogota')::date between greatest(d::date,p_from) and least((d+interval '1 month'-interval '1 day')::date,p_to)) as orders
    from generate_series(date_trunc('month',p_from),date_trunc('month',p_to),interval '1 month') d
   )m),'[]'),
   'top_products',coalesce((select jsonb_agg(to_jsonb(m)) from (select l.description as name,sum(l.quantity) as quantity,sum(l.quantity*l.unit_price) as sales from public.order_lines l join public.orders o on o.id=l.order_id where o.status='delivered' and (o.delivered_at at time zone 'America/Bogota')::date between p_from and p_to group by l.description order by sum(l.quantity) desc limit 8)m),'[]'),
   'consumption',coalesce((select jsonb_agg(to_jsonb(m)) from (select concat_ws(' ',m.kind,m.color) as name,-sum(i.delta_grams) as grams from public.inventory_movements i join public.inventory_lots l on l.id=i.lot_id join public.materials m on m.id=l.material_id where i.production_id is not null and (i.created_at at time zone 'America/Bogota')::date between p_from and p_to group by m.kind,m.color order by -sum(i.delta_grams) desc limit 10)m),'[]'),
   'alerts',jsonb_build_object('stock',private.op_lots(),'orders',coalesce((select jsonb_agg(to_jsonb(o)) from (select id,number,description,promised_at,status from public.orders where status not in ('delivered','cancelled') order by promised_at limit 10)o),'[]'),
   'debts',coalesce((select jsonb_agg(to_jsonb(d)) from (select i.*,b.description from public.debt_installments i join public.debts b on b.id=i.debt_id where private.op_debt_balance(b.id)>0 and i.principal_due>coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0) order by i.due_on limit 10)d),'[]'),
   'maintenance',coalesce((select jsonb_agg(to_jsonb(d)) from (select distinct on (printer_id) printer_id,p.name,next_due from public.maintenance_records m join public.printers p on p.id=m.printer_id where next_due is not null order by printer_id,performed_on desc,m.created_at desc)d),'[]')));
 else raise exception 'Consulta desconocida' using errcode='22023';
 end case;
 result:=jsonb_build_object('rows',coalesce(rows,'[]'),'total',total,'page',p_page);
 if p_section in ('cash','debts','purchases','settlements') then result:=result||jsonb_build_object('summary',private.op_summary(p_from,p_to),'partners',private.op_partners()); end if;
 return result;
end $$;

create function public.preview_production_cost(p_data jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin if not private.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if; return private.op_cost(p_data); end $$;
revoke all on function public.business_read(text,text,integer,date,date,uuid),public.preview_production_cost(jsonb) from public,anon;
grant execute on function public.business_read(text,text,integer,date,date,uuid),public.preview_production_cost(jsonb) to authenticated;

-- Private helpers may only be reached through the checked entry points.
do $$ declare f record; begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'op_%' loop execute format('revoke all on function %s from public, anon, authenticated',f.signature); end loop; end $$;

-- Files remain private. Only active administrators can upload and request signed download links.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('kapa-order-files','kapa-order-files',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','model/stl','application/octet-stream','application/vnd.ms-package.3dmanufacturing-3dmodel+xml','application/zip']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy kapa_files_read on storage.objects for select to authenticated using(bucket_id='kapa-order-files' and (select private.is_admin()));
create policy kapa_files_upload on storage.objects for insert to authenticated with check(bucket_id='kapa-order-files' and (select private.is_admin()) and exists(select 1 from public.orders where id::text=split_part(name,'/',1)));
create policy kapa_files_remove on storage.objects for delete to authenticated using(bucket_id='kapa-order-files' and (select private.is_admin()) and not exists(select 1 from public.order_files where object_path=name));
notify pgrst,'reload schema';

create function public.preview_order_priority(p_order_id uuid,p_priority integer,p_position integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 if not private.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_priority is null or p_priority not between 0 and 2 or p_position is null then raise exception 'Prioridad o posición inválida.' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by new_priority desc,new_position,promised_at),'[]') into result from (
  select o.id as order_id,o.number,o.description,o.priority,o.queue_position,o.promised_at,p.name as printer_name,p.status as printer_status,l.printer_id,
  case when o.id=p_order_id then p_priority else o.priority end as new_priority,case when o.id=p_order_id then p_position else o.queue_position end as new_position,
  greatest(l.quantity-coalesce((select sum(good_units) from public.production_runs where order_line_id=l.id and reversed_at is null),0),0)*l.estimated_hours as remaining_hours,
  now()+sum(greatest(l.quantity-coalesce((select sum(good_units) from public.production_runs where order_line_id=l.id and reversed_at is null),0),0)*l.estimated_hours) over(partition by l.printer_id order by case when o.id=p_order_id then p_priority else o.priority end desc,case when o.id=p_order_id then p_position else o.queue_position end,o.promised_at,o.id,l.id)*interval '1 hour' as estimated_finish,
  now()+sum(greatest(l.quantity-coalesce((select sum(good_units) from public.production_runs where order_line_id=l.id and reversed_at is null),0),0)*l.estimated_hours) over(partition by l.printer_id order by o.priority desc,o.queue_position,o.promised_at,o.id,l.id)*interval '1 hour' as previous_finish
  from public.order_lines l join public.orders o on o.id=l.order_id join public.printers p on p.id=l.printer_id where o.status not in ('delivered','cancelled')
 )x;
 return result;
end $$;

create function public.business_report(p_kind text,p_from date,p_to date,p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare query text; total bigint; rows jsonb; begin
 if not private.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_page is null or p_page < -1 or p_page>200000 or p_from is null or p_to is null or p_to<p_from or p_to-p_from>3660 then raise exception 'Filtros de reporte inválidos.' using errcode='22023'; end if;
 case p_kind
 when 'sales','profitability' then query:=$q$select 'K-'||o.number as codigo,c.name as cliente,o.description as producto,o.status as estado,o.created_at as creado,o.delivered_at as entregado,o.price_total as venta,private.op_paid(o.id) as cobrado,o.price_total-private.op_paid(o.id) as pendiente,o.estimated_cost as costo_estimado,private.op_production_cost(o.id) as costo_real,o.price_total-private.op_production_cost(o.id) as ganancia_real,case when o.status='delivered' and private.op_paid(o.id)>=o.price_total then 'Sí' else 'No' end as utilidad_realizada from public.orders o join public.customers c on c.id=o.customer_id where (o.created_at at time zone 'America/Bogota')::date between $1 and $2 order by o.created_at,o.id$q$;
 when 'costs' then query:=$q$select 'C-'||q.number as cotizacion,l.description as producto,l.quantity as cantidad,l.estimated_hours as horas_unidad,l.unit_cost as costo_unidad,l.unit_price as precio_unidad,l.quantity*l.unit_cost as costo_total,l.quantity*l.unit_price as precio_total,l.quantity*(l.unit_price-l.unit_cost) as ganancia_estimada from public.quote_lines l join public.quotes q on q.id=l.quote_id where (q.created_at at time zone 'America/Bogota')::date between $1 and $2 order by q.number,l.id$q$;
 when 'inventory' then query:=$q$select m.brand as marca,m.kind as material,m.color as color,l.purchased_on as fecha_compra,l.initial_grams as gramos_iniciales,l.on_hand_grams as gramos_fisicos,private.op_reserved(l.id) as gramos_reservados,l.on_hand_grams-private.op_reserved(l.id) as gramos_disponibles,round(l.cost_per_gram,6) as costo_gramo,round((l.on_hand_grams-private.op_reserved(l.id))*l.cost_per_gram,2) as valor_disponible from public.inventory_lots l join public.materials m on m.id=l.material_id order by m.kind,m.color,l.id$q$;
 when 'consumption' then query:=$q$select i.created_at as fecha,m.brand as marca,m.kind as material,m.color,i.kind as movimiento,i.delta_grams as cambio_fisico,i.reserved_delta as cambio_reserva,i.expense_amount as costo_merma,i.reason as motivo,'K-'||o.number as pedido,u.display_name as responsable from public.inventory_movements i join public.inventory_lots l on l.id=i.lot_id join public.materials m on m.id=l.material_id left join public.orders o on o.id=i.order_id left join public.user_profiles u on u.user_id=i.created_by where (i.created_at at time zone 'America/Bogota')::date between $1 and $2 order by i.created_at,i.id$q$;
 when 'cash' then query:=$q$select c.occurred_on as fecha,c.category as categoria,c.description as descripcion,c.amount as valor,c.method as medio_pago,c.profit_effect as efecto_utilidad,u.display_name as responsable,c.authorization_reason as autorizacion from public.cash_entries c left join public.user_profiles u on u.user_id=c.created_by where c.occurred_on between $1 and $2 order by c.occurred_on,c.created_at,c.id$q$;
 when 'expenses' then query:=$q$select categoria,sum(valor) as gasto from (select coalesce(orig.category,c.category) as categoria,-c.profit_effect as valor from public.cash_entries c left join public.cash_entries orig on orig.id=c.reverses_id where c.occurred_on between $1 and $2 and coalesce(orig.category,c.category) not in ('other_income','direct_sale','capital') union all select 'compra_operativa',expense_amount from public.purchases where category='operating' and voided_at is null and purchased_on between $1 and $2 union all select 'merma_inventario',expense_amount from public.inventory_movements where (created_at at time zone 'America/Bogota')::date between $1 and $2) x group by categoria having sum(valor)<>0 order by sum(valor) desc$q$;
 when 'debts' then query:=$q$select d.description as concepto,s.name as proveedor,d.principal as capital_inicial,private.op_debt_balance(d.id) as capital_pendiente,d.monthly_payment as cuota_referencia,d.installment_count as cuotas,(select count(*) from public.debt_installments i where i.debt_id=d.id and i.principal_due<=coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0)) as cuotas_pagadas,(select min(due_on) from public.debt_installments i where i.debt_id=d.id and (i.principal_due>coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0) or i.interest_due>coalesce((select sum(interest_paid) from public.debt_payments where installment_id=i.id),0))) as proximo_vencimiento from public.debts d left join public.suppliers s on s.id=d.supplier_id order by d.created_at,d.id$q$;
 when 'partners' then query:=$q$select p.display_name as socio,50 as participacion_porcentaje,private.op_partner_balance(p.id) as saldo_asignado,private.op_pending_advances(p.id) as adelantos_por_compensar,coalesce((select sum(amount) from public.partner_allocations where partner_id=p.id),0) as utilidades_asignadas,coalesce((select sum(amount) from public.partner_advances where partner_id=p.id),0) as adelantos,coalesce((select sum(amount) from public.partner_withdrawals where partner_id=p.id),0) as retiros from public.partners p order by code$q$;
 when 'products' then query:=$q$select l.description as producto,sum(l.quantity) as unidades,sum(l.quantity*l.unit_price) as ventas,sum(coalesce((select sum(r.cost_total) from public.production_runs r where r.order_line_id=l.id and r.reversed_at is null),0)) as costo_real,sum(l.quantity*l.unit_price-coalesce((select sum(r.cost_total) from public.production_runs r where r.order_line_id=l.id and r.reversed_at is null),0)) as ganancia from public.order_lines l join public.orders o on o.id=l.order_id where o.status='delivered' and (o.delivered_at at time zone 'America/Bogota')::date between $1 and $2 group by l.description order by ganancia desc,l.description$q$;
 when 'customers' then query:=$q$select c.name as cliente,c.phone as telefono,c.city as ciudad,count(o.id) as pedidos,coalesce(sum(o.price_total),0) as total_comprado,coalesce(sum(greatest(o.price_total-private.op_paid(o.id),0)),0) as saldo_pendiente,max(o.delivered_at) as ultima_compra from public.customers c join public.orders o on o.customer_id=c.id where o.status<>'cancelled' and (o.created_at at time zone 'America/Bogota')::date between $1 and $2 group by c.id order by count(o.id) desc,c.name$q$;
 else raise exception 'Reporte desconocido.' using errcode='22023'; end case;
 execute 'select count(*) from ('||query||')r' into total using p_from,p_to;
 if p_page=-1 then
  if total>50000 then raise exception 'El reporte supera 50.000 filas. Reduce el periodo para exportarlo.' using errcode='PT422'; end if;
  execute 'select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from ('||query||')r' into rows using p_from,p_to;
 else execute 'select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from ('||query||' limit 50 offset $3)r' into rows using p_from,p_to,p_page*50; end if;
 return jsonb_build_object('rows',rows,'total',total,'page',p_page,'summary',private.op_summary(p_from,p_to),'generated_at',now());
end $$;
revoke all on function public.preview_order_priority(uuid,integer,integer),public.business_report(text,date,date,integer) from public,anon;
grant execute on function public.preview_order_priority(uuid,integer,integer),public.business_report(text,date,date,integer) to authenticated;

commit;
