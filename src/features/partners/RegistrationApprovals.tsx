import { useCallback, useEffect, useRef, useState } from "react";
import { UserRoundPlus, RefreshCw } from "lucide-react";
import { Notice, Loading } from "../../components/ui";
import { database } from "../../lib/supabase";
import { errorMessage, dateTime } from "../../lib/format";
import { useWorkspace } from "../../lib/WorkspaceProvider";
import type { Database } from "../../lib/database.types";

type Request =
  Database["public"]["Functions"]["get_pending_registrations"]["Returns"][number];
const pageSize = 20;

export function RegistrationApprovals() {
  const { partners, members, reload } = useWorkspace();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<{
    request: Request;
    code: string;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const saving = useRef(false);
  const available = partners.filter(
    (partner) => !members.some((member) => member.partner_id === partner.id),
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: readError } = await database().rpc(
        "get_pending_registrations",
        { p_limit: pageSize + 1, p_offset: page * pageSize },
      );
      if (readError) throw readError;
      setRequests(data.slice(0, pageSize));
      setHasNext(data.length > pageSize);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    void load();
  }, [load]);
  async function approve() {
    if (!chosen || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    dialog.current?.close();
    try {
      const { error: writeError } = await database().rpc(
        "approve_registration",
        { p_user_id: chosen.request.user_id, p_partner_code: chosen.code },
      );
      if (writeError) throw writeError;
      await reload();
      await load();
      setMessage(
        `Acceso habilitado para ${chosen.request.display_name}. Ya puede entrar con su correo y contraseña.`,
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="panel registration-approvals">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CUENTAS DEL EQUIPO</span>
          <h2>Solicitudes de acceso</h2>
          <p>Revisa el correo y habilita a cada persona como John o Sebas.</p>
        </div>
        <button
          className="button secondary"
          disabled={loading || busy}
          onClick={() => {
            void load();
          }}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>
      {error && <Notice>{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}
      {loading ? (
        <Loading label="Consultando solicitudes…" />
      ) : requests.length === 0 ? (
        <p>No hay cuentas pendientes por habilitar.</p>
      ) : (
        <>
          {!available.length && (
            <Notice type="info">
              John y Sebas ya tienen una cuenta vinculada. No se reemplazará
              ninguna cuenta existente.
            </Notice>
          )}
          <div className="registration-list">
            {requests.map((request) => (
              <article className="registration-row" key={request.user_id}>
                <div>
                  <h3>{request.display_name}</h3>
                  <p>{request.email}</p>
                  <small>
                    Registro: {dateTime(request.created_at)} ·{" "}
                    {request.email_confirmed
                      ? "Correo confirmado"
                      : "Pendiente de confirmar correo"}
                  </small>
                </div>
                <div className="registration-actions">
                  <label
                    className="visually-hidden"
                    htmlFor={`partner-${request.user_id}`}
                  >
                    Socio para {request.display_name}
                  </label>
                  <select
                    id={`partner-${request.user_id}`}
                    value={
                      selection[request.user_id] ?? available[0]?.code ?? ""
                    }
                    disabled={busy || !available.length}
                    onChange={(event) =>
                      setSelection((current) => ({
                        ...current,
                        [request.user_id]: event.target.value,
                      }))
                    }
                  >
                    {!available.length && (
                      <option value="">Sin cupos disponibles</option>
                    )}
                    {available.map((partner) => (
                      <option value={partner.code} key={partner.id}>
                        {partner.display_name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="button primary"
                    disabled={
                      busy || !request.email_confirmed || !available.length
                    }
                    onClick={() => {
                      setChosen({
                        request,
                        code: selection[request.user_id] ?? available[0].code,
                      });
                      dialog.current?.showModal();
                    }}
                  >
                    <UserRoundPlus size={16} />
                    Habilitar acceso
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {(page > 0 || hasNext) && (
        <div className="pagination">
          <span>Página {page + 1}</span>
          <div>
            <button
              className="button secondary"
              disabled={page === 0 || loading || busy}
              onClick={() => setPage((v) => v - 1)}
            >
              Anterior
            </button>
            <button
              className="button secondary"
              disabled={!hasNext || loading || busy}
              onClick={() => setPage((v) => v + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
      <dialog ref={dialog} className="confirm-dialog">
        <div className="icon-tile">
          <UserRoundPlus size={22} />
        </div>
        <h2>¿Habilitar esta cuenta?</h2>
        <p>
          {chosen?.request.display_name} · {chosen?.request.email}
        </p>
        <p>
          Se vinculará a{" "}
          {
            partners.find((partner) => partner.code === chosen?.code)
              ?.display_name
          }{" "}
          y tendrá acceso de administrador al negocio. Verifica que el correo
          pertenezca al socio.
        </p>
        <div className="dialog-actions">
          <button
            className="button secondary"
            onClick={() => dialog.current?.close()}
          >
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => {
              void approve();
            }}
          >
            Confirmar acceso
          </button>
        </div>
      </dialog>
    </section>
  );
}
