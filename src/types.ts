export type Metadata = Record<string, string | number | boolean | null>;

export type DataRow = Record<string, string | number | boolean | null>;

export type ParsedSample = {
  id: string;
  label: string;
  sourceFileName: string;
  metadata: Metadata;
  headers: string[];
  rows: DataRow[];
  warnings: string[];
};

export type ChartType = "line" | "scatter" | "line-markers";

export type StepKey = "upload" | "table" | "chart";
