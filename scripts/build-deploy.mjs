import { spawnSync } from "node:child_process";
import { loadEnv } from "vite";
import { readConfig, isHostedSupabase } from "../src/lib/config.ts";

const config = readConfig(loadEnv("production", process.cwd(), "VITE_"));
if (!config || !isHostedSupabase(config)) {
  console.error(
    "No se generó un despliegue: configura VITE_SUPABASE_URL con la URL HTTPS de tu proyecto alojado y VITE_SUPABASE_PUBLISHABLE_KEY con su clave pública. La conexión de desarrollo local no es accesible desde el navegador de otros equipos.",
  );
  process.exit(1);
}
const result = spawnSync("npm", ["run", "build"], { stdio: "inherit" });
if (result.error) {
  console.error("No se pudo ejecutar la compilación de producción.");
  process.exit(1);
}
process.exit(result.status ?? 1);
