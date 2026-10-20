import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  Box,
  Check,
  CheckCheck,
  Layers3,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PageTitle } from "../../components/ui";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../../lib/WorkspaceProvider";
import { money } from "../../lib/format";

const phases = [
  [
    "01",
    "Una base segura",
    "Acceso privado, socios, configuración e historial.",
    true,
  ],
  [
    "02",
    "Materiales e impresoras",
    "Inventario trazable, reservas y mantenimiento.",
    false,
  ],
  [
    "03",
    "Del costo a la cotización",
    "Costos precisos y precios con criterio.",
    false,
  ],
  [
    "04",
    "Clientes y producción",
    "Pedidos, anticipos y entregas organizadas.",
    false,
  ],
  [
    "05",
    "Finanzas claras",
    "Caja, deudas y distribución de utilidades.",
    false,
  ],
  ["06", "Todo a la vista", "Indicadores, reportes y exportaciones.", false],
] as const;

export function OverviewPage() {
  const { profile } = useAuth();
  const { settings, partners, members } = useWorkspace();
  return (
    <>
      <PageTitle
        eyebrow="VISTA GENERAL"
        title={`Hola, ${profile?.display_name}.`}
        description="Cada gran impresión empieza con una buena base."
        action={
          <Link className="button secondary" to="/configuracion">
            <Settings2 size={16} /> Configurar negocio
          </Link>
        }
      />
      <section className="welcome-card">
        <div className="welcome-copy">
          <span className="pill dark">
            <span className="status-dot" /> FUNDAMENTOS · FASE 01
          </span>
          <h2>
            Tu próximo gran proyecto
            <br />
            empieza <em>aquí.</em>
          </h2>
          <p>
            El espacio de {settings.business_name} ya tiene una base.
            <br />
            Construyamos una operación tan precisa como tus piezas.
          </p>
          <Link className="button lime" to="/socios">
            Conoce tu equipo <ArrowRight size={17} />
          </Link>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <span className="art-orbit orbit-one" />
          <span className="art-orbit orbit-two" />
          <div className="cube">
            <Box size={104} strokeWidth={0.8} />
          </div>
          <div className="art-tag">
            <Layers3 size={15} /> UNA CAPA A LA VEZ
          </div>
        </div>
      </section>
      <div className="info-grid">
        <article className="summary-card">
          <span className="icon-tile green">
            <Users size={20} />
          </span>
          <small>Socios del negocio</small>
          <strong>
            {partners.length.toString().padStart(2, "0")}{" "}
            <span>John + Sebas</span>
          </strong>
          <p>Participación compartida, 50 % cada uno.</p>
        </article>
        <article className="summary-card">
          <span className="icon-tile sand">
            <LockKeyhole size={20} />
          </span>
          <small>Cuentas habilitadas</small>
          <strong>
            {members
              .filter((m) => m.active)
              .length.toString()
              .padStart(2, "0")}{" "}
            <span>de {partners.length} socios</span>
          </strong>
          <p>Acceso validado desde la base de datos.</p>
        </article>
        <article className="summary-card">
          <span className="icon-tile lilac">
            <Settings2 size={20} />
          </span>
          <small>Anticipo predeterminado</small>
          <strong>
            {settings.default_deposit_percent} <span>% por pedido</span>
          </strong>
          <p>Referencia configurable para la fase de pedidos.</p>
        </article>
      </div>
      <div className="overview-columns">
        <section className="panel roadmap">
          <div className="section-heading">
            <div>
              <span className="eyebrow">EL CAMINO DE KAPA</span>
              <h2>Crecer, con estructura.</h2>
            </div>
            <span className="pill">1 de 6 etapas</span>
          </div>
          <div className="phase-list">
            {phases.map(([number, title, text, active]) => (
              <div
                className={`phase-row ${active ? "complete" : ""}`}
                key={number}
              >
                <span className="phase-number">
                  {active ? <Check size={16} /> : number}
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <span className={`phase-status ${active ? "ready" : ""}`}>
                  {active ? "Disponible" : "Por construir"}
                </span>
              </div>
            ))}
          </div>
        </section>
        <div className="side-stack">
          <section className="panel parameters">
            <div className="section-heading">
              <h2>Las reglas de tu taller</h2>
              <ArrowDownRight size={20} />
            </div>
            <p>Valores leídos de la configuración del negocio.</p>
            <dl>
              <div>
                <dt>Moneda</dt>
                <dd>{settings.currency}</dd>
              </div>
              <div>
                <dt>Filamento · referencia / kg</dt>
                <dd>{money(settings.reference_filament_kg_cost)}</dd>
              </div>
              <div>
                <dt>Alerta de stock bajo</dt>
                <dd>&lt; {settings.low_stock_grams} g</dd>
              </div>
              <div>
                <dt>Alerta crítica</dt>
                <dd>≤ {settings.critical_stock_grams} g</dd>
              </div>
            </dl>
            <Link to="/configuracion" className="text-link">
              Editar parámetros <ArrowRight size={15} />
            </Link>
          </section>
          <section className="security-card">
            <ShieldCheck size={25} />
            <h3>Un espacio de confianza.</h3>
            <p>
              Solo los socios autorizados pueden consultar y actualizar la
              información. Cada cambio de configuración queda registrado.
            </p>
            <Link to="/actividad">
              Ver historial <ArrowRight size={15} />
            </Link>
          </section>
        </div>
      </div>
      <div className="foundation-note">
        <CheckCheck size={18} />
        <p>
          Esta primera fase no registra ventas ni saldos. Los indicadores
          financieros se incorporarán cuando existan los módulos y sus datos
          reales.
        </p>
      </div>
    </>
  );
}
