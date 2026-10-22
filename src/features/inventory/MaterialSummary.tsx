import { useEffect, useState } from "react";
import { useBusiness, type PageData } from "../../lib/operations";
import { ReadState, Pagination, Empty } from "../../components/business";
import { money } from "../../lib/format";
type MaterialStock = {
  id: string;
  brand: string;
  kind: string;
  color: string;
  color_hex: string | null;
  rolls: number;
  grams: number;
  reserved_grams: number;
  available_grams: number;
  initial_grams: number;
  value: number;
};
export function MaterialSummary({
  search,
  onLots,
}: {
  search: string;
  onLots: (search: string) => void;
}) {
  const [page, setPage] = useState(0);
  const { data, error, loading, refresh } = useBusiness<
    PageData<MaterialStock> & {
      stock_totals: {
        rolls: number;
        colors: number;
        grams: number;
        available: number;
      };
    }
  >("material_summary", { search, page });
  useEffect(() => setPage(0), [search]);
  return (
    <ReadState loading={loading} error={error} retry={refresh}>
      {data?.stock_totals && (
        <div className="business-stats">
          <div className="business-stat">
            <small>Rollos activos</small>
            <strong>{data.stock_totals.rolls}</strong>
          </div>
          <div className="business-stat">
            <small>Colores</small>
            <strong>{data.stock_totals.colors}</strong>
          </div>
          <div className="business-stat">
            <small>Filamento físico</small>
            <strong>
              {Number(data.stock_totals.grams).toLocaleString("es-CO")} g
            </strong>
          </div>
          <div className="business-stat">
            <small>Disponible para imprimir</small>
            <strong>
              {Number(data.stock_totals.available).toLocaleString("es-CO")} g
            </strong>
          </div>
        </div>
      )}
      {!data?.rows.length ? (
        <Empty text="Tus colores y existencias aparecerán aquí" />
      ) : (
        <div className="material-summary-grid">
          {data.rows.map((m) => (
            <article className="panel material-summary-card" key={m.id}>
              <div
                className="material-swatch"
                style={{ backgroundColor: m.color_hex ?? "#d7cfca" }}
                aria-label={"Color " + m.color}
              />
              <div>
                <span className="eyebrow">
                  {m.kind} · {m.brand}
                </span>
                <h2>{m.color}</h2>
                <strong>
                  {Number(m.available_grams).toLocaleString("es-CO")} g
                  disponibles
                </strong>
                <p>
                  {m.rolls} rollos · {Number(m.grams).toLocaleString("es-CO")} g
                  físicos · {Number(m.reserved_grams).toLocaleString("es-CO")} g
                  reservados
                </p>
                <progress
                  aria-label={"Filamento restante " + m.color}
                  max={Math.max(m.initial_grams, m.grams, 1)}
                  value={m.grams}
                />
                <p>Valor del material físico: {money(m.value)}</p>
                <button
                  className="text-button"
                  onClick={() => onLots([m.brand, m.kind, m.color].join(" "))}
                >
                  Ver y editar rollos
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {data && <Pagination data={data} onPage={setPage} />}
    </ReadState>
  );
}
