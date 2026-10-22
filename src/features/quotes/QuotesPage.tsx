import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Decimal from "decimal.js";
import { PageTitle, Notice } from "../../components/ui";
import {
  CatalogWarning,
  Empty,
  Modal,
  OperationForm,
  Pagination,
  ReadState,
  Toolbar,
  useCatalog,
} from "../../components/business";
import {
  useBusiness,
  readBusiness,
  statusNames,
  type Order,
  useOperation,
  calculateCost,
  type Quote,
  type PageData,
  type CostInputs,
  type Catalog,
} from "../../lib/operations";
import { useWorkspace } from "../../lib/WorkspaceProvider";
import { money, dateTime } from "../../lib/format";
import { CostEditor, emptyCost } from "./CostEditor";
import { customerFields } from "../customers/CustomersPage";
type QuoteDraft = CostInputs & {
  description: string;
  quantity: string;
  product_id: string;
};
const freshLine = (): QuoteDraft => ({
  ...emptyCost(),
  description: "",
  quantity: "1",
  product_id: "",
});
const headerSchema = z.object({
  customer_id: z.uuid("Selecciona un cliente."),
  description: z.string().trim().min(1, "Describe la cotización.").max(500),
  deposit_percent: z
    .string()
    .refine(
      (v) => v !== "" && Number(v) >= 0 && Number(v) <= 100,
      "Usa un porcentaje entre 0 y 100.",
    ),
  notes: z.string().max(5000),
});
export function QuoteComposer({
  catalog,
  onClose,
  quote,
  template,
  mode = "quote",
  onSaved,
}: {
  mode?: "quote" | "order";
  template?: Quote | Order;
  onSaved?: (id: string) => void;
  quote?: Quote;
  catalog: Catalog;
  onClose: () => void;
}) {
  const { settings } = useWorkspace();
  const source = quote ?? template;
  const [createdCustomer, setCreatedCustomer] = useState<string | null>(null),
    [promisedAt, setPromisedAt] = useState(""),
    [initialStatus, setInitialStatus] = useState("confirmed"),
    [alreadyPrinted, setAlreadyPrinted] = useState(false);
  const [lines, setLines] = useState<QuoteDraft[]>(
      source
        ? source.lines.map((l) => ({
            ...freshLine(),
            ...((l.cost_snapshot as Record<string, unknown>)
              .inputs as Partial<CostInputs>),
            description: l.description,
            quantity: String(l.quantity),
            product_id: l.product_id ?? "",
            printer_id: l.printer_id,
            hours: String(l.estimated_hours),
          }))
        : [freshLine()],
    ),
    [issue, setIssue] = useState<string | null>(null),
    [customerForm, setCustomerForm] = useState(false);
  const operation = useOperation();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof headerSchema>>({
    resolver: zodResolver(headerSchema),
    defaultValues: {
      customer_id: source?.customer_id ?? "",
      description: source?.description ?? "",
      deposit_percent: String(
        source?.deposit_percent ?? settings.default_deposit_percent,
      ),
      notes: source?.notes ?? "",
    },
  });
  useEffect(() => {
    if (
      createdCustomer &&
      catalog.customers.some((c) => c.id === createdCustomer)
    ) {
      setValue("customer_id", createdCustomer, { shouldValidate: true });
      setCreatedCustomer(null);
    }
  }, [createdCustomer, catalog.customers, setValue]);
  let totalPrice = new Decimal(0),
    totalCost = new Decimal(0);
  for (const line of lines) {
    try {
      const printer = catalog.printers.find((p) => p.id === line.printer_id);
      if (printer) {
        const result = calculateCost(
          line,
          printer,
          catalog.lots,
          settings.energy_kwh_cost,
          settings.labor_hour_cost,
        );
        totalPrice = totalPrice.plus(
          new Decimal(result.price).times(line.quantity || 0),
        );
        totalCost = totalCost.plus(
          new Decimal(result.total).times(line.quantity || 0),
        );
      }
    } catch {
      /* Incomplete input is explained in the cost editor. */
    }
  }
  async function submit(header: z.infer<typeof headerSchema>) {
    setIssue(null);
    try {
      if (mode === "order" && !promisedAt)
        throw Error("Indica la fecha de entrega del pedido.");
      for (const line of lines) {
        if (
          !line.description.trim() ||
          !Number.isInteger(Number(line.quantity)) ||
          Number(line.quantity) < 1
        )
          throw Error(
            "Cada producto necesita descripción y una cantidad entera positiva.",
          );
        const printer = catalog.printers.find((p) => p.id === line.printer_id);
        if (!printer)
          throw Error("Selecciona una impresora para cada producto.");
        calculateCost(
          line,
          printer,
          catalog.lots,
          settings.energy_kwh_cost,
          settings.labor_hour_cost,
        );
      }
      const result = await operation.run(
        mode === "order"
          ? "order_quick_create"
          : quote
            ? "quote_update"
            : "quote_create",
        {
          ...(quote ? { id: quote.id, version: quote.version } : {}),
          ...header,
          ...(mode === "order"
            ? {
                promised_at: promisedAt + "-05:00",
                initial_status: initialStatus,
                already_printed: alreadyPrinted,
              }
            : {}),
          lines: lines.map((l) => ({
            ...l,
            materials: l.materials.map((m) => ({ ...m })),
          })),
        },
      );
      if (result) {
        if (
          typeof result === "object" &&
          !Array.isArray(result) &&
          typeof result.id === "string"
        )
          onSaved?.(result.id);
        onClose();
      }
    } catch (e) {
      setIssue(e instanceof Error ? e.message : "Revisa los datos.");
    }
  }
  return (
    <Modal
      title={
        mode === "order"
          ? "Nuevo pedido"
          : quote
            ? "Editar cotización"
            : template
              ? "Repetir impresión en cotización"
              : "Nueva cotización"
      }
      onClose={() => {
        if (!operation.busy) onClose();
      }}
    >
      <form onSubmit={handleSubmit(submit)} noValidate>
        <p className="modal-description">
          Puedes registrar piezas personalizadas sin crear productos en el
          catálogo. Agrega tantas piezas como necesites. Los gramos, horas y
          costos se calculan por unidad.
          {mode === "order"
            ? " Al confirmar el pedido se reserva el filamento; solo la producción registrada consume existencias."
            : " La cotización guarda los costos actuales; no reserva ni consume material."}
        </p>
        {mode === "order" && (
          <section className="panel direct-order-options">
            <div className="business-form-grid">
              <label className="field">
                Fecha de entrega *
                <input
                  type="datetime-local"
                  value={promisedAt}
                  onChange={(e) => setPromisedAt(e.target.value)}
                />
              </label>
              <label className="field">
                Estado real del trabajo
                <select
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value)}
                >
                  {Object.entries(statusNames)
                    .filter(([key]) => key !== "cancelled")
                    .map(([key, label]) => (
                      <option key={key} value={key}>
                        {key === "confirmed"
                          ? "Confirmado · se permite sin anticipo"
                          : label}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={alreadyPrinted}
                onChange={(e) => {
                  setAlreadyPrinted(e.target.checked);
                  if (
                    e.target.checked &&
                    !["finishing", "ready_delivery", "delivered"].includes(
                      initialStatus,
                    )
                  )
                    setInitialStatus("ready_delivery");
                }}
              />
              Estas piezas ya están impresas; confirmo los gramos, horas y
              costos indicados como consumo real.
            </label>
            <p>
              El pedido puede registrarse sin anticipo. El saldo del cliente
              quedará visible. Si marcas piezas ya impresas se registran su
              producción y consumo de filamento.
            </p>
          </section>
        )}
        <div className="business-form-grid">
          <div className="field">
            <label htmlFor="quote-customer">Cliente *</label>
            <select id="quote-customer" {...register("customer_id")}>
              <option value="">Seleccionar…</option>
              {catalog.customers.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.customer_id && (
              <span className="field-error">{errors.customer_id.message}</span>
            )}
            <button
              type="button"
              className="text-button"
              onClick={() => setCustomerForm(true)}
            >
              Crear cliente
            </button>
          </div>
          <div className="field">
            <label htmlFor="quote-description">Descripción general *</label>
            <input id="quote-description" {...register("description")} />
            {errors.description && (
              <span className="field-error">{errors.description.message}</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="quote-deposit">Anticipo (%)</label>
            <input
              id="quote-deposit"
              type="number"
              min="0"
              max="100"
              {...register("deposit_percent")}
            />
            {errors.deposit_percent && (
              <span className="field-error">
                {errors.deposit_percent.message}
              </span>
            )}
          </div>
        </div>
        {lines.map((line, index) => (
          <section className="quote-line-editor" key={index}>
            <div className="form-section-heading">
              <h3>Pieza {index + 1}</h3>
              <button
                type="button"
                className="text-button"
                onClick={() => setLines((v) => [...v, structuredClone(line)])}
              >
                Repetir pieza
              </button>
              {lines.length > 1 && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={"Quitar producto " + (index + 1)}
                  onClick={() =>
                    setLines((v) => v.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
            <div className="business-form-grid">
              <div className="field">
                <label htmlFor={"quote-product-" + index}>
                  Producto del catálogo (opcional)
                </label>
                <select
                  id={"quote-product-" + index}
                  value={line.product_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    setLines((v) =>
                      v.map((l, i) =>
                        i === index
                          ? {
                              ...l,
                              product_id: id,
                              description:
                                catalog.products.find((p) => p.id === id)
                                  ?.name ?? l.description,
                            }
                          : l,
                      ),
                    );
                  }}
                >
                  <option value="">Pieza personalizada</option>
                  {catalog.products.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={"quote-line-description-" + index}>
                  Descripción del producto *
                </label>
                <input
                  id={"quote-line-description-" + index}
                  value={line.description}
                  onChange={(e) =>
                    setLines((v) =>
                      v.map((l, i) =>
                        i === index ? { ...l, description: e.target.value } : l,
                      ),
                    )
                  }
                />
              </div>
              <div className="field">
                <label htmlFor={"quote-quantity-" + index}>Cantidad *</label>
                <input
                  id={"quote-quantity-" + index}
                  type="number"
                  min="1"
                  step="1"
                  value={line.quantity}
                  onChange={(e) =>
                    setLines((v) =>
                      v.map((l, i) =>
                        i === index ? { ...l, quantity: e.target.value } : l,
                      ),
                    )
                  }
                />
              </div>
            </div>
            <CostEditor
              value={line}
              onChange={(cost) =>
                setLines((v) =>
                  v.map((l, i) => (i === index ? { ...l, ...cost } : l)),
                )
              }
              catalog={catalog}
            />
          </section>
        ))}
        <button
          type="button"
          className="button secondary"
          onClick={() => setLines((v) => [...v, freshLine()])}
        >
          <Plus size={16} />
          Agregar producto
        </button>
        <div className="field">
          <label htmlFor="quote-notes">Observaciones</label>
          <textarea id="quote-notes" {...register("notes")} />
        </div>
        <div className="cost-totals">
          <span>
            Costo total<strong>{money(totalCost.toNumber())}</strong>
          </span>
          <span>
            Precio total<strong>{money(totalPrice.toNumber())}</strong>
          </span>
        </div>
        {totalPrice.lt(totalCost) && (
          <Notice type="info">
            El precio está por debajo del costo calculado. La cotización
            conservará esa diferencia como pérdida estimada.
          </Notice>
        )}
        {(issue || operation.error) && (
          <Notice>{issue || operation.error}</Notice>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={operation.busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="button primary" disabled={operation.busy}>
            {operation.busy
              ? "Guardando…"
              : mode === "order"
                ? "Guardar pedido"
                : "Guardar cotización"}
          </button>
        </div>
      </form>
      {customerForm && (
        <OperationForm
          title="Nuevo cliente"
          action="customer_save"
          fields={customerFields}
          onSaved={(result) => {
            if (
              result &&
              typeof result === "object" &&
              !Array.isArray(result) &&
              typeof result.id === "string"
            )
              setCreatedCustomer(result.id);
          }}
          onClose={() => setCustomerForm(false)}
        />
      )}
    </Modal>
  );
}
export function QuotesPage() {
  const [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [compose, setCompose] = useState(false),
    [editing, setEditing] = useState<Quote | null>(null),
    [template, setTemplate] = useState<Quote | Order | null>(null),
    [repeatError, setRepeatError] = useState<string | null>(null),
    [convert, setConvert] = useState<Quote | null>(null),
    [product, setProduct] = useState(false);
  const catalog = useCatalog(),
    navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const repeatOrder = params.get("repetir");
  useEffect(() => {
    if (!repeatOrder) return;
    let alive = true;
    void readBusiness<PageData<Order>>("orders", { id: repeatOrder })
      .then((r) => {
        if (alive && r.rows[0]) setTemplate(r.rows[0]);
      })
      .catch(() => {
        if (alive) setRepeatError("No se pudo cargar la impresión a repetir.");
      });
    return () => {
      alive = false;
    };
  }, [repeatOrder]);
  const { data, loading, error, refresh } = useBusiness<PageData<Quote>>(
    "quotes",
    { page, search },
  );
  return (
    <>
      <PageTitle
        eyebrow="COSTOS Y PRECIOS"
        title="Cotiza con criterio."
        description="Costo completo, multiplicadores ×2, ×3 y ×4, precio manual y costos originales conservados."
        action={
          <button className="button primary" onClick={() => setCompose(true)}>
            <Plus size={17} />
            Nueva cotización
          </button>
        }
      />
      <CatalogWarning catalog={catalog.data} />
      {repeatError && <Notice>{repeatError}</Notice>}
      <Toolbar
        search={search}
        onSearch={(s) => {
          setSearch(s);
          setPage(0);
        }}
      >
        <button className="button secondary" onClick={() => setProduct(true)}>
          Nuevo producto de catálogo
        </button>
      </Toolbar>
      <ReadState loading={loading} error={error} retry={refresh}>
        {!data?.rows.length ? (
          <Empty text="Crea tu primera cotización" />
        ) : (
          <div className="resource-grid">
            {data.rows.map((q) => (
              <article className="panel resource-card" key={q.id}>
                <div className="resource-top">
                  <span className="pill">C-{q.number}</span>
                  <span className="pill">
                    {q.status === "draft"
                      ? "Cotizada"
                      : q.status === "converted"
                        ? "Convertida en pedido"
                        : "Cancelada"}
                  </span>
                </div>
                <h2>{q.description}</h2>
                <p>
                  {q.customer_name} · {dateTime(q.created_at)}
                </p>
                <dl className="resource-details">
                  <div>
                    <dt>Costo calculado</dt>
                    <dd>{money(q.cost_total)}</dd>
                  </div>
                  <div>
                    <dt>Precio de venta</dt>
                    <dd>{money(q.price_total)}</dd>
                  </div>
                  <div>
                    <dt>Ganancia estimada</dt>
                    <dd>{money(q.price_total - q.cost_total)}</dd>
                  </div>
                  <div>
                    <dt>Margen / recargo</dt>
                    <dd>
                      {q.price_total
                        ? (
                            ((q.price_total - q.cost_total) / q.price_total) *
                            100
                          ).toFixed(1)
                        : "0"}{" "}
                      % /{" "}
                      {q.cost_total
                        ? (
                            ((q.price_total - q.cost_total) / q.cost_total) *
                            100
                          ).toFixed(1)
                        : "0"}{" "}
                      %
                    </dd>
                  </div>
                </dl>
                <details>
                  <summary>Desglose de los costos guardados</summary>
                  {q.lines.map((l) => (
                    <div className="history-item" key={l.id}>
                      <strong>
                        {l.quantity} × {l.description}
                      </strong>
                      <p>
                        Costo/unidad: {money(l.unit_cost)} · Precio/unidad:{" "}
                        {money(l.unit_price)}
                      </p>
                      <p>
                        Impresión estimada: {Math.floor(l.estimated_hours)} h{" "}
                        {Math.round(l.estimated_hours * 60) % 60} min/unidad
                      </p>
                      {(
                        (
                          (l.cost_snapshot as Record<string, unknown>)
                            .inputs as Partial<CostInputs>
                        )?.extra_items ?? []
                      ).map((it, i) => (
                        <p key={i}>
                          {it.description}: {it.quantity} ×{" "}
                          {money(Number(it.unit_cost))} / pieza
                        </p>
                      ))}
                      <dl className="resource-details">
                        {Object.entries({
                          material_cost: "Material",
                          depreciation_cost: "Amortización",
                          energy_cost: "Energía",
                          labor_cost: "Mano de obra",
                          painting_cost: "Pintado",
                          extras_cost: "Otros directos",
                        }).map(([key, label]) => (
                          <div key={key}>
                            <dt>{label} / unidad</dt>
                            <dd>
                              {money(
                                Number(
                                  (l.cost_snapshot as Record<string, unknown>)[
                                    key
                                  ] ?? 0,
                                ),
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </details>
                <button
                  className="button secondary"
                  onClick={() => setTemplate(q)}
                >
                  Repetir cotización
                </button>
                {q.status === "draft" && (
                  <button
                    className="button secondary"
                    onClick={() => setEditing(q)}
                  >
                    Editar cotización
                  </button>
                )}
                {q.status === "draft" && (
                  <button
                    className="button primary"
                    onClick={() => setConvert(q)}
                  >
                    Convertir en pedido
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
        {data && <Pagination data={data} onPage={setPage} />}
      </ReadState>
      {(compose || editing || template) && (
        <ReadState
          loading={catalog.loading && !catalog.data}
          error={catalog.error}
          retry={catalog.refresh}
        >
          {catalog.data && (
            <QuoteComposer
              catalog={catalog.data}
              template={template ?? undefined}
              quote={editing ?? undefined}
              onClose={() => {
                setCompose(false);
                setEditing(null);
                setTemplate(null);
                if (repeatOrder) setParams({});
              }}
            />
          )}
        </ReadState>
      )}
      {convert && (
        <OperationForm
          title="Crear pedido desde cotización"
          action="order_create"
          extra={{ quote_id: convert.id, allow_without_deposit: true }}
          description="Se conservan los productos y costos cotizados. Se confirma sin exigir anticipo y reserva material. No se registra un cobro; todo el saldo queda pendiente."
          fields={[
            {
              name: "promised_at",
              label: "Fecha comprometida de entrega",
              type: "datetime-local",
              required: true,
            },
            {
              name: "priority",
              label: "Prioridad",
              type: "select",
              options: [
                { value: "0", label: "Normal" },
                { value: "1", label: "Alta" },
                { value: "2", label: "Urgente" },
              ],
              default: "0",
            },
            {
              name: "reference_url",
              label: "Imagen de referencia (URL)",
              type: "url",
            },
            { name: "model_url", label: "Enlace STL / 3MF", type: "url" },
            { name: "notes", label: "Observaciones", type: "textarea" },
          ]}
          onClose={() => setConvert(null)}
          onSaved={() => navigate("/pedidos")}
        />
      )}
      {product && (
        <OperationForm
          title="Nuevo producto"
          action="product_create"
          fields={[
            { name: "name", label: "Nombre del producto", required: true },
            { name: "description", label: "Descripción", type: "textarea" },
            {
              name: "model_url",
              label: "Enlace del modelo STL / 3MF",
              type: "url",
            },
          ]}
          onClose={() => setProduct(false)}
        />
      )}
    </>
  );
}
