import { useBusiness, type Row, type Debt } from "../../lib/operations";
import {
  Modal,
  ReadState,
  OperationForm,
  financingField,
  type Field,
} from "../../components/business";
type PurchaseDetail = Row<"purchases"> & { debt: Debt | null };
export function PurchaseEditor({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, error, loading, refresh } = useBusiness<PurchaseDetail>(
    "purchase_detail",
    { id },
  );
  if (!data)
    return (
      <Modal title="Cargar compra" onClose={onClose}>
        <ReadState loading={loading} error={error} retry={refresh}>
          {null}
        </ReadState>
      </Modal>
    );
  const d = data.debt,
    pending =
      d?.installments.filter(
        (i) =>
          i.principal_paid < i.principal_due ||
          i.interest_paid < i.interest_due,
      ) ?? [],
    first = pending[0];
  return (
    <OperationForm
      title="Corregir compra y financiación"
      action="purchase_reclassify"
      extra={{ purchase_id: id, version: data.version }}
      description="Corrige cómo se pagó la compra. El pago inicial es solo el dinero propio que salió de caja al comprar, sin sumar cuotas posteriores. Cambiar a tarjeta compensa el cargo de caja equivocado; conserva los abonos reales y reemplaza únicamente el plan de cuotas pendientes. No cambia el costo ni los gramos del rollo."
      fields={
        [
          {
            name: "description",
            label: "Concepto",
            required: true,
            default: data.description,
          },
          financingField,
          {
            name: "paid",
            label: "Pago inicial con dinero propio (COP)",
            type: "number",
            min: 0,
            max: data.total,
            required: true,
            default: String(data.paid_initial),
          },
          {
            name: "installments",
            label: "Cuotas pendientes del nuevo plan",
            type: "number",
            min: 1,
            max: 600,
            required: true,
            default: String(Math.max(1, pending.length)),
          },
          {
            name: "next_due",
            label: "Primer vencimiento del nuevo plan",
            type: "date",
            default: first?.due_on ?? d?.next_due ?? "",
          },
          {
            name: "installment_interest",
            label: "Interés por cuota pendiente (COP)",
            type: "number",
            min: 0,
            default: String(first?.interest_due ?? 0),
          },
          {
            name: "reason",
            label: "Motivo de la corrección",
            type: "textarea",
            required: true,
          },
        ].map((f) =>
          f.name === "financing" ? { ...f, default: data.financing } : f,
        ) as Field[]
      }
      onClose={onClose}
    />
  );
}
export function DebtEditor({
  debt,
  onClose,
}: {
  debt: Debt;
  onClose: () => void;
}) {
  const pending = debt.installments.filter(
      (i) =>
        i.principal_paid < i.principal_due || i.interest_paid < i.interest_due,
    ),
    first = pending[0];
  return (
    <OperationForm
      title="Editar deuda y cuotas pendientes"
      action="debt_edit"
      extra={{ debt_id: debt.id, version: debt.version }}
      description="Los pagos ya realizados se conservan. El capital total incluye lo abonado y no registra dinero nuevo en caja. El nuevo plan reemplaza las cuotas pendientes; el plan anterior queda en el historial."
      fields={[
        {
          name: "description",
          label: "Concepto de la deuda",
          required: true,
          default: debt.description,
        },
        {
          name: "principal",
          label: "Capital total pactado (incluye abonos) · COP",
          type: "number",
          min: 0.01,
          required: true,
          default: String(debt.principal),
        },
        {
          name: "financing",
          label: "Tipo de financiación",
          type: "select",
          required: true,
          default: debt.financing,
          options: [
            { value: "loan", label: "Préstamo" },
            { value: "credit_card", label: "Tarjeta de crédito" },
            { value: "supplier_credit", label: "Crédito con proveedor" },
          ],
        },
        {
          name: "installments",
          label: "Cuotas pendientes del nuevo plan",
          type: "number",
          min: 1,
          max: 600,
          required: true,
          default: String(Math.max(1, pending.length)),
        },
        {
          name: "next_due",
          label: "Primer vencimiento del nuevo plan",
          type: "date",
          required: true,
          default: first?.due_on ?? debt.next_due,
        },
        {
          name: "installment_interest",
          label: "Interés por cuota pendiente (COP)",
          type: "number",
          min: 0,
          default: String(first?.interest_due ?? 0),
        },
        {
          name: "reason",
          label: "Motivo de la corrección",
          type: "textarea",
          required: true,
        },
      ]}
      onClose={onClose}
    />
  );
}
