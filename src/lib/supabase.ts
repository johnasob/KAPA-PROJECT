import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { readConfig } from "./config";

export const publicConfig = readConfig(import.meta.env);
export const supabase = publicConfig
  ? createClient<Database>(publicConfig.url, publicConfig.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;

export function database() {
  if (!supabase) throw new Error("Falta configurar la conexión a Supabase.");
  return supabase;
}
