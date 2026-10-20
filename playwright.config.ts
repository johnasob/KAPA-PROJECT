import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
const local = JSON.parse(
  execFileSync("sh", ["scripts/supabase.sh", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
) as { API_URL: string; ANON_KEY: string };
if (new URL(local.API_URL).hostname !== "127.0.0.1")
  throw new Error("Las pruebas E2E requieren Supabase local.");
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://127.0.0.1:5174",
    browserName: "chromium",
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ??
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    env: {
      VITE_SUPABASE_URL: local.API_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: local.ANON_KEY,
    },
    reuseExistingServer: false,
  },
});
