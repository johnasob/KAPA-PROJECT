// @vitest-environment node
import { describe, it, expect } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { buildExcel } from "./excel";
describe("exportación Excel", () => {
  it("genera un XLSX válido con números y textos seguros, sin fórmulas ejecutables", async () => {
    const bytes = await buildExcel(
      "Reporte KAPA",
      ["Cliente", "Valor"],
      [
        ['=HYPERLINK("https://ejemplo.test")', 1234.56],
        ["Ñandú <crema> & vino", -200],
        ["@SUM(A1:A2)", null],
      ],
    );
    expect(Array.from(bytes.slice(0, 2))).toEqual([80, 75]);
    const zip = unzipSync(bytes);
    expect(zip["[Content_Types].xml"]).toBeDefined();
    const sheet = strFromU8(zip["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain("1234.56");
    expect(sheet).toContain("-200");
    expect(sheet).not.toMatch(/<f[ >]/);
    const text = Object.entries(zip)
      .filter(([name]) => name.endsWith(".xml"))
      .map(([, value]) => strFromU8(value))
      .join("");
    expect(text).toContain("HYPERLINK");
    expect(text).toContain("Ñandú");
    expect(text).toContain("&lt;crema&gt;");
  });
});
