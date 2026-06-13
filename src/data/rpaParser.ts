import * as XLSX from "xlsx";
import type { DataRow, Metadata, ParsedSample } from "../types";

const META_START_ROW = 0;
const META_END_ROW = 12;
const HEADER_ROW = 14;
const FIRST_DATA_ROW = 15;

const LEADING_COLUMNS = ["Sample", "Source File", "Metadata Summary"] as const;

const HEADER_ALIASES: Record<string, string> = {
  "p-count": "Pcount",
  pcount: "Pcount",
  "p count": "Pcount",
  "set-strain[degree]": "Set-Strain[Degree]",
  "set-strain[degree ]": "Set-Strain[Degree]",
  "speed[lbin/min]": "Speed[LB/min]",
  "speed[lb/min]": "Speed[LB/min]",
  "up-module[%]": "Module[%]",
};

export const SYSTEM_COLUMNS: string[] = [...LEADING_COLUMNS];

export function sampleLabelForIndex(index: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let value = index;
  let label = "";

  do {
    label = alphabet[value % 26] + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);

  return `Sample ${label}`;
}

export function normalizeHeader(rawHeader: unknown, fallbackIndex: number) {
  const base =
    rawHeader === null || rawHeader === undefined || String(rawHeader).trim() === ""
      ? `Column ${fallbackIndex + 1}`
      : String(rawHeader).replace(/\s+/g, " ").trim();
  const lowerKey = base.toLowerCase();
  const compactKey = lowerKey.replace(/\s+/g, "");
  return HEADER_ALIASES[lowerKey] ?? HEADER_ALIASES[compactKey] ?? base;
}

export function buildMetadataSummary(metadata: Metadata) {
  const preferredKeys = ["Compound", "Batch", "Operator", "Date", "Program name", "Instrument"];
  const parts = preferredKeys
    .filter((key) => metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== "")
    .map((key) => `${key}: ${metadata[key]}`);

  return parts.length > 0 ? parts.join(" | ") : "No metadata";
}

function cellToJsonValue(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function sheetToRows(workbook: XLSX.WorkBook, fileName: string) {
  const sheetName = workbook.SheetNames.includes("Result") ? "Result" : workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error(`${fileName} does not contain any sheets.`);
  }

  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: true,
  });
}

function parseMetadata(rows: unknown[][]): Metadata {
  const metadata: Metadata = {};

  for (let rowIndex = META_START_ROW; rowIndex <= META_END_ROW; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const key = cellToJsonValue(row[0]);
    if (key === null) continue;

    metadata[String(key)] = cellToJsonValue(row[1]);
  }

  return metadata;
}

function makeUniqueHeaders(rawHeaders: unknown[]) {
  const seen = new Map<string, number>();
  const normalizedHeaders = rawHeaders.map((header, index) => normalizeHeader(header, index));
  const shearRateIndex = normalizedHeaders.findIndex((header) => header === "Shear rate[sec-1]");
  let fallbackLastMeaningfulIndex = -1;

  for (let index = normalizedHeaders.length - 1; index >= 0; index -= 1) {
    const rawHeader = rawHeaders[index];
    if (rawHeader !== null && rawHeader !== undefined && String(rawHeader).trim() !== "") {
      fallbackLastMeaningfulIndex = index;
      break;
    }
  }

  const lastMeaningfulIndex =
    shearRateIndex >= 0
      ? shearRateIndex
      : fallbackLastMeaningfulIndex;
  const trimmedHeaders = lastMeaningfulIndex >= 0 ? normalizedHeaders.slice(0, lastMeaningfulIndex + 1) : [];

  return trimmedHeaders.map((normalized) => {
    const count = seen.get(normalized) ?? 0;
    seen.set(normalized, count + 1);
    return count === 0 ? normalized : `${normalized} ${count + 1}`;
  });
}

function parseDataRows(rows: unknown[][], headers: string[], sample: Pick<ParsedSample, "label" | "sourceFileName" | "metadata">) {
  const metadataSummary = buildMetadataSummary(sample.metadata);
  const dataRows: DataRow[] = [];

  rows.slice(FIRST_DATA_ROW).forEach((rawRow) => {
    const hasValue = rawRow.slice(0, headers.length).some((value) => cellToJsonValue(value) !== null);
    if (!hasValue) return;

    const row: DataRow = {
      Sample: sample.label,
      "Source File": sample.sourceFileName,
      "Metadata Summary": metadataSummary,
    };

    headers.forEach((header, index) => {
      row[header] = cellToJsonValue(rawRow[index]);
    });

    dataRows.push(row);
  });

  return dataRows;
}

export async function parseRpaFile(file: File, sampleIndex: number): Promise<ParsedSample> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    raw: false,
  });
  const rows = sheetToRows(workbook, file.name);
  const metadata = parseMetadata(rows);
  const headers = makeUniqueHeaders(rows[HEADER_ROW] ?? []);
  const sampleShell = {
    id: crypto.randomUUID(),
    label: sampleLabelForIndex(sampleIndex),
    sourceFileName: file.name,
    metadata,
  };
  const dataRows = parseDataRows(rows, headers, sampleShell);
  const warnings: string[] = [];

  if (headers.length === 0) {
    warnings.push("No row 15 measurement headers were found.");
  }

  if (dataRows.length === 0) {
    warnings.push("No measurement rows were found after row 15.");
  }

  return {
    ...sampleShell,
    headers,
    rows: dataRows,
    warnings,
  };
}

export function mergeSamples(samples: ParsedSample[]) {
  const measurementHeaders = new Set<string>();

  samples.forEach((sample) => {
    sample.headers.forEach((header) => measurementHeaders.add(header));
  });

  const columns = [...SYSTEM_COLUMNS, ...measurementHeaders];
  const rows = samples.flatMap((sample) =>
    sample.rows.map((row) =>
      columns.reduce<DataRow>((record, column) => {
        record[column] = row[column] ?? null;
        return record;
      }, {}),
    ),
  );

  return { columns, rows };
}

export function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed === "?") return null;

  const number = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

export function isNumericColumn(rows: DataRow[], column: string) {
  return rows.some((row) => parseNumber(row[column]) !== null);
}
