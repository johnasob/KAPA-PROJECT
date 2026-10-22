import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { database } from "./supabase";
import type { Database } from "./database.types";
import { errorMessage } from "./format";
import { Brand, ErrorState, Loading } from "../components/ui";

export type Settings = Database["public"]["Tables"]["business_settings"]["Row"];
export type Partner = Database["public"]["Tables"]["partners"]["Row"];
export type Member = Database["public"]["Tables"]["user_profiles"]["Row"];
type Workspace = {
  settings: Settings;
  partners: Partner[];
  members: Member[];
  reload: () => Promise<void>;
};
const Context = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Omit<Workspace, "reload"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);
  const [checking, setChecking] = useState(false);
  const reload = useCallback(async () => {
    setError(null);
    setChecking(true);
    try {
      const [settings, partners, members, capabilities] = await Promise.all([
        database().from("business_settings").select("*").single(),
        database().from("partners").select("*").order("code"),
        database().from("user_profiles").select("*").order("display_name"),
        database().rpc("business_read", { p_section: "capabilities" }),
      ]);
      if (settings.error) throw settings.error;
      if (partners.error) throw partners.error;
      if (members.error) throw members.error;
      if (
        capabilities.error &&
        !["22023", "PGRST202", "PGRST205", "42P01"].includes(
          capabilities.error.code,
        )
      )
        throw capabilities.error;
      if (
        capabilities.error ||
        !(
          Number(
            (capabilities.data as { schema_version?: number } | null)
              ?.schema_version ?? 0,
          ) >= 3
        )
      ) {
        setUpgradeNeeded(true);
        setData(null);
        return;
      }
      setUpgradeNeeded(false);
      setData({
        settings: settings.data,
        partners: partners.data,
        members: members.data,
      });
    } catch (cause) {
      setError(errorMessage(cause));
      throw cause;
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    void reload().catch(() => {});
  }, [reload]);
  if (loading) return <Loading />;
  if (error)
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          void reload().catch(() => {});
        }}
      />
    );
  if (upgradeNeeded)
    return (
      <div className="setup-screen">
        <Brand />
        <section className="setup-card">
          <h1>Actualiza KAPA en Supabase</h1>
          <p>
            Tu cuenta y tus datos se conservan. Esta versión necesita actualizar
            las tablas antes de usar las cotizaciones, entregas y créditos
            nuevos.
          </p>
          <ol>
            <li>Abre el instalador actualizado y copia todo su contenido.</li>
            <li>
              En tu proyecto Supabase entra a SQL Editor → New query, pega el
              SQL y pulsa Run.
            </li>
            <li>
              Cuando aparezca Success, vuelve aquí y pulsa el botón de abajo.
            </li>
          </ol>
          <div className="card-actions">
            <a
              className="button primary"
              href="https://raw.githubusercontent.com/johnasob/KAPA-PROJECT/main/release/KAPA-3D-instalacion.sql"
              target="_blank"
              rel="noreferrer"
            >
              Abrir SQL de actualización
            </a>
            <a
              className="button secondary"
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              Abrir Supabase
            </a>
          </div>
          <p>No necesitas crear otro usuario ni volver a activar la cuenta.</p>
          <button
            className="button secondary"
            disabled={checking}
            onClick={() => {
              void reload().catch(() => {});
            }}
          >
            {checking
              ? "Comprobando…"
              : "Ya ejecuté el SQL · Volver a intentar"}
          </button>
        </section>
      </div>
    );
  if (!data) return null;
  return (
    <Context.Provider value={{ ...data, reload }}>{children}</Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkspaceProvider requerido");
  return value;
}
