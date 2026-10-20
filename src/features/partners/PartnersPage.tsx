import { ShieldCheck, UserRound, Users } from "lucide-react";
import { PageTitle } from "../../components/ui";
import { useWorkspace } from "../../lib/WorkspaceProvider";

export function PartnersPage() {
  const { partners, members } = useWorkspace();
  return (
    <>
      <PageTitle
        eyebrow="PERSONAS"
        title="Dos socios. Una visión."
        description="John y Sebas comparten la administración de KAPA 3D en partes iguales."
      />
      <div className="partner-grid">
        {partners.map((partner, i) => {
          const member = members.find((m) => m.partner_id === partner.id);
          return (
            <article className="panel partner-card" key={partner.id}>
              <div className="partner-head">
                <span className={`large-avatar ${i ? "lavender" : ""}`}>
                  {partner.display_name[0]}
                </span>
                <span className={`pill ${member?.active ? "success" : ""}`}>
                  {member?.active ? "Acceso habilitado" : "Sin acceso asignado"}
                </span>
              </div>
              <h2>{partner.display_name}</h2>
              <p>Socio · Administrador</p>
              <div className="share">
                <strong>
                  {partner.share_basis_points / 100}
                  <small>%</small>
                </strong>
                <span>
                  Participación
                  <br />
                  en el negocio
                </span>
              </div>
              <div className="share-bar">
                <span
                  style={{ width: `${partner.share_basis_points / 100}%` }}
                />
              </div>
              <div className="partner-detail">
                <ShieldCheck size={17} />
                <span>Permisos completos para los módulos disponibles</span>
              </div>
              <div className="partner-detail">
                <UserRound size={17} />
                <span>
                  {member?.active
                    ? `Cuenta vinculada a ${member.display_name}`
                    : "Vinculación pendiente desde Supabase"}
                </span>
              </div>
            </article>
          );
        })}
      </div>
      <section className="panel note-panel">
        <Users size={24} />
        <div>
          <h2>Participación y dinero son cosas distintas.</h2>
          <p>
            El 50 % representa la participación de cada socio. Aportes,
            adelantos, retiros y liquidaciones se incorporarán en la fase
            financiera, con sus propios movimientos e historial. Aquí no se
            presumen saldos ni ganancias.
          </p>
        </div>
      </section>
    </>
  );
}
