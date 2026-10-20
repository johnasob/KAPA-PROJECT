import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import Decimal from "decimal.js";
import {
  CalendarDays,
  ExternalLink,
  Paperclip,
  Plus,
  Upload,
} from "lucide-react";
import { PageTitle, Notice, Loading } from "../../components/ui";
import {
  Empty,
  Modal,
  OperationForm,
  Pagination,
  ReadState,
  Tabs,
  Toolbar,
  moneyFields,
  useCatalog,
} from "../../components/business";
import {
  categoryNames,
  lotName,
  printerStates,
  statusNames,
  today,
  useBusiness,
  useOperation,
  safeUrl,
  whatsappUrl,
  type Catalog,
  type CostInputs,
  type CostMaterial,
  type Order,
  type PageData,
  type QueueItem,
} from "../../lib/operations";
import { database } from "../../lib/supabase";
import { money, dateTime, errorMessage } from "../../lib/format";
import { CostEditor, emptyCost } from "../quotes/CostEditor";

function bogotaInput(date: string) {
  return new Date(new Date(date).getTime() - 5 * 3600000)
    .toISOString()
    .slice(0, 16);
}
function ProductionComposer({
  order,
  catalog,
  onClose,
}: {
  order: Order;
  catalog: Catalog;
  onClose: () => void;
}) {
  const first =
    order.lines.find((l) => l.produced < l.quantity) ?? order.lines[0];
  const [lineId, setLineId] = useState(first.id),
    [units, setUnits] = useState(
      String(Math.max(0, first.quantity - first.produced)),
    ),
    [cost, setCost] = useState<CostInputs>(initialCost(first)),
    [notes, setNotes] = useState("");
  const operation = useOperation();
  function initialCost(line: Order["lines"][number]): CostInputs {
    const qty = Math.max(1, line.quantity - line.produced),
      saved = line.cost_snapshot as Record<string, unknown>,
      inputs = (saved.inputs ?? {}) as Partial<CostInputs>;
    const result = {
      ...emptyCost(),
      ...inputs,
      printer_id: line.printer_id,
      hours: new Decimal(line.estimated_hours).times(qty).toString(),
      materials: (line.material_snapshot as unknown as CostMaterial[]).map(
        (m) => ({
          ...m,
          piece_grams: new Decimal(m.piece_grams || 0).times(qty).toString(),
          support_grams: new Decimal(m.support_grams || 0)
            .times(qty)
            .toString(),
          waste_grams: new Decimal(m.waste_grams || 0).times(qty).toString(),
        }),
      ),
    };
    for (const k of [
      "labor_hours",
      "painting_hours",
      "painting_materials",
      "supplies_cost",
      "customization_cost",
      "packaging_cost",
      "other_cost",
    ] as const)
      result[k] = new Decimal(result[k] || 0).times(qty).toString();
    return result;
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(Number(units)) || Number(units) < 0) return;
    const result = await operation.run("production_create", {
      line_id: lineId,
      good_units: units,
      ...cost,
      materials: cost.materials.map((m) => ({ ...m })),
      notes,
    });
    if (result) onClose();
  }
  return (
    <Modal
      title="Registrar producción real"
      onClose={() => {
        if (!operation.busy) onClose();
      }}
    >
      <form onSubmit={save}>
        <p className="modal-description">
          Reemplaza las estimaciones por los totales realmente utilizados en
          esta impresión. Se consumirá filamento, se liberará la reserva
          utilizada y se sumarán horas a la impresora. No se registra un pago de
          caja.
        </p>
        <div className="business-form-grid">
          <div className="field">
            <label htmlFor="production-line">Producto</label>
            <select
              id="production-line"
              value={lineId}
              onChange={(e) => {
                const l = order.lines.find((v) => v.id === e.target.value);
                if (l) {
                  setLineId(l.id);
                  setUnits(String(Math.max(0, l.quantity - l.produced)));
                  setCost(initialCost(l));
                }
              }}
            >
              {order.lines.map((l) => (
                <option value={l.id} key={l.id}>
                  {l.description} · {l.produced}/{l.quantity} unidades
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="production-units">Unidades buenas producidas</label>
            <input
              id="production-units"
              type="number"
              min="0"
              step="1"
              required
              value={units}
              onChange={(e) => setUnits(e.target.value)}
            />
            <small>
              Usa 0 para una impresión fallida; se conservarán sus costos y
              consumos.
            </small>
          </div>
        </div>
        <CostEditor
          production
          value={cost}
          onChange={setCost}
          catalog={catalog}
        />
        <div className="field">
          <label htmlFor="production-notes">Notas de producción</label>
          <textarea
            id="production-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {operation.error && <Notice>{operation.error}</Notice>}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={operation.busy}
          >
            Cancelar
          </button>
          <button className="button primary" disabled={operation.busy}>
            {operation.busy ? "Registrando…" : "Registrar consumo y producción"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function PriorityComposer({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const [priority, setPriority] = useState(String(order.priority)),
    [position, setPosition] = useState(String(order.queue_position)),
    [preview, setPreview] = useState<QueueItem[]>([]),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true);
  const operation = useOperation();
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      void database()
        .rpc("preview_order_priority", {
          p_order_id: order.id,
          p_priority: Number(priority),
          p_position: Number(position),
        })
        .then(({ data, error }) => {
          if (!alive) return;
          if (error) setError(errorMessage(error));
          else {
            setPreview(data as unknown as QueueItem[]);
            setError(null);
          }
          setLoading(false);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [order.id, priority, position]);
  return (
    <Modal title="Reorganizar cola de producción" onClose={onClose}>
      <p className="modal-description">
        Las fechas estimadas suponen impresoras disponibles y trabajo continuo.
        Se conservan las fechas prometidas a clientes. Revisa los pedidos
        afectados antes de confirmar.
      </p>
      <div className="business-form-grid">
        <div className="field">
          <label htmlFor="queue-priority">Prioridad</label>
          <select
            id="queue-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="0">Normal</option>
            <option value="1">Alta</option>
            <option value="2">Urgente</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="queue-position">
            Posición relativa (menor va primero)
          </label>
          <input
            id="queue-position"
            type="number"
            step="1"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
        </div>
      </div>
      {loading ? (
        <Loading label="Calculando impacto…" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pedido / impresora</th>
                <th>Estimación anterior</th>
                <th>Final estimado</th>
                <th>Compromiso</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((q, i) => (
                <tr key={q.order_id + q.printer_id + i}>
                  <td>
                    K-{q.number} · {q.printer_name}
                    <small>{q.description}</small>
                  </td>
                  <td>
                    {q.previous_finish ? dateTime(q.previous_finish) : "—"}
                  </td>
                  <td
                    className={
                      new Date(q.estimated_finish) > new Date(q.promised_at)
                        ? "text-danger"
                        : ""
                    }
                  >
                    {dateTime(q.estimated_finish)}
                    {!["available", "printing"].includes(q.printer_status) && (
                      <small>
                        Impresora en {printerStates[q.printer_status]}; requiere
                        disponibilidad.
                      </small>
                    )}
                  </td>
                  <td>{dateTime(q.promised_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(error || operation.error) && (
        <Notice>{error || operation.error}</Notice>
      )}
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={loading || !!error || operation.busy}
          onClick={() => {
            void operation
              .run("order_update", {
                order_id: order.id,
                version: order.version,
                priority,
                queue_position: position,
              })
              .then((result) => {
                if (result) onClose();
              });
          }}
        >
          Confirmar prioridad
        </button>
      </div>
    </Modal>
  );
}
function OrderDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error, loading, refresh } = useBusiness<PageData<Order>>(
    "orders",
    { id },
  );
  const catalog = useCatalog(),
    operation = useOperation();
  const order = data?.rows[0];
  const [mode, setMode] = useState<
      | "payment"
      | "update"
      | "reserve"
      | "production"
      | "cancel"
      | "priority"
      | null
    >(null),
    [reverse, setReverse] = useState<string | null>(null),
    [fileError, setFileError] = useState<string | null>(null),
    [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  async function attach() {
    const file = fileInput.current?.files?.[0];
    if (!file || !order || uploading) return;
    setFileError(null);
    if (
      file.size > 10485760 ||
      !/\.(jpe?g|png|webp|pdf|stl|3mf)$/i.test(file.name)
    ) {
      setFileError("Usa JPG, PNG, WebP, PDF, STL o 3MF de hasta 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const path =
        order.id +
        "/" +
        crypto.randomUUID() +
        "-" +
        file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
      const uploaded = await database()
        .storage.from("kapa-order-files")
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (uploaded.error) throw uploaded.error;
      const result = await operation.run("file_attach", {
        order_id: order.id,
        object_path: path,
        name: file.name,
      });
      if (!result) {
        await database().storage.from("kapa-order-files").remove([path]);
        return;
      }
      if (fileInput.current) fileInput.current.value = "";
    } catch (e) {
      setFileError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }
  async function openFile(path: string) {
    setFileError(null);
    const { data, error } = await database()
      .storage.from("kapa-order-files")
      .createSignedUrl(path, 60);
    if (error) setFileError(errorMessage(error));
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  if (!order)
    return (
      <Modal title="Pedido" onClose={onClose}>
        <ReadState loading={loading} error={error} retry={refresh}>
          <Empty text="No se encontró el pedido" />
        </ReadState>
      </Modal>
    );
  const closed = ["delivered", "cancelled"].includes(order.status),
    wa = whatsappUrl(
      order.whatsapp || order.phone,
      "Hola " +
        order.customer_name +
        ", tu pedido K-" +
        order.number +
        " de KAPA 3D está " +
        statusNames[order.status].toLowerCase() +
        ". Saldo pendiente: " +
        money(order.balance) +
        ".",
    );
  const formClose = () => setMode(null);
  return (
    <Modal
      title={"K-" + order.number + " · " + order.description}
      onClose={onClose}
    >
      <div className="order-detail-top">
        <div>
          <span className="pill">{statusNames[order.status]}</span>
          <p>
            {order.customer_name} · {order.phone}
          </p>
          <p>Entrega comprometida: {dateTime(order.promised_at)}</p>
        </div>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="button secondary"
          >
            WhatsApp <ExternalLink size={15} />
          </a>
        )}
      </div>
      <div className="business-stats compact">
        <div>
          <small>Total</small>
          <strong>{money(order.price_total)}</strong>
        </div>
        <div>
          <small>Cobrado</small>
          <strong>{money(order.paid)}</strong>
        </div>
        <div>
          <small>Pendiente</small>
          <strong>{money(order.balance)}</strong>
        </div>
        <div>
          <small>Costo real</small>
          <strong>{money(order.actual_cost)}</strong>
        </div>
      </div>
      <div className="card-actions">
        {order.balance > 0 && order.status !== "cancelled" && (
          <button className="button primary" onClick={() => setMode("payment")}>
            Registrar cobro
          </button>
        )}
        {!closed && (
          <>
            <button
              className="button secondary"
              onClick={() => setMode("update")}
            >
              Estado y entrega
            </button>
            <button
              className="button secondary"
              onClick={() => setMode("reserve")}
            >
              Reservas
            </button>
            <button
              className="button secondary"
              onClick={() => setMode("production")}
            >
              Registrar producción
            </button>
            <button
              className="button secondary"
              onClick={() => setMode("priority")}
            >
              Reorganizar cola
            </button>
            <button
              className="text-button text-danger"
              onClick={() => setMode("cancel")}
            >
              Cancelar pedido
            </button>
          </>
        )}
      </div>
      <div className="order-line-list">
        {order.lines.map((l) => (
          <div key={l.id}>
            <strong>{l.description}</strong>
            <p>
              {l.produced} de {l.quantity} unidades producidas · Estimado:{" "}
              {l.estimated_hours} h/unidad · {money(l.unit_price)} / unidad
            </p>
          </div>
        ))}
      </div>
      {order.notes && <p>{order.notes}</p>}
      <details>
        <summary>Reservas activas</summary>
        {order.reservations
          .filter((r) => r.grams > 0)
          .map((r) => (
            <p key={r.lot_id}>
              {catalog.data?.lots.find((l) => l.id === r.lot_id)?.color ??
                r.lot_id}
              : {r.grams} g
            </p>
          ))}
      </details>
      <details>
        <summary>Producciones y consumos</summary>
        {order.productions.map((r) => (
          <div className="history-item" key={r.id}>
            <strong>
              {r.good_units} unidades · {r.actual_hours} h ·{" "}
              {money(r.cost_total)}
            </strong>
            <p>
              {dateTime(r.created_at)} ·{" "}
              {r.reversed_at ? "Compensada" : "Registrada"}
            </p>
            <p>{r.notes}</p>
            {!closed && !r.reversed_at && (
              <button className="text-button" onClick={() => setReverse(r.id)}>
                Compensar producción incorrecta
              </button>
            )}
          </div>
        ))}
      </details>
      <details>
        <summary>Cobros y devoluciones</summary>
        {order.payments.map((p) => (
          <p key={p.id}>
            {p.occurred_on} · {categoryNames[p.category]} · {money(p.amount)} ·{" "}
            {p.method}
          </p>
        ))}
      </details>
      <section className="order-files">
        <h3>Referencias y archivos</h3>
        {order.reference_url && safeUrl(order.reference_url) && (
          <a
            target="_blank"
            rel="noreferrer"
            href={safeUrl(order.reference_url) ?? ""}
          >
            Ver imagen de referencia ↗
          </a>
        )}
        {order.model_url && safeUrl(order.model_url) && (
          <a
            target="_blank"
            rel="noreferrer"
            href={safeUrl(order.model_url) ?? ""}
          >
            Abrir modelo STL / 3MF ↗
          </a>
        )}
        {order.files.map((f) => (
          <button
            key={f.id}
            className="text-button"
            onClick={() => {
              void openFile(f.object_path);
            }}
          >
            <Paperclip size={15} />
            {f.name}
          </button>
        ))}
        <label className="field">
          Adjunto opcional (hasta 10 MB)
          <input
            ref={fileInput}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,.stl,.3mf"
          />
        </label>
        <button
          className="button secondary"
          disabled={uploading || operation.busy}
          onClick={() => {
            void attach();
          }}
        >
          <Upload size={16} />
          {uploading ? "Subiendo…" : "Guardar adjunto privado"}
        </button>
        {fileError && <Notice>{fileError}</Notice>}
      </section>
      {mode === "payment" && (
        <OperationForm
          title="Registrar dinero recibido"
          action="order_payment"
          extra={{ order_id: order.id }}
          description={
            "Saldo pendiente: " +
            money(order.balance) +
            ". Se registra únicamente el dinero que recibiste efectivamente."
          }
          fields={[
            {
              name: "amount",
              label: "Valor recibido (COP)",
              type: "number",
              min: 0.01,
              max: order.balance,
              required: true,
            },
            ...moneyFields.map((f) => ({
              ...f,
              default: f.name === "date" ? today() : f.default,
            })),
          ]}
          onClose={formClose}
        />
      )}
      {mode === "update" && (
        <OperationForm
          title="Estado y fecha de entrega"
          action="order_update"
          extra={{ order_id: order.id, version: order.version }}
          description="Confirmar el pedido reserva los gramos cotizados; no los consume. Entregar exige registrar la producción real."
          initial={{
            status: order.status,
            deposit_percent: String(order.deposit_percent),
            promised_at: bogotaInput(order.promised_at),
            notes: order.notes,
          }}
          fields={[
            {
              name: "status",
              label: "Estado",
              type: "select",
              options: Object.entries(statusNames)
                .filter(([k]) => k !== "cancelled")
                .map(([value, label]) => ({ value, label })),
              required: true,
            },
            {
              name: "promised_at",
              label: "Fecha comprometida (Bogotá)",
              type: "datetime-local",
              required: true,
            },
            {
              name: "deposit_percent",
              label: "Anticipo requerido (%)",
              type: "number",
              min: 0,
              max: 100,
              required: true,
            },
            { name: "notes", label: "Observaciones", type: "textarea" },
          ]}
          checks={[
            {
              name: "confirm_date_change",
              label:
                "Autorizo expresamente cambiar la fecha comprometida con el cliente.",
            },
            {
              name: "confirm_without_deposit",
              label:
                "Autorizo confirmar producción aunque todavía falte el anticipo.",
            },
            {
              name: "confirm_unpaid_delivery",
              label:
                "Autorizo entregar a crédito con saldo pendiente; la utilidad no será realizada hasta cobrarlo.",
            },
          ]}
          onClose={formClose}
        />
      )}
      {mode === "reserve" && (
        <OperationForm
          title="Reservar o liberar filamento"
          action="order_reserve"
          extra={{ order_id: order.id }}
          description="Indica la reserva total deseada para este rollo en el pedido, no una cantidad adicional. Escribe 0 para liberarla."
          fields={[
            {
              name: "lot_id",
              label: "Rollo",
              type: "select",
              options: (catalog.data?.lots ?? []).map((l) => ({
                value: l.id,
                label: lotName(l),
              })),
              required: true,
            },
            {
              name: "grams",
              label: "Gramos a mantener reservados",
              type: "number",
              min: 0,
              required: true,
            },
          ]}
          onClose={formClose}
        />
      )}
      {mode === "production" && catalog.data && (
        <ProductionComposer
          order={order}
          catalog={catalog.data}
          onClose={formClose}
        />
      )}
      {mode === "priority" && (
        <PriorityComposer order={order} onClose={formClose} />
      )}
      {mode === "cancel" && (
        <OperationForm
          title="Cancelar pedido"
          action="order_cancel"
          extra={{ order_id: order.id }}
          description={
            "Se liberarán las reservas. El material ya consumido permanece como costo de la cancelación. Dinero a devolver: " +
            money(order.paid) +
            "."
          }
          fields={[
            {
              name: "reason",
              label: "Motivo",
              required: true,
              type: "textarea",
            },
            ...moneyFields.map((f) => ({
              ...f,
              default: f.name === "date" ? today() : f.default,
            })),
          ]}
          checks={[
            {
              name: "refund_confirmed",
              label:
                "Confirmo que devuelvo efectivamente todo el dinero recibido del cliente.",
            },
          ]}
          onClose={formClose}
        />
      )}
      {reverse && (
        <OperationForm
          title="Compensar producción incorrecta"
          action="production_reverse"
          extra={{ production_id: reverse }}
          description="Solo para corregir un registro incorrecto: devuelve los gramos al inventario, revierte las horas y conserva el historial. No uses esta acción para plástico que realmente fue consumido en una impresión fallida."
          fields={[
            {
              name: "reason",
              label: "Motivo y autorización",
              type: "textarea",
              required: true,
            },
          ]}
          onClose={() => setReverse(null)}
        />
      )}
    </Modal>
  );
}
export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState("list"),
    [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [month, setMonth] = useState(today().slice(0, 7));
  const { data, error, loading, refresh } = useBusiness<PageData<Order>>(
    view === "calendar" ? "calendar" : "orders",
    {
      page,
      search,
      ...(view === "calendar"
        ? {
            from: month + "-01",
            to: format(endOfMonth(parseISO(month + "-01")), "yyyy-MM-dd"),
          }
        : {}),
    },
  );
  const queue = useBusiness<PageData<QueueItem>>("queue", {
    page: view === "queue" ? page : 0,
  });
  const choose = (id: string) => setParams({ pedido: id });
  const rows = data?.rows ?? [];
  const renderCard = (o: Order) => (
    <button className="order-card" key={o.id} onClick={() => choose(o.id)}>
      <div className="resource-top">
        <span>K-{o.number}</span>
        <span className={"priority priority-" + o.priority}>
          {["Normal", "Alta", "Urgente"][o.priority]}
        </span>
      </div>
      <h3>{o.description}</h3>
      <p>{o.customer_name}</p>
      <span className="pill">{statusNames[o.status]}</span>
      <div className="order-card-footer">
        <strong>{money(o.price_total)}</strong>
        <span
          className={
            new Date(o.promised_at) < new Date() &&
            !["delivered", "cancelled"].includes(o.status)
              ? "text-danger"
              : ""
          }
        >
          {dateTime(o.promised_at)}
        </span>
      </div>
      <small>Pendiente: {money(o.balance)}</small>
    </button>
  );
  return (
    <>
      <PageTitle
        eyebrow="PEDIDOS Y PRODUCCIÓN"
        title="Del encargo a la entrega."
        description="Reservas, producción, anticipos y compromisos en un mismo lugar."
        action={
          <Link className="button primary" to="/cotizaciones">
            <Plus size={17} />
            Cotizar nuevo pedido
          </Link>
        }
      />
      <Tabs
        items={[
          { id: "list", label: "Lista" },
          { id: "kanban", label: "Tablero Kanban" },
          { id: "calendar", label: "Calendario" },
          { id: "queue", label: "Cola por impresora" },
        ]}
        value={view}
        onChange={(v) => {
          setView(v);
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
        {view === "calendar" && (
          <label className="month-filter">
            <CalendarDays size={16} />
            <input
              type="month"
              aria-label="Mes del calendario"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>
        )}
      </Toolbar>
      {view === "queue" ? (
        <ReadState
          loading={queue.loading}
          error={queue.error}
          retry={queue.refresh}
        >
          <Notice type="info">
            Estimaciones de trabajo continuo según prioridad y horas pendientes.
            Una impresora en mantenimiento o inactiva necesita volver a estar
            disponible. Las fechas comprometidas no se cambian automáticamente.
          </Notice>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Impresora</th>
                  <th>Horas pendientes</th>
                  <th>Final estimado</th>
                  <th>Compromiso</th>
                </tr>
              </thead>
              <tbody>
                {queue.data?.rows.map((q, i) => (
                  <tr key={q.order_id + q.printer_id + i}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => choose(q.order_id)}
                      >
                        K-{q.number} · {q.description}
                      </button>
                    </td>
                    <td>
                      {q.printer_name}
                      <small>{printerStates[q.printer_status]}</small>
                    </td>
                    <td>{q.remaining_hours}</td>
                    <td
                      className={
                        new Date(q.estimated_finish) > new Date(q.promised_at)
                          ? "text-danger"
                          : ""
                      }
                    >
                      {dateTime(q.estimated_finish)}
                    </td>
                    <td>{dateTime(q.promised_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {queue.data && <Pagination data={queue.data} onPage={setPage} />}
        </ReadState>
      ) : (
        <ReadState loading={loading} error={error} retry={refresh}>
          {!rows.length ? (
            <Empty
              text="Tus pedidos aparecerán aquí"
              action={
                <Link to="/cotizaciones" className="button secondary">
                  Crear cotización
                </Link>
              }
            />
          ) : view === "list" ? (
            <div className="resource-grid">{rows.map(renderCard)}</div>
          ) : view === "kanban" ? (
            <div className="kanban-board">
              {Object.entries(statusNames).map(([status, label]) => (
                <section className="kanban-column" key={status}>
                  <h3>
                    {label}{" "}
                    <span>
                      {rows.filter((o) => o.status === status).length}
                    </span>
                  </h3>
                  {rows.filter((o) => o.status === status).map(renderCard)}
                </section>
              ))}
            </div>
          ) : (
            <div className="calendar-grid">
              {eachDayOfInterval({
                start: startOfWeek(startOfMonth(parseISO(month + "-01")), {
                  weekStartsOn: 1,
                }),
                end: endOfWeek(endOfMonth(parseISO(month + "-01")), {
                  weekStartsOn: 1,
                }),
              }).map((day) => (
                <div
                  className={
                    "calendar-day " +
                    (format(day, "yyyy-MM") === month ? "" : "outside")
                  }
                  key={day.toISOString()}
                >
                  <strong>{format(day, "EEE d", { locale: es })}</strong>
                  {rows
                    .filter(
                      (o) =>
                        bogotaInput(o.promised_at).slice(0, 10) ===
                        format(day, "yyyy-MM-dd"),
                    )
                    .map((o) => (
                      <button
                        key={o.id}
                        onClick={() => choose(o.id)}
                        className={"calendar-order priority-" + o.priority}
                      >
                        K-{o.number} {o.description}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          )}
          {data && (
            <>
              <Pagination data={data} onPage={setPage} />
              {view !== "list" && data.total > 50 && (
                <p className="field-help">
                  La vista muestra los 50 pedidos de esta página. Cambia de
                  página o usa la búsqueda para localizar otros pedidos.
                </p>
              )}
            </>
          )}
        </ReadState>
      )}
      {params.get("pedido") && (
        <OrderDetails
          id={params.get("pedido")!}
          onClose={() => setParams({})}
        />
      )}
    </>
  );
}
