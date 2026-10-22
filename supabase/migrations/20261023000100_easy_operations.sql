begin;
-- Additive correction: retain cash, customer receipts, stock and paid installments.
alter table public.materials add column color_hex text check(color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$');
alter table public.inventory_lots add column version integer not null default 1;
alter table public.purchases add column version integer not null default 1;
alter table public.debts add column version integer not null default 1;
alter table public.debt_installments add column superseded_at timestamptz;
create table private.kapa_updates(name text primary key,applied_at timestamptz not null default now(),details jsonb not null default '{}');
revoke all on private.kapa_updates from public,anon,authenticated;

-- Decimal-cent floor guarantees even a tiny material amount cannot exceed 10%.
create function private.op_depreciation(material numeric,uncapped numeric) returns numeric language sql immutable set search_path='' as $$
 select least(greatest(round(uncapped,2),0),trunc(greatest(round(material,2),0)*0.10,2))
$$;
create function private.op_cap_snapshot(s jsonb,sale numeric default null) returns jsonb language plpgsql immutable set search_path='' as $$
declare dep numeric:=private.op_depreciation(coalesce((s->>'material_cost')::numeric,0),coalesce((s->>'depreciation_cost')::numeric,0)); total numeric; price numeric; begin
 total:=greatest(round(coalesce((s->>'total')::numeric,0)-coalesce((s->>'depreciation_cost')::numeric,0)+dep,2),0);
 price:=coalesce(sale,(s->>'price')::numeric,0);
 return s||jsonb_build_object('depreciation_uncapped',coalesce(s->'depreciation_uncapped',s->'depreciation_cost'),'depreciation_cost',dep,'depreciation_limit_percent',10,'total',total,'price',price,'profit',price-total,'margin',case when price>0 then round((price-total)/price*100,4) else 0 end,'markup',case when total>0 then round((price-total)/total*100,4) else 0 end);
end $$;

create function private.op_replan_debt(did uuid,p jsonb) returns void language plpgsql set search_path='' as $$
#variable_conflict use_variable
declare debt public.debts; principal numeric; paid numeric; remaining numeric; interest numeric:=private.op_number(p,'installment_interest'); n integer:=coalesce(nullif(p->>'installments','')::integer,1); due date:=coalesce(nullif(p->>'next_due','')::date,private.op_today()+30); first_number integer; piece numeric; i integer; begin
 select * into strict debt from public.debts where id=did for update;
 if debt.voided_at is not null then raise exception 'Esta deuda fue anulada con su compra.' using errcode='PT422'; end if;
 principal:=round(private.op_number(p,'principal',debt.principal),2);
 select coalesce(sum(principal_paid),0) into paid from public.debt_payments where debt_id=did;
 if principal<=0 or principal<paid or n not between 1 and 600 then raise exception 'El capital total debe ser positivo y no puede quedar por debajo de lo ya abonado. Usa entre 1 y 600 cuotas pendientes.' using errcode='PT422'; end if;
 if length(trim(coalesce(p->>'reason','')))<5 then raise exception 'Explica la corrección de la deuda.' using errcode='22023'; end if;
 remaining:=principal-paid;
 select coalesce(max(number),0) into first_number from public.debt_installments where debt_id=did;
 update public.debt_installments set superseded_at=now() where debt_id=did and superseded_at is null;
 piece:=trunc(remaining/n,2);
 if remaining>0 or interest>0 then
  for i in 1..n loop
   insert into public.debt_installments(debt_id,number,due_on,principal_due,interest_due) values(did,first_number+i,(due+(i-1)*interval '1 month')::date,case when i=n then remaining-piece*(n-1) else piece end,interest);
  end loop;
 end if;
 update public.debts set description=coalesce(nullif(trim(p->>'description'),''),description),supplier_id=case when p ? 'supplier_id' then nullif(p->>'supplier_id','')::uuid else supplier_id end,principal=principal,installment_count=n,monthly_payment=case when remaining=0 and interest=0 then debt.monthly_payment else greatest(piece+interest,0.01) end,next_due=due,financing=coalesce(nullif(p->>'financing',''),financing),notes=notes||E'\nReprogramación: '||(p->>'reason'),version=version+1 where id=did;
end $$;

create function private.op_complete_missing(oid uuid,reason text) returns void language plpgsql set search_path='' as $$
declare l public.order_lines; inputs jsonb; item jsonb; qty integer; materials jsonb; extras jsonb; key text; begin
 for l in select * from public.order_lines where order_id=oid order by position,id loop
  select l.quantity-coalesce(sum(good_units),0) into qty from public.production_runs where order_line_id=l.id and reversed_at is null;
  if qty<=0 then continue; end if;
  inputs:=coalesce(l.cost_snapshot->'inputs','{}'); materials:='[]';extras:='[]';
  for item in select value from jsonb_array_elements(l.material_snapshot) loop
   materials:=materials||jsonb_build_array(jsonb_build_object('lot_id',item->>'lot_id','piece_grams',coalesce((item->>'grams')::numeric,0)*qty,'support_grams',0,'waste_grams',0));
  end loop;
  for item in select value from jsonb_array_elements(coalesce(inputs->'extra_items','[]')) loop extras:=extras||jsonb_build_array(item||jsonb_build_object('quantity',private.op_number(item,'quantity')*qty)); end loop;
  foreach key in array array['labor_hours','painting_hours','painting_materials','supplies_cost','customization_cost','packaging_cost','other_cost'] loop inputs:=jsonb_set(inputs,array[key],to_jsonb(private.op_number(inputs,key)*qty)); end loop;
  perform public.business_operate('production_create',inputs||jsonb_build_object('line_id',l.id,'good_units',qty,'hours',l.estimated_hours*qty,'materials',materials,'extra_items',extras,'notes','Registro de piezas ya impresas; cantidades confirmadas por el usuario. '||reason),gen_random_uuid());
 end loop;
end $$;


create or replace function private.op_cost(p jsonb) returns jsonb language plpgsql stable set search_path='' as $$
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
 dep:=private.op_depreciation(materials,hours*printer.acquisition_cost/printer.useful_hours);
 energy:=hours*printer.power_kw*coalesce(printer.energy_rate,settings.energy_kwh_cost);
 labor:=private.op_number(p,'labor_hours')*settings.labor_hour_cost;
 painting:=private.op_number(p,'painting_hours')*settings.labor_hour_cost+private.op_number(p,'painting_materials');
 extras:=private.op_number(p,'supplies_cost')+private.op_number(p,'customization_cost')+private.op_number(p,'packaging_cost')+private.op_number(p,'other_cost');
 if jsonb_typeof(coalesce(p->'extra_items','[]'))<>'array' or jsonb_array_length(coalesce(p->'extra_items','[]'))>100 then raise exception 'Máximo 100 costos adicionales.' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(coalesce(p->'extra_items','[]')) loop
  if length(trim(coalesce(item->>'description','')))<1 or private.op_number(item,'quantity')<=0 then raise exception 'Describe el insumo y su cantidad.' using errcode='22023'; end if;
  extras:=extras+private.op_number(item,'quantity')*private.op_number(item,'unit_cost');
 end loop;
 total:=round(materials+dep+energy+labor+painting+extras,2);
 price:=round(case when nullif(p->>'manual_price','') is not null then private.op_number(p,'manual_price') else total*private.op_number(p,'multiplier',3) end,2);
 return jsonb_build_object('depreciation_limit_percent',10,'material_cost',round(materials,2),'depreciation_cost',round(dep,2),'energy_cost',round(energy,2),'labor_cost',round(labor,2),'painting_cost',round(painting,2),'extras_cost',round(extras,2),'total',total,'price',price,'profit',price-total,'margin',case when price>0 then round((price-total)/price*100,4) else 0 end,'markup',case when total>0 then round((price-total)/total*100,4) else 0 end,'materials',snapshots,'inputs',p,'labor_rate',settings.labor_hour_cost,'depreciation_rate',printer.acquisition_cost/printer.useful_hours,'power_kw',printer.power_kw,'energy_rate',coalesce(printer.energy_rate,settings.energy_kwh_cost));
end $$;

create or replace function public.business_operate(p_action text,p_data jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare line_position integer:=0; previous private.mutation_requests; result jsonb; id uuid; related uuid; partner uuid; row_data jsonb; item jsonb; detail jsonb; snapshot jsonb; materials jsonb;
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

 if nullif(p_data->>'order_id','') is not null and exists(select 1 from public.orders where orders.id=(p_data->>'order_id')::uuid and deleted_at is not null) then raise exception 'El pedido fue eliminado de la vista activa.' using errcode='PT422'; end if;
 case p_action
   when 'lot_update' then
  select * into strict lot from public.inventory_lots where inventory_lots.id=(p_data->>'lot_id')::uuid for update;
  if lot.version<>coalesce((p_data->>'version')::integer,0) then raise exception 'El rollo cambió. Actualiza antes de editar.' using errcode='PT409'; end if;
  if length(trim(coalesce(p_data->>'brand','')))=0 or length(trim(coalesce(p_data->>'kind','')))=0 or length(trim(coalesce(p_data->>'color','')))=0 then raise exception 'Indica marca, material y nombre del color.' using errcode='22023'; end if;
  insert into public.materials(brand,kind,color,color_hex) values(trim(p_data->>'brand'),trim(p_data->>'kind'),trim(p_data->>'color'),nullif(p_data->>'color_hex','')) on conflict(brand,kind,color) do update set color_hex=excluded.color_hex returning materials.id into related;
  update public.inventory_lots set material_id=related,version=version+1 where inventory_lots.id=lot.id;
 when 'purchase_reclassify' then
  select * into strict purchase from public.purchases where purchases.id=coalesce(nullif(p_data->>'purchase_id','')::uuid,(select p.id from public.purchases p where p.lot_id=nullif(p_data->>'lot_id','')::uuid)) for update;
  if purchase.version<>coalesce((p_data->>'version')::integer,0) or purchase.voided_at is not null then raise exception 'La compra cambió o fue anulada. Actualiza antes de editar.' using errcode='PT409'; end if;
  if length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Explica la corrección de la compra.' using errcode='22023'; end if;
  amount:=round(private.op_number(p_data,'paid',purchase.paid_initial),2);
  target_status:=coalesce(nullif(p_data->>'financing',''),purchase.financing);
  if amount>purchase.total or target_status not in ('cash','supplier_credit','credit_card') or (target_status='cash' and amount<purchase.total) then raise exception 'El pago inicial no puede superar la compra. Si queda saldo, elige crédito o tarjeta.' using errcode='PT422'; end if;
  select d.id into related from public.debts d where d.purchase_id=purchase.id;
  select coalesce(sum(principal_paid),0) into paid from public.debt_payments where debt_id=related;
  principal:=purchase.total-amount;
  if principal<paid then raise exception 'Conserva los abonos de capital existentes: el pago inicial no puede incluir dinero pagado después como cuota.' using errcode='PT422'; end if;
  cost:=purchase.paid_initial-amount;
  if cost<0 and private.op_cash_balance()+cost<0 then raise exception 'La corrección gastaría dinero que no hay en caja. Si se pagó con tarjeta, elige crédito e indica solo el dinero propio del pago inicial.' using errcode='PT422'; end if;
  if cost<>0 then
   insert into public.cash_entries(amount,category,description,method,occurred_on,purchase_id,profit_effect,authorization_reason,created_by) values(cost,'purchase_correction','Corrección de compra: '||purchase.description,'Corrección contable',purchase.purchased_on,purchase.id,0,p_data->>'reason',auth.uid());
  end if;
  update public.purchases set financing=target_status,paid_initial=amount,description=coalesce(nullif(p_data->>'description',''),description),supplier_id=case when p_data ? 'supplier_id' then nullif(p_data->>'supplier_id','')::uuid else supplier_id end,version=version+1 where purchases.id=purchase.id;
  if principal>0 then
   if related is null then
    related:=private.op_create_debt(p_data||jsonb_build_object('financing',target_status,'description',coalesce(nullif(p_data->>'description',''),purchase.description)),principal,purchase.id);
   else
    perform private.op_replan_debt(related,p_data||jsonb_build_object('principal',principal,'financing',target_status));
   end if;
  elsif related is not null then
   if exists(select 1 from public.debt_payments where debt_id=related) then raise exception 'La deuda tiene pagos. Conserva ese historial y corrige solo los importes que correspondan.' using errcode='PT422'; end if;
   update public.debt_installments set superseded_at=now() where debt_id=related and superseded_at is null;
   update public.debts set voided_at=now(),version=version+1,notes=notes||E'\nCorrección a contado: '||(p_data->>'reason') where debts.id=related;
  end if;
 when 'debt_edit' then
  related:=(p_data->>'debt_id')::uuid;
  perform 1 from public.debts where debts.id=related and version=coalesce((p_data->>'version')::integer,0) for update;
  if not found then raise exception 'La deuda cambió. Actualiza antes de editar.' using errcode='PT409'; end if;
  if exists(select 1 from public.debts where debts.id=related and purchase_id is not null) then raise exception 'Corrige el pago inicial y la financiación desde la compra vinculada.' using errcode='PT422'; end if;
  perform private.op_replan_debt(related,p_data);
 when 'order_quick_create' then
  detail:=public.business_operate('quote_create',p_data,gen_random_uuid()); related:=(detail->>'id')::uuid;
  detail:=public.business_operate('order_create',p_data||jsonb_build_object('quote_id',related),gen_random_uuid()); id:=(detail->>'id')::uuid;
  target_status:=coalesce(nullif(p_data->>'initial_status',''),'confirmed');
  if target_status<>'pending_deposit' or coalesce((p_data->>'already_printed')::boolean,false) then
   perform public.business_operate('order_update',jsonb_build_object('order_id',id,'version',(select version from public.orders where orders.id=id),'status',target_status,'confirm_without_deposit',true,'confirm_record_completed',coalesce((p_data->>'already_printed')::boolean,false),'notes',coalesce(p_data->>'notes','')),gen_random_uuid());
  end if;

 when 'opening_save' then
  if (select version from public.opening_balances)<>coalesce((p_data->>'version')::integer,0) then raise exception 'Los saldos iniciales cambiaron. Actualiza antes de guardar.' using errcode='PT409'; end if;
  amount:=coalesce(nullif(p_data->>'cash_amount','')::numeric,private.op_number(p_data,'income')-private.op_number(p_data,'expense'));
  if amount::text in ('NaN','Infinity','-Infinity') or abs(amount)>99999999999999 then raise exception 'Saldo inicial inválido.' using errcode='22023'; end if;
  if coalesce(nullif(p_data->>'effective_on','')::date,private.op_today())>private.op_today() then raise exception 'La fecha inicial no puede estar en el futuro.' using errcode='22023'; end if;
  if length(trim(coalesce(p_data->>'notes','')))<5 then raise exception 'Explica el origen o corrección de los saldos iniciales.' using errcode='22023'; end if;
  update public.opening_balances set income=private.op_number(p_data,'income'),expense=private.op_number(p_data,'expense'),cash_amount=amount,effective_on=coalesce(nullif(p_data->>'effective_on','')::date,private.op_today()),notes=p_data->>'notes',version=version+1,updated_by=auth.uid(),updated_at=now() where singleton=true;
 when 'inventory_count' then
  select * into strict lot from public.inventory_lots where inventory_lots.id=(p_data->>'lot_id')::uuid for update;
  if lot.on_hand_grams<>private.op_number(p_data,'previous_grams') then raise exception 'El stock cambió. Actualiza antes de contar.' using errcode='PT409'; end if;
  grams:=round(private.op_number(p_data,'on_hand_grams'),3)-lot.on_hand_grams;
  if lot.on_hand_grams+grams<private.op_reserved(lot.id) then raise exception 'Libera reservas antes de reducir el stock por debajo de lo reservado.' using errcode='PT422'; end if;
  if grams=0 or length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Indica una cantidad diferente y el motivo del conteo.' using errcode='22023'; end if;
  update public.inventory_lots set on_hand_grams=on_hand_grams+grams where inventory_lots.id=lot.id;
  insert into public.inventory_movements(id,lot_id,kind,delta_grams,expense_amount,reason,created_by) values(id,lot.id,'adjustment',grams,greatest(-grams,0)*lot.purchase_cost/lot.initial_grams,p_data->>'reason',auth.uid());
 when 'line_deliver' then
  select * into strict line from public.order_lines where order_lines.id=(p_data->>'line_id')::uuid for update;
  select * into strict ord from public.orders where orders.id=line.order_id and deleted_at is null for update;
  if ord.version<>coalesce((p_data->>'version')::integer,0) then raise exception 'El pedido cambió. Actualiza antes de entregar.' using errcode='PT409'; end if;
  units:=(p_data->>'delivered_quantity')::integer;
  if ord.status='cancelled' or units<0 or units>line.quantity or units>coalesce((select sum(good_units) from public.production_runs where order_line_id=line.id and reversed_at is null),0) then raise exception 'Solo puedes entregar unidades producidas; la cantidad indica el total entregado.' using errcode='PT422'; end if;
  if units=line.delivered_quantity then raise exception 'La cantidad entregada no cambió.' using errcode='PT422'; end if;

  insert into public.order_deliveries(line_id,quantity,delivered_on,notes,created_by) values(line.id,units-line.delivered_quantity,private.op_today(),coalesce(p_data->>'notes',''),auth.uid());
  update public.order_lines set delivered_quantity=units,delivered_at=case when units>0 then now() end where order_lines.id=line.id;
  if not exists(select 1 from public.order_lines where order_id=ord.id and delivered_quantity<quantity) then
   update public.orders set status='delivered',delivered_at=now(),version=version+1 where orders.id=ord.id;
   for item in select jsonb_build_object('lot_id',lot_id) from public.material_reservations where order_id=ord.id and grams>0 loop perform private.op_reserve(ord.id,(item->>'lot_id')::uuid,0); end loop;
  else
   update public.orders set status=case when status='delivered' then 'ready_delivery' else status end,delivered_at=null,version=version+1 where orders.id=ord.id;
  end if;
 when 'order_line_save','order_line_remove' then
  select * into strict ord from public.orders where orders.id=(p_data->>'order_id')::uuid and deleted_at is null for update;
  if ord.version<>coalesce((p_data->>'version')::integer,0) or ord.status in ('delivered','cancelled') then raise exception 'El pedido cambió o está cerrado.' using errcode='PT409'; end if;
  if nullif(p_data->>'line_id','') is not null then
   select * into strict line from public.order_lines where order_lines.id=(p_data->>'line_id')::uuid and order_id=ord.id for update;
   units:=coalesce((select sum(good_units) from public.production_runs where order_line_id=line.id and reversed_at is null),0);
   if p_action='order_line_remove' then
    if (select count(*) from public.order_lines where order_id=ord.id)<=1 or exists(select 1 from public.production_runs where order_line_id=line.id) or exists(select 1 from public.order_line_payments where line_id=line.id) or exists(select 1 from public.order_deliveries where line_id=line.id) then raise exception 'Esta pieza tiene movimientos o es la única del pedido. Conserva su historial.' using errcode='PT422'; end if;
    delete from public.order_lines where order_lines.id=line.id;
   else
    if (p_data->>'quantity')::integer<greatest(units,line.delivered_quantity) or private.op_number(p_data,'unit_price')*(p_data->>'quantity')::integer<private.op_line_paid(line.id) then raise exception 'La cantidad o el precio no puede quedar por debajo de lo producido, entregado o cobrado.' using errcode='PT422'; end if;
    if length(trim(coalesce(p_data->>'description','')))=0 then raise exception 'Describe la pieza.' using errcode='22023'; end if;
    update public.order_lines set description=trim(p_data->>'description'),quantity=(p_data->>'quantity')::integer,unit_price=private.op_number(p_data,'unit_price') where order_lines.id=line.id;
   end if;
  else
   snapshot:=private.op_cost(p_data); units:=(p_data->>'quantity')::integer;
   if length(trim(coalesce(p_data->>'description','')))=0 or units not between 1 and 100000 then raise exception 'Describe la pieza y su cantidad.' using errcode='22023'; end if;
   insert into public.order_lines(order_id,description,quantity,printer_id,estimated_hours,unit_cost,unit_price,cost_snapshot,material_snapshot,position) values(ord.id,p_data->>'description',units,(p_data->>'printer_id')::uuid,private.op_number(p_data,'hours'),(snapshot->>'total')::numeric,(snapshot->>'price')::numeric,snapshot,snapshot->'materials',coalesce((select max(position)+1 from public.order_lines where order_id=ord.id),0));
  end if;
  update public.orders set price_total=(select sum(quantity*unit_price) from public.order_lines where order_id=ord.id),estimated_cost=(select sum(quantity*unit_cost) from public.order_lines where order_id=ord.id),version=version+1 where orders.id=ord.id;
  if ord.status<>'pending_deposit' then
   -- Rebuild only outstanding reservations, excluding consumption already recorded.
   for item in select jsonb_build_object('lot_id',lot_id) from public.material_reservations where order_id=ord.id and grams>0 loop perform private.op_reserve(ord.id,(item->>'lot_id')::uuid,0); end loop;
   for item in select jsonb_build_object('lot_id',m->>'lot_id','grams',sum((m->>'grams')::numeric*greatest(l.quantity-coalesce((select sum(good_units) from public.production_runs where order_line_id=l.id and reversed_at is null),0),0))) from public.order_lines l cross join lateral jsonb_array_elements(l.material_snapshot) m where l.order_id=ord.id group by m->>'lot_id' loop perform private.op_reserve(ord.id,(item->>'lot_id')::uuid,(item->>'grams')::numeric); end loop;
  end if;
 when 'order_edit' then
  select * into strict ord from public.orders where orders.id=(p_data->>'order_id')::uuid and deleted_at is null for update;
  if ord.version<>coalesce((p_data->>'version')::integer,0) or ord.status in ('delivered','cancelled') then raise exception 'El pedido cambió o está cerrado.' using errcode='PT409'; end if;
  if length(trim(coalesce(p_data->>'description','')))=0 then raise exception 'Describe el pedido.' using errcode='22023'; end if;
  update public.orders set description=trim(p_data->>'description'),customer_id=(p_data->>'customer_id')::uuid,notes=coalesce(p_data->>'notes',''),reference_url=coalesce(p_data->>'reference_url',''),model_url=coalesce(p_data->>'model_url',''),version=version+1 where orders.id=ord.id;
 when 'order_delete' then
  select * into strict ord from public.orders where orders.id=(p_data->>'order_id')::uuid and deleted_at is null for update;
  if ord.version<>coalesce((p_data->>'version')::integer,0) then raise exception 'El pedido cambió.' using errcode='PT409'; end if;
  if length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Explica el motivo de eliminación.' using errcode='22023'; end if;
  if ord.status not in ('delivered','cancelled') then
   if private.op_paid(ord.id)>0 or exists(select 1 from public.order_lines where order_id=ord.id and delivered_quantity>0) then raise exception 'Cancela y devuelve el dinero o completa la entrega antes de eliminar un pedido con movimientos pendientes.' using errcode='PT422'; end if;
   update public.orders set status='cancelled',cancelled_at=now() where orders.id=ord.id;
  elsif ord.status='delivered' and private.op_paid(ord.id)<ord.price_total then raise exception 'Cobra el saldo pendiente antes de eliminar este pedido entregado.' using errcode='PT422'; end if;
  for item in select jsonb_build_object('lot_id',lot_id) from public.material_reservations where order_id=ord.id and grams>0 loop perform private.op_reserve(ord.id,(item->>'lot_id')::uuid,0); end loop;
  update public.orders set deleted_at=now(),notes=notes||E'\nEliminación: '||(p_data->>'reason'),version=version+1 where orders.id=ord.id;
 when 'experiment_create' then
  if p_data->>'kind' not in ('test','failed') then raise exception 'Tipo de impresión inválido.' using errcode='22023'; end if;
  if private.op_number(p_data,'minutes')>59 then raise exception 'Los minutos deben estar entre 0 y 59.' using errcode='22023'; end if;
  hours:=round(private.op_number(p_data,'hours')+private.op_number(p_data,'minutes')/60,3); cost_sum:=0; materials:='[]';
  if jsonb_array_length(coalesce(p_data->'materials','[]')) not between 1 and 100 then raise exception 'Indica el material consumido.' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_data->'materials') loop
   select * into strict lot from public.inventory_lots where inventory_lots.id=(item->>'lot_id')::uuid and state='active' for update;
   grams:=round(private.op_number(item,'grams'),3);
   if grams<=0 or grams>lot.on_hand_grams-private.op_reserved(lot.id) then raise exception 'Gramos inválidos o insuficientes; se respetan las reservas.' using errcode='PT422'; end if;
   cost:=round(grams*lot.purchase_cost/lot.initial_grams,2); cost_sum:=cost_sum+cost;
   update public.inventory_lots set on_hand_grams=on_hand_grams-grams where inventory_lots.id=lot.id;
   materials:=materials||jsonb_build_array(jsonb_build_object('lot_id',lot.id,'grams',grams,'material_cost',cost));
  end loop;
  insert into public.print_experiments(id,kind,description,printer_id,actual_hours,material_cost,details,created_by) values(id,p_data->>'kind',trim(p_data->>'description'),nullif(p_data->>'printer_id','')::uuid,hours,cost_sum,materials,auth.uid());
  for item in select value from jsonb_array_elements(materials) loop insert into public.inventory_movements(lot_id,experiment_id,kind,delta_grams,expense_amount,reason,created_by) values((item->>'lot_id')::uuid,id,'waste',-(item->>'grams')::numeric,(item->>'material_cost')::numeric,case when p_data->>'kind'='test' then 'Prueba: ' else 'Fallo: ' end||(p_data->>'description'),auth.uid()); end loop;
  update public.printers set accumulated_hours=accumulated_hours+hours,version=version+1 where printers.id=nullif(p_data->>'printer_id','')::uuid;
 when 'experiment_reverse' then
  if length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Explica la corrección.' using errcode='22023'; end if;
  select to_jsonb(e) into strict detail from public.print_experiments e where e.id=(p_data->>'experiment_id')::uuid and e.reversed_at is null for update;
  for movement in select * from public.inventory_movements where experiment_id=(detail->>'id')::uuid and kind='waste' loop
   update public.inventory_lots set on_hand_grams=on_hand_grams-movement.delta_grams where inventory_lots.id=movement.lot_id;
   insert into public.inventory_movements(lot_id,experiment_id,kind,delta_grams,expense_amount,reason,reverses_id,created_by) values(movement.lot_id,(detail->>'id')::uuid,'reversal',-movement.delta_grams,-movement.expense_amount,p_data->>'reason',movement.id,auth.uid());
  end loop;
  update public.printers set accumulated_hours=accumulated_hours-(detail->>'actual_hours')::numeric,version=version+1 where printers.id=(detail->>'printer_id')::uuid;
  update public.print_experiments set reversed_at=now() where print_experiments.id=(detail->>'id')::uuid;

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
  if movement.experiment_id is not null then raise exception 'Corrige esta impresión desde Pruebas y fallos.' using errcode='PT422'; end if;
  if movement.kind not in ('waste','adjustment','return') then raise exception 'Las reservas se liberan desde el pedido y las producciones se revierten desde Producción.' using errcode='PT422'; end if;
  if exists(select 1 from public.inventory_movements where reverses_id=movement.id) then raise exception 'Este movimiento ya fue compensado.' using errcode='PT409'; end if;
  if length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Indica el motivo de la compensación.' using errcode='22023'; end if;
  select * into strict lot from public.inventory_lots where inventory_lots.id=movement.lot_id for update;
  if lot.on_hand_grams-movement.delta_grams<private.op_reserved(lot.id) then raise exception 'No hay stock libre suficiente para compensar.' using errcode='PT422'; end if;
  update public.inventory_lots set on_hand_grams=on_hand_grams-movement.delta_grams where inventory_lots.id=lot.id;
  insert into public.inventory_movements(id,lot_id,kind,delta_grams,expense_amount,reason,reverses_id,created_by) values(id,lot.id,'reversal',-movement.delta_grams,-movement.expense_amount,p_data->>'reason',movement.id,auth.uid());
 when 'quote_create','quote_update' then
  cost_sum:=0; price_sum:=0;
  if jsonb_array_length(coalesce(p_data->'lines','[]')) not between 1 and 100 then raise exception 'Agrega entre 1 y 100 productos.' using errcode='22023'; end if;
  if p_action='quote_update' then
   select * into strict q from public.quotes where quotes.id=id for update;
   if q.status<>'draft' or q.version<>coalesce((p_data->>'version')::integer,0) then raise exception 'La cotización cambió o ya tiene pedido. Edita el pedido si ya se convirtió.' using errcode='PT409'; end if;
   delete from public.quote_lines where quote_id=id;
   update public.quotes set customer_id=(p_data->>'customer_id')::uuid,description=p_data->>'description',deposit_percent=private.op_number(p_data,'deposit_percent',settings.default_deposit_percent),notes=coalesce(p_data->>'notes',''),version=version+1 where quotes.id=id;
  else
  insert into public.quotes(id,customer_id,description,cost_total,price_total,deposit_percent,notes,created_by) values(id,(p_data->>'customer_id')::uuid,p_data->>'description',0,0,private.op_number(p_data,'deposit_percent',settings.default_deposit_percent),coalesce(p_data->>'notes',''),auth.uid());
  end if;
  for item in select value from jsonb_array_elements(p_data->'lines') loop
   line_position:=line_position+1;
   snapshot:=private.op_cost(item); units:=(item->>'quantity')::integer;
   if length(trim(coalesce(item->>'description','')))=0 then raise exception 'Describe cada pieza personalizada.' using errcode='22023'; end if;
   insert into public.quote_lines(quote_id,product_id,description,quantity,printer_id,estimated_hours,unit_cost,unit_price,cost_snapshot,material_snapshot,position)
   values(id,nullif(item->>'product_id','')::uuid,item->>'description',units,(item->>'printer_id')::uuid,private.op_number(item,'hours'),(snapshot->>'total')::numeric,(snapshot->>'price')::numeric,snapshot,snapshot->'materials',line_position);
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
  insert into public.order_lines(order_id,product_id,description,quantity,printer_id,estimated_hours,unit_cost,unit_price,cost_snapshot,material_snapshot,position)
  select id,l.product_id,l.description,l.quantity,l.printer_id,l.estimated_hours,l.unit_cost,l.unit_price,l.cost_snapshot,l.material_snapshot,l.position from public.quote_lines l where quote_id=q.id;
  update public.quotes set status='converted' where quotes.id=q.id;
  if coalesce((p_data->>'allow_without_deposit')::boolean,false) then perform public.business_operate('order_update',jsonb_build_object('order_id',id,'version',1,'status','confirmed','confirm_without_deposit',true),gen_random_uuid()); end if;
 when 'order_payment' then
  select * into strict ord from public.orders where orders.id=(p_data->>'order_id')::uuid for update;
  amount:=private.op_number(p_data,'amount'); paid:=private.op_paid(ord.id);
  if ord.status='cancelled' or amount<=0 or paid+amount>ord.price_total then raise exception 'El cobro debe ser positivo y no superar el saldo del pedido.' using errcode='PT422'; end if;
  id:=private.op_post_cash(amount,case when paid=0 then 'deposit' else 'order_payment' end,'Cobro pedido K-'||ord.number,p_data,ord.id);
  perform private.op_allocate_payment(id,nullif(p_data->>'line_id','')::uuid);
 when 'order_reserve' then
  select * into strict ord from public.orders where orders.id=(p_data->>'order_id')::uuid for update;
  if ord.status in ('delivered','cancelled') then raise exception 'El pedido está cerrado.' using errcode='PT422'; end if;
  perform private.op_reserve(ord.id,(p_data->>'lot_id')::uuid,private.op_number(p_data,'grams'));
 when 'order_update' then
  select * into strict ord from public.orders where orders.id=(p_data->>'order_id')::uuid for update;
  if ord.version<>coalesce((p_data->>'version')::integer,0) then raise exception 'Otro socio cambió el pedido. Actualiza antes de guardar.' using errcode='PT409'; end if;
  if ord.status='cancelled' then raise exception 'El pedido está cancelado. Repite la cotización para crear otro.' using errcode='PT422'; end if;
  if nullif(p_data->>'promised_at','') is not null and (p_data->>'promised_at')::timestamptz<>ord.promised_at and not coalesce((p_data->>'confirm_date_change')::boolean,false) then raise exception 'Confirma expresamente el cambio de fecha comprometida.' using errcode='PT422'; end if;
  target_status:=coalesce(p_data->>'status',ord.status);
  if target_status not in ('pending_deposit','confirmed','design','ready','printing','finishing','ready_delivery','delivered') then raise exception 'Estado de pedido inválido.' using errcode='PT422'; end if;
  if target_status='cancelled' then raise exception 'Usa la cancelación con devolución y liberación de reservas.' using errcode='PT422'; end if;
  if target_status not in ('pending_deposit') and ord.status='pending_deposit' then
   if private.op_paid(ord.id)<round(ord.price_total*private.op_number(p_data,'deposit_percent',ord.deposit_percent)/100,2) and not coalesce((p_data->>'confirm_without_deposit')::boolean,false) then raise exception 'Falta el anticipo. Confirma expresamente si autorizas producir sin él.' using errcode='PT422'; end if;
   for item in select jsonb_build_object('lot_id',m->>'lot_id','grams',sum((m->>'grams')::numeric*l.quantity)) from public.order_lines l cross join lateral jsonb_array_elements(l.material_snapshot) m where l.order_id=ord.id group by m->>'lot_id' loop
    perform private.op_reserve(ord.id,(item->>'lot_id')::uuid,(item->>'grams')::numeric);
   end loop;
  end if;
  if coalesce((p_data->>'confirm_record_completed')::boolean,false) then perform private.op_complete_missing(ord.id,coalesce(p_data->>'notes','')); end if;
  if target_status in ('ready_delivery','delivered') and exists(select 1 from public.order_lines l where l.order_id=ord.id and l.quantity>coalesce((select sum(good_units) from public.production_runs where order_line_id=l.id and reversed_at is null),0)) then raise exception 'Registra la producción real de todas las unidades antes de entregar.' using errcode='PT422'; end if;

  if ord.status='delivered' and target_status<>'delivered' then
   if length(trim(coalesce(p_data->>'correction_reason','')))<5 then raise exception 'Indica el motivo al corregir un pedido ya entregado.' using errcode='PT422'; end if;
   insert into public.order_deliveries(line_id,quantity,delivered_on,notes,created_by) select ol.id,-ol.delivered_quantity,private.op_today(),p_data->>'correction_reason',auth.uid() from public.order_lines ol where ol.order_id=ord.id and ol.delivered_quantity>0;
   update public.order_lines set delivered_quantity=0,delivered_at=null where order_id=ord.id;
  end if;
  update public.orders set status=target_status,deposit_percent=private.op_number(p_data,'deposit_percent',ord.deposit_percent),priority=coalesce((p_data->>'priority')::integer,priority),queue_position=coalesce((p_data->>'queue_position')::integer,queue_position),promised_at=coalesce(nullif(p_data->>'promised_at','')::timestamptz,promised_at),notes=coalesce(p_data->>'notes',notes),delivered_at=case when target_status='delivered' then now() else null end,version=version+1 where orders.id=ord.id;
  if target_status='delivered' then
   insert into public.order_deliveries(line_id,quantity,delivered_on,notes,created_by) select l.id,l.quantity-l.delivered_quantity,private.op_today(),'Entrega completa del pedido',auth.uid() from public.order_lines l where order_id=ord.id and l.quantity>l.delivered_quantity;
   update public.order_lines set delivered_quantity=quantity,delivered_at=now() where order_id=ord.id;
   for item in select jsonb_build_object('lot_id',lot_id) from public.material_reservations where order_id=ord.id and grams>0 loop perform private.op_reserve(ord.id,(item->>'lot_id')::uuid,0); end loop; end if;
 when 'order_cancel' then
  select * into strict ord from public.orders where orders.id=(p_data->>'order_id')::uuid for update;
  if exists(select 1 from public.order_lines where order_id=ord.id and delivered_quantity>0) then raise exception 'El pedido tiene piezas entregadas. Registra su devolución antes de cancelarlo.' using errcode='PT422'; end if;
  if ord.status in ('delivered','cancelled') then raise exception 'El pedido ya está cerrado.' using errcode='PT409'; end if;
  paid:=private.op_paid(ord.id);
  if paid>0 and not coalesce((p_data->>'refund_confirmed')::boolean,false) then raise exception 'Confirma que devolverás el dinero recibido antes de cancelar.' using errcode='PT422'; end if;
  id:=private.op_post_cash(-paid,'refund','Devolución pedido K-'||ord.number,p_data,ord.id);
  if id is not null then perform private.op_allocate_payment(id); end if;
  for item in select jsonb_build_object('lot_id',lot_id) from public.material_reservations where order_id=ord.id and grams>0 loop perform private.op_reserve(ord.id,(item->>'lot_id')::uuid,0); end loop;
  update public.orders set status='cancelled',cancelled_at=now(),notes=notes||E'\nCancelación: '||coalesce(p_data->>'reason',''),version=version+1 where orders.id=ord.id;
 when 'production_create' then
  select * into strict line from public.order_lines where order_lines.id=(p_data->>'line_id')::uuid;
  select * into strict ord from public.orders where orders.id=line.order_id for update;
  if ord.status in ('delivered','cancelled') then raise exception 'Confirma el pedido antes de producir. Los pedidos cerrados no admiten producción.' using errcode='PT422'; end if;
  units:=(p_data->>'good_units')::integer; hours:=round(private.op_number(p_data,'hours'),3);
  if units<0 or units+coalesce((select sum(good_units) from public.production_runs where order_line_id=line.id and reversed_at is null),0)>line.quantity then raise exception 'La producción excede las unidades pedidas.' using errcode='PT422'; end if;
  select * into strict printer from public.printers where printers.id=line.printer_id for update;
  if printer.status in ('maintenance','inactive') then raise exception 'La impresora no está disponible.' using errcode='PT422'; end if;
  snapshot:=private.op_cost(jsonb_build_object('printer_id',printer.id,'hours',hours,'materials',p_data->'materials','labor_hours',private.op_number(p_data,'labor_hours'),'painting_hours',private.op_number(p_data,'painting_hours'),'painting_materials',private.op_number(p_data,'painting_materials'),'supplies_cost',private.op_number(p_data,'supplies_cost'),'customization_cost',private.op_number(p_data,'customization_cost'),'packaging_cost',private.op_number(p_data,'packaging_cost'),'other_cost',private.op_number(p_data,'other_cost'),'extra_items',coalesce(p_data->'extra_items','[]')));
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
  if ord.status not in ('delivered','cancelled') and run.reversed_at is null and line.delivered_quantity>coalesce((select sum(good_units) from public.production_runs where order_line_id=line.id and reversed_at is null),0)-run.good_units then raise exception 'No se puede revertir producción de piezas ya entregadas.' using errcode='PT422'; end if;
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
  if cash.order_id is not null and exists(select 1 from public.orders where orders.id=cash.order_id and deleted_at is not null) then raise exception 'El pedido está archivado. Conserva su historial cerrado.' using errcode='PT422'; end if;
  if cash.order_id is not null and private.op_paid(cash.order_id)<cash.amount then raise exception 'El cobro ya fue devuelto.' using errcode='PT422'; end if;
  id:=private.op_post_cash(-cash.amount,'reversal',p_data->>'reason',p_data,cash.order_id,null,null,cash.partner_id,null,-cash.profit_effect,cash.id);
  if cash.order_id is not null then perform private.op_allocate_payment(id); end if;
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
  if selected_installment is null then select i.id into selected_installment from public.debt_installments i where i.debt_id=related and i.superseded_at is null and (i.principal_due>coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0) or i.interest_due>coalesce((select sum(interest_paid) from public.debt_payments where installment_id=i.id),0)) order by i.number limit 1; end if;
  if principal>private.op_debt_balance(related) or principal+interest<=0 then raise exception 'El pago supera el capital pendiente o no es positivo.' using errcode='PT422'; end if;
  if selected_installment is null or not exists(select 1 from public.debt_installments where debt_installments.id=selected_installment and debt_id=related and superseded_at is null) then raise exception 'La cuota no corresponde a esta deuda o ya está pagada.' using errcode='22023'; end if;
  if exists(select 1 from public.debts where debts.id=related and voided_at is not null) then raise exception 'La deuda fue anulada con su compra.' using errcode='PT422'; end if;
  if principal>(select i.principal_due-coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0) from public.debt_installments i where i.id=selected_installment) then raise exception 'El capital excede el saldo de la cuota seleccionada. Abona las cuotas por separado.' using errcode='PT422'; end if;
  insert into public.debt_payments(id,debt_id,installment_id,principal_paid,interest_paid,paid_on,created_by) values(id,related,selected_installment,principal,interest,coalesce(nullif(p_data->>'date','')::date,private.op_today()),auth.uid());
  update public.debts set version=version+1 where debts.id=related;
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

