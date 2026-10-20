import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  Home,
  LogOut,
  Menu,
  Settings2,
  Users,
  X,
  Boxes,
  Printer,
  Calculator,
  ContactRound,
  ClipboardList,
  Wallet,
  ChartNoAxesCombined,
} from "lucide-react";
import { Brand, Notice } from "./ui";
import { useAuth } from "../features/auth/AuthProvider";
import { useWorkspace } from "../lib/WorkspaceProvider";
import { database, publicConfig } from "../lib/supabase";
import { errorMessage } from "../lib/format";

const links = [
  { to: "/", title: "Inicio", icon: Home },
  { to: "/inventario", title: "Inventario", icon: Boxes },
  { to: "/impresoras", title: "Impresoras", icon: Printer },
  { to: "/cotizaciones", title: "Costos y cotizaciones", icon: Calculator },
  { to: "/clientes", title: "Clientes", icon: ContactRound },
  { to: "/pedidos", title: "Pedidos y producción", icon: ClipboardList },
  { to: "/finanzas", title: "Finanzas", icon: Wallet },
  { to: "/reportes", title: "Reportes", icon: ChartNoAxesCombined },
  { to: "/socios", title: "Socios y equipo", icon: Users },
  { to: "/actividad", title: "Actividad", icon: Activity },
  { to: "/configuracion", title: "Configuración", icon: Settings2 },
];
export function Layout() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const receive = (event: Event) => {
      const message = (event as CustomEvent<unknown>).detail;
      if (typeof message !== "string") return;
      setNotice(message);
      clearTimeout(timer);
      timer = setTimeout(() => setNotice(null), 6000);
    };
    window.addEventListener("kapa:notice", receive);
    return () => {
      window.removeEventListener("kapa:notice", receive);
      clearTimeout(timer);
    };
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const { profile } = useAuth();
  const { settings } = useWorkspace();
  const location = useLocation();
  const trigger = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () =>
      Array.from(
        drawer.current?.querySelectorAll<HTMLElement>("a, button") ?? [],
      );
    controls()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
      if (event.key !== "Tab") return;
      const all = controls(),
        first = all[0],
        last = all.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  async function signOut() {
    setLeaving(true);
    setError(null);
    try {
      const { error: signOutError } = await database().auth.signOut();
      if (signOutError) throw signOutError;
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLeaving(false);
    }
  }
  const local =
    publicConfig && new URL(publicConfig.url).hostname === "127.0.0.1";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      {open && (
        <div
          className="drawer-backdrop"
          onClick={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
        />
      )}
      <aside
        ref={drawer}
        className={`sidebar ${open ? "is-open" : ""}`}
        aria-label="Navegación principal"
        {...(open ? { role: "dialog", "aria-modal": true } : {})}
      >
        <div className="sidebar-top">
          <Brand />
          <button
            className="icon-button drawer-close"
            aria-label="Cerrar menú"
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            <X size={22} />
          </button>
        </div>
        <span className="nav-caption">TU ESPACIO</span>
        <nav>
          {links.map(({ to, title, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={19} />
              <span>{title}</span>
              <ChevronRight size={14} />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="mini-layers" aria-hidden="true">
            ◇
          </div>
          <strong>Construyendo capa a capa.</strong>
          <p>El comienzo de una operación más organizada.</p>
          <NavLink to="/configuracion">
            Personalizar mi negocio <ArrowUpRight size={15} />
          </NavLink>
        </div>
        <div className="sidebar-account">
          <span className="avatar">{profile?.display_name.slice(0, 1)}</span>
          <div>
            <strong>{profile?.display_name}</strong>
            <small>Socio · Administrador</small>
          </div>
          <button
            className="icon-button"
            onClick={() => {
              void signOut();
            }}
            disabled={leaving}
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={trigger}
              className="icon-button menu-trigger"
              aria-label="Abrir menú"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span>{settings.business_name}</span>
            <ChevronRight size={14} />
            <strong>
              {links.find((l) => l.to === location.pathname)?.title ??
                "Seguridad"}
            </strong>
          </div>
          <div className="connection">
            <span className="status-dot" />
            {local ? "Desarrollo local" : "Espacio conectado"}
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {notice && (
            <div className="operation-toast">
              <Notice type="success">{notice}</Notice>
              <button
                className="icon-button"
                aria-label="Ocultar mensaje"
                onClick={() => setNotice(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {error && <Notice>{error}</Notice>}
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>KAPA 3D · Creamos capa a capa</span>
          <span>COP · Bogotá, Colombia</span>
        </footer>
      </div>
    </div>
  );
}
