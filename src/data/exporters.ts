import * as XLSX from "xlsx";
import type { DataRow, ParsedSample } from "../types";

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(columns: string[], rows: DataRow[]) {
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(","))].join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "smart-board-rpa-merged.csv");
}

export function downloadXlsx(columns: string[], rows: DataRow[], samples: ParsedSample[]) {
  const dataSheet = XLSX.utils.json_to_sheet(rows, { header: columns });
  const metadataKeys = Array.from(new Set(samples.flatMap((sample) => Object.keys(sample.metadata))));
  const metadataRows = samples.map((sample) => ({
    Sample: sample.label,
    "Source File": sample.sourceFileName,
    ...sample.metadata,
  }));
  const metadataSheet = XLSX.utils.json_to_sheet(metadataRows, {
    header: ["Sample", "Source File", ...metadataKeys],
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Merged Data");
  XLSX.utils.book_append_sheet(workbook, metadataSheet, "Metadata");
  XLSX.writeFile(workbook, "smart-board-rpa-merged.xlsx");
}