-- Change recorded cost only. Existing order prices, customer receipts, cash and stock stay intact.
do $$ declare l record; r record; s jsonb; price numeric; dep numeric; qcount integer:=0; ocount integer:=0; rcount integer:=0; begin
 for l in select ql.*,q.status as quote_status from public.quote_lines ql join public.quotes q on q.id=ql.quote_id where ql.unit_cost>=0 loop
  s:=private.op_cap_snapshot(l.cost_snapshot,l.unit_price);
  if s->>'depreciation_cost'=l.cost_snapshot->>'depreciation_cost' then continue; end if;
  price:=l.unit_price;
  if l.quote_status='draft' and nullif(l.cost_snapshot->'inputs'->>'manual_price','') is null then price:=round((s->>'total')::numeric*coalesce((l.cost_snapshot->'inputs'->>'multiplier')::numeric,3),2); end if;
  s:=private.op_cap_snapshot(s,price);
  update public.quote_lines set unit_cost=(s->>'total')::numeric,unit_price=price,cost_snapshot=s where id=l.id;
  qcount:=qcount+1;
 end loop;
 update public.quotes q set cost_total=x.cost,price_total=x.price,version=q.version+1 from (select quote_id,sum(quantity*unit_cost) cost,sum(quantity*unit_price) price from public.quote_lines group by quote_id)x where q.id=x.quote_id and (q.cost_total<>x.cost or q.price_total<>x.price);
 for l in select * from public.order_lines loop
  s:=private.op_cap_snapshot(l.cost_snapshot,l.unit_price);
  if s->>'depreciation_cost'=l.cost_snapshot->>'depreciation_cost' then continue; end if;
  update public.order_lines set unit_cost=(s->>'total')::numeric,cost_snapshot=s where id=l.id;ocount:=ocount+1;
 end loop;
 update public.orders o set estimated_cost=x.cost,version=o.version+1 from (select order_id,sum(quantity*unit_cost) cost from public.order_lines group by order_id)x where o.id=x.order_id and o.estimated_cost<>x.cost;
 for r in select * from public.production_runs where depreciation_cost>private.op_depreciation(material_cost,depreciation_cost) loop
  dep:=private.op_depreciation(r.material_cost,r.depreciation_cost);
  update public.production_runs set depreciation_cost=dep,cost_total=cost_total-r.depreciation_cost+dep,details=private.op_cap_snapshot(details,0) where id=r.id;rcount:=rcount+1;
 end loop;
 insert into private.kapa_updates(name,details) values('easy_operations_20261023',jsonb_build_object('quote_lines_corrected',qcount,'order_lines_corrected',ocount,'production_runs_corrected',rcount,'depreciation_maximum_percent',10));
