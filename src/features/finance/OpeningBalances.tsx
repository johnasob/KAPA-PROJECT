import { useState } from "react";
import { useBusiness, type Row } from "../../lib/operations";
import { OperationForm, ReadState } from "../../components/business";
import { money } from "../../lib/format";
export function OpeningBalances() {
  const { data, loading, error, refresh } =
    useBusiness<Row<"opening_balances">>("opening");
  const [editing, setEditing] = useState(false);
  return (
    <section className="panel month-budget">
      <h2>Saldos iniciales</h2>
      <ReadState loading={loading} error={error} retry={refresh}>
        {data && (
          <>
            <p>
              Ingresos previos: {money(data.income)} · Gastos previos:{" "}
              {money(data.expense)} · Caja inicial: {money(data.cash_amount)} ·
              Desde {data.effective_on}
            </p>
            <button
              className="button secondary"
              onClick={() => setEditing(true)}
            >
              Modificar saldos iniciales
            </button>
          </>
        )}
      </ReadState>
      {editing && data && (
        <OperationForm
          title="Modificar saldos iniciales"
          action="opening_save"
          extra={{ version: data.version }}
          description="Ingresa los acumulados anteriores al uso de KAPA. No incluyas operaciones que ya registraste. La caja inicial puede diferir de ingresos menos gastos si había préstamos, aportes o retiros. Las correcciones quedan en el historial."
          fields={[
            {
              name: "income",
              label: "Ingresos iniciales (COP)",
              type: "number",
              min: 0,
              required: true,
              default: String(data.income),
            },
            {
              name: "expense",
              label: "Gastos iniciales (COP)",
              type: "number",
              min: 0,
              required: true,
              default: String(data.expense),
            },
            {
              name: "cash_amount",
              label: "Dinero en caja al comenzar (COP)",
              type: "number",
              required: true,
              default: String(data.cash_amount),
            },
            {
              name: "effective_on",
              label: "Fecha de inicio de estos saldos",
              type: "date",
              required: true,
              default: data.effective_on,
            },
            {
              name: "notes",
              label: "Origen o motivo de corrección",
              type: "textarea",
              required: true,
              default: data.notes,
            },
          ]}
          onClose={() => setEditing(false)}
        />
      )}{" "}
    </section>
  );
}
