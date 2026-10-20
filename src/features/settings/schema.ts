import { z } from "zod";
const decimal = z
  .string()
  .regex(
    /^\d{1,12}(\.\d{1,2})?$/,
    "Usa un valor positivo, con máximo dos decimales y punto decimal.",
  );
const optionalDecimal = z.union([z.literal(""), decimal]);
export const settingsSchema = z
  .object({
    business_name: z
      .string()
      .trim()
      .min(1, "Escribe el nombre del negocio.")
      .max(80),
    default_deposit_percent: decimal.refine(
      (v) => Number(v) <= 100,
      "El anticipo debe estar entre 0 y 100 %.",
    ),
    low_stock_grams: decimal.refine(
      (v) => Number(v) > 0 && Number(v) <= 1000000,
      "Usa un valor mayor que 0 y hasta 1.000.000 g.",
    ),
    critical_stock_grams: decimal,
    reference_filament_kg_cost: decimal,
    energy_kwh_cost: optionalDecimal,
    labor_hour_cost: optionalDecimal,
  })
  .refine((v) => Number(v.critical_stock_grams) < Number(v.low_stock_grams), {
    path: ["critical_stock_grams"],
    message: "La alerta crítica debe ser menor que la alerta de stock bajo.",
  });
export type SettingsForm = z.infer<typeof settingsSchema>;
export function toChanges(values: SettingsForm) {
  return {
    ...values,
    energy_kwh_cost: values.energy_kwh_cost || null,
    labor_hour_cost: values.labor_hour_cost || null,
  };
}
