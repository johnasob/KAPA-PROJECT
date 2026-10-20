export type PublicConfig = { url: string; key: string };

export function isHostedSupabase(config: PublicConfig): boolean {
  const parsed = new URL(config.url);
  // El despliegue gratuito usa el proyecto alojado de Supabase. Una URL local
  // apunta al computador de cada visitante, no a la máquina privada de Codex.
  return (
    parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co")
  );
}

export function readConfig(
  env: Record<string, string | undefined>,
): PublicConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = (
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))
      return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash)
      return null;
    if (key.startsWith("sb_secret_")) return null;
    if (key.split(".").length === 3) {
      const payload: unknown = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (
        !payload ||
        typeof payload !== "object" ||
        !("role" in payload) ||
        payload.role !== "anon"
      )
        return null;
    } else if (!key.startsWith("sb_publishable_")) return null;
    return { url: parsed.origin, key };
  } catch {
    return null;
  }
}
