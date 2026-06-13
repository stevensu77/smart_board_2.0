import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { mergeSamples, normalizeHeader, parseRpaFile, sampleLabelForIndex } from "./rpaParser";

function fileLike(name: string, bytes: ArrayBuffer): File {
  return {
    name,
    arrayBuffer: async () => bytes,
  } as File;
}

function workbookFile(name: string, rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Result");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return fileLike(name, bytes);
}

describe("RPA parser", () => {
  it("extracts A1:B13 metadata and row 15 headers from the provided Table A sample", async () => {
    const bytes = await readFile(resolve(process.cwd(), "row data table/raw_input_tableA.xlsx"));
    const sample = await parseRpaFile(fileLike("raw_input_tableA.xlsx", bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)), 0);

    expect(sample.label).toBe("Sample A");
    expect(sample.metadata).toMatchObject({
      Compound: "Filler Floculation",
      "SR Number": "Auto Test",
      Batch: "1234",
      Operator: "ABC",
      Date: "02/16/2019 03:11",
      "Program name": "Flocculation_Strain Sweep_100C",
      Instrument: "RPA1",
      "Program file": "ABCDEFG",
    });
    expect(sample.headers).toContain("T-SUM[Sec]");
    expect(sample.headers).toContain("Pcount");
    expect(sample.headers).toContain("Set-Strain[Degree]");
    expect(sample.headers).toContain("Shear rate[sec-1]");
    expect(sample.headers).not.toContain("Column 33");
    expect(sample.rows).toHaveLength(15);
    expect(sample.rows[0].Pcount).toBe("1");
    expect(sample.rows[8].Pcount).toBe("2");
    expect(sample.rows[0]["Column 33"]).toBeUndefined();
  });

  it("normalizes headers and merges multiple files by sample label", async () => {
    const baseRows = [
      ["Compound", "Compound A"],
      ["SR Number", "Auto Test"],
      ["Batch", "1234"],
      ["Operator", "ABC"],
      ["Date", "02/16/2019 03:11"],
      [],
      [],
      [],
      [],
      ["Program name", "Flocculation"],
      ["Instrument", "RPA1"],
      ["Remark", ""],
      ["Program file", "ABCDEFG"],
      [],
      ["P-COUNT", "Set-Strain[Degree ]", "G''[kPa]", "Speed[LBin/Min]", "Shear rate[sec-1]", null, null],
      [1, 0.5, 103.1, 0.12, 0.091, "ignored", "ignored"],
    ];

    const sampleA = await parseRpaFile(workbookFile("table-a.xlsx", baseRows), 0);
    const sampleB = await parseRpaFile(workbookFile("table-b.xlsx", baseRows), 1);
    const merged = mergeSamples([sampleA, sampleB]);

    expect(sampleLabelForIndex(0)).toBe("Sample A");
    expect(sampleLabelForIndex(27)).toBe("Sample AB");
    expect(normalizeHeader("Set-Strain[Degree ]", 0)).toBe("Set-Strain[Degree]");
    expect(normalizeHeader("Speed[LBin/Min]", 0)).toBe("Speed[LB/min]");
    expect(normalizeHeader("P-COUNT", 0)).toBe("Pcount");
    expect(merged.columns.slice(0, 3)).toEqual(["Sample", "Source File", "Metadata Summary"]);
    expect(merged.columns).toContain("Pcount");
    expect(merged.columns).toContain("Set-Strain[Degree]");
    expect(merged.columns).toContain("Speed[LB/min]");
    expect(merged.columns).not.toContain("Column 6");
    expect(merged.rows).toHaveLength(2);
    expect(merged.rows[0].Sample).toBe("Sample A");
    expect(merged.rows[1].Sample).toBe("Sample B");
    expect(merged.rows[0]["Metadata Summary"]).toContain("Compound: Compound A");
  });
});
