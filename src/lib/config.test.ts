import { describe, expect, it } from "vitest";
import { readConfig, isHostedSupabase } from "./config";
describe("configuración pública de Supabase", () => {
  it("no permite desplegar una conexión de desarrollo local ni otro dominio", () => {
    expect(
      isHostedSupabase({
        url: "http://127.0.0.1:54321",
        key: "sb_publishable_local",
      }),
    ).toBe(false);
    expect(
      isHostedSupabase({
        url: "https://localhost:54321",
        key: "sb_publishable_local",
      }),
    ).toBe(false);
    expect(
      isHostedSupabase({
        url: "https://proyecto.supabase.co.example.com",
        key: "sb_publishable_local",
      }),
    ).toBe(false);
    expect(
      isHostedSupabase({
        url: "https://proyecto.supabase.co",
        key: "sb_publishable_public",
      }),
    ).toBe(true);
  });
  it("requiere las dos variables", () => {
    expect(readConfig({})).toBeNull();
    expect(
      readConfig({ VITE_SUPABASE_URL: "https://example.supabase.co" }),
    ).toBeNull();
  });
  it("acepta claves públicas y HTTP únicamente en desarrollo local", () => {
    expect(
      readConfig({
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local",
      })?.url,
    ).toBe("http://127.0.0.1:54321");
    expect(
      readConfig({
        VITE_SUPABASE_URL: "http://example.com",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local",
      }),
    ).toBeNull();
  });
  it("rechaza claves privadas y URLs con credenciales", () => {
    expect(
      readConfig({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_do-not-use",
      }),
    ).toBeNull();
    const privateJwt = `header.${btoa(JSON.stringify({ role: "service_role" }))}.signature`;
    expect(
      readConfig({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_ANON_KEY: privateJwt,
      }),
    ).toBeNull();
    expect(
      readConfig({
        VITE_SUPABASE_URL: "https://user:pass@example.com",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local",
      }),
    ).toBeNull();
  });
});
