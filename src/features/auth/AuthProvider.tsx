import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { database } from "../../lib/supabase";
import { errorMessage } from "../../lib/format";
import type { Database } from "../../lib/database.types";

export type Profile = Database["public"]["Tables"]["user_profiles"]["Row"];
type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => void;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const principal = useRef<string | undefined>(undefined);
  const userId = session?.user.id;
  const refreshProfile = useCallback(() => setRevision((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    let eventReceived = false;
    const {
      data: { subscription },
    } = database().auth.onAuthStateChange((event, nextSession) => {
      eventReceived = true;
      if (!alive) return;
      if (principal.current !== nextSession?.user.id) {
        principal.current = nextSession?.user.id;
        setProfile(null);
        setLoading(!!nextSession);
      }
      if (!nextSession) setLoading(false);
      if (event === "PASSWORD_RECOVERY") setRevision((v) => v + 1);
      setSession(nextSession);
    });
    void database()
      .auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!alive || eventReceived) return;
        if (sessionError) {
          setError(errorMessage(sessionError));
          setLoading(false);
        } else {
          principal.current = data.session?.user.id;
          setSession(data.session);
          if (!data.session) setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError("No se pudo recuperar tu sesión. Recarga la página.");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setError(null);
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void database()
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error: profileError }) => {
        if (!alive) return;
        setProfile(data?.active ? data : null);
        setError(profileError ? errorMessage(profileError) : null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId, revision]);
  return (
    <AuthContext.Provider
      value={{ session, profile, loading, error, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider requerido");
  return value;
}