end $$;


create or replace function public.business_read(p_section text,p_search text default '',p_page integer default 0,p_from date default date_trunc('month',current_date)::date,p_to date default current_date,p_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; result jsonb; total bigint; off integer:=p_page*50; begin
 if not private.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_page is null or p_page<0 or p_page>200000 or p_from is null or p_to is null or p_from>p_to or p_to-p_from>3660 then raise exception 'Filtros inválidos. Usa un periodo de hasta diez años.' using errcode='22023'; end if;
 case p_section
  when 'capabilities' then return jsonb_build_object('schema_version',3);
  when 'material_summary' then
  select count(distinct m.id) into total from public.inventory_lots l join public.materials m on m.id=l.material_id where l.state='active' and concat_ws(' ',m.brand,m.kind,m.color) ilike '%'||p_search||'%';
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (select m.id,m.brand,m.kind,m.color,m.color_hex,count(*) as rolls,sum(l.on_hand_grams) as grams,sum(private.op_reserved(l.id)) as reserved_grams,sum(l.on_hand_grams-private.op_reserved(l.id)) as available_grams,sum(l.initial_grams) as initial_grams,round(sum(l.on_hand_grams*l.cost_per_gram),2) as value from public.inventory_lots l join public.materials m on m.id=l.material_id where l.state='active' and concat_ws(' ',m.brand,m.kind,m.color) ilike '%'||p_search||'%' group by m.id order by m.kind,m.color,m.brand limit 50 offset off)x;
 when 'purchase_detail' then
  return (select to_jsonb(p)||jsonb_build_object('debt',(select to_jsonb(d)||jsonb_build_object('balance',private.op_debt_balance(d.id),'installments',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('principal_paid',coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0),'interest_paid',coalesce((select sum(interest_paid) from public.debt_payments where installment_id=i.id),0)) order by i.number) from public.debt_installments i where i.debt_id=d.id and i.superseded_at is null),'[]')) from public.debts d where d.purchase_id=p.id and d.voided_at is null)) from public.purchases p where p.id=p_id);

 when 'opening' then return (select to_jsonb(b) from public.opening_balances b);
 when 'experiments' then
  select count(*) into total from public.print_experiments;
  select coalesce(jsonb_agg(to_jsonb(e)),'[]') into rows from (select e.*,p.name as printer_name from public.print_experiments e left join public.printers p on p.id=e.printer_id order by e.created_at desc,e.id limit 50 offset off)e;

 when 'catalog' then
  return jsonb_build_object('customers',coalesce((select jsonb_agg(to_jsonb(c)) from (select id,name,phone,whatsapp from public.customers where active order by name limit 1000)c),'[]'),
   'products',coalesce((select jsonb_agg(to_jsonb(c)) from (select * from public.products where active order by name limit 1000)c),'[]'),
   'suppliers',coalesce((select jsonb_agg(to_jsonb(c)) from (select * from public.suppliers order by name limit 1000)c),'[]'),
   'printers',coalesce((select jsonb_agg(to_jsonb(c)) from (select * from public.printers order by name limit 1000)c),'[]'),
   'lots',private.op_lots(),'partners',private.op_partners(),
   'catalog_truncated',(select count(*)>1000 from public.customers where active) or (select count(*)>1000 from public.inventory_lots));
 when 'inventory' then
  select count(*) into total from public.inventory_lots l join public.materials m on m.id=l.material_id where concat_ws(' ',m.brand,m.kind,m.color) ilike '%'||p_search||'%';
  select coalesce(jsonb_agg(x),'[]') into rows from (select to_jsonb(l)||jsonb_build_object('brand',m.brand,'kind',m.kind,'color',m.color,'color_hex',m.color_hex,'reserved_grams',private.op_reserved(l.id),'available_grams',l.on_hand_grams-private.op_reserved(l.id),'supplier_name',s.name,'color_hex',m.color_hex,'purchase',(select to_jsonb(p) from public.purchases p where p.lot_id=l.id),'financing',(select financing from public.purchases where lot_id=l.id),'debt_balance',coalesce((select sum(private.op_debt_balance(d.id)) from public.debts d join public.purchases p on p.id=d.purchase_id where p.lot_id=l.id),0)) x from public.inventory_lots l join public.materials m on m.id=l.material_id left join public.suppliers s on s.id=l.supplier_id where concat_ws(' ',m.brand,m.kind,m.color) ilike '%'||p_search||'%' order by l.created_at desc,l.id limit 50 offset off) q;
 when 'printers' then
  select count(*) into total from public.printers where concat_ws(' ',name,model) ilike '%'||p_search||'%';
  select coalesce(jsonb_agg(x),'[]') into rows from (select to_jsonb(p)||jsonb_build_object('depreciation_rate',p.acquisition_cost/nullif(p.useful_hours,0),'maintenance',coalesce((select jsonb_agg(to_jsonb(m)) from (select * from public.maintenance_records where printer_id=p.id order by performed_on desc limit 20)m),'[]'),'debt_balance',coalesce((select sum(private.op_debt_balance(d.id)) from public.debts d join public.purchases b on b.id=d.purchase_id where b.printer_id=p.id),0)) x from public.printers p where concat_ws(' ',name,model) ilike '%'||p_search||'%' order by p.created_at,p.id limit 50 offset off)q;
 when 'customers' then
  select count(*) into total from public.customers where concat_ws(' ',name,phone,city) ilike '%'||p_search||'%';
  select coalesce(jsonb_agg(x),'[]') into rows from (select to_jsonb(c)||jsonb_build_object('order_count',(select count(*) from public.orders where customer_id=c.id and status<>'cancelled'),'total_purchased',coalesce((select sum(price_total) from public.orders where customer_id=c.id and status='delivered'),0),'balance',coalesce((select sum(greatest(price_total-private.op_paid(id),0)) from public.orders where customer_id=c.id and status<>'cancelled'),0),'last_purchase',(select max(delivered_at) from public.orders where customer_id=c.id and status='delivered'),'orders',coalesce((select jsonb_agg(to_jsonb(o)) from (select id,number,description,status,price_total,private.op_paid(id) as paid,promised_at from public.orders where customer_id=c.id order by created_at desc limit 20)o),'[]'),'favorites',coalesce((select jsonb_agg(to_jsonb(a)) from (select l.description,sum(l.quantity) as quantity from public.order_lines l join public.orders o on o.id=l.order_id where o.customer_id=c.id and o.status='delivered' group by l.description order by sum(l.quantity) desc limit 5)a),'[]')) x from public.customers c where concat_ws(' ',name,phone,city) ilike '%'||p_search||'%' order by c.name,c.id limit 50 offset off)q;
 when 'quotes' then
  select count(*) into total from public.quotes q join public.customers c on c.id=q.customer_id where concat_ws(' ',q.description,c.name,q.number) ilike '%'||p_search||'%';
  select coalesce(jsonb_agg(x),'[]') into rows from (select to_jsonb(q)||jsonb_build_object('customer_name',c.name,'lines',(select jsonb_agg(to_jsonb(l) order by l.position,l.id) from public.quote_lines l where quote_id=q.id)) x from public.quotes q join public.customers c on c.id=q.customer_id where concat_ws(' ',q.description,c.name,q.number) ilike '%'||p_search||'%' order by q.created_at desc,q.id limit 50 offset off)a;
 when 'orders','calendar','receivables','balances','orders_pending_deposit','orders_confirmed','orders_design','orders_ready','orders_printing','orders_finishing','orders_ready_delivery','orders_delivered','orders_cancelled' then
  select count(*) into total from public.orders o join public.customers c on c.id=o.customer_id where o.deleted_at is null and (p_section not like 'orders_%' or o.status=substring(p_section from 8)) and (p_section<>'balances' or (o.status<>'cancelled' and o.price_total>private.op_paid(o.id))) and (p_section<>'receivables' or exists(select 1 from public.order_lines lr where lr.order_id=o.id and lr.delivered_quantity*lr.unit_price>private.op_line_paid(lr.id))) and (p_id is null or o.id=p_id) and (p_section<>'calendar' or (o.promised_at at time zone 'America/Bogota')::date between p_from and p_to) and concat_ws(' ',o.description,c.name,o.number,o.status) ilike '%'||p_search||'%';
  select coalesce(jsonb_agg(x),'[]') into rows from (select to_jsonb(o)||jsonb_build_object('customer_name',c.name,'phone',c.phone,'whatsapp',c.whatsapp,'paid',private.op_paid(o.id),'balance',o.price_total-private.op_paid(o.id),'actual_cost',private.op_production_cost(o.id),
   'lines',(select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('paid',private.op_line_paid(l.id),'produced',coalesce((select sum(good_units) from public.production_runs where order_line_id=l.id and reversed_at is null),0)) order by l.position,l.id), '[]') from public.order_lines l where order_id=o.id),
   'reservations',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.material_reservations r where order_id=o.id),
   'productions',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]') from public.production_runs r join public.order_lines l on l.id=r.order_line_id where l.order_id=o.id),
   'payments',(select coalesce(jsonb_agg(to_jsonb(v) order by v.created_at desc),'[]') from public.cash_entries v where order_id=o.id),
   'files',(select coalesce(jsonb_agg(to_jsonb(v)),'[]') from public.order_files v where order_id=o.id)) x
   from public.orders o join public.customers c on c.id=o.customer_id where o.deleted_at is null and (p_section not like 'orders_%' or o.status=substring(p_section from 8)) and (p_section<>'balances' or (o.status<>'cancelled' and o.price_total>private.op_paid(o.id))) and (p_section<>'receivables' or exists(select 1 from public.order_lines lr where lr.order_id=o.id and lr.delivered_quantity*lr.unit_price>private.op_line_paid(lr.id))) and (p_id is null or o.id=p_id) and (p_section<>'calendar' or (o.promised_at at time zone 'America/Bogota')::date between p_from and p_to) and concat_ws(' ',o.description,c.name,o.number,o.status) ilike '%'||p_search||'%' order by o.priority desc,o.queue_position,o.promised_at,o.id limit 50 offset off)a;
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
  select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('balance',private.op_debt_balance(d.id),'purchase',(select to_jsonb(p) from public.purchases p where p.id=d.purchase_id),'supplier_name',s.name,
   'installments',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('principal_paid',coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0),'interest_paid',coalesce((select sum(interest_paid) from public.debt_payments where installment_id=i.id),0)) order by i.number) from public.debt_installments i where i.debt_id=d.id and i.superseded_at is null),'[]'),
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
   'alerts',jsonb_build_object('balances',coalesce((select jsonb_agg(to_jsonb(x)) from (select o.id,o.number,o.description,c.name as customer_name,o.price_total-private.op_paid(o.id) as balance,private.op_paid(o.id) as paid from public.orders o join public.customers c on c.id=o.customer_id where o.deleted_at is null and o.status<>'cancelled' and o.price_total>private.op_paid(o.id) order by o.promised_at limit 20)x),'[]'),'stock',private.op_lots(),'orders',coalesce((select jsonb_agg(to_jsonb(o)) from (select id,number,description,promised_at,status from public.orders where status not in ('delivered','cancelled') order by promised_at limit 10)o),'[]'),
   'debts',coalesce((select jsonb_agg(to_jsonb(d)) from (select i.*,b.description from public.debt_installments i join public.debts b on b.id=i.debt_id where i.superseded_at is null and private.op_debt_balance(b.id)>0 and i.principal_due>coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0) order by i.due_on limit 10)d),'[]'),
   'stale_orders',coalesce((select jsonb_agg(to_jsonb(x)) from (select o.id,o.number,o.description,o.created_at,private.op_today()-(o.created_at at time zone 'America/Bogota')::date as waiting_days from public.orders o where o.deleted_at is null and o.status not in ('delivered','cancelled') and o.created_at<now()-interval '3 days' and not exists(select 1 from public.production_runs r join public.order_lines l on l.id=r.order_line_id where l.order_id=o.id and r.reversed_at is null) order by o.created_at limit 20)x),'[]'),
   'maintenance',coalesce((select jsonb_agg(to_jsonb(d)) from (select distinct on (printer_id) printer_id,p.name,next_due from public.maintenance_records m join public.printers p on p.id=m.printer_id where next_due is not null order by printer_id,performed_on desc,m.created_at desc)d),'[]')));
 else raise exception 'Consulta desconocida' using errcode='22023';
 end case;
 result:=jsonb_build_object('rows',coalesce(rows,'[]'),'total',total,'page',p_page);
 if p_section in ('orders','calendar','receivables','balances') or p_section like 'orders_%' then result:=result||jsonb_build_object('state_counts',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from public.orders where deleted_at is null group by status)x),'unpaid_orders',(select count(*) from public.orders where deleted_at is null and status<>'cancelled' and price_total>private.op_paid(id))); end if;
 if p_section='material_summary' then result:=result||jsonb_build_object('stock_totals',(select jsonb_build_object('rolls',count(*),'colors',count(distinct material_id),'grams',coalesce(sum(on_hand_grams),0),'available',coalesce(sum(on_hand_grams-private.op_reserved(id)),0)) from public.inventory_lots where state='active')); end if;
 if p_section in ('cash','debts','purchases','settlements') then result:=result||jsonb_build_object('summary',private.op_summary(p_from,p_to),'partners',private.op_partners()); end if;
 return result;
