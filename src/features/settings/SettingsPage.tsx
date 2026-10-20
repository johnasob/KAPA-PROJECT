import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { ArrowRight, Globe2, Save, ShieldCheck } from "lucide-react";
import { Notice, PageTitle } from "../../components/ui";
import { useWorkspace } from "../../lib/WorkspaceProvider";
import { database } from "../../lib/supabase";
import { dateTime, errorMessage } from "../../lib/format";
import { settingsSchema, toChanges, type SettingsForm } from "./schema";

export function SettingsPage() {
  const { settings, reload } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<SettingsForm | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsForm>({ resolver: zodResolver(settingsSchema) });
  useEffect(() => {
    reset({
      business_name: settings.business_name,
      default_deposit_percent: String(settings.default_deposit_percent),
      low_stock_grams: String(settings.low_stock_grams),
      critical_stock_grams: String(settings.critical_stock_grams),
      reference_filament_kg_cost: String(settings.reference_filament_kg_cost),
      energy_kwh_cost:
        settings.energy_kwh_cost === null
          ? ""
          : String(settings.energy_kwh_cost),
      labor_hour_cost:
        settings.labor_hour_cost === null
          ? ""
          : String(settings.labor_hour_cost),
    });
  }, [settings, reset]);
  function confirm(values: SettingsForm) {
    setPending(values);
    dialog.current?.showModal();
  }
  async function save() {
    if (!pending || busy.current) return;
    busy.current = true;
    setSaving(true);
    setSuccess(false);
    setError(null);
    dialog.current?.close();
    const changes = toChanges(pending);
    const signature = JSON.stringify({ changes, version: settings.version });
    if (request.current?.signature !== signature)
      request.current = { signature, id: crypto.randomUUID() };
    try {
      const { error: writeError } = await database().rpc(
        "update_business_settings",
        {
          p_changes: changes,
          p_expected_version: settings.version,
          p_request_id: request.current.id,
        },
      );
      if (writeError) throw writeError;
      await reload();
      request.current = null;
      setSuccess(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const field = (
    name: keyof SettingsForm,
    label: string,
    hint?: string,
    money = false,
  ) => (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <div className={money ? "currency-input" : ""}>
        {money && <span>$</span>}
        <input
          id={name}
          inputMode={name === "business_name" ? "text" : "decimal"}
          {...register(name)}
          aria-invalid={!!errors[name]}
          aria-describedby={`${name}-hint ${errors[name] ? `${name}-error` : ""}`}
        />
      </div>
      <small id={`${name}-hint`}>{hint}</small>
      {errors[name] && (
        <span id={`${name}-error`} className="field-error">
          {errors[name]?.message}
        </span>
      )}
    </div>
  );
  return (
    <>
      <PageTitle
        eyebrow="A TU MEDIDA"
        title="Las bases de tu negocio."
        description="Ajusta los parámetros de KAPA 3D. Cada modificación queda en el historial."
      />
      <div className="settings-layout">
        <form
          className="settings-form"
          onSubmit={handleSubmit(confirm)}
          noValidate
        >
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Identidad del negocio</h2>
                <p>La información que identifica tu espacio de trabajo.</p>
              </div>
              <span className="section-number">01</span>
            </div>
            {field(
              "business_name",
              "Nombre del negocio",
              "Máximo 80 caracteres.",
            )}
            <div className="fixed-settings">
              <div>
                <Globe2 size={17} />
                <span>
                  Moneda <strong>COP · Peso colombiano</strong>
                </span>
              </div>
              <div>
                <span>
                  Zona horaria <strong>America/Bogota</strong>
                </span>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Pedidos e inventario</h2>
                <p>
                  Parámetros de reservas, anticipos y alertas de inventario.
                </p>
              </div>
              <span className="section-number">02</span>
            </div>
            <div className="form-grid">
              {field(
                "default_deposit_percent",
                "Anticipo predeterminado (%)",
                "Entre 0 y 100 %. Editable en cada pedido.",
              )}
              {field(
                "reference_filament_kg_cost",
                "Filamento de referencia / kg (COP)",
                "Es una referencia, no una compra ni existencias.",
                true,
              )}
              {field(
                "low_stock_grams",
                "Alerta de stock bajo (g)",
                "Amarillo: menos de este valor y por encima del crítico.",
              )}
              {field(
                "critical_stock_grams",
                "Alerta de stock crítico (g)",
                "Rojo: este valor o menos. Cero significa sin stock.",
              )}
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Referencias de costos</h2>
                <p>
                  Completa estos valores cuando conozcas los costos de tu
                  taller.
                </p>
              </div>
              <span className="section-number">03</span>
            </div>
            <div className="form-grid">
              {field(
                "energy_kwh_cost",
                "Tarifa de energía / kWh (COP)",
                "Opcional. Vacío significa sin configurar.",
                true,
              )}
              {field(
                "labor_hour_cost",
                "Mano de obra / hora (COP)",
                "Opcional. No es un pago automático.",
                true,
              )}
            </div>
            <p className="field-help">
              Usa punto para decimales, sin separadores de miles. Los importes
              se almacenan como valores decimales en PostgreSQL.
            </p>
          </section>
          {error && (
            <>
              <Notice>{error}</Notice>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  void reload().catch(() => {});
                }}
              >
                Recargar valores guardados
              </button>
            </>
          )}
          {success && (
            <Notice type="success">
              Configuración guardada y registrada en el historial.
            </Notice>
          )}
          <div className="save-bar">
            <span>Último cambio: {dateTime(settings.updated_at)}</span>
            <button className="button primary" disabled={!isDirty || saving}>
              <Save size={17} />
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
        <aside className="settings-aside">
          <div className="panel">
            <ShieldCheck size={28} />
            <h3>Cambios con trazabilidad.</h3>
            <p>
              Las actualizaciones se validan en la base de datos y se guardan
              junto a tu usuario y la fecha de la operación.
            </p>
            <Link to="/actividad" className="text-link">
              Consultar actividad <ArrowRight size={15} />
            </Link>
          </div>
          <div className="settings-tip">
            <strong>Una base, sin supuestos.</strong>
            <p>
              {settings.energy_kwh_cost === null ||
              settings.labor_hour_cost === null
                ? "Hay costos de energía o mano de obra sin configurar. Complétalos con información real antes de cotizar."
                : "Estas referencias calculan costos de cotización y producción. Configurarlas no registra gastos ni pagos automáticos."}
            </p>
          </div>
          <Link className="text-link" to="/actualizar-clave">
            Cambiar mi contraseña <ArrowRight size={15} />
          </Link>
        </aside>
      </div>
      <dialog ref={dialog} className="confirm-dialog">
        <div className="icon-tile">
          <Save size={22} />
        </div>
        <h2>¿Guardar estos cambios?</h2>
        <p>
          Se actualizarán los parámetros del negocio. El historial conservará
          los valores anteriores y nuevos.
        </p>
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => dialog.current?.close()}
          >
            Volver a revisar
          </button>
          <button
            type="button"
            className="button primary"
            onClick={() => {
              void save();
            }}
            disabled={saving}
          >
            Confirmar cambios
          </button>
        </div>
      </dialog>
    </>
  );
}
