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
import { ErrorState, Loading } from "../components/ui";

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
  const reload = useCallback(async () => {
    setError(null);
    try {
      const [settings, partners, members] = await Promise.all([
        database().from("business_settings").select("*").single(),
        database().from("partners").select("*").order("code"),
        database().from("user_profiles").select("*").order("display_name"),
      ]);
      if (settings.error) throw settings.error;
      if (partners.error) throw partners.error;
      if (members.error) throw members.error;
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
