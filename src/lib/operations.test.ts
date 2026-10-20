import { describe, expect, it } from "vitest";
import {
  calculateCost,
  csvText,
  safeUrl,
  whatsappUrl,
  type Lot,
  type Row,
  type CostInputs,
} from "./operations";
const printer: Row<"printers"> = {
  id: "p",
  name: "A1 Mini",
  model: "A1 Mini",
  acquisition_cost: 1000000,
  purchased_on: null,
  useful_hours: 1000,
  accumulated_hours: 0,
  baseline_hours: 0,
  power_kw: 0.1,
  energy_rate: null,
  status: "available",
  notes: "",
  version: 1,
  created_at: "",
};
const lot: Lot = {
  id: "l",
  material_id: "m",
  initial_grams: 1000,
  on_hand_grams: 1000,
  purchase_cost: 90000,
  cost_per_gram: 90,
  purchased_on: "2026-10-20",
  supplier_id: null,
  state: "active",
  created_at: "",
  brand: "Marca",
  kind: "PLA",
  color: "Verde",
  reserved_grams: 0,
  available_grams: 1000,
  supplier_name: null,
};
const inputs: CostInputs = {
  printer_id: "p",
  hours: "2",
  materials: [
    { lot_id: "l", piece_grams: "10", support_grams: "2", waste_grams: "3" },
  ],
  labor_hours: "0.5",
  painting_hours: "0.25",
  painting_materials: "500",
  supplies_cost: "100",
  customization_cost: "200",
  packaging_cost: "300",
  other_cost: "400",
  multiplier: "3",
  manual_price: "",
};
describe("costos económicos de impresión", () => {
  it("redondea medio centavo sin convertir antes una tasa periódica a float", () => {
    const zero = {
      ...inputs,
      hours: "1",
      materials: [
        {
          lot_id: "l",
          piece_grams: "0.015",
          support_grams: "0",
          waste_grams: "0",
        },
      ],
      labor_hours: "0",
      painting_hours: "0",
      painting_materials: "0",
      supplies_cost: "0",
      customization_cost: "0",
      packaging_cost: "0",
      other_cost: "0",
    };
    const c = calculateCost(
      zero,
      { ...printer, acquisition_cost: 0, power_kw: 0 },
      [{ ...lot, purchase_cost: 1, initial_grams: 3, cost_per_gram: 1 / 3 }],
      1000,
      5000,
    );
    expect(c.material_cost).toBe(0.01);
    expect(c.total).toBe(0.01);
    expect(c.price).toBe(0.03);
  });
  it("coincide con PostgreSQL e incluye pintado y personalización una sola vez", () => {
    const c = calculateCost(inputs, printer, [lot], 1000, 5000);
    expect(c).toMatchObject({
      material_cost: 1350,
      depreciation_cost: 2000,
      energy_cost: 200,
      labor_cost: 2500,
      painting_cost: 1750,
      extras_cost: 1000,
      total: 8800,
      price: 26400,
      profit: 17600,
      markup: 200,
    });
    expect(c.margin).toBeCloseTo(66.666666, 4);
  });
  it.each([
    ["2", 17600],
    ["3", 26400],
    ["4", 35200],
  ])("multiplicador %s", (multiplier, price) =>
    expect(
      calculateCost({ ...inputs, multiplier }, printer, [lot], 1000, 5000)
        .price,
    ).toBe(price),
  );
  it("precio manual sustituye al multiplicador y permite visualizar pérdidas", () => {
    const c = calculateCost(
      { ...inputs, manual_price: "5000" },
      printer,
      [lot],
      1000,
      5000,
    );
    expect(c.price).toBe(5000);
    expect(c.profit).toBe(-3800);
    expect(c.margin).toBe(-76);
  });
  it("exige configurar costos antes de mostrar una cotización", () =>
    expect(() =>
      calculateCost(
        inputs,
        { ...printer, useful_hours: null },
        [lot],
        1000,
        5000,
      ),
    ).toThrow(/Completa/));
  it("maneja decimales sin los errores acumulados de float", () => {
    const c = calculateCost(
      {
        ...inputs,
        hours: "0.1",
        materials: [
          {
            lot_id: "l",
            piece_grams: "0.1",
            support_grams: "0.2",
            waste_grams: "0",
          },
        ],
        labor_hours: "0",
        painting_hours: "0",
        painting_materials: "0",
        supplies_cost: "0",
        customization_cost: "0",
        packaging_cost: "0",
        other_cost: "0",
      },
      printer,
      [lot],
      1000,
      5000,
    );
    expect(c.total).toBe(137);
    expect(c.price).toBe(411);
  });
  it.each(["-1", "NaN", "Infinity"])("rechaza horas inválidas %s", (hours) =>
    expect(() =>
      calculateCost({ ...inputs, hours }, printer, [lot], 1000, 5000),
    ).toThrow(),
  );
  it("suma dos colores sin omitir soportes y purga", () => {
    const second = { ...lot, id: "l2", purchase_cost: 120000 };
    const c = calculateCost(
      {
        ...inputs,
        materials: [
          ...inputs.materials,
          {
            lot_id: "l2",
            piece_grams: "5",
            support_grams: "1",
            waste_grams: "1",
          },
        ],
      },
      printer,
      [lot, second],
      1000,
      5000,
    );
    expect(c.material_cost).toBe(2190);
  });
});
describe("exportaciones y enlaces de clientes", () => {
  it("escapa separadores y comillas, y neutraliza fórmulas de hojas de cálculo", () => {
    const text = csvText(
      ["Nombre", "Valor"],
      [
        ["=1+1", 10],
        ['Una; pieza "verde"', null],
        ["+573001234567", -20],
      ],
    );
    expect(text).toContain('"\'=1+1";"10"');
    expect(text).toContain('"Una; pieza ""verde""";""');
    expect(text).toContain('"\'+573001234567";"-20"');
    expect(text.startsWith("\uFEFF")).toBe(true);
  });
  it("solo permite abrir URLs HTTP o HTTPS", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,malicioso")).toBeNull();
    expect(safeUrl("https://example.com/modelo.3mf")).toBe(
      "https://example.com/modelo.3mf",
    );
  });
  it("prepara WhatsApp sin enviar mensajes automáticamente", () =>
    expect(whatsappUrl("300 123 4567", "Hola, KAPA")).toBe(
      "https://wa.me/573001234567?text=Hola%2C%20KAPA",
    ));
});
