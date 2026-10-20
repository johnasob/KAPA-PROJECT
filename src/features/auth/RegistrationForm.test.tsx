import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
const { signup } = vi.hoisted(() => ({ signup: vi.fn() }));
vi.mock("../../lib/supabase", () => ({
  database: () => ({ auth: { signUp: signup } }),
}));
import { RegistrationForm } from "./RegistrationForm";
beforeEach(() => signup.mockReset());
it("envía el nombre a Supabase y solicita confirmación cuando no hay sesión", async () => {
  signup.mockResolvedValue({ data: { session: null }, error: null });
  render(<RegistrationForm onLogin={vi.fn()} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nombre"), "John");
  await user.type(
    screen.getByLabelText("Correo electrónico"),
    "john@example.com",
  );
  await user.type(
    screen.getByLabelText("Contraseña", { exact: true }),
    "UnaClaveSegura123!",
  );
  await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
  expect(signup).toHaveBeenCalledWith({
    email: "john@example.com",
    password: "UnaClaveSegura123!",
    options: {
      data: { display_name: "John" },
      emailRedirectTo: window.location.origin,
    },
  });
  expect(
    await screen.findByText(/Revisa tu correo y confirma el registro/),
  ).toBeVisible();
});
it("muestra un error claro si el proyecto no permite registro", async () => {
  signup.mockResolvedValue({ data: {}, error: { code: "signup_disabled" } });
  render(<RegistrationForm onLogin={vi.fn()} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nombre"), "John");
  await user.type(
    screen.getByLabelText("Correo electrónico"),
    "john@example.com",
  );
  await user.type(
    screen.getByLabelText("Contraseña", { exact: true }),
    "UnaClaveSegura123!",
  );
  await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "El registro de usuarios está deshabilitado",
  );
});
