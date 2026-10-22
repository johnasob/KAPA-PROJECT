import { useState } from "react";
import { Plus, Settings2, Wrench } from "lucide-react";
import { PageTitle } from "../../components/ui";
import {
  Empty,
  OperationForm,
  Pagination,
  ReadState,
  Toolbar,
  moneyFields,
  financingField,
  useCatalog,
  optionList,
  type Field,
} from "../../components/business";
import {
  printerStates,
  useBusiness,
  today,
  type Printer,
  type PageData,
} from "../../lib/operations";
import { money } from "../../lib/format";
export function PrintersPage() {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<Printer | null>(null),
    [mode, setMode] = useState<"edit" | "maintenance" | null>(null);
  const catalog = useCatalog();
  const { data, loading, error, refresh } = useBusiness<PageData<Printer>>(
    "printers",
    { search, page },
  );
  const fields: Field[] = [
    { name: "name", label: "Nombre", required: true },
    { name: "model", label: "Modelo", required: true },
    {
      name: "acquisition_cost",
      label: "Precio de adquisición (COP)",
      type: "number",
      min: 0,
      hint: "Vacío: todavía no configurado.",
    },
    { name: "purchased_on", label: "Fecha de compra", type: "date" },
    {
      name: "baseline_hours",
      label: "Horas de uso anteriores a KAPA",
      type: "number",
      min: 0,
      default: "0",
      hint: "Se suman a las horas registradas mediante producción. Editar esta referencia no cambia producciones anteriores.",
    },
    {
      name: "useful_hours",
      label: "Vida útil (horas)",
      type: "number",
      min: 0.001,
    },
    {
      name: "power_kw",
      label: "Potencia estimada (kW)",
      type: "number",
      min: 0,
      hint: "Ejemplo: 100 W equivalen a 0,1 kW.",
    },
    {
      name: "energy_rate",
      label: "Tarifa propia por kWh (COP)",
      type: "number",
      min: 0,
      hint: "Vacía: usa la tarifa del negocio.",
    },
    {
      name: "status",
      label: "Estado",
      type: "select",
      options: Object.entries(printerStates).map(([value, label]) => ({
        value,
        label,
      })),
      default: "available",
      required: true,
    },
    { name: "notes", label: "Notas", type: "textarea" },
    ...([
      {
        name: "paid",
        label: "Pago inicial con dinero propio (COP)",
        type: "number",
        min: 0,
      },
      {
        name: "supplier_id",
        label: "Proveedor",
        type: "select",
        options: optionList(catalog.data?.suppliers),
      },
      financingField,
      ...moneyFields.map((f) => ({
        ...f,
        default: f.name === "date" ? today() : f.default,
      })),
      {
        name: "installments",
        label: "Cuotas del saldo",
        type: "number",
        default: "1",
        min: 1,
      },
      { name: "next_due", label: "Primer vencimiento", type: "date" },
      {
        name: "description",
        label: "Concepto de compra",
        default: "Compra de impresora",
      },
    ] as Field[]),
  ];
  return (
    <>
      <PageTitle
        eyebrow="TALLER"
        title="Tus impresoras, listas para crear."
        description="Horas reales de producción, amortización económica y mantenimiento. La amortización no descuenta caja."
        action={
          <button
            className="button primary"
            onClick={() => {
              setSelected(null);
              setMode("edit");
            }}
          >
            <Plus size={17} />
            Agregar impresora
          </button>
        }
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
          <Empty text="Agrega una impresora" />
        ) : (
          <div className="resource-grid">
            {data.rows.map((p) => (
              <article className="panel resource-card" key={p.id}>
                <div className="resource-top">
                  <span className="pill">{printerStates[p.status]}</span>
                  <Wrench size={19} />
                </div>
                <h2>{p.name}</h2>
                <p>{p.model}</p>
                <dl className="resource-details">
                  <div>
                    <dt>Adquisición</dt>
                    <dd>
                      {p.acquisition_cost === null
                        ? "Sin configurar"
                        : money(p.acquisition_cost)}
                    </dd>
                  </div>
                  <div>
                    <dt>Horas acumuladas</dt>
                    <dd>
                      {Number(p.accumulated_hours).toLocaleString("es-CO")} h
                    </dd>
                  </div>
                  <div>
                    <dt>Amortización aplicada en cotizaciones</dt>
                    <dd>Hasta 10 % del material</dd>
                  </div>
                  <div>
                    <dt>Potencia / deuda</dt>
                    <dd>
                      {p.power_kw ?? "—"} kW · {money(p.debt_balance)}
                    </dd>
                  </div>
                </dl>
                <div className="card-actions">
                  <button
                    className="button secondary"
                    onClick={() => {
                      setSelected(p);
                      setMode("edit");
                    }}
                  >
                    <Settings2 size={16} />
                    Editar
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setSelected(p);
                      setMode("maintenance");
                    }}
                  >
                    Mantenimiento
                  </button>
                </div>
                <details>
                  <summary>Historial de mantenimiento</summary>
                  {p.maintenance.length ? (
                    p.maintenance.map((m) => (
                      <div className="history-item" key={m.id}>
                        <strong>{m.description}</strong>
                        <p>
                          {m.performed_on} · {money(m.cost)}
                          {m.next_due && " · Próximo: " + m.next_due}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>No hay mantenimientos registrados.</p>
                  )}
                </details>
              </article>
            ))}
          </div>
        )}
        {data && <Pagination data={data} onPage={setPage} />}
      </ReadState>
      {mode === "edit" && (
        <OperationForm
          title={selected ? "Editar impresora" : "Nueva impresora"}
          description="Configurar el valor de adquisición no registra un pago. Marca la compra únicamente si quieres registrar dinero y financiación reales."
          action="printer_save"
          fields={fields}
          initial={
            selected
              ? Object.fromEntries(
                  Object.entries(selected)
                    .filter(
                      ([, v]) => typeof v === "string" || typeof v === "number",
                    )
                    .map(([k, v]) => [k, String(v)]),
                )
              : {}
          }
          extra={selected ? { id: selected.id, version: selected.version } : {}}
          checks={[
            {
              name: "register_purchase",
              label:
                "Registrar esta adquisición como compra real (caja y deuda).",
            },
          ]}
          onClose={() => setMode(null)}
        />
      )}
      {mode === "maintenance" && selected && (
        <OperationForm
          title="Registrar mantenimiento"
          action="maintenance_create"
          extra={{ printer_id: selected.id }}
          fields={[
            {
              name: "description",
              label: "Trabajo, repuesto o reparación",
              required: true,
            },
            {
              name: "cost",
              label: "Costo pagado (COP)",
              type: "number",
              min: 0,
              default: "0",
              required: true,
            },
            ...moneyFields.map((f) => ({
              ...f,
              default: f.name === "date" ? today() : f.default,
            })),
            { name: "next_due", label: "Próximo mantenimiento", type: "date" },
            {
              name: "printer_status",
              label: "Estado al finalizar",
              type: "select",
              options: Object.entries(printerStates).map(([value, label]) => ({
                value,
                label,
              })),
              default: "available",
            },
            { name: "notes", label: "Notas", type: "textarea" },
          ]}
          onClose={() => setMode(null)}
        />
      )}
    </>
  );
}
