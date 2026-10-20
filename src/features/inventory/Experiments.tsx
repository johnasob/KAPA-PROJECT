import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useBusiness,
  useOperation,
  lotName,
  type Catalog,
  type PageData,
  type Row,
} from "../../lib/operations";
import {
  Modal,
  OperationForm,
  Pagination,
  ReadState,
} from "../../components/business";
import { Notice } from "../../components/ui";
import { money, dateTime } from "../../lib/format";
function ExperimentComposer({
  catalog,
  onClose,
}: {
  catalog: Catalog;
  onClose: () => void;
}) {
  const op = useOperation();
  const [kind, setKind] = useState("test"),
    [description, setDescription] = useState(""),
    [printer, setPrinter] = useState(""),
    [hours, setHours] = useState("0"),
    [minutes, setMinutes] = useState("0");
  const [materials, setMaterials] = useState([{ lot_id: "", grams: "" }]);
  return (
    <Modal title="Registrar prueba o impresión fallida" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void op
            .run("experiment_create", {
              kind,
              description,
              printer_id: printer,
              hours,
              minutes,
              materials,
            })
            .then((r) => {
              if (r) onClose();
            });
        }}
      >
        <p>
          Sin precio de venta ni ingreso. Solo se reconoce el costo del
          filamento consumido. Las horas, si las indicas, se suman al uso de la
          impresora.
        </p>
        <div className="business-form-grid">
          <label className="field">
            Tipo
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="test">Impresión de prueba</option>
              <option value="failed">Impresión fallida sin pedido</option>
            </select>
          </label>
          <label className="field">
            Descripción
            <input
              required
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="field">
            Impresora (opcional)
            <select
              value={printer}
              onChange={(e) => setPrinter(e.target.value)}
            >
              <option value="">Sin registrar horas</option>
              {catalog.printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Horas
            <input
              type="number"
              min="0"
              step="1"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </label>
          <label className="field">
            Minutos
            <input
              type="number"
              min="0"
              max="59"
              step="1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
        </div>
        {materials.map((item, i) => (
          <div className="extra-item-row" key={i}>
            <label className="field">
              Rollo / color
              <select
                required
                value={item.lot_id}
                onChange={(e) =>
                  setMaterials((items) =>
                    items.map((m, j) =>
                      j === i ? { ...m, lot_id: e.target.value } : m,
                    ),
                  )
                }
              >
                <option value="">Seleccionar…</option>
                {catalog.lots
                  .filter((l) => l.state === "active")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {lotName(l)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              Gramos consumidos
              <input
                type="number"
                min="0.001"
                step="0.001"
                required
                value={item.grams}
                onChange={(e) =>
                  setMaterials((items) =>
                    items.map((m, j) =>
                      j === i ? { ...m, grams: e.target.value } : m,
                    ),
                  )
                }
              />
            </label>
            {materials.length > 1 && (
              <button
                type="button"
                className="icon-button"
                aria-label="Quitar rollo"
                onClick={() =>
                  setMaterials((ms) => ms.filter((_, j) => j !== i))
                }
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="text-button"
          onClick={() =>
            setMaterials((ms) => [...ms, { lot_id: "", grams: "" }])
          }
        >
          <Plus size={15} />
          Otro material
        </button>
        {op.error && <Notice>{op.error}</Notice>}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={op.busy}
          >
            Cancelar
          </button>
          <button className="button primary" disabled={op.busy}>
            Guardar consumo sin venta
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Experiments({ catalog }: { catalog?: Catalog }) {
  const [page, setPage] = useState(0),
    [compose, setCompose] = useState(false),
    [reverse, setReverse] = useState<string | null>(null);
  const { data, error, loading, refresh } = useBusiness<
    PageData<Row<"print_experiments"> & { printer_name: string }>
  >("experiments", { page });
  return (
    <section className="panel month-budget">
      <div className="form-section-heading">
        <h2>Pruebas e impresiones fallidas sin venta</h2>
        <button
          className="button secondary"
          disabled={!catalog}
          onClick={() => setCompose(true)}
        >
          Registrar prueba o fallo
        </button>
      </div>
      <p>
        Para fallos de un pedido, usa «Registrar producción» con 0 unidades
        buenas dentro de ese pedido: así conserva su costo real.
      </p>
      <ReadState loading={loading} error={error} retry={refresh}>
        {data?.rows.map((r) => (
          <div className="history-item" key={r.id}>
            <strong>
              {r.kind === "test" ? "Prueba" : "Fallo"} · {r.description} ·{" "}
              {money(r.material_cost)}
            </strong>
            <p>
              {dateTime(r.created_at)} · {r.printer_name ?? "Sin impresora"} ·{" "}
              {r.actual_hours} h ·{" "}
              {r.reversed_at ? "Compensado" : "Costo de material, venta $0"}
            </p>
            {!r.reversed_at && (
              <button className="text-button" onClick={() => setReverse(r.id)}>
                Corregir registro equivocado
              </button>
            )}
          </div>
        ))}
        {data && <Pagination data={data} onPage={setPage} />}
      </ReadState>
      {compose && catalog && (
        <ExperimentComposer
          catalog={catalog}
          onClose={() => setCompose(false)}
        />
      )}
      {reverse && (
        <OperationForm
          title="Corregir prueba registrada por error"
          action="experiment_reverse"
          extra={{ experiment_id: reverse }}
          description="Solo para registros equivocados. Devuelve el material y compensa el costo y las horas. Una impresión que realmente falló debe conservarse."
          fields={[
            {
              name: "reason",
              label: "Motivo de la corrección",
              required: true,
              type: "textarea",
            },
          ]}
          onClose={() => setReverse(null)}
        />
      )}
    </section>
  );
}
