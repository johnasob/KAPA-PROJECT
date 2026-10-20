import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { lazy, Suspense, useState } from "react";
import { ArrowRight, PlugZap, ShieldAlert } from "lucide-react";
import { supabase, database } from "./lib/supabase";
import { Brand, ErrorState, Loading, Notice } from "./components/ui";
import { AuthProvider, useAuth } from "./features/auth/AuthProvider";
import { Layout } from "./components/Layout";
import { WorkspaceProvider } from "./lib/WorkspaceProvider";
import { errorMessage } from "./lib/format";

const AuthScreen = lazy(() =>
  import("./features/auth/AuthScreen").then((m) => ({ default: m.AuthScreen })),
);
const PasswordPage = lazy(() =>
  import("./features/auth/PasswordPage").then((m) => ({
    default: m.PasswordPage,
  })),
);
const OverviewPage = lazy(() =>
  import("./features/overview/OverviewPage").then((m) => ({
    default: m.OverviewPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./features/settings/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  })),
);
const PartnersPage = lazy(() =>
  import("./features/partners/PartnersPage").then((m) => ({
    default: m.PartnersPage,
  })),
);
const AuditPage = lazy(() =>
  import("./features/audit/AuditPage").then((m) => ({ default: m.AuditPage })),
);

function ConfigurationRequired() {
  return (
    <div className="setup-screen">
      <Brand />
      <div className="setup-card">
        <span className="icon-tile">
          <PlugZap size={26} />
        </span>
        <span className="eyebrow">PRIMER PASO</span>
        <h1>Conectemos tu taller.</h1>
        <p>
          KAPA 3D necesita un proyecto de Supabase para guardar tus datos y
          proteger el acceso de John y Sebas.
        </p>
        <ol>
          <li>Crea un proyecto gratuito en Supabase.</li>
          <li>
            Aplica la migración de fundamentos y vincula las cuentas de ambos
            socios siguiendo el README.
          </li>
          <li>
            Configura <code>VITE_SUPABASE_URL</code> y{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, y vuelve a iniciar la
            aplicación.
          </li>
        </ol>
        <Notice type="info">
          Usa exclusivamente la clave pública publishable o anon. Nunca una
          clave privada ni service_role.
        </Notice>
        <a
          className="button primary"
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
        >
          Abrir Supabase <ArrowRight size={17} />
        </a>
      </div>
      <p className="setup-footer">
        Tus datos se guardarán en Supabase. No hay datos de demostración.
      </p>
    </div>
  );
}
function UnassignedAccount() {
  const { refreshProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    setError(null);
    const { error: signOutError } = await database().auth.signOut();
    if (signOutError) setError(errorMessage(signOutError));
    setBusy(false);
  }
  return (
    <div className="setup-screen">
      <Brand />
      <section className="setup-card">
        <ShieldAlert size={32} />
        <h1>Tu acceso aún no está habilitado.</h1>
        <p>
          Tu cuenta ya está registrada. Un socio debe habilitar tu acceso a KAPA
          3D desde «Socios y equipo». Cuando lo haga, pulsa «Comprobar acceso»
          para entrar.
        </p>
        {error && <Notice>{error}</Notice>}
        <div className="dialog-actions">
          <button className="button secondary" onClick={refreshProfile}>
            Comprobar acceso
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => {
              void logout();
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </section>
    </div>
  );
}
function Gate() {
  const { session, profile, loading, error, refreshProfile } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refreshProfile} />;
  if (!session) return <AuthScreen />;
  // Recovery must work even if the invited user has not yet been assigned a partner.
  if (location.pathname === "/actualizar-clave")
    return (
      <div className="recovery-shell">
        <Brand />
        <PasswordPage />
      </div>
    );
  if (!profile) return <UnassignedAccount />;
  return (
    <WorkspaceProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="socios" element={<PartnersPage />} />
          <Route path="configuracion" element={<SettingsPage />} />
          <Route path="actividad" element={<AuditPage />} />
          <Route
            path="*"
            element={
              <div className="empty-state">
                <h1>Este lugar aún no existe.</h1>
                <p>Regresa a tu espacio para continuar.</p>
                <Link className="button primary" to="/">
                  Volver al inicio
                </Link>
              </div>
            }
          />
        </Route>
      </Routes>
    </WorkspaceProvider>
  );
}
export default function App() {
  if (!supabase) return <ConfigurationRequired />;
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Loading />}>
          <Gate />
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
