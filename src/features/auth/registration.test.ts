import { describe, expect, it } from "vitest";
import { registrationSchema } from "./registration";
const valid = {
  display_name: "John",
  email: "john@example.com",
  password: "UnaClaveSegura123!",
};
describe("registro de usuario", () => {
  it("solo requiere nombre, correo y contraseña y normaliza espacios", () => {
    expect(
      registrationSchema.parse({
        ...valid,
        display_name: " John ",
        email: " john@example.com ",
      }),
    ).toEqual(valid);
  });
  it.each([
    { display_name: "  " },
    { display_name: "x".repeat(81) },
    { email: "correo-no-valido" },
    { password: "123456" },
  ])("rechaza campos inválidos: %j", (changes) => {
    expect(registrationSchema.safeParse({ ...valid, ...changes }).success).toBe(
      false,
    );
  });
  it("no admite roles o asignaciones enviados por el cliente", () => {
    expect(
      registrationSchema.parse({ ...valid, role: "admin", partner_id: "john" }),
    ).toEqual(valid);
  });
});
