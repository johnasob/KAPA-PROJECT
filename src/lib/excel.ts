import type { SheetData } from "write-excel-file/universal";

// Explicit text cells keep names beginning with =, +, - or @ as literal text.
export async function buildExcel(
  _title: string,
  headers: string[],
  rows: (string | number | null)[][],
) {
  const { default: writeExcelFile } =
    await import("write-excel-file/universal");
  const data: SheetData = [
    headers.map((value) => ({
      type: String,
      value,
      fontWeight: "bold",
      color: "#FFF9EB",
      backgroundColor: "#701B34",
    })),
    ...rows.map((row) =>
      row.map((value) =>
        value === null
          ? null
          : typeof value === "number"
            ? { type: Number, value, format: "#,##0.00" }
            : { type: String, value },
      ),
    ),
  ];
  const blob = await writeExcelFile(data, {
    sheet: "KAPA 3D",
    columns: headers.map((h) => ({
      width: Math.min(50, Math.max(16, h.length + 3)),
    })),
    stickyRowsCount: 1,
  }).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}
export async function downloadExcel(
  name: string,
  headers: string[],
  rows: (string | number | null)[][],
) {
  const bytes = await buildExcel(name, headers, rows);
  const url = URL.createObjectURL(
    new Blob([bytes.buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name + ".xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