end $$;

create or replace function private.op_summary(f date,t date) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
 'cash',private.op_cash_balance(),
 'opening_income',(select income from public.opening_balances),
 'opening_expense',(select expense from public.opening_balances),
 'delivered_receivables',coalesce((select sum(greatest(l.delivered_quantity*l.unit_price-private.op_line_paid(l.id),0)) from public.order_lines l join public.orders o on o.id=l.order_id where o.status<>'cancelled'),0),
 'installments_scheduled',coalesce((select sum(i.principal_due+i.interest_due) from public.debt_installments i join public.debts d on d.id=i.debt_id where d.voided_at is null and i.superseded_at is null and i.due_on between f and t),0),
 'installments_pending',coalesce((select sum(greatest(i.principal_due-coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0),0)+greatest(i.interest_due-coalesce((select sum(interest_paid) from public.debt_payments where installment_id=i.id),0),0)) from public.debt_installments i join public.debts d on d.id=i.debt_id where d.voided_at is null and i.superseded_at is null and i.due_on between f and t),0),
 'installments_paid',coalesce((select sum(principal_paid+interest_paid) from public.debt_payments where paid_on between f and t),0),
 'profit_before_interest',private.op_realized(t)-private.op_realized(f-1)+coalesce((select sum(interest_paid) from public.debt_payments where paid_on between f and t),0),
 'after_installments',private.op_realized(t)-private.op_realized(f-1)-coalesce((select sum(principal_paid) from public.debt_payments where paid_on between f and t),0)-coalesce((select sum(greatest(i.principal_due-coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0),0)+greatest(i.interest_due-coalesce((select sum(interest_paid) from public.debt_payments where installment_id=i.id),0),0)) from public.debt_installments i join public.debts d on d.id=i.debt_id where d.voided_at is null and i.superseded_at is null and i.due_on between f and t),0),
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

