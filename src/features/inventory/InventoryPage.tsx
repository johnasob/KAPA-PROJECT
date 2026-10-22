import { Experiments } from "./Experiments";
import { MaterialSummary } from "./MaterialSummary";
import { PurchaseEditor } from "../finance/FinancingEditor";
import { useState } from "react";
import { History, Plus, RefreshCw, Undo2 } from "lucide-react";
import { PageTitle, Notice } from "../../components/ui";
import {
  CatalogWarning,
  Empty,
  OperationForm,
  Pagination,
  ReadState,
  Stat,
  Tabs,
  Toolbar,
  moneyFields,
  financingField,
  optionList,
  useCatalog,
  type Field,
} from "../../components/business";
import {
  useBusiness,
  today,
  yearStart,
  type Lot,
  type PageData,
  type Row,
} from "../../lib/operations";
import { dateTime, money } from "../../lib/format";
import { useWorkspace } from "../../lib/WorkspaceProvider";
type Movement = Row<"inventory_movements"> & {
  brand: string;
  kind: string;
  color: string;
  responsible: string;
  reversed_by: string | null;
};
export function InventoryPage() {
  const { settings } = useWorkspace();
  const catalog = useCatalog();
  const [tab, setTab] = useState("summary"),
    [page, setPage] = useState(0),
    [search, setSearch] = useState("");
  const { data, error, loading, refresh } = useBusiness<PageData<Lot>>(
    "inventory",
    { page, search },
  );
  const history = useBusiness<PageData<Movement>>("inventory_history", {
    page: tab === "history" ? page : 0,
    from: yearStart(),
    to: today(),
  });
  const [form, setForm] = useState<{
    title: string;
    action: string;
    fields: Field[];
    extra?: Record<string, string>;
    checks?: { name: string; label: string }[];
    description?: string;
  } | null>(null);
  const [editPurchase, setEditPurchase] = useState<string | null>(null);
  const editLot = (lot: Lot) =>
    setForm({
      title: "Editar filamento y color",
      action: "lot_update",
      extra: { lot_id: lot.id, version: String(lot.version) },
      fields: [
        { name: "brand", label: "Marca", required: true, default: lot.brand },
        { name: "kind", label: "Material", required: true, default: lot.kind },
        {
          name: "color",
          label: "Nombre del color",
          required: true,
          default: lot.color,
        },
        {
          name: "color_hex",
          label: "Color visual",
          type: "color",
          default: lot.color_hex ?? "#d7cfca",
        },
      ],
    });
  const purchase = () =>
    setForm({
      title: "Comprar filamento",
      action: "lot_purchase",
      description:
        "Registra el rollo completo. Solo el pago inicial sale de caja; el resto se registra como deuda. Los valores de compra son reales.",
      fields: [
        { name: "brand", label: "Marca", required: true },
        { name: "kind", label: "Material", required: true, default: "PLA" },
        { name: "color", label: "Color", required: true },
        {
          name: "initial_grams",
          label: "Peso inicial (g)",
          type: "number",
          min: 0.001,
          required: true,
          default: "1000",
        },
        {
          name: "total",
          label: "Costo total del rollo (COP)",
          type: "number",
          min: 0.01,
          required: true,
        },
        {
          name: "paid",
          label: "Pago inicial con dinero propio (COP)",
          type: "number",
          min: 0,
          required: true,
          hint: "Escribe 0 si se financia por completo.",
        },
        {
          name: "supplier_id",
          label: "Proveedor",
          type: "select",
          options: optionList(catalog.data?.suppliers),
        },
        {
          name: "description",
          label: "Concepto",
          default: "Compra de filamento",
          required: true,
        },
        financingField,
        ...moneyFields.map((f) => ({
          ...f,
          default: f.name === "date" ? today() : f.default,
        })),
        {
          name: "installments",
          label: "Número de cuotas del saldo",
          type: "number",
          min: 1,
          max: 600,
          default: "1",
        },
        {
          name: "next_due",
          label: "Primer vencimiento del saldo",
          type: "date",
        },
        {
          name: "installment_interest",
          label: "Interés por cuota (COP)",
          type: "number",
          min: 0,
          default: "0",
        },
        {
          name: "authorization_reason",
          label: "Motivo de autorización de caja negativa",
          type: "textarea",
          hint: "Completa al menos 10 caracteres únicamente si autorizas un sobregiro.",
        },
      ],
      checks: [
        {
          name: "allow_negative_cash",
          label:
            "Autorizo expresamente caja negativa si el pago excede el dinero disponible.",
        },
      ],
    });
  const count = (lot: Lot) =>
    setForm({
      title: "Modificar filamento actual",
      action: "inventory_count",
      extra: { lot_id: lot.id, previous_grams: String(lot.on_hand_grams) },
      description:
        "Escribe el peso físico actual del rollo. El ajuste queda registrado y respeta los gramos reservados.",
      fields: [
        {
          name: "on_hand_grams",
          label: "Filamento actual (g)",
          type: "number",
          min: 0,
          required: true,
          default: String(lot.on_hand_grams),
        },
        {
          name: "reason",
          label: "Motivo del conteo",
          required: true,
          type: "textarea",
        },
      ],
    });
  const adjust = (lot: Lot) =>
    setForm({
      title: "Registrar movimiento de material",
      action: "inventory_adjust",
      extra: { lot_id: lot.id },
      description:
        "El movimiento no modifica reservas de otros pedidos. El consumo de una impresión se registra desde Producción.",
      fields: [
        {
          name: "kind",
          label: "Tipo",
          type: "select",
          required: true,
          options: [
            { value: "waste", label: "Desperdicio o merma" },
            { value: "adjustment", label: "Ajuste manual" },
            { value: "return", label: "Devolución de material" },
          ],
          default: "waste",
        },
        {
          name: "delta_grams",
          label: "Cambio en gramos",
          type: "number",
          required: true,
          hint: "Negativo para descontar, positivo para devolver. Ejemplo: -20.",
        },
        {
          name: "reason",
          label: "Motivo y autorización",
          required: true,
          type: "textarea",
        },
      ],
    });
  return (
    <>
      <PageTitle
        eyebrow="MATERIALES"
        title="Cada gramo, en su lugar."
        description="Compras, existencias físicas y reservas separadas. El consumo ocurre cuando registras la producción real."
        action={
          <button className="button primary" onClick={purchase}>
            <Plus size={17} />
            Comprar filamento
          </button>
        }
      />
      <CatalogWarning catalog={catalog.data} />

      {tab === "inventory" && (
        <>
          <div className="business-stats">
            <Stat
              label="Existencias físicas · página"
              value={
                (
                  data?.rows.reduce((n, l) => n + Number(l.on_hand_grams), 0) ??
                  0
                ).toLocaleString("es-CO") + " g"
              }
            />
            <Stat
              label="Reservado · página"
              value={
                (
                  data?.rows.reduce(
                    (n, l) => n + Number(l.reserved_grams),
                    0,
                  ) ?? 0
                ).toLocaleString("es-CO") + " g"
              }
            />
            <Stat
              label="Valor disponible · página"
              value={money(
                data?.rows.reduce(
                  (n, l) =>
                    n + Number(l.available_grams) * Number(l.cost_per_gram),
                  0,
                ) ?? 0,
              )}
              hint="El inventario no se registra como gasto al comprarlo."
            />
          </div>
        </>
      )}
      <Tabs
        items={[
          { id: "summary", label: "Resumen por color" },
          { id: "experiments", label: "Pruebas y fallos" },
          { id: "inventory", label: "Rollos y existencias" },
          { id: "history", label: "Historial de movimientos" },
        ]}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setPage(0);
        }}
      />
      <Toolbar
        search={search}
        onSearch={(s) => {
          setSearch(s);
          setPage(0);
        }}
      >
        <button
          className="button secondary"
          onClick={() =>
            setForm({
              title: "Nuevo proveedor",
              action: "supplier_create",
              fields: [
                { name: "name", label: "Nombre", required: true },
                { name: "phone", label: "Teléfono" },
                { name: "notes", label: "Notas", type: "textarea" },
              ],
            })
          }
        >
          Agregar proveedor
        </button>
        <button
          className="button secondary"
          aria-label="Actualizar inventario"
          onClick={() => {
            refresh();
            history.refresh();
          }}
        >
          <RefreshCw size={16} />
        </button>
      </Toolbar>
      {tab === "summary" ? (
        <MaterialSummary
          search={search}
          onLots={(s) => {
            setSearch(s);
            setPage(0);
            setTab("inventory");
          }}
        />
      ) : tab === "experiments" ? (
        <Experiments catalog={catalog.data ?? undefined} />
      ) : tab === "inventory" ? (
        <ReadState loading={loading} error={error} retry={refresh}>
          {data && !data.rows.length ? (
            <Empty text="Registra tu primer rollo" />
          ) : (
            <div className="resource-grid">
              {data?.rows.map((l) => (
                <article className="panel resource-card" key={l.id}>
                  <div className="resource-top">
                    <span
                      className={
                        "stock-badge " +
                        (l.available_grams === 0
                          ? "empty"
                          : l.available_grams <= settings.critical_stock_grams
                            ? "critical"
                            : l.available_grams < settings.low_stock_grams
                              ? "low"
                              : "ok")
                      }
                    >
                      {l.available_grams === 0
                        ? "Sin stock"
                        : l.available_grams <= settings.critical_stock_grams
                          ? "Crítico"
                          : l.available_grams < settings.low_stock_grams
                            ? "Stock bajo"
                            : "Disponible"}
                    </span>
                    <small>{l.brand}</small>
                  </div>
                  <div className="roll-color-title">
                    <span
                      className="color-dot"
                      style={{ backgroundColor: l.color_hex ?? "#d7cfca" }}
                    />
                    <h2>
                      {l.kind} · {l.color}
                    </h2>
                  </div>
                  {l.financing && l.financing !== "cash" && (
                    <p>
                      <span className="pill">
                        {l.financing === "credit_card"
                          ? "Tarjeta de crédito"
                          : "Crédito con proveedor"}
                      </span>{" "}
                      · Saldo: {money(l.debt_balance ?? 0)}
                    </p>
                  )}
                  <strong className="stock-amount">
                    {Number(l.available_grams).toLocaleString("es-CO")}{" "}
                    <small>g libres</small>
                  </strong>
                  <dl className="resource-details">
                    <div>
                      <dt>Físico / reservado</dt>
                      <dd>
                        {l.on_hand_grams} / {l.reserved_grams} g
                      </dd>
                    </div>
                    <div>
                      <dt>Costo por gramo</dt>
                      <dd>{money(l.cost_per_gram)}</dd>
                    </div>
                    <div>
                      <dt>Compra</dt>
                      <dd>
                        {money(l.purchase_cost)} · {l.purchased_on}
                      </dd>
                    </div>
                    <div>
                      <dt>Proveedor</dt>
                      <dd>{l.supplier_name || "Sin proveedor"}</dd>
                    </div>
                  </dl>
                  <div className="card-actions">
                    <button
                      className="button secondary"
                      onClick={() => editLot(l)}
                    >
                      Editar color y filamento
                    </button>
                    {l.purchase && (
                      <button
                        className="button secondary"
                        onClick={() => setEditPurchase(l.purchase!.id)}
                      >
                        Editar forma de compra
                      </button>
                    )}
                    <button
                      className="button secondary"
                      onClick={() => count(l)}
                    >
                      Modificar cantidad actual
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => adjust(l)}
                    >
                      Registrar movimiento
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        setForm({
                          title:
                            l.state === "active"
                              ? "Desactivar rollo"
                              : "Activar rollo",
                          action: "lot_state",
                          extra: {
                            lot_id: l.id,
                            state: l.state === "active" ? "inactive" : "active",
                          },
                          description:
                            "Los rollos inactivos no pueden reservarse para nuevas producciones. Conservan sus existencias y su historial.",
                          fields: [],
                        })
                      }
                    >
                      {l.state === "active" ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Ver historial de material"
                      onClick={() => {
                        setTab("history");
                        setPage(0);
                      }}
                    >
                      <History size={18} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {data && <Pagination data={data} onPage={setPage} />}
        </ReadState>
      ) : (
        <ReadState
          loading={history.loading}
          error={history.error}
          retry={history.refresh}
        >
          <Notice type="info">
            Historial del año actual. Los reportes permiten consultar otros
            periodos. Las compensaciones conservan el movimiento original.
          </Notice>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha / responsable</th>
                  <th>Material</th>
                  <th>Movimiento</th>
                  <th>Gramos físicos</th>
                  <th>Reserva</th>
                  <th>Motivo</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {history.data?.rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {dateTime(m.created_at)}
                      <small>{m.responsible}</small>
                    </td>
                    <td>
                      {m.brand} · {m.color}
                    </td>
                    <td>
                      {
                        (
                          {
                            purchase: "Compra",
                            reserve: "Reserva",
                            release: "Liberación",
                            production: "Producción",
                            waste: "Merma",
                            adjustment: "Ajuste",
                            return: "Devolución",
                            reversal: "Compensación",
                          } as Record<string, string>
                        )[m.kind]
                      }
                    </td>
                    <td>{m.delta_grams}</td>
                    <td>{m.reserved_delta}</td>
                    <td>{m.reason}</td>
                    <td>
                      {["waste", "adjustment", "return"].includes(m.kind) &&
                        !m.reversed_by && (
                          <button
                            className="text-button"
                            onClick={() =>
                              setForm({
                                title: "Compensar movimiento",
                                action: "inventory_reverse",
                                extra: { movement_id: m.id },
                                description:
                                  "Se registrará un movimiento contrario. El registro original se conserva y el stock no puede afectar reservas.",
                                fields: [
                                  {
                                    name: "reason",
                                    label: "Motivo",
                                    type: "textarea",
                                    required: true,
                                  },
                                ],
                              })
                            }
                          >
                            <Undo2 size={16} />
                            Compensar
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.data && <Pagination data={history.data} onPage={setPage} />}
        </ReadState>
      )}
      {editPurchase && (
        <PurchaseEditor
          id={editPurchase}
          onClose={() => setEditPurchase(null)}
        />
      )}
      {form && <OperationForm {...form} onClose={() => setForm(null)} />}
    </>
  );
}
