import { MonthlyBudget } from "../finance/MonthlyBudget";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Plus, RefreshCw } from "lucide-react";
import { PageTitle } from "../../components/ui";
import { DateRange, ReadState, Stat } from "../../components/business";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../../lib/WorkspaceProvider";
import {
  useBusiness,
  today,
  yearStart,
  type Dashboard,
} from "../../lib/operations";
import { money, dateTime } from "../../lib/format";
import { PartnerCards } from "../finance/FinancePage";
const colors = [
  "#701b34",
  "#ad778b",
  "#c79b57",
  "#ab7e68",
  "#a84454",
  "#d1b28e",
];
function ChartCard({
  title,
  children,
  empty = false,
}: {
  title: string;
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <section className="panel chart-card">
      <h2>{title}</h2>
      {empty ? (
        <div className="chart-empty">Sin registros para este periodo.</div>
      ) : (
        <div className="chart-container">{children}</div>
      )}
    </section>
  );
}
export function OverviewPage() {
  const { profile } = useAuth(),
    { settings } = useWorkspace();
  const [from, setFrom] = useState(yearStart()),
    [to, setTo] = useState(today());
  const { data, error, loading, refresh } = useBusiness<Dashboard>(
    "dashboard",
    { from, to },
  );
  const s = data?.summary;
  return (
    <>
      <PageTitle
        eyebrow="VISTA GENERAL"
        title={"Hola, " + profile?.display_name + "."}
        description="Tu taller y tus finanzas, con información real del negocio."
        action={
          <Link className="button primary" to="/cotizaciones">
            <Plus size={17} />
            Nueva cotización
          </Link>
        }
      />
      <MonthlyBudget />
      {!!data?.alerts.balances?.length && (
        <section className="panel month-budget">
          <h2>Clientes con saldo pendiente</h2>
          {data.alerts.balances.map((o) => (
            <p key={o.id}>
              <Link to={"/pedidos?pedido=" + o.id}>
                K-{o.number} · {o.customer_name} · {money(o.balance)}{" "}
                {o.paid === 0 ? "· Sin anticipo" : "· Abono recibido"} ↗
              </Link>
            </p>
          ))}
        </section>
      )}
      {!!data?.alerts.stale_orders?.length && (
        <section className="panel month-budget">
          <h2>Pedidos sin iniciar hace 3 días o más</h2>
          {data.alerts.stale_orders.map((o) => (
            <p key={o.id}>
              <Link to={"/pedidos?pedido=" + o.id}>
                K-{o.number} · {o.description} · {o.waiting_days} días esperando
                ↗
              </Link>
            </p>
          ))}
        </section>
      )}
      <div className="dashboard-filters">
        <DateRange
          from={from}
          to={to}
          onChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
        />
        <button className="button secondary" onClick={refresh}>
          <RefreshCw size={16} />
          Actualizar
        </button>
        <Link to="/reportes" className="text-link">
          Reportes y exportaciones <ArrowRight size={15} />
        </Link>
      </div>
      <ReadState loading={loading} error={error} retry={refresh}>
        {s && data && (
          <>
            <div className="business-stats dashboard-metrics">
              <Stat
                label="Caja disponible actual"
                value={money(s.cash)}
                tone="featured"
                hint="Entradas menos salidas efectivas."
              />
              <Stat
                label="Ventas cobradas · periodo"
                value={money(s.sales_collected)}
              />
              <Stat
                label="Cuentas por cobrar actuales"
                value={money(s.receivables)}
              />
              <Stat
                label="Utilidad realizada · periodo"
                value={money(s.realized_profit)}
                hint="Entregas totalmente cobradas menos costos y gastos."
              />
              <Stat
                label="Ganancia estimada · pedidos activos"
                value={money(s.estimated_profit)}
              />
              <Stat
                label="Gastos operativos · periodo"
                value={money(s.operating_expenses)}
              />
              <Stat
                label="Deudas de capital pendientes"
                value={money(s.debt_balance)}
              />
              <Stat
                label="Inventario disponible actual"
                value={money(s.inventory_value)}
              />
              <Stat label="Pedidos activos" value={s.active_orders} />
              <Stat label="Listos para entregar" value={s.ready_orders} />
              <Stat
                label="Pedidos atrasados"
                value={s.overdue_orders}
                tone={s.overdue_orders ? "warning" : ""}
              />
              <Stat label="Completados · periodo" value={s.completed_orders} />
            </div>
            <div className="charts-grid">
              <ChartCard title="Ventas cobradas por mes">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      width={65}
                      tickFormatter={(v) =>
                        Number(v).toLocaleString("es-CO", {
                          notation: "compact",
                        })
                      }
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip formatter={(v) => money(Number(v))} />
                    <Line
                      isAnimationActive={false}
                      name="Ventas cobradas"
                      type="monotone"
                      dataKey="sales"
                      stroke="#701b34"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Ingresos y salidas de caja">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      width={65}
                      tickFormatter={(v) =>
                        Number(v).toLocaleString("es-CO", {
                          notation: "compact",
                        })
                      }
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip formatter={(v) => money(Number(v))} />
                    <Legend />
                    <Bar
                      isAnimationActive={false}
                      dataKey="income"
                      name="Ingresos"
                      fill="#701b34"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      isAnimationActive={false}
                      dataKey="expenses"
                      name="Salidas"
                      fill="#c19483"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Utilidad neta realizada por mes">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      width={65}
                      tickFormatter={(v) =>
                        Number(v).toLocaleString("es-CO", {
                          notation: "compact",
                        })
                      }
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip formatter={(v) => money(Number(v))} />
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="profit"
                      name="Utilidad"
                      stroke="#8a4563"
                      fill="#f3e1e5"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard
                title="Productos más vendidos"
                empty={!data.top_products.length}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.top_products} layout="vertical">
                    <XAxis type="number" />
                    <YAxis
                      type="category"
                      width={105}
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip />
                    <Bar
                      isAnimationActive={false}
                      name="Unidades entregadas"
                      dataKey="quantity"
                      fill="#701b34"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard
                title="Consumo real de filamento"
                empty={!data.consumption.some((c) => c.grams > 0)}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      isAnimationActive={false}
                      data={data.consumption.filter((c) => c.grams > 0)}
                      dataKey="grams"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={82}
                      paddingAngle={3}
                    >
                      {data.consumption.map((_, i) => (
                        <Cell key={i} fill={colors[i % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) =>
                        Number(v).toLocaleString("es-CO") + " g"
                      }
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Evolución de pedidos creados">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar
                      isAnimationActive={false}
                      dataKey="orders"
                      name="Pedidos"
                      fill="#c79b57"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <div className="dashboard-alerts">
              <section className="panel">
                <h2>Materiales que necesitan atención</h2>
                {!data.alerts.stock.some(
                  (l) =>
                    l.state === "active" &&
                    l.available_grams < settings.low_stock_grams,
                ) ? (
                  <p>No hay alertas de filamento.</p>
                ) : (
                  data.alerts.stock
                    .filter(
                      (l) =>
                        l.state === "active" &&
                        l.available_grams < settings.low_stock_grams,
                    )
                    .map((l) => (
                      <Link className="alert-row" to="/inventario" key={l.id}>
                        <span>
                          {l.kind} · {l.color}
                          <small>{l.brand}</small>
                        </span>
                        <strong
                          className={
                            l.available_grams <= settings.critical_stock_grams
                              ? "text-danger"
                              : ""
                          }
                        >
                          {l.available_grams} g
                        </strong>
                      </Link>
                    ))
                )}
              </section>
              <section className="panel">
                <h2>Próximas entregas</h2>
                {data.alerts.orders.length ? (
                  data.alerts.orders.map((o) => (
                    <Link
                      className="alert-row"
                      to={"/pedidos?pedido=" + o.id}
                      key={o.id}
                    >
                      <span>
                        K-{o.number} · {o.description}
                      </span>
                      <small
                        className={
                          new Date(o.promised_at) < new Date()
                            ? "text-danger"
                            : ""
                        }
                      >
                        {dateTime(o.promised_at)}
                      </small>
                    </Link>
                  ))
                ) : (
                  <p>No hay pedidos activos.</p>
                )}
              </section>
              <section className="panel">
                <h2>Obligaciones y mantenimiento</h2>
                {!data.alerts.debts.length &&
                !data.alerts.maintenance.length ? (
                  <p>No hay vencimientos registrados.</p>
                ) : (
                  <>
                    {data.alerts.debts.map((d) => (
                      <Link className="alert-row" to="/finanzas" key={d.id}>
                        <span>
                          {d.description} · Cuota {d.number}
                        </span>
                        <small
                          className={d.due_on < today() ? "text-danger" : ""}
                        >
                          {d.due_on}
                        </small>
                      </Link>
                    ))}
                    {data.alerts.maintenance.map((m) => (
                      <Link
                        className="alert-row"
                        to="/impresoras"
                        key={m.printer_id}
                      >
                        <span>Mantenimiento · {m.name}</span>
                        <small>{m.next_due}</small>
                      </Link>
                    ))}
                  </>
                )}
              </section>
            </div>
            <div className="section-heading">
              <div>
                <span className="eyebrow">SOCIOS · SALDOS ACTUALES</span>
                <h2>John y Sebas, 50 / 50.</h2>
              </div>
              <Link to="/finanzas" className="text-link">
                Liquidaciones y retiros <ArrowRight size={15} />
              </Link>
            </div>
            <PartnerCards partners={data.partners} />
            <p className="field-help">
              Los filtros aplican a ventas, gastos, ganancias, gráficos y
              pedidos completados. Caja, stock, cuentas pendientes y socios
              muestran el saldo actual. Las amortizaciones y estimaciones de
              energía son costos económicos, no pagos automáticos.
            </p>
          </>
        )}
      </ReadState>
    </>
  );
}
