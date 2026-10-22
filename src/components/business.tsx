import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Decimal from "decimal.js";
import { ArrowLeft, ArrowRight, Plus, Search, X } from "lucide-react";
import { ErrorState, Loading, Notice } from "./ui";
import {
  useOperation,
  type PageData,
  type Catalog,
  useBusiness,
} from "../lib/operations";
import type { Json } from "../lib/database.types";

export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "date"
    | "datetime-local"
    | "textarea"
    | "select"
    | "url"
    | "color";
  required?: boolean;
  min?: number;
  max?: number;
  hint?: string;
  options?: { value: string; label: string }[];
  default?: string;
};
export const methods = [
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
];
export const financingField: Field = {
  name: "financing",
  label: "Forma de compra",
  type: "select",
  default: "cash",
  required: true,
  options: [
    { value: "cash", label: "Contado" },
    { value: "supplier_credit", label: "Crédito con proveedor" },
    { value: "credit_card", label: "Tarjeta de crédito" },
  ],
  hint: "El crédito queda como deuda. Solo el pago con dinero propio sale de caja; escribe 0 si financias toda la compra.",
};
export const moneyFields: Field[] = [
  {
    name: "method",
    label: "Medio de pago",
    type: "select",
    options: methods,
    default: "transferencia",
    required: true,
  },
  { name: "date", label: "Fecha del movimiento", type: "date", required: true },
];
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => {
      d?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="business-modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Cerrar formulario"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function OperationForm({
  title,
  description,
  action,
  fields,
  initial = {},
  extra = {},
  checks = [],
  onClose,
  onSaved,
  label = "Guardar operación",
}: {
  title: string;
  description?: string;
  action: string;
  fields: Field[];
  initial?: Record<string, string>;
  extra?: Record<string, Json | undefined>;
  checks?: { name: string; label: string }[];
  onClose: () => void;
  onSaved?: (result: Json) => void;
  label?: string;
}) {
  const operation = useOperation();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const shape: Record<string, z.ZodString> = {};
  for (const f of fields) {
    let s = z.string().trim();
    if (f.required) s = s.min(1, "Completa este campo.");
    s = s.max(
      f.type === "textarea" ? 5000 : 500,
      "Este texto es demasiado largo.",
    );
    shape[f.name] = s;
  }
  const schema = z.object(shape).superRefine((values, ctx) => {
    for (const f of fields) {
      const s = values[f.name];
      if (!s) continue;
      if (f.type === "number") {
        try {
          const d = new Decimal(s);
          if (
            !d.isFinite() ||
            (f.min !== undefined && d.lt(f.min)) ||
            (f.max !== undefined && d.gt(f.max))
          )
            throw Error();
        } catch {
          ctx.addIssue({
            code: "custom",
            path: [f.name],
            message: "Revisa el valor numérico y sus límites.",
          });
        }
      }
      if (f.type === "url") {
        try {
          if (!["http:", "https:"].includes(new URL(s).protocol)) throw Error();
        } catch {
          ctx.addIssue({
            code: "custom",
            path: [f.name],
            message: "Usa una dirección https:// válida.",
          });
        }
      }
    }
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      fields.map((f) => [f.name, initial[f.name] ?? f.default ?? ""]),
    ),
  });
  const financing = watch("financing");
  const isPurchase = [
    "lot_purchase",
    "printer_save",
    "purchase_create",
    "purchase_reclassify",
  ].includes(action);
  const previousFinancing = useRef<string | undefined>(financing);
  useEffect(() => {
    if (
      isPurchase &&
      financing === "credit_card" &&
      previousFinancing.current !== "credit_card"
    )
      setValue("paid", "0");
    previousFinancing.current = financing;
  }, [financing, isPurchase, setValue]);
  async function submit(values: Record<string, string>) {
    const normalized = { ...values };
    for (const f of fields)
      if (f.type === "datetime-local" && normalized[f.name])
        normalized[f.name] += "-05:00";
    const result = await operation.run(action, {
      ...extra,
      ...normalized,
      ...checked,
    });
    if (result) {
      onSaved?.(result);
      onClose();
    }
  }
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!operation.busy) onClose();
      }}
    >
      <form onSubmit={handleSubmit(submit)} noValidate>
        {description && <p className="modal-description">{description}</p>}
        <div className="business-form-grid">
          {fields.map((f) => (
            <div
              className={f.type === "textarea" ? "field wide" : "field"}
              key={f.name}
            >
              <label htmlFor={"op-" + f.name}>
                {f.label}
                {f.required ? " *" : ""}
              </label>
              {f.type === "select" ? (
                <select id={"op-" + f.name} {...register(f.name)}>
                  <option value="">Seleccionar…</option>
                  {f.options?.map((o) => (
                    <option value={o.value} key={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea id={"op-" + f.name} rows={3} {...register(f.name)} />
              ) : (
                <input
                  id={"op-" + f.name}
                  type={f.type ?? "text"}
                  step={f.type === "number" ? "any" : undefined}
                  min={f.min}
                  max={f.max}
                  {...register(f.name)}
                  aria-invalid={!!errors[f.name]}
                />
              )}
              {f.hint && <small>{f.hint}</small>}
              {errors[f.name] && (
                <span className="field-error">
                  {String(errors[f.name]?.message)}
                </span>
              )}
            </div>
          ))}
        </div>
        {checks.map((c) => (
          <label className="check-field" key={c.name}>
            <input
              type="checkbox"
              checked={checked[c.name] ?? false}
              onChange={(e) =>
                setChecked((v) => ({ ...v, [c.name]: e.target.checked }))
              }
            />
            <span>{c.label}</span>
          </label>
        ))}
        {operation.error && <Notice>{operation.error}</Notice>}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={operation.busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="button primary" disabled={operation.busy}>
            {operation.busy ? "Guardando…" : label}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ReadState({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
  children: ReactNode;
}) {
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  return <>{children}</>;
}
export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="business-empty">
      <Plus size={28} />
      <h3>{text}</h3>
      <p>Los registros que agregues se guardarán en tu negocio.</p>
      {action}
    </div>
  );
}
export function Pagination({
  data,
  onPage,
}: {
  data: Pick<PageData<unknown>, "page" | "total">;
  onPage: (n: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {data.total} registros · Página {data.page + 1} de{" "}
        {Math.max(1, Math.ceil(data.total / 50))}
      </span>
      <div>
        <button
          className="button secondary"
          disabled={data.page === 0}
          aria-label="Página anterior"
          onClick={() => onPage(data.page - 1)}
        >
          <ArrowLeft size={16} />
        </button>
        <button
          className="button secondary"
          disabled={(data.page + 1) * 50 >= data.total}
          aria-label="Página siguiente"
          onClick={() => onPage(data.page + 1)}
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function Toolbar({
  search,
  onSearch,
  children,
}: {
  search: string;
  onSearch: (s: string) => void;
  children?: ReactNode;
}) {
  const [draft, setDraft] = useState(search);
  useEffect(() => setDraft(search), [search]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (draft !== search) onSearch(draft);
    }, 300);
    return () => clearTimeout(t);
  }, [draft, search, onSearch]);
  return (
    <div className="business-toolbar">
      <div className="search-field">
        <Search size={17} />
        <input
          type="search"
          aria-label="Buscar registros"
          placeholder="Buscar…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
      <div className="toolbar-actions">{children}</div>
    </div>
  );
}
export function DateRange({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (f: string, t: string) => void;
}) {
  return (
    <div className="date-range">
      <label>
        Desde
        <input
          type="date"
          aria-label="Desde"
          value={from}
          max={to}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value, to);
          }}
        />
      </label>
      <label>
        Hasta
        <input
          type="date"
          aria-label="Hasta"
          value={to}
          min={from}
          onChange={(e) => {
            if (e.target.value) onChange(from, e.target.value);
          }}
        />
      </label>
    </div>
  );
}
export function Stat({
  label,
  value,
  hint,
  tone = "",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <article className={"business-stat " + tone}>
      <small>{label}</small>
      <strong>{value}</strong>
      {hint && <p>{hint}</p>}
    </article>
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="business-tabs" role="tablist">
      {items.map((t) => (
        <button
          role="tab"
          aria-selected={value === t.id}
          className={value === t.id ? "active" : ""}
          key={t.id}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
export function useCatalog() {
  return useBusiness<Catalog>("catalog");
}
export function CatalogWarning({ catalog }: { catalog: Catalog | null }) {
  return catalog?.catalog_truncated ? (
    <Notice type="info">
      Hay más de 1.000 registros en el catálogo. Usa la búsqueda y las páginas
      del módulo para consultar los restantes; las opciones de formularios
      muestran los primeros 1.000.
    </Notice>
  ) : null;
}
export const optionList = (items: { id: string; name: string }[] | undefined) =>
  (items ?? []).map((x) => ({ value: x.id, label: x.name }));
