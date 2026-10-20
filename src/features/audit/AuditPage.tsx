import { useCallback, useEffect, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { database } from "../../lib/supabase";
import { dateTime, errorMessage, money } from "../../lib/format";
import type { Database, Json } from "../../lib/database.types";
import { ErrorState, Loading, PageTitle } from "../../components/ui";
import { useWorkspace } from "../../lib/WorkspaceProvider";

type Audit = Database["public"]["Tables"]["audit_log"]["Row"];
const size = 20;
const names: Record<string, string> = {
  inventory_lots: "Lotes de filamento",
  inventory_movements: "Movimiento de material",
  material_reservations: "Reserva de material",
  printers: "Impresora",
  maintenance_records: "Mantenimiento",
  customers: "Cliente",
  suppliers: "Proveedor",
  products: "Producto",
  quotes: "Cotización",
  quote_lines: "Detalle de cotización",
  orders: "Pedido",
  order_lines: "Detalle de pedido",
  production_runs: "Producción",
  purchases: "Compra",
  debts: "Deuda",
  debt_installments: "Cuota",
  debt_payments: "Pago de deuda",
  cash_entries: "Movimiento de caja",
  settlements: "Liquidación",
  partner_allocations: "Utilidad asignada",
  partner_advances: "Adelanto a socio",
  partner_withdrawals: "Retiro de utilidades",
  advance_compensations: "Compensación de adelanto",
  order_files: "Adjunto de pedido",
  materials: "Material",
  business_settings: "Configuración del negocio",
  user_profiles: "Acceso de socios",
  partners: "Socios",
};
const operations: Record<string, string> = {
  INSERT: "Creación",
  UPDATE: "Actualización",
  DELETE: "Eliminación",
};
const fields: Record<string, string> = {
  name: "Nombre",
  description: "Descripción",
  status: "Estado",
  priority: "Prioridad",
  promised_at: "Fecha comprometida",
  price_total: "Precio total",
  cost_total: "Costo total",
  amount: "Valor",
  category: "Categoría",
  method: "Medio de pago",
  occurred_on: "Fecha del movimiento",
  on_hand_grams: "Gramos físicos",
  delta_grams: "Cambio de gramos",
  reserved_delta: "Cambio de reserva",
  grams: "Gramos reservados",
  reason: "Motivo",
  good_units: "Unidades producidas",
  actual_hours: "Horas reales",
  accumulated_hours: "Horas acumuladas",
  principal: "Capital inicial",
  principal_paid: "Capital pagado",
  interest_paid: "Interés pagado",
  profit_recognized: "Utilidad reconocida",
  reserved: "Reserva empresarial",
  distributed: "Utilidad distribuida",
  reserve_release: "Reserva liberada",
  authorization_reason: "Autorización",
  reversed_at: "Fecha de compensación",
  notes: "Notas",
  business_name: "Nombre del negocio",
  display_name: "Nombre del socio",
  active: "Acceso a la cuenta",
  role: "Permisos",
  share_basis_points: "Participación",
  default_deposit_percent: "Anticipo predeterminado",
  low_stock_grams: "Alerta de stock bajo",
  critical_stock_grams: "Alerta de stock crítico",
  reference_filament_kg_cost: "Filamento de referencia / kg",
  energy_kwh_cost: "Tarifa de energía / kWh",
  labor_hour_cost: "Mano de obra / hora",
};
function displayValue(field: string, value: Json | undefined) {
  if (value === undefined) return "—";
  if (value === null) return "Sin configurar";
  if (field === "active") return value ? "Habilitado" : "Deshabilitado";
  if (field === "role")
    return value === "admin" ? "Administrador" : String(value);
  if (field.endsWith("_cost")) return money(Number(value));
  if (field.endsWith("_grams")) return `${value} g`;
  if (field === "default_deposit_percent") return `${value} %`;
  if (field === "share_basis_points") return `${Number(value) / 100} %`;
  return String(value);
}
function ChangeDetails({ row }: { row: Audit }) {
  const record = (value: Json | null) =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const before = record(row.old_record),
    after = record(row.new_record);
  const changed = Object.entries(fields).filter(
    ([field]) => before[field] !== after[field],
  );
  return (
    <dl className="change-list">
      {changed.length ? (
        changed.map(([field, label]) => (
          <div key={field}>
            <dt>{label}</dt>
            <dd>
              <span>
                <small>Antes</small>
                {displayValue(field, before[field])}
              </span>
              <span>
                <small>Después</small>
                {displayValue(field, after[field])}
              </span>
            </dd>
          </div>
        ))
      ) : (
        <p>No se modificaron los parámetros del negocio.</p>
      )}
    </dl>
  );
}
export function AuditPage() {
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const { members } = useWorkspace();
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: readError } = await database()
        .from("audit_log")
        .select("*")
        .order("id", { ascending: false })
        .range(page * size, (page + 1) * size);
      if (readError) throw readError;
      setRows(data.slice(0, size));
      setHasNext(data.length > size);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <PageTitle
        eyebrow="TRAZABILIDAD"
        title="Cada cambio tiene una historia."
        description="Consulta quién cambió qué, y cuándo. Fechas en la zona horaria de Bogotá."
        action={
          <button
            className="button secondary"
            onClick={() => {
              void load();
            }}
            disabled={loading}
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        }
      />
      <section className="panel audit-panel">
        {loading ? (
          <Loading label="Consultando historial…" />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => {
              void load();
            }}
          />
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <Activity size={36} />
            <h2>Un comienzo limpio.</h2>
            <p>
              Cuando se actualice la configuración o se vincule un socio, el
              cambio aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="audit-list">
            {rows.map((row) => (
              <article className="audit-row" key={row.id}>
                <span className="audit-icon">
                  <Activity size={18} />
                </span>
                <div className="audit-body">
                  <h3>{names[row.entity] ?? row.entity}</h3>
                  <p>
                    {operations[row.operation]} ·{" "}
                    {row.actor_id
                      ? (members.find((m) => m.user_id === row.actor_id)
                          ?.display_name ?? "Administrador")
                      : "Sistema / aprovisionamiento"}
                  </p>
                  <time dateTime={row.occurred_at}>
                    {dateTime(row.occurred_at)}
                  </time>
                  <details>
                    <summary>Ver detalle del cambio</summary>
                    <ChangeDetails row={row} />
                  </details>
                </div>
                <span className="audit-id">#{row.id}</span>
              </article>
            ))}
          </div>
        )}
        <div className="pagination">
          <span>
            Página {page + 1} · {size} registros por página
          </span>
          <div>
            <button
              className="button secondary"
              aria-label="Página anterior"
              disabled={page === 0 || loading}
              onClick={() => setPage((v) => v - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="button secondary"
              aria-label="Página siguiente"
              disabled={!hasNext || loading}
              onClick={() => setPage((v) => v + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
