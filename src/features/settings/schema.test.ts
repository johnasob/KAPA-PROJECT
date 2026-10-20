import { describe, expect, it } from "vitest";
import { settingsSchema, toChanges } from "./schema";
const valid = {
  business_name: "KAPA 3D",
  default_deposit_percent: "50",
  low_stock_grams: "200",
  critical_stock_grams: "100",
  reference_filament_kg_cost: "90000",
  energy_kwh_cost: "",
  labor_hour_cost: "",
};
describe("parámetros del negocio", () => {
  it("mantiene sin configurar los costos desconocidos", () => {
    expect(toChanges(settingsSchema.parse(valid))).toMatchObject({
      energy_kwh_cost: null,
      labor_hour_cost: null,
    });
  });
  it.each(["-1", "100.01", "500"])(
    "rechaza anticipos fuera de rango: %s",
    (value) => {
      expect(
        settingsSchema.safeParse({ ...valid, default_deposit_percent: value })
          .success,
      ).toBe(false);
    },
  );
  it("exige que la alerta crítica sea menor que la amarilla", () => {
    expect(
      settingsSchema.safeParse({ ...valid, critical_stock_grams: "200" })
        .success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({ ...valid, critical_stock_grams: "0" }).success,
    ).toBe(true);
  });
  it.each(["-12", "1.005", "NaN", "90,000", "1e5"])(
    "rechaza importes ambiguos o imprecisos: %s",
    (value) => {
      expect(
        settingsSchema.safeParse({ ...valid, energy_kwh_cost: value }).success,
      ).toBe(false);
    },
  );
  it("preserva decimales como texto hasta almacenarlos en PostgreSQL", () => {
    expect(
      toChanges(settingsSchema.parse({ ...valid, labor_hour_cost: "12500.25" }))
        .labor_hour_cost,
    ).toBe("12500.25");
  });
});
