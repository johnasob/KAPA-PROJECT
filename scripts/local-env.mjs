import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env.local"))
  throw new Error(
    ".env.local ya existe. No se sobrescribió. Conserva tu configuración o renómbrala antes de continuar.",
  );
const status = JSON.parse(
  execFileSync("sh", ["scripts/supabase.sh", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);
const url = new URL(status.API_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname))
  throw new Error("Esta ayuda solo configura Supabase local.");
writeFileSync(
  ".env.local",
  `# Desarrollo local; solo clave pública anon.\nVITE_SUPABASE_URL=${url.origin}\nVITE_SUPABASE_PUBLISHABLE_KEY=${status.ANON_KEY}\n`,
  { mode: 0o600 },
);
console.log(
  ".env.local creado con la conexión pública local. No contiene la clave administrativa.",
);
