import { Plus, Trash2 } from "lucide-react";
import Decimal from "decimal.js";
import { useId } from "react";
import {
  calculateCost,
  totalColorMaterial,
  lotName,
  type Catalog,
  type CostInputs,
} from "../../lib/operations";
import { useWorkspace } from "../../lib/WorkspaceProvider";
import { money } from "../../lib/format";
export const emptyCost = (): CostInputs => ({
  printer_id: "",
  hours: "",
  extra_items: [],
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
    key: Exclude<keyof CostInputs, "materials" | "printer_id" | "extra_items">,
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
        <div
          className="duration-input"
          role="group"
          aria-label={production ? "Duración real" : "Duración por unidad"}
        >
          <div className="field">
            <label htmlFor={prefix + "duration-hours"}>
              {production
                ? "Horas reales totales *"
                : "Horas de impresión por unidad *"}
            </label>
            <input
              id={prefix + "duration-hours"}
              type="number"
              min="0"
              step="1"
              value={
                value.hours === ""
                  ? ""
                  : Math.floor(Math.round(Number(value.hours) * 60) / 60)
              }
              onChange={(e) =>
                update(
                  "hours",
                  new Decimal(e.target.value || 0)
                    .plus(
                      new Decimal(
                        Math.round(Number(value.hours || 0) * 60) % 60,
                      ).div(60),
                    )
                    .toString(),
                )
              }
            />
          </div>
          <div className="field">
            <label htmlFor={prefix + "duration-minutes"}>Minutos</label>
            <input
              id={prefix + "duration-minutes"}
              type="number"
              min="0"
              max="59"
              step="1"
              value={
                value.hours === ""
                  ? "0"
                  : Math.round(Number(value.hours) * 60) % 60
              }
              onChange={(e) =>
                update(
                  "hours",
                  new Decimal(
                    Math.floor(Math.round(Number(value.hours || 0) * 60) / 60),
                  )
                    .plus(new Decimal(e.target.value || 0).div(60))
                    .toString(),
                )
              }
            />
          </div>
        </div>
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
          <div className="field">
            <label htmlFor={prefix + "total-grams" + i}>
              Total de este color (g)
            </label>
            <input
              id={prefix + "total-grams" + i}
              type="number"
              min="0.001"
              step="0.001"
              value={
                m.piece_grams || m.support_grams || m.waste_grams
                  ? totalColorMaterial(m).piece_grams
                  : ""
              }
              onChange={(e) =>
                onChange({
                  ...value,
                  materials: value.materials.map((it, j) =>
                    j === i
                      ? {
                          ...it,
                          piece_grams: e.target.value,
                          support_grams: "0",
                          waste_grams: "0",
                        }
                      : it,
                  ),
                })
              }
            />
            <small>
              Un solo total por color. Incluye todo el material usado.
            </small>
          </div>
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
      <section className="itemized-extras">
        <div className="form-section-heading">
          <h3>Insumos y costos adicionales por unidad</h3>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              onChange({
                ...value,
                extra_items: [
                  ...(value.extra_items ?? []),
                  { description: "", quantity: "1", unit_cost: "0" },
                ],
              })
            }
          >
            <Plus size={15} /> Agregar insumo
          </button>
        </div>
        <p>
          Switches, chips NFC, argollas de llavero, imanes o cualquier otro
          costo.
        </p>
        {(value.extra_items ?? []).map((item, i) => (
          <div className="extra-item-row" key={i}>
            {(
              [
                ["description", "Insumo"],
                ["quantity", "Cantidad del insumo"],
                ["unit_cost", "Costo unitario del insumo (COP)"],
              ] as const
            ).map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={prefix + key + i}>{label}</label>
                <input
                  id={prefix + key + i}
                  type={key === "description" ? "text" : "number"}
                  min={key === "quantity" ? "0.001" : "0"}
                  step="any"
                  value={item[key]}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      extra_items: (value.extra_items ?? []).map((it, j) =>
                        j === i ? { ...it, [key]: e.target.value } : it,
                      ),
                    })
                  }
                />
              </div>
            ))}
            <button
              type="button"
              className="icon-button"
              aria-label={"Quitar insumo " + (i + 1)}
              onClick={() =>
                onChange({
                  ...value,
                  extra_items: value.extra_items?.filter((_, j) => j !== i),
                })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </section>
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
            <span>Precio orientativo por unidad</span>
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
                {m === "3" ? " · Recomendado" : ""}
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
      <p className="field-help">
        La amortización aplicada es el menor valor entre el uso de la impresora
        y el 10 % del material. El precio sugerido incluye los demás costos que
        registres.
      </p>
      {result ? (
        <div className="cost-breakdown">
          <dl>
            <div>
              <dt>Material</dt>
              <dd>{money(result.material_cost)}</dd>
            </div>
            <div>
              <dt>Amortización · máximo 10 % del material</dt>
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
