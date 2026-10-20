import {
  useBusiness,
  today,
  type PageData,
  type Summary,
} from "../../lib/operations";
import { money } from "../../lib/format";
import { Notice } from "../../components/ui";
import { Stat } from "../../components/business";

export function MonthlyBudget() {
  const month = today().slice(0, 7),
    from = month + "-01";
  const [year, m] = month.split("-").map(Number);
  const to = month + "-" + new Date(Date.UTC(year, m, 0)).getUTCDate();
  const { data, error } = useBusiness<PageData<never>>("cash", { from, to });
  const s: Summary | undefined = data?.summary;
  return (
    <section className="panel month-budget">
      <h2>
        Este mes ·{" "}
        {new Intl.DateTimeFormat("es-CO", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(from + "T12:00:00Z"))}
      </h2>
      {error && <Notice>{error}</Notice>}
      {s && (
        <>
          <div className="business-stats">
            <Stat
              label="Ganancia antes de intereses"
              value={money(s.profit_before_interest)}
              hint="Utilidad realizada con costos de producción y gastos incluidos."
            />
            <Stat
              label="Cuotas pagadas este mes"
              value={money(s.installments_paid)}
              hint="Capital e intereses efectivamente pagados."
            />
            <Stat
              label="Cuotas del mes aún pendientes"
              value={money(s.installments_pending)}
              hint="Impresoras, filamento, tarjeta y demás créditos."
            />
            <Stat
              label="Resta después de cuotas"
              value={money(s.after_installments)}
              hint="Utilidad neta menos capital pagado y cuotas del mes todavía pendientes."
            />
          </div>
          <p>
            Las cuotas incluyen capital e intereses. El interés ya pagado se
            descuenta una sola vez. «Resta después de cuotas» es un presupuesto
            de disponibilidad; la caja actual y la utilidad contable se muestran
            por separado.
          </p>
        </>
      )}
    </section>
  );
}
