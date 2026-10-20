import { useCallback, useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import type { Database, Json } from "./database.types";
import { database } from "./supabase";
import { errorMessage } from "./format";

export type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Lot = Row<"inventory_lots"> & {
  cost_per_gram: number;
  brand: string;
  kind: string;
  color: string;
  reserved_grams: number;
  available_grams: number;
  supplier_name: string | null;
  debt_balance?: number;
  financing?: string;
};
export type Printer = Row<"printers"> & {
  depreciation_rate: number | null;
  maintenance: Row<"maintenance_records">[];
  debt_balance: number;
};
export type Customer = Row<"customers"> & {
  order_count: number;
  total_purchased: number;
  balance: number;
  last_purchase: string | null;
  orders: Pick<
    Order,
    | "id"
    | "number"
    | "description"
    | "status"
    | "price_total"
    | "paid"
    | "promised_at"
  >[];
  favorites: { description: string; quantity: number }[];
};
export type Quote = Row<"quotes"> & {
  customer_name: string;
  lines: Row<"quote_lines">[];
};
export type Order = Row<"orders"> & {
  customer_name: string;
  phone: string;
  whatsapp: string;
  paid: number;
  balance: number;
  actual_cost: number;
  lines: (Row<"order_lines"> & { produced: number; paid: number })[];
  reservations: Row<"material_reservations">[];
  productions: Row<"production_runs">[];
  payments: Row<"cash_entries">[];
  files: Row<"order_files">[];
};
export type Debt = Row<"debts"> & {
  balance: number;
  supplier_name: string | null;
  installments: (Row<"debt_installments"> & {
    principal_paid: number;
    interest_paid: number;
  })[];
  payments: Row<"debt_payments">[];
};
export type PartnerBalance = Row<"partners"> & {
  balance: number;
  pending_advances: number;
  allocated: number;
  advances: number;
  withdrawals: number;
  compensated: number;
  contributions: number;
};
export type Summary = Record<
  | "cash"
  | "delivered_receivables"
  | "installments_scheduled"
  | "installments_pending"
  | "installments_paid"
  | "profit_before_interest"
  | "after_installments"
  | "opening_income"
  | "opening_expense"
  | "sales_collected"
  | "receivables"
  | "realized_profit"
  | "cumulative_profit"
  | "unsettled_profit"
  | "business_reserve"
  | "estimated_profit"
  | "operating_expenses"
  | "debt_balance"
  | "active_orders"
  | "ready_orders"
  | "overdue_orders"
  | "completed_orders"
  | "inventory_value"
  | "low_stock"
  | "income"
  | "outgoings",
  number
>;
export type PageData<T> = {
  rows: T[];
  total: number;
  page: number;
  summary?: Summary;
  partners?: PartnerBalance[];
};
export type Catalog = {
  customers: Pick<Customer, "id" | "name" | "phone" | "whatsapp">[];
  products: Row<"products">[];
  suppliers: Row<"suppliers">[];
  printers: Row<"printers">[];
  lots: Lot[];
  partners: PartnerBalance[];
  catalog_truncated: boolean;
};
export type CostMaterial = {
  lot_id: string;
  piece_grams: string;
  support_grams: string;
  waste_grams: string;
};
export type CostInputs = {
  printer_id: string;
  hours: string;
  extra_items?: { description: string; quantity: string; unit_cost: string }[];
  materials: CostMaterial[];
  labor_hours: string;
  painting_hours: string;
  painting_materials: string;
  supplies_cost: string;
  customization_cost: string;
  packaging_cost: string;
  other_cost: string;
  multiplier: string;
  manual_price: string;
};
export type CostResult = {
  material_cost: number;
  depreciation_cost: number;
  energy_cost: number;
  labor_cost: number;
  painting_cost: number;
  extras_cost: number;
  total: number;
  price: number;
  profit: number;
  margin: number;
  markup: number;
  materials: (CostMaterial & { grams: number; cost_per_gram: number })[];
};
export type QueueItem = {
  order_id: string;
  number: number;
  description: string;
  priority: number;
  queue_position: number;
  promised_at: string;
  printer_name: string;
  printer_status: string;
  printer_id: string;
  remaining_hours: number;
  running_hours: number;
  estimated_finish: string;
  previous_finish?: string;
};
export type Dashboard = {
  summary: Summary;
  partners: PartnerBalance[];
  monthly: {
    month: string;
    income: number;
    expenses: number;
    sales: number;
    profit: number;
    orders: number;
  }[];
  top_products: { name: string; quantity: number; sales: number }[];
  consumption: { name: string; grams: number }[];
  alerts: {
    stale_orders: {
      id: string;
      number: number;
      description: string;
      created_at: string;
      waiting_days: number;
    }[];
    stock: Lot[];
    orders: Pick<
      Order,
      "id" | "number" | "description" | "promised_at" | "status"
    >[];
    debts: (Row<"debt_installments"> & { description: string })[];
    maintenance: { printer_id: string; name: string; next_due: string }[];
  };
};
export const statusNames: Record<string, string> = {
  pending_deposit: "Pendiente de anticipo",
  confirmed: "Confirmado",
  design: "En diseño",
  ready: "Listo para imprimir",
  printing: "Imprimiendo",
  finishing: "En acabado o pintado",
  ready_delivery: "Listo para entregar",
  delivered: "Entregado",
  cancelled: "Cancelado",
};
export const printerStates: Record<string, string> = {
  available: "Disponible",
  printing: "Imprimiendo",
  maintenance: "Mantenimiento",
  inactive: "Inactiva",
};
export const categoryNames: Record<string, string> = {
  deposit: "Anticipo",
  order_payment: "Saldo de pedido",
  refund: "Devolución",
  capital: "Aporte de capital",
  other_income: "Otro ingreso",
  direct_sale: "Venta directa",
  expense: "Gasto operativo",
  transport: "Transporte",
  shipping: "Envíos",
  energy: "Energía pagada",
  supplies: "Insumos",
  parts: "Repuestos",
  inventory_purchase: "Compra de filamento",
  purchase_refund: "Reembolso de compra",
  asset_purchase: "Compra de impresora",
  operating_purchase: "Compra operativa",
  loan: "Préstamo recibido",
  debt_principal: "Capital de deuda",
  interest: "Intereses",
  maintenance: "Mantenimiento",
  partner_advance: "Adelanto a socio",
  partner_withdrawal: "Retiro de utilidades",
  reversal: "Compensación",
};
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(
    new Date(),
  );
export const yearStart = () => today().slice(0, 4) + "-01-01";
export const lotName = (l: Lot) =>
  [l.brand, l.kind, l.color].join(" · ") +
  " · " +
  Number(l.available_grams).toLocaleString("es-CO") +
  " g libres";
export function safeUrl(value: string) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
export function whatsappUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return digits
    ? "https://wa.me/" +
        (digits.length === 10 ? "57" : "") +
        digits +
        "?text=" +
        encodeURIComponent(message)
    : null;
}
export function piecePayments(line: {
  quantity: number;
  unit_price: number;
  paid: number;
}) {
  const unit = new Decimal(line.unit_price),
    total = unit.times(line.quantity),
    paid = new Decimal(line.paid);
  return {
    paidInFull: paid.gte(total),
    balance: Decimal.max(total.minus(paid), 0)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber(),
    paidUnits: unit.gt(0)
      ? Math.min(line.quantity, Math.max(0, paid.div(unit).floor().toNumber()))
      : line.quantity,
  };
}
export function calculateCost(
  inputs: CostInputs,
  printer: Row<"printers">,
  lots: Lot[],
  energyRate: number | null,
  laborRate: number | null,
): CostResult {
  const d = (s: string | number) => {
    const v = new Decimal(s || 0);
    if (!v.isFinite() || v.isNegative())
      throw Error("Usa valores positivos o cero.");
    return v;
  };
  if (
    printer.acquisition_cost === null ||
    printer.useful_hours === null ||
    printer.power_kw === null ||
    (printer.energy_rate ?? energyRate) === null ||
    laborRate === null
  )
    throw Error("Completa los costos de impresora, energía y mano de obra.");
  if (d(inputs.hours).lte(0) || !inputs.materials.length)
    throw Error("Indica horas y filamento.");
  const materials = inputs.materials.map((m) => {
    const lot = lots.find((l) => l.id === m.lot_id);
    if (!lot) throw Error("Selecciona un filamento.");
    const grams = d(m.piece_grams)
      .plus(d(m.support_grams))
      .plus(d(m.waste_grams))
      .toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    if (grams.lte(0)) throw Error("Indica gramos positivos.");
    return {
      ...m,
      grams: grams.toNumber(),
      cost_per_gram: new Decimal(lot.purchase_cost)
        .div(lot.initial_grams)
        .toNumber(),
    };
  });
  const material = materials.reduce((s, m) => {
    const lot = lots.find((l) => l.id === m.lot_id);
    if (!lot) throw Error("Selecciona un filamento.");
    return s.plus(d(m.grams).times(lot.purchase_cost).div(lot.initial_grams));
  }, new Decimal(0));
  const dep = d(inputs.hours)
      .toDecimalPlaces(3, Decimal.ROUND_HALF_UP)
      .times(printer.acquisition_cost)
      .div(printer.useful_hours),
    energy = d(inputs.hours)
      .toDecimalPlaces(3, Decimal.ROUND_HALF_UP)
      .times(printer.power_kw)
      .times(printer.energy_rate ?? energyRate ?? 0);
  const labor = d(inputs.labor_hours).times(laborRate),
    painting = d(inputs.painting_hours)
      .times(laborRate)
      .plus(d(inputs.painting_materials));
  const itemized = (inputs.extra_items ?? []).reduce((sum, item) => {
    if (!item.description.trim() || d(item.quantity).lte(0))
      throw Error("Describe el insumo y su cantidad.");
    return sum.plus(d(item.quantity).times(d(item.unit_cost)));
  }, new Decimal(0));
  const extras = itemized
    .plus(d(inputs.supplies_cost))
    .plus(d(inputs.customization_cost))
    .plus(d(inputs.packaging_cost))
    .plus(d(inputs.other_cost));
  const total = material
    .plus(dep)
    .plus(energy)
    .plus(labor)
    .plus(painting)
    .plus(extras)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const price = (
      inputs.manual_price !== ""
        ? d(inputs.manual_price)
        : total.times(d(inputs.multiplier))
    ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    profit = price.minus(total);
  const n = (v: Decimal) =>
    v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  return {
    material_cost: n(material),
    depreciation_cost: n(dep),
    energy_cost: n(energy),
    labor_cost: n(labor),
    painting_cost: n(painting),
    extras_cost: n(extras),
    total: n(total),
    price: n(price),
    profit: n(profit),
    margin: price.gt(0) ? profit.div(price).times(100).toNumber() : 0,
    markup: total.gt(0) ? profit.div(total).times(100).toNumber() : 0,
    materials,
  };
}
export async function readBusiness<T>(
  section: string,
  options: {
    page?: number;
    search?: string;
    from?: string;
    to?: string;
    id?: string;
  } = {},
): Promise<T> {
  const { data, error } = await database().rpc("business_read", {
    p_section: section,
    p_page: options.page ?? 0,
    p_search: options.search ?? "",
    p_from: options.from ?? yearStart(),
    p_to: options.to ?? today(),
    p_id: options.id,
  });
  if (error) throw error;
  return data as unknown as T;
}
export function useBusiness<T>(
  section: string,
  options: {
    page?: number;
    search?: string;
    from?: string;
    to?: string;
    id?: string;
  } = {},
) {
  const [result, setResult] = useState<{ key: string; data: T } | null>(null),
    [failure, setFailure] = useState<{ key: string; message: string } | null>(
      null,
    ),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const key = JSON.stringify(options),
    requestKey = section + key,
    refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    window.addEventListener("kapa:changed", refresh);
    return () => window.removeEventListener("kapa:changed", refresh);
  }, [refresh]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailure(null);
    void readBusiness<T>(section, JSON.parse(key) as typeof options)
      .then((v) => {
        if (alive) setResult({ key: requestKey, data: v });
      })
      .catch((e) => {
        if (alive) setFailure({ key: requestKey, message: errorMessage(e) });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [section, key, requestKey, revision]);
  const data = result?.key === requestKey ? result.data : null,
    error = failure?.key === requestKey ? failure.message : null;
  return { data, error, loading: loading || (!data && !error), refresh };
}
export function useOperation() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [success, setSuccess] = useState<string | null>(null);
  const locked = useRef(false),
    request = useRef<{ signature: string; id: string } | null>(null);
  async function run(
    action: string,
    payload: Record<string, Json | undefined>,
    message = "Operación guardada.",
  ) {
    if (locked.current) return null;
    locked.current = true;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const signature = JSON.stringify({ action, payload });
    if (request.current?.signature !== signature)
      request.current = { signature, id: crypto.randomUUID() };
    try {
      const result = await database().rpc("business_operate", {
        p_action: action,
        p_data: payload,
        p_request_id: request.current.id,
      });
      if (result.error) throw result.error;
      request.current = null;
      setSuccess(message);
      window.dispatchEvent(new CustomEvent("kapa:notice", { detail: message }));
      window.dispatchEvent(new Event("kapa:changed"));
      return result.data as { id: string; action: string };
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return {
    run,
    busy,
    error,
    success,
    clear: () => {
      setError(null);
      setSuccess(null);
    },
  };
}
export function csvText(headers: string[], rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    let s = v === null ? "" : String(v);
    if (typeof v === "string" && /^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(cell).join(";")).join("\r\n")
  );
}
export function downloadCsv(
  name: string,
  headers: string[],
  rows: (string | number | null)[][],
) {
  const url = URL.createObjectURL(
    new Blob([csvText(headers, rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
