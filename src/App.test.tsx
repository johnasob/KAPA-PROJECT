import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("./lib/supabase", () => ({ supabase: null }));
import App from "./App";
it("sin conexión configurada muestra instrucciones y no aparenta datos ni permite ingresar", () => {
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "Conectemos tu taller." }),
  ).toBeInTheDocument();
  expect(screen.getByText("VITE_SUPABASE_URL")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /ingresar/i }),
  ).not.toBeInTheDocument();
});
