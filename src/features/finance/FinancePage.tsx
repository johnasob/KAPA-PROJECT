import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Plus, Undo2 } from "lucide-react";
import { PageTitle } from "../../components/ui";
import {
  DateRange,
  Empty,
  OperationForm,
  Pagination,
  ReadState,
  Stat,
  Tabs,
  Toolbar,
  moneyFields,
  optionList,
  useCatalog,
  type Field,
} from "../../components/business";
import {
  categoryNames,
  today,
  yearStart,
  useBusiness,
  type Debt,
  type PageData,
  type PartnerBalance,
  type Row,
} from "../../lib/operations";
import { money } from "../../lib/format";
type Cash = Row<"cash_entries"> & { responsible: string; reversed_by: string };
type Purchase = Row<"purchases"> & {
  supplier_name: string;
  debt_balance: number;
};
type FormConfig = {
  title: string;
  action: string;
  description?: string;
  fields: Field[];
  extra?: Record<string, string | number>;
  initial?: Record<string, string>;
  checks?: { name: string; label: string }[];
};
const cashDateFields = () =>
  moneyFields.map((f) => ({
    ...f,
    default: f.name === "date" ? today() : f.default,
  }));
const authField: Field = {
  name: "authorization_reason",
  label: "Motivo de autorización excepcional",
  type: "textarea",
  hint: "Mínimo 10 caracteres si autorizas un sobregiro.",
};
const negativeCheck = {
  name: "allow_negative_cash",
  label:
    "Autorizo expresamente caja negativa si esta salida supera el dinero disponible.",
};
export function PartnerCards({ partners }: { partners: PartnerBalance[] }) {
  return (
    <div className="partner-grid">
      {partners.map((p, i) => (
        <article className="panel partner-card" key={p.id}>
          <div className="partner-head">
            <span className={"large-avatar " + (i ? "lavender" : "")}>
              {p.display_name[0]}
            </span>
            <span className="pill">50 %</span>
          </div>
          <h2>{p.display_name}</h2>
          <dl className="resource-details">
            <div>
              <dt>Utilidades asignadas</dt>
              <dd>{money(p.allocated)}</dd>
            </div>
            <div>
              <dt>Adelantos entregados</dt>
              <dd>{money(p.advances)}</dd>
            </div>
            <div>
              <dt>Adelantos compensados</dt>
              <dd>{money(p.compensated)}</dd>
            </div>
            <div>
              <dt>Adelantos por compensar</dt>
              <dd>{money(p.pending_advances)}</dd>
            </div>
            <div>
              <dt>Retiros de utilidades</dt>
              <dd>{money(p.withdrawals)}</dd>
            </div>
            <div>
              <dt>Saldo asignado pendiente</dt>
              <dd>{money(p.balance)}</dd>
            </div>
            <div>
              <dt>Disponible para retirar</dt>
              <dd>{money(Math.max(0, p.balance - p.pending_advances))}</dd>
            </div>
            <div>
              <dt>Aportes adicionales</dt>
              <dd>{money(p.contributions)}</dd>
            </div>
          </dl>
          <p className="field-help">
            Los aportes no cambian el 50 %. Los adelantos pendientes se
            compensan al liquidar utilidades.
          </p>
        </article>
      ))}
    </div>
  );
}
export function PartnerFinance({ embedded = false }: { embedded?: boolean }) {
  const [page, setPage] = useState(0),
    [form, setForm] = useState<FormConfig | null>(null);
  const { data, loading, error, refresh } = useBusiness<
    PageData<Row<"settlements">>
  >("settlements", { page });
  const partners = data?.partners ?? [],
    summary = data?.summary;
  const partnerFields: Field[] = [
    {
      name: "partner_id",
      label: "Socio",
      type: "select",
      options: partners.map((p) => ({ value: p.id, label: p.display_name })),
      required: true,
    },
    {
      name: "amount",
      label: "Valor (COP)",
      type: "number",
      min: 0.01,
      required: true,
    },
    { name: "description", label: "Descripción", required: true },
    ...cashDateFields(),
  ];
  return (
    <section className={embedded ? "embedded-finances" : ""}>
      {summary && (
        <div className="business-stats">
          <Stat
            label="Utilidad realizada acumulada"
            value={money(summary.cumulative_profit)}
            hint="Pedidos entregados y totalmente cobrados, menos costos y gastos."
          />
          <Stat
            label="Utilidad sin liquidar"
            value={money(summary.unsettled_profit)}
          />
          <Stat
            label="Reserva empresarial"
            value={money(summary.business_reserve)}
            hint="Reservar utilidad no mueve dinero de caja."
          />
        </div>
      )}
      <div className="card-actions">
        <button
          className="button primary"
          disabled={!summary || summary.unsettled_profit <= 0}
          onClick={() =>
            setForm({
              title: "Liquidar utilidades 50 / 50",
              action: "settlement_create",
              description:
                "La base de datos calcula la utilidad realizada acumulada que aún no se ha liquidado. La reserva queda en el negocio; el resto se asigna por mitades y compensa adelantos pendientes. Asignar utilidad no paga caja.",
              fields: [
                {
                  name: "period_start",
                  label: "Inicio del primer periodo",
                  type: "date",
                  default: yearStart(),
                  required: true,
                },
                {
                  name: "period_end",
                  label: "Fecha de corte",
                  type: "date",
                  default: today(),
                  required: true,
                },
                {
                  name: "reserve_amount",
                  label: "Utilidad para reservar (COP)",
                  type: "number",
                  min: 0,
                  default: "0",
                  required: true,
                },
                {
                  name: "notes",
                  label: "Motivo / observaciones",
                  type: "textarea",
                },
              ],
            })
          }
        >
          Liquidar utilidades
        </button>
        <button
          className="button secondary"
          onClick={() =>
            setForm({
              title: "Entregar adelanto a socio",
              action: "partner_advance",
              description:
                "Es una salida de caja pendiente de compensar con utilidades futuras. No es un gasto operativo.",
              fields: [...partnerFields, authField],
              checks: [negativeCheck],
            })
          }
        >
          Registrar adelanto
        </button>
        <button
          className="button secondary"
          onClick={() =>
            setForm({
              title: "Pagar retiro de utilidades",
              action: "partner_withdraw",
              description:
                "Se paga el saldo ya asignado y disponible del socio. Los adelantos pendientes reducen el disponible para evitar un pago duplicado.",
              fields: [...partnerFields, authField],
              checks: [
                {
                  name: "authorize_overdraft",
                  label:
                    "Autorizo expresamente un retiro superior a la utilidad disponible del socio.",
                },
                negativeCheck,
              ],
            })
          }
        >
          Registrar retiro
        </button>
        <button
          className="button secondary"
          disabled={!summary || summary.business_reserve <= 0}
          onClick={() =>
            setForm({
              title: "Liberar reserva empresarial",
              action: "reserve_release",
              description:
                "Se asigna a John y Sebas por mitades, sin volver a reconocer ganancias y sin mover caja hasta registrar un retiro.",
              fields: [
                {
                  name: "amount",
                  label: "Valor a liberar (COP)",
                  type: "number",
                  min: 0.02,
                  max: summary?.business_reserve,
                  required: true,
                },
                {
                  name: "period_end",
                  label: "Fecha de corte",
                  type: "date",
                  default: today(),
                  required: true,
                },
                {
                  name: "notes",
                  label: "Motivo",
                  type: "textarea",
                  required: true,
                },
              ],
            })
          }
        >
          Liberar reserva
        </button>
      </div>
      <ReadState loading={loading} error={error} retry={refresh}>
        <PartnerCards partners={partners} />
        <section className="panel">
          <h2>Historial de liquidaciones</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th>Utilidad reconocida</th>
                  <th>Reserva</th>
                  <th>Reserva liberada</th>
                  <th>Asignación total</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.period_start} → {s.period_end}
                    </td>
                    <td>{money(s.profit_recognized)}</td>
                    <td>{money(s.reserved)}</td>
                    <td>{money(s.reserve_release)}</td>
                    <td>{money(s.distributed)}</td>
                    <td>{s.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && <Pagination data={data} onPage={setPage} />}
        </section>
      </ReadState>
      {form && <OperationForm {...form} onClose={() => setForm(null)} />}
    </section>
  );
}
export function FinancePage() {
  const [tab, setTab] = useState("cash"),
    [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [from, setFrom] = useState(yearStart()),
    [to, setTo] = useState(today()),
    [form, setForm] = useState<FormConfig | null>(null);
  const catalog = useCatalog();
  const section = tab === "partners" ? "cash" : tab;
  const { data, error, loading, refresh } = useBusiness<
    PageData<Cash | Debt | Purchase>
  >(section, { page, search, from, to });
  const summary = data?.summary;
  const paymentFields = cashDateFields(),
    supplierField: Field = {
      name: "supplier_id",
      label: "Proveedor",
      type: "select",
      options: optionList(catalog.data?.suppliers),
    };
  const creditFields: Field[] = [
    {
      name: "installments",
      label: "Número de cuotas",
      type: "number",
      min: 1,
      max: 600,
      default: "1",
      required: true,
    },
    {
      name: "next_due",
      label: "Primer vencimiento",
      type: "date",
      required: true,
    },
    {
      name: "installment_interest",
      label: "Interés pactado por cuota (COP)",
      type: "number",
      min: 0,
      default: "0",
      required: true,
    },
  ];
  function cashForm(incoming: boolean) {
    setForm({
      title: incoming ? "Registrar ingreso real" : "Registrar gasto pagado",
      action: "cash_create",
      description: incoming
        ? "Aportes y préstamos no son utilidad. Los anticipos y saldos de pedidos se cobran desde el pedido para no duplicar ventas."
        : "Registra un gasto efectivamente pagado. Las compras de rollos, cuotas de deuda y retiros de socios tienen su propia operación para evitar duplicar costos.",
      fields: [
        {
          name: "category",
          label: "Categoría",
          type: "select",
          required: true,
          options: (incoming
            ? ["capital", "other_income", "direct_sale"]
            : [
                "expense",
                "transport",
                "shipping",
                "energy",
                "supplies",
                "parts",
              ]
          ).map((value) => ({ value, label: categoryNames[value] })),
        },
        {
          name: "amount",
          label: "Valor (COP)",
          type: "number",
          min: 0.01,
          required: true,
        },
        { name: "description", label: "Descripción", required: true },
        ...(incoming
          ? ([
              {
                name: "partner_id",
                label: "Socio que aporta (solo capital)",
                type: "select",
                options: (catalog.data?.partners ?? []).map((p) => ({
                  value: p.id,
                  label: p.display_name,
                })),
              },
              {
                name: "direct_cost",
                label: "Costo económico de venta directa (COP)",
                type: "number",
                min: 0,
                default: "0",
                hint: "Solo ventas sin pedido. Si consumen filamento, utiliza un pedido y su producción para mantener trazabilidad.",
              },
            ] as Field[])
          : []),
        ...paymentFields,
        ...(!incoming ? [authField] : []),
      ],
      checks: incoming
        ? []
        : [
            negativeCheck,
            {
              name: "included_in_production",
              label:
                "Este pago corresponde a un costo ya registrado en producción (energía, trabajo, pintado o insumos). Mover caja sin volver a descontarlo de la utilidad.",
            },
          ],
    });
  }
  const debtPay = (d: Debt) => {
    const first = d.installments.find(
      (i) =>
        i.principal_due > i.principal_paid || i.interest_due > i.interest_paid,
    );
    setForm({
      title: "Pagar cuota o abonar deuda",
      action: "debt_pay",
      extra: { debt_id: d.id },
      description:
        "El capital reduce caja y deuda. Solo los intereses se reconocen como gasto; la compra no se vuelve a contabilizar.",
      initial: first
        ? {
            installment_id: first.id,
            principal: String(
              Math.min(
                d.balance,
                Math.max(0, first.principal_due - first.principal_paid),
              ),
            ),
            interest: String(
              Math.max(0, first.interest_due - first.interest_paid),
            ),
          }
        : {},
      fields: [
        {
          name: "installment_id",
          label: "Cuota",
          type: "select",
          required: true,
          options: d.installments
            .filter(
              (i) =>
                i.principal_due > i.principal_paid ||
                i.interest_due > i.interest_paid,
            )
            .map((i) => ({
              value: i.id,
              label:
                "Cuota " +
                i.number +
                " · " +
                i.due_on +
                " · Capital pendiente " +
                money(Math.max(0, i.principal_due - i.principal_paid)),
            })),
        },
        {
          name: "principal",
          label: "Capital a pagar (COP)",
          type: "number",
          min: 0,
          max: d.balance,
          required: true,
        },
        {
          name: "interest",
          label: "Interés pagado (COP)",
          type: "number",
          min: 0,
          default: "0",
          required: true,
        },
        ...paymentFields,
        authField,
      ],
      checks: [negativeCheck],
    });
  };
  return (
    <>
      <PageTitle
        eyebrow="FINANZAS"
        title="Dinero claro. Decisiones claras."
        description="Caja real, financiación y utilidades separadas. Cada operación conserva responsable, fecha e historial."
        action={
          <Link to="/reportes" className="button secondary">
            Ver reportes
          </Link>
        }
      />
      <Tabs
        items={[
          { id: "cash", label: "Caja, ingresos y gastos" },
          { id: "purchases", label: "Compras" },
          { id: "debts", label: "Deudas y cuotas" },
          { id: "partners", label: "John y Sebas" },
        ]}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setPage(0);
          setSearch("");
        }}
      />
      {tab === "partners" ? (
        <PartnerFinance />
      ) : (
        <>
          {summary && (
            <div className="business-stats">
              <Stat
                label="Caja disponible actual"
                value={money(summary.cash)}
              />
              <Stat
                label="Cuentas por cobrar"
                value={money(summary.receivables)}
              />
              <Stat
                label="Deuda de capital pendiente"
                value={money(summary.debt_balance)}
              />
              <Stat
                label="Utilidad realizada · periodo"
                value={money(summary.realized_profit)}
              />
            </div>
          )}
          <div className="finance-actions">
            <button className="button primary" onClick={() => cashForm(true)}>
              <ArrowDownLeft size={17} />
              Registrar ingreso
            </button>
            <button
              className="button secondary"
              onClick={() => cashForm(false)}
            >
              <ArrowUpRight size={17} />
              Registrar gasto
            </button>
            <button
              className="button secondary"
              onClick={() =>
                setForm({
                  title: "Compra operativa al contado o financiada",
                  action: "purchase_create",
                  description:
                    "Para insumos, repuestos y gastos operativos: se reconoce el gasto una vez, incluso financiado. Los rollos y las impresoras se compran desde sus módulos.",
                  fields: [
                    {
                      name: "description",
                      label: "Concepto de la compra",
                      required: true,
                    },
                    supplierField,
                    {
                      name: "total",
                      label: "Valor total (COP)",
                      type: "number",
                      min: 0.01,
                      required: true,
                    },
                    {
                      name: "paid",
                      label: "Pago inicial (COP)",
                      type: "number",
                      min: 0,
                      required: true,
                    },
                    ...paymentFields,
                    ...creditFields,
                    authField,
                  ],
                  checks: [
                    negativeCheck,
                    {
                      name: "included_in_production",
                      label:
                        "Los costos de esta compra ya se incluyen en los costos de producción. Registrar caja y deuda sin duplicar el costo económico.",
                    },
                  ],
                })
              }
            >
              <Plus size={17} />
              Compra operativa
            </button>
            <button
              className="button secondary"
              onClick={() =>
                setForm({
                  title: "Registrar préstamo recibido",
                  action: "loan_create",
                  description:
                    "Aumenta caja y reconoce una deuda. El dinero prestado no es una ganancia.",
                  fields: [
                    {
                      name: "description",
                      label: "Concepto y acreedor",
                      required: true,
                    },
                    supplierField,
                    {
                      name: "amount",
                      label: "Dinero recibido (COP)",
                      type: "number",
                      min: 0.01,
                      required: true,
                    },
                    ...creditFields,
                    ...paymentFields,
                  ],
                })
              }
            >
              Préstamo recibido
            </button>
          </div>
          <DateRange
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
              setPage(0);
            }}
          />
          <Toolbar
            search={search}
            onSearch={(s) => {
              setSearch(s);
              setPage(0);
            }}
          />
          <ReadState loading={loading} error={error} retry={refresh}>
            {!data?.rows.length ? (
              <Empty text="Todavía no hay movimientos en esta vista" />
            ) : tab === "cash" ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha / responsable</th>
                      <th>Categoría</th>
                      <th>Descripción</th>
                      <th>Medio</th>
                      <th>Valor</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.rows as Cash[]).map((c) => (
                      <tr key={c.id}>
                        <td>
                          {c.occurred_on}
                          <small>{c.responsible}</small>
                        </td>
                        <td>{categoryNames[c.category] ?? c.category}</td>
                        <td>
                          {c.description}
                          {c.authorization_reason && (
                            <small>
                              Autorización: {c.authorization_reason}
                            </small>
                          )}
                        </td>
                        <td>{c.method}</td>
                        <td
                          className={
                            c.amount < 0 ? "text-danger" : "text-success"
                          }
                        >
                          {money(c.amount)}
                        </td>
                        <td>
                          {[
                            "capital",
                            "other_income",
                            "direct_sale",
                            "expense",
                            "transport",
                            "shipping",
                            "energy",
                            "supplies",
                            "parts",
                            "deposit",
                            "order_payment",
                          ].includes(c.category) &&
                            !c.reversed_by &&
                            !c.reverses_id && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  setForm({
                                    title: "Compensar movimiento de caja",
                                    action: "cash_reverse",
                                    extra: { cash_id: c.id },
                                    description:
                                      "Se registra una operación contraria y se conserva el original. Para cobros de clientes se registra la devolución real del dinero.",
                                    fields: [
                                      {
                                        name: "reason",
                                        label: "Motivo de la compensación",
                                        required: true,
                                        type: "textarea",
                                      },
                                      ...paymentFields,
                                      authField,
                                    ],
                                    checks: [negativeCheck],
                                  })
                                }
                              >
                                <Undo2 size={15} />
                                Compensar
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : tab === "purchases" ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Concepto / proveedor</th>
                      <th>Tipo</th>
                      <th>Total</th>
                      <th>Pago inicial</th>
                      <th>Deuda pendiente</th>
                      <th>Estado / corrección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.rows as Purchase[]).map((p) => (
                      <tr key={p.id}>
                        <td>{p.purchased_on}</td>
                        <td>
                          {p.description}
                          <small>{p.supplier_name}</small>
                        </td>
                        <td>
                          {
                            {
                              inventory: "Inventario",
                              asset: "Activo",
                              operating: "Operativa",
                            }[p.category]
                          }
                        </td>
                        <td>{money(p.total)}</td>
                        <td>{money(p.paid_initial)}</td>
                        <td>{money(p.debt_balance)}</td>
                        <td>
                          {p.voided_at ? (
                            "Compra devuelta"
                          ) : (
                            <button
                              className="text-button"
                              onClick={() =>
                                setForm({
                                  title: "Devolver y compensar compra",
                                  action: "purchase_void",
                                  extra: { purchase_id: p.id },
                                  description:
                                    "Devuelve un rollo completo sin reservas o una adquisición no usada. Se anula la deuda pendiente y se registra el reembolso real del precio pagado; los intereses ya pagados no se recuperan automáticamente.",
                                  fields: [
                                    {
                                      name: "reason",
                                      label: "Motivo",
                                      type: "textarea",
                                      required: true,
                                    },
                                    ...paymentFields,
                                  ],
                                  checks: [
                                    {
                                      name: "refund_confirmed",
                                      label:
                                        "Confirmo que recibí el reembolso del precio efectivamente pagado.",
                                    },
                                  ],
                                })
                              }
                            >
                              Registrar devolución
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="resource-grid">
                {(data.rows as Debt[]).map((d) => (
                  <article className="panel resource-card" key={d.id}>
                    <div className="resource-top">
                      <span className="pill">
                        {d.balance > 0 ? "Pendiente" : "Capital pagado"}
                      </span>
                      <small>{d.supplier_name}</small>
                    </div>
                    <h2>{d.description}</h2>
                    <dl className="resource-details">
                      <div>
                        <dt>Capital inicial</dt>
                        <dd>{money(d.principal)}</dd>
                      </div>
                      <div>
                        <dt>Capital pendiente</dt>
                        <dd>{money(d.balance)}</dd>
                      </div>
                      <div>
                        <dt>Cuota de referencia</dt>
                        <dd>{money(d.monthly_payment)}</dd>
                      </div>
                      <div>
                        <dt>Cuotas con capital pagado</dt>
                        <dd>
                          {
                            d.installments.filter(
                              (i) => i.principal_paid >= i.principal_due,
                            ).length
                          }{" "}
                          / {d.installment_count}
                        </dd>
                      </div>
                    </dl>
                    {d.installments.some(
                      (i) =>
                        i.principal_paid < i.principal_due ||
                        i.interest_paid < i.interest_due,
                    ) && (
                      <button
                        className="button primary"
                        onClick={() => debtPay(d)}
                      >
                        Registrar pago
                      </button>
                    )}
                    <details>
                      <summary>Cuotas y vencimientos</summary>
                      {d.installments.map((i) => (
                        <div className="history-item" key={i.id}>
                          <strong
                            className={
                              i.due_on < today() &&
                              (i.principal_paid < i.principal_due ||
                                i.interest_paid < i.interest_due)
                                ? "text-danger"
                                : ""
                            }
                          >
                            Cuota {i.number} · {i.due_on}
                          </strong>
                          <p>
                            Capital: {money(i.principal_paid)} /{" "}
                            {money(i.principal_due)} · Interés:{" "}
                            {money(i.interest_paid)} / {money(i.interest_due)}
                          </p>
                        </div>
                      ))}
                    </details>
                    <details>
                      <summary>Historial de pagos</summary>
                      {d.payments.map((p) => (
                        <p key={p.id}>
                          {p.paid_on} · Capital: {money(p.principal_paid)} ·
                          Interés: {money(p.interest_paid)}
                        </p>
                      ))}
                    </details>
                  </article>
                ))}
              </div>
            )}
            {data && <Pagination data={data} onPage={setPage} />}
          </ReadState>
        </>
      )}
      {form && <OperationForm {...form} onClose={() => setForm(null)} />}
    </>
  );
}
