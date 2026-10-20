import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Plus } from "lucide-react";
import { PageTitle } from "../../components/ui";
import {
  Empty,
  OperationForm,
  Pagination,
  ReadState,
  Toolbar,
  type Field,
} from "../../components/business";
import {
  useBusiness,
  whatsappUrl,
  type Customer,
  type PageData,
} from "../../lib/operations";
import { money, dateTime } from "../../lib/format";
export const customerFields: Field[] = [
  { name: "name", label: "Nombre", required: true },
  { name: "phone", label: "Teléfono" },
  {
    name: "whatsapp",
    label: "WhatsApp",
    hint: "Número con indicativo; en Colombia puedes escribir 10 dígitos.",
  },
  { name: "city", label: "Ciudad" },
  { name: "address", label: "Dirección opcional" },
  { name: "notes", label: "Notas", type: "textarea" },
];
export function CustomersPage() {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [edit, setEdit] = useState<Customer | null | undefined>(undefined);
  const { data, error, loading, refresh } = useBusiness<PageData<Customer>>(
    "customers",
    { search, page },
  );
  return (
    <>
      <PageTitle
        eyebrow="CLIENTES"
        title="Cada cliente tiene una historia."
        description="Datos de contacto, compras, favoritos y saldos vinculados a los pedidos reales."
        action={
          <button className="button primary" onClick={() => setEdit(null)}>
            <Plus size={17} />
            Nuevo cliente
          </button>
        }
      />
      <Toolbar
        search={search}
        onSearch={(s) => {
          setSearch(s);
          setPage(0);
        }}
      />
      <ReadState loading={loading} error={error} retry={refresh}>
        {!data?.rows.length ? (
          <Empty text="Agrega tu primer cliente" />
        ) : (
          <div className="resource-grid">
            {data.rows.map((c) => {
              const wa = whatsappUrl(
                c.whatsapp || c.phone,
                "Hola " +
                  c.name +
                  ", te escribimos de KAPA 3D sobre tu pedido.",
              );
              return (
                <article className="panel resource-card" key={c.id}>
                  <div className="resource-top">
                    <span className="avatar">{c.name.slice(0, 1)}</span>
                    <span className="pill">{c.order_count} pedidos</span>
                  </div>
                  <h2>{c.name}</h2>
                  <p>
                    {[c.phone, c.city].filter(Boolean).join(" · ") ||
                      "Completa los datos de contacto"}
                  </p>
                  <dl className="resource-details">
                    <div>
                      <dt>Total comprado</dt>
                      <dd>{money(c.total_purchased)}</dd>
                    </div>
                    <div>
                      <dt>Pagos pendientes</dt>
                      <dd>{money(c.balance)}</dd>
                    </div>
                    <div>
                      <dt>Última compra</dt>
                      <dd>
                        {c.last_purchase
                          ? dateTime(c.last_purchase)
                          : "Sin entregas"}
                      </dd>
                    </div>
                  </dl>
                  {c.notes && <p>{c.notes}</p>}
                  <div className="card-actions">
                    <button
                      className="button secondary"
                      onClick={() => setEdit(c)}
                    >
                      Editar ficha
                    </button>
                    {wa && (
                      <a
                        href={wa}
                        className="button secondary"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle size={16} />
                        WhatsApp
                      </a>
                    )}
                    <Link className="text-link" to="/cotizaciones">
                      Cotizar
                    </Link>
                  </div>
                  <details>
                    <summary>Historial y productos frecuentes</summary>
                    {c.favorites.map((f) => (
                      <p key={f.description}>
                        {f.description} · {f.quantity} unidades
                      </p>
                    ))}
                    {c.orders.map((o) => (
                      <p key={o.id}>
                        <Link to={"/pedidos?pedido=" + o.id}>
                          K-{o.number} · {o.description}
                        </Link>
                        <br />
                        {money(o.price_total)} · Pendiente:{" "}
                        {money(o.price_total - o.paid)}
                      </p>
                    ))}
                  </details>
                </article>
              );
            })}
          </div>
        )}
        {data && <Pagination data={data} onPage={setPage} />}
      </ReadState>
      {edit !== undefined && (
        <OperationForm
          title={edit ? "Editar cliente" : "Nuevo cliente"}
          action="customer_save"
          fields={customerFields}
          initial={
            edit
              ? {
                  name: edit.name,
                  phone: edit.phone,
                  whatsapp: edit.whatsapp,
                  city: edit.city,
                  address: edit.address,
                  notes: edit.notes,
                }
              : {}
          }
          extra={edit ? { id: edit.id, version: edit.version } : {}}
          onClose={() => setEdit(undefined)}
        />
      )}
    </>
  );
}
