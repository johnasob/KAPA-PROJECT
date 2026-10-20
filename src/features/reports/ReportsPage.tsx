import { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { PageTitle, Notice } from "../../components/ui";
import {
  DateRange,
  Empty,
  Pagination,
  ReadState,
  Stat,
} from "../../components/business";
import {
  categoryNames,
  statusNames,
  today,
  yearStart,
  downloadCsv,
  type PageData,
  type Summary,
} from "../../lib/operations";
import { database } from "../../lib/supabase";
import { errorMessage, money } from "../../lib/format";
type ReportRow = Record<string, string | number | null>;
type Report = PageData<ReportRow> & { summary: Summary; generated_at: string };
const kinds = [
  { id: "sales", label: "Ventas por periodo" },
  { id: "profitability", label: "Rentabilidad por pedido" },
  { id: "costs", label: "Costos por producto cotizado" },
  { id: "consumption", label: "Movimientos y consumo de material" },
  { id: "inventory", label: "Inventario valorizado actual" },
  { id: "expenses", label: "Gastos por categoría" },
  { id: "debts", label: "Deudas pendientes actuales" },
  { id: "cash", label: "Movimientos de caja" },
  { id: "partners", label: "Balance actual de socios" },
  { id: "products", label: "Productos más rentables" },
  { id: "customers", label: "Clientes frecuentes" },
];
const headers: Record<string, string> = {
  codigo: "Pedido",
  cliente: "Cliente",
  producto: "Producto",
  estado: "Estado",
  creado: "Creado",
  entregado: "Entregado",
  venta: "Venta COP",
  cobrado: "Cobrado COP",
  pendiente: "Pendiente COP",
  costo_estimado: "Costo estimado COP",
  costo_real: "Costo real COP",
  ganancia_real: "Ganancia COP",
  utilidad_realizada: "Utilidad realizada",
  cotizacion: "Cotización",
  cantidad: "Cantidad",
  horas_unidad: "Horas / unidad",
  costo_unidad: "Costo / unidad COP",
  precio_unidad: "Precio / unidad COP",
  costo_total: "Costo total COP",
  precio_total: "Precio total COP",
  ganancia_estimada: "Ganancia estimada COP",
  marca: "Marca",
  material: "Material",
  color: "Color",
  fecha_compra: "Fecha compra",
  gramos_iniciales: "Gramos iniciales",
  gramos_fisicos: "Gramos físicos",
  gramos_reservados: "Gramos reservados",
  gramos_disponibles: "Gramos libres",
  costo_gramo: "Costo / gramo COP",
  valor_disponible: "Valor disponible COP",
  fecha: "Fecha",
  movimiento: "Movimiento",
  cambio_fisico: "Cambio físico (g)",
  cambio_reserva: "Cambio reserva (g)",
  costo_merma: "Costo merma COP",
  motivo: "Motivo",
  pedido: "Pedido",
  responsable: "Responsable",
  categoria: "Categoría",
  descripcion: "Descripción",
  valor: "Valor COP",
  medio_pago: "Medio de pago",
  efecto_utilidad: "Efecto en utilidad COP",
  autorizacion: "Autorización",
  gasto: "Gasto COP",
  concepto: "Concepto",
  proveedor: "Proveedor",
  capital_inicial: "Capital inicial COP",
  capital_pendiente: "Capital pendiente COP",
  cuota_referencia: "Cuota referencia COP",
  cuotas: "Cuotas",
  cuotas_pagadas: "Cuotas pagadas",
  proximo_vencimiento: "Próximo vencimiento",
  socio: "Socio",
  participacion_porcentaje: "Participación %",
  saldo_asignado: "Saldo asignado COP",
  adelantos_por_compensar: "Adelantos pendientes COP",
  utilidades_asignadas: "Utilidades asignadas COP",
  adelantos: "Adelantos COP",
  retiros: "Retiros COP",
  unidades: "Unidades",
  ventas: "Ventas COP",
  ganancia: "Ganancia COP",
  telefono: "Teléfono",
  ciudad: "Ciudad",
  pedidos: "Pedidos",
  total_comprado: "Total comprado COP",
  saldo_pendiente: "Saldo pendiente COP",
  ultima_compra: "Última compra",
};
const display = (key: string, value: string | number | null) =>
  value === null
    ? "—"
    : key === "estado"
      ? (statusNames[String(value)] ?? String(value))
      : key === "categoria"
        ? (categoryNames[String(value)] ?? String(value))
        : typeof value === "number"
          ? Number(value).toLocaleString("es-CO", { maximumFractionDigits: 6 })
          : String(value);
async function getReport(
  kind: string,
  from: string,
  to: string,
  page: number,
): Promise<Report> {
  const { data, error } = await database().rpc("business_report", {
    p_kind: kind,
    p_from: from,
    p_to: to,
    p_page: page,
  });
  if (error) throw error;
  return data as unknown as Report;
}
function reportKeys(row: ReportRow = {}) {
  return [
    ...Object.keys(headers).filter((k) => k in row),
    ...Object.keys(row).filter((k) => !(k in headers)),
  ];
}
function ReportTable({ rows }: { rows: ReportRow[] }) {
  const keys = reportKeys(rows[0]);
  return (
    <table>
      <thead>
        <tr>
          {keys.map((k) => (
            <th key={k}>{headers[k] ?? k}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {keys.map((k) => (
              <td key={k}>{display(k, row[k])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export function ReportsPage() {
  const [kind, setKind] = useState("sales"),
    [from, setFrom] = useState(yearStart()),
    [to, setTo] = useState(today()),
    [page, setPage] = useState(0),
    [data, setData] = useState<Report | null>(null),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [exporting, setExporting] = useState(false),
    [printData, setPrintData] = useState<Report | null>(null);
  const title = kinds.find((k) => k.id === kind)?.label ?? "Reporte";
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void getReport(kind, from, to, page)
      .then((v) => {
        if (alive) setData(v);
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [kind, from, to, page, revision]);
  async function exportReport(pdf: boolean) {
    if (exporting) return;
    setExporting(true);
    setError(null);
    try {
      const all = await getReport(kind, from, to, -1);
      if (pdf) {
        setPrintData(all);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => window.print()),
        );
      } else {
        const keys = reportKeys(all.rows[0]);
        downloadCsv(
          "KAPA-" + kind + "-" + from + "-" + to,
          keys.map((k) => headers[k] ?? k),
          all.rows.map((r) =>
            keys.map((k) =>
              typeof r[k] === "number"
                ? r[k]
                : r[k] === null
                  ? null
                  : display(k, r[k]),
            ),
          ),
        );
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <div className="screen-report">
        <PageTitle
          eyebrow="REPORTES"
          title="Todo a la vista."
          description="Información verificable, filtros por periodo y exportación de todos los registros del reporte."
        />
        <div className="report-controls">
          <label className="field">
            Reporte
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(0);
              }}
            >
              {kinds.map((k) => (
                <option value={k.id} key={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <DateRange
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
              setPage(0);
            }}
          />
          <button
            className="button secondary"
            disabled={exporting || !data?.rows.length}
            onClick={() => {
              void exportReport(false);
            }}
          >
            <Download size={16} />
            {exporting ? "Preparando…" : "Exportar CSV"}
          </button>
          <button
            className="button secondary"
            disabled={exporting || !data?.rows.length}
            onClick={() => {
              void exportReport(true);
            }}
          >
            <Printer size={16} />
            Imprimir / PDF
          </button>
        </div>
        <Notice type="info">
          Ventas, rentabilidad y clientes se filtran por creación del pedido;
          productos rentables, por entrega. Inventario, deudas y socios muestran
          saldos actuales. La utilidad realizada exige entrega y cobro completo.
          PDF abre el diálogo del navegador: selecciona «Guardar como PDF».
        </Notice>
        <ReadState
          loading={loading}
          error={error}
          retry={() => setRevision((v) => v + 1)}
        >
          {data && (
            <>
              <div className="business-stats">
                <Stat
                  label="Utilidad neta realizada · periodo"
                  value={money(data.summary.realized_profit)}
                />
                <Stat
                  label="Ventas cobradas · periodo"
                  value={money(data.summary.sales_collected)}
                />
                <Stat
                  label="Gastos operativos · periodo"
                  value={money(data.summary.operating_expenses)}
                />
              </div>
              <section className="panel">
                <h2>{title}</h2>
                {data.rows.length ? (
                  <div className="table-wrap">
                    <ReportTable rows={data.rows} />
                  </div>
                ) : (
                  <Empty text="Sin registros para estos filtros" />
                )}
                <Pagination data={data} onPage={setPage} />
              </section>
            </>
          )}
        </ReadState>
      </div>
      {printData && (
        <section className="print-report">
          <h1>KAPA 3D · {title}</h1>
          <p>
            {from} a {to} · Generado:{" "}
            {new Date(printData.generated_at).toLocaleString("es-CO")}
          </p>
          <p>
            Utilidad neta realizada: {money(printData.summary.realized_profit)}{" "}
            · Ventas cobradas: {money(printData.summary.sales_collected)} ·
            Gastos operativos: {money(printData.summary.operating_expenses)}
          </p>
          <ReportTable rows={printData.rows} />
        </section>
      )}
    </>
  );
}