create or replace function public.business_report(p_kind text,p_from date,p_to date,p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare query text; total bigint; rows jsonb; begin
 if not private.is_admin() then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_page is null or p_page < -1 or p_page>200000 or p_from is null or p_to is null or p_to<p_from or p_to-p_from>3660 then raise exception 'Filtros de reporte inválidos.' using errcode='22023'; end if;
 case p_kind
  when 'deliveries' then query:=$q$select 'K-'||o.number as pedido,c.name as cliente,l.description as producto,l.quantity as cantidad,l.delivered_quantity as unidades_entregadas,l.quantity-l.delivered_quantity as unidades_sin_entregar,l.quantity*l.unit_price as venta,private.op_line_paid(l.id) as cobrado,greatest(l.quantity*l.unit_price-private.op_line_paid(l.id),0) as pendiente,greatest(l.delivered_quantity*l.unit_price-private.op_line_paid(l.id),0) as entregado_por_cobrar,case when private.op_line_paid(l.id)>=l.quantity*l.unit_price then 'Pagada' when private.op_line_paid(l.id)>0 then 'Con anticipo' else 'Sin anticipo' end as estado_pago from public.order_lines l join public.orders o on o.id=l.order_id join public.customers c on c.id=o.customer_id where o.status<>'cancelled' and (o.created_at at time zone 'America/Bogota')::date between $1 and $2 order by o.number,l.id$q$;
 when 'experiments' then query:=$q$select e.created_at as fecha,case e.kind when 'test' then 'Prueba' else 'Fallida' end as tipo,e.description as descripcion,p.name as impresora,e.actual_hours as horas,e.material_cost as costo_material,0 as venta,case when e.reversed_at is null then 'Vigente' else 'Compensada' end as estado_registro from public.print_experiments e left join public.printers p on p.id=e.printer_id where (e.created_at at time zone 'America/Bogota')::date between $1 and $2 order by e.created_at,e.id$q$;
 when 'installments' then query:=$q$select d.description as concepto,case d.financing when 'credit_card' then 'Tarjeta de crédito' when 'loan' then 'Préstamo' else 'Crédito proveedor' end as financiacion,i.number as cuota,i.due_on as vencimiento,i.principal_due as capital_cuota,i.interest_due as interes_cuota,coalesce((select sum(principal_paid+interest_paid) from public.debt_payments where installment_id=i.id),0) as pagado,greatest(i.principal_due-coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0),0)+greatest(i.interest_due-coalesce((select sum(interest_paid) from public.debt_payments where installment_id=i.id),0),0) as pendiente from public.debt_installments i join public.debts d on d.id=i.debt_id where d.voided_at is null and i.superseded_at is null and i.due_on between $1 and $2 order by i.due_on,d.id,i.number$q$;
 when 'opening' then query:=$q$select effective_on as fecha,income as ingresos_iniciales,expense as gastos_iniciales,cash_amount as caja_inicial,notes as motivo,updated_at as ultima_actualizacion from public.opening_balances order by effective_on$q$;

 when 'sales','profitability' then query:=$q$select 'K-'||o.number as codigo,c.name as cliente,o.description as producto,o.status as estado,o.created_at as creado,o.delivered_at as entregado,o.price_total as venta,private.op_paid(o.id) as cobrado,o.price_total-private.op_paid(o.id) as pendiente,o.estimated_cost as costo_estimado,private.op_production_cost(o.id) as costo_real,o.price_total-private.op_production_cost(o.id) as ganancia_real,case when o.status='delivered' and private.op_paid(o.id)>=o.price_total then 'Sí' else 'No' end as utilidad_realizada from public.orders o join public.customers c on c.id=o.customer_id where (o.created_at at time zone 'America/Bogota')::date between $1 and $2 order by o.created_at,o.id$q$;
 when 'costs' then query:=$q$select 'C-'||q.number as cotizacion,l.description as producto,l.quantity as cantidad,l.estimated_hours as horas_unidad,l.unit_cost as costo_unidad,l.unit_price as precio_unidad,l.quantity*l.unit_cost as costo_total,l.quantity*l.unit_price as precio_total,l.quantity*(l.unit_price-l.unit_cost) as ganancia_estimada from public.quote_lines l join public.quotes q on q.id=l.quote_id where (q.created_at at time zone 'America/Bogota')::date between $1 and $2 order by q.number,l.id$q$;
 when 'inventory' then query:=$q$select m.brand as marca,m.kind as material,m.color as color,l.purchased_on as fecha_compra,l.initial_grams as gramos_iniciales,l.on_hand_grams as gramos_fisicos,private.op_reserved(l.id) as gramos_reservados,l.on_hand_grams-private.op_reserved(l.id) as gramos_disponibles,round(l.cost_per_gram,6) as costo_gramo,round((l.on_hand_grams-private.op_reserved(l.id))*l.cost_per_gram,2) as valor_disponible from public.inventory_lots l join public.materials m on m.id=l.material_id order by m.kind,m.color,l.id$q$;
 when 'consumption' then query:=$q$select i.created_at as fecha,m.brand as marca,m.kind as material,m.color,i.kind as movimiento,i.delta_grams as cambio_fisico,i.reserved_delta as cambio_reserva,i.expense_amount as costo_merma,i.reason as motivo,'K-'||o.number as pedido,u.display_name as responsable from public.inventory_movements i join public.inventory_lots l on l.id=i.lot_id join public.materials m on m.id=l.material_id left join public.orders o on o.id=i.order_id left join public.user_profiles u on u.user_id=i.created_by where (i.created_at at time zone 'America/Bogota')::date between $1 and $2 order by i.created_at,i.id$q$;
 when 'cash' then query:=$q$select c.occurred_on as fecha,c.category as categoria,c.description as descripcion,c.amount as valor,c.method as medio_pago,c.profit_effect as efecto_utilidad,u.display_name as responsable,c.authorization_reason as autorizacion from public.cash_entries c left join public.user_profiles u on u.user_id=c.created_by where c.occurred_on between $1 and $2 order by c.occurred_on,c.created_at,c.id$q$;
 when 'expenses' then query:=$q$select categoria,sum(valor) as gasto from (select coalesce(orig.category,c.category) as categoria,-c.profit_effect as valor from public.cash_entries c left join public.cash_entries orig on orig.id=c.reverses_id where c.occurred_on between $1 and $2 and coalesce(orig.category,c.category) not in ('other_income','direct_sale','capital') union all select 'compra_operativa',expense_amount from public.purchases where category='operating' and voided_at is null and purchased_on between $1 and $2 union all select 'merma_inventario',expense_amount from public.inventory_movements where (created_at at time zone 'America/Bogota')::date between $1 and $2) x group by categoria having sum(valor)<>0 order by sum(valor) desc$q$;
 when 'debts' then query:=$q$select d.description as concepto,case d.financing when 'credit_card' then 'Tarjeta de crédito' when 'loan' then 'Préstamo' else 'Crédito proveedor' end as financiacion,s.name as proveedor,d.principal as capital_inicial,private.op_debt_balance(d.id) as capital_pendiente,d.monthly_payment as cuota_referencia,d.installment_count as cuotas,(select count(*) from public.debt_installments i where i.debt_id=d.id and i.superseded_at is null and i.principal_due<=coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0)) as cuotas_pagadas,(select min(due_on) from public.debt_installments i where i.debt_id=d.id and i.superseded_at is null and (i.principal_due>coalesce((select sum(principal_paid) from public.debt_payments where installment_id=i.id),0) or i.interest_due>coalesce((select sum(interest_paid) from public.debt_payments where installment_id=i.id),0))) as proximo_vencimiento from public.debts d left join public.suppliers s on s.id=d.supplier_id order by d.created_at,d.id$q$;
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

create or replace function private.op_lots() returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by purchased_on desc,id),'[]') from (
 select l.*,m.brand,m.kind,m.color,m.color_hex,private.op_reserved(l.id) as reserved_grams,l.on_hand_grams-private.op_reserved(l.id) as available_grams,
 coalesce(s.name,'Sin proveedor') as supplier_name,
 (select sum(d.principal-coalesce((select sum(principal_paid) from public.debt_payments where debt_id=d.id),0)) from public.debts d join public.purchases p on p.id=d.purchase_id where p.lot_id=l.id) as debt_balance
 from public.inventory_lots l join public.materials m on m.id=l.material_id left join public.suppliers s on s.id=l.supplier_id order by l.purchased_on desc limit 1000
 ) x
$$;

revoke all on function private.op_depreciation(numeric,numeric),private.op_cap_snapshot(jsonb,numeric),private.op_replan_debt(uuid,jsonb),private.op_complete_missing(uuid,text) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
