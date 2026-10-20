import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import {
  calculateCost,
  lotName,
  type Catalog,
  type CostInputs,
} from "../../lib/operations";
import { useWorkspace } from "../../lib/WorkspaceProvider";
import { money } from "../../lib/format";
export const emptyCost = (): CostInputs => ({
  printer_id: "",
  hours: "",
  materials: [
    { lot_id: "", piece_grams: "", support_grams: "0", waste_grams: "0" },
  ],
  labor_hours: "0",
  painting_hours: "0",
  painting_materials: "0",
  supplies_cost: "0",
  customization_cost: "0",
  packaging_cost: "0",
  other_cost: "0",
  multiplier: "3",
  manual_price: "",
});
export function CostEditor({
  value,
  onChange,
  catalog,
  production = false,
}: {
  value: CostInputs;
  onChange: (v: CostInputs) => void;
  catalog: Catalog;
  production?: boolean;
}) {
  const prefix = useId();
  const { settings } = useWorkspace();
  const printer = catalog.printers.find((p) => p.id === value.printer_id);
  let result = null,
    problem = "Selecciona impresora, material y gramos para calcular.";
  try {
    if (printer)
      result = calculateCost(
        value,
        printer,
        catalog.lots,
        settings.energy_kwh_cost,
        settings.labor_hour_cost,
      );
  } catch (e) {
    problem = e instanceof Error ? e.message : "Revisa los datos.";
  }
  const update = (k: keyof CostInputs, v: string) =>
    onChange({ ...value, [k]: v });
  const input = (
    key: Exclude<keyof CostInputs, "materials" | "printer_id">,
    label: string,
    hint?: string,
  ) => (
    <div className="field" key={key}>
      <label htmlFor={prefix + key}>{label}</label>
      <input
        id={prefix + key}
        type="number"
        step="any"
        min="0"
        value={value[key]}
        onChange={(e) => update(key, e.target.value)}
      />
      {hint && <small>{hint}</small>}
    </div>
  );
  return (
    <div className="cost-editor">
      <div className="business-form-grid">
        <div className="field">
          <label htmlFor={prefix + "printer"}>Impresora *</label>
          <select
            id={prefix + "printer"}
            disabled={production}
            value={value.printer_id}
            onChange={(e) => update("printer_id", e.target.value)}
          >
            <option value="">Seleccionar…</option>
            {catalog.printers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {input(
          "hours",
          production
            ? "Horas reales totales *"
            : "Horas de impresión por unidad *",
        )}
      </div>
      <div className="form-section-heading">
        <h3>
          {production ? "Material consumido realmente" : "Material por unidad"}
        </h3>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            onChange({
              ...value,
              materials: [
                ...value.materials,
                {
                  lot_id: "",
                  piece_grams: "",
                  support_grams: "0",
                  waste_grams: "0",
                },
              ],
            })
          }
        >
          <Plus size={15} />
          Otro material o color
        </button>
      </div>
      {value.materials.map((m, i) => (
        <div className="material-input-row" key={i}>
          <div className="field">
            <label htmlFor={prefix + "lot" + i}>Rollo / color {i + 1}</label>
            <select
              id={prefix + "lot" + i}
              value={m.lot_id}
              onChange={(e) =>
                onChange({
                  ...value,
                  materials: value.materials.map((v, j) =>
                    j === i ? { ...v, lot_id: e.target.value } : v,
                  ),
                })
              }
            >
              <option value="">Seleccionar…</option>
              {catalog.lots
                .filter((l) => l.state === "active")
                .map((l) => (
                  <option value={l.id} key={l.id}>
                    {lotName(l)}
                  </option>
                ))}
            </select>
          </div>
          {(
            [
              ["piece_grams", "Pieza (g)"],
              ["support_grams", "Soportes (g)"],
              ["waste_grams", "Purgado / merma (g)"],
            ] as const
          ).map(([k, label]) => (
            <div className="field" key={k}>
              <label htmlFor={prefix + k + i}>{label}</label>
              <input
                id={prefix + k + i}
                min="0"
                step="0.001"
                type="number"
                value={m[k]}
                onChange={(e) =>
                  onChange({
                    ...value,
                    materials: value.materials.map((v, j) =>
                      j === i ? { ...v, [k]: e.target.value } : v,
                    ),
                  })
                }
              />
            </div>
          ))}
          {value.materials.length > 1 && (
            <button
              type="button"
              className="icon-button"
              aria-label={"Quitar material " + (i + 1)}
              onClick={() =>
                onChange({
                  ...value,
                  materials: value.materials.filter((_, j) => j !== i),
                })
              }
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      ))}
      <details className="cost-extras">
        <summary>Mano de obra, pintado, personalización y otros costos</summary>
        <div className="business-form-grid">
          {input("labor_hours", "Mano de obra (horas)")}
          {input("painting_hours", "Pintado (horas)")}
          {input("painting_materials", "Materiales de pintado (COP)")}
          {input("supplies_cost", "Insumos adicionales (COP)")}
          {input(
            "customization_cost",
            "Personalización (COP)",
            "Se incluye una sola vez en el costo.",
          )}
          {input("packaging_cost", "Empaque (COP)")}
          {input("other_cost", "Otros costos directos (COP)")}
        </div>
      </details>
      {!production && (
        <>
          <div className="multiplier-options">
            <span>Multiplicador del costo</span>
            {["2", "3", "4"].map((m) => (
              <button
                key={m}
                type="button"
                className={
                  "button " +
                  (value.multiplier === m && !value.manual_price
                    ? "primary"
                    : "secondary")
                }
                onClick={() =>
                  onChange({ ...value, multiplier: m, manual_price: "" })
                }
              >
                ×{m}
                {result && <small>{money(result.total * Number(m))}</small>}
              </button>
            ))}
          </div>
          {input(
            "manual_price",
            "Precio manual por unidad (COP)",
            "Opcional. Al completarlo reemplaza el precio por multiplicador.",
          )}
        </>
      )}
      {result ? (
        <div className="cost-breakdown">
          <dl>
            <div>
              <dt>Material</dt>
              <dd>{money(result.material_cost)}</dd>
            </div>
            <div>
              <dt>Amortización</dt>
              <dd>{money(result.depreciation_cost)}</dd>
            </div>
            <div>
              <dt>Energía</dt>
              <dd>{money(result.energy_cost)}</dd>
            </div>
            <div>
              <dt>Mano de obra</dt>
              <dd>{money(result.labor_cost)}</dd>
            </div>
            <div>
              <dt>Pintado</dt>
              <dd>{money(result.painting_cost)}</dd>
            </div>
            <div>
              <dt>Otros directos</dt>
              <dd>{money(result.extras_cost)}</dd>
            </div>
          </dl>
          <div className="cost-totals">
            <span>
              Costo {production ? "real" : "por unidad"}
              <strong>{money(result.total)}</strong>
            </span>
            {!production && (
              <>
                <span>
                  Precio de venta<strong>{money(result.price)}</strong>
                </span>
                <span>
                  Ganancia estimada<strong>{money(result.profit)}</strong>
                </span>
              </>
            )}
          </div>
          {!production && (
            <p>
              Margen: {result.margin.toFixed(2)} % · Recargo:{" "}
              {result.markup.toFixed(2)} % · Precio mínimo de referencia:{" "}
              {money(result.total)}. Personalización y pintado ya incluidos.
            </p>
          )}
        </div>
      ) : (
        <p className="field-help">{problem}</p>
      )}
    </div>
  );
}
