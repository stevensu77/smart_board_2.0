import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Check,
  ChevronRight,
  Download,
  FileSpreadsheet,
  LineChart,
  RefreshCcw,
  Table2,
  Upload,
} from "lucide-react";
import Highcharts from "highcharts/highcharts";
import HighchartsReact from "highcharts-react-official";
import type { Options, SeriesOptionsType } from "highcharts";
import type { ChartType, DataRow, ParsedSample, StepKey } from "./types";
import { downloadCsv, downloadXlsx } from "./data/exporters";
import { isNumericColumn, mergeSamples, parseNumber, parseRpaFile, SYSTEM_COLUMNS } from "./data/rpaParser";

const steps: Array<{ key: StepKey; label: string; icon: typeof Upload }> = [
  { key: "upload", label: "Upload", icon: Upload },
  { key: "table", label: "Data table", icon: Table2 },
  { key: "chart", label: "Chart", icon: LineChart },
];

const HighchartsRuntime = ((Highcharts as unknown as { default?: typeof Highcharts }).default ?? Highcharts) as typeof Highcharts;
const CHART_CONFIG_STORAGE_KEY = "smart-board-rpa.chartConfigs";

type ChartConfigPreset = {
  name: string;
  configText: string;
  updatedAt: string;
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function fileListToArray(fileList: FileList | null) {
  return fileList ? Array.from(fileList) : [];
}

function uniqueSortedValues(rows: DataRow[], column: string) {
  return Array.from(
    new Set(
      rows
        .map((row) => row[column])
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
        .map((value) => String(value)),
    ),
  ).sort((a, b) => {
    const numberA = parseNumber(a);
    const numberB = parseNumber(b);
    if (numberA !== null && numberB !== null) return numberA - numberB;
    return a.localeCompare(b);
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepMergeOptions(base: Options, override: unknown): Options {
  if (!isPlainObject(override)) return base;

  const merge = (left: unknown, right: unknown): unknown => {
    if (Array.isArray(right)) return right;
    if (!isPlainObject(left) || !isPlainObject(right)) return right;

    return Object.keys(right).reduce<Record<string, unknown>>(
      (result, key) => {
        result[key] = merge(left[key], right[key]);
        return result;
      },
      { ...left },
    );
  };

  return merge(base, override) as Options;
}

function readChartPresets(): ChartConfigPreset[] {
  try {
    const rawValue = localStorage.getItem(CHART_CONFIG_STORAGE_KEY);
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeChartPresets(presets: ChartConfigPreset[]) {
  localStorage.setItem(CHART_CONFIG_STORAGE_KEY, JSON.stringify(presets));
}

function formatOptions(options: Options) {
  return JSON.stringify(options, null, 2);
}

function App() {
  const [activeStep, setActiveStep] = useState<StepKey>("upload");
  const [samples, setSamples] = useState<ParsedSample[]>([]);
  const [editedRows, setEditedRows] = useState<DataRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [isParsing, setIsParsing] = useState(false);
  const [message, setMessage] = useState("");
  const [xAxis, setXAxis] = useState("");
  const [yAxes, setYAxes] = useState<string[]>([]);
  const [chartType, setChartType] = useState<ChartType>("line");
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  const [selectedPcounts, setSelectedPcounts] = useState<string[]>([]);
  const [customConfigText, setCustomConfigText] = useState("");
  const [customConfigError, setCustomConfigError] = useState("");
  const [appliedCustomConfig, setAppliedCustomConfig] = useState<Options | null>(null);
  const [chartConfigPresets, setChartConfigPresets] = useState<ChartConfigPreset[]>(() => readChartPresets());
  const [chartConfigName, setChartConfigName] = useState("Default chart");
  const [highchartsModulesReady, setHighchartsModulesReady] = useState(false);
  const [highchartsModuleError, setHighchartsModuleError] = useState("");
  const [isMetadataHelperOpen, setIsMetadataHelperOpen] = useState(true);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(true);

  const merged = useMemo(() => mergeSamples(samples), [samples]);
  const columns = merged.columns;
  const rows = editedRows.length > 0 || samples.length === 0 ? editedRows : merged.rows;
  const numericColumns = useMemo(() => columns.filter((column) => !SYSTEM_COLUMNS.includes(column) && isNumericColumn(rows, column)), [columns, rows]);
  const sampleLabels = samples.map((sample) => sample.label);
  const pcountValues = useMemo(() => uniqueSortedValues(rows, "Pcount"), [rows]);
  const warnings = samples.flatMap((sample) => sample.warnings.map((warning) => `${sample.label}: ${warning}`));

  useEffect(() => {
    setSelectedPcounts((current) => {
      if (pcountValues.length === 0) return [];
      const next = current.filter((value) => pcountValues.includes(value));
      return next.length > 0 ? next : pcountValues;
    });
  }, [pcountValues]);

  useEffect(() => {
    let isMounted = true;
    window._Highcharts = HighchartsRuntime;

    Promise.all([
      import("highcharts/modules/exporting.js"),
      import("highcharts/modules/full-screen.js"),
      import("highcharts/modules/export-data.js"),
    ])
      .then(() => {
        if (isMounted) setHighchartsModulesReady(true);
      })
      .catch((error) => {
        if (isMounted) setHighchartsModuleError(error instanceof Error ? error.message : "Highcharts modules failed to load.");
        console.error("Highcharts modules failed to load", error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;

    setIsParsing(true);
    setMessage("");

    try {
      const parsed = await Promise.all(files.map((file, index) => parseRpaFile(file, samples.length + index)));
      const nextSamples = [...samples, ...parsed];
      const nextMerged = mergeSamples(nextSamples);
      setSamples(nextSamples);
      setEditedRows(nextMerged.rows);
      setSelectedRows(new Set(nextMerged.rows.map((_, index) => index)));
      setSelectedColumns(new Set(nextMerged.columns));
      setSelectedSamples(nextSamples.map((sample) => sample.label));

      const defaultX = nextMerged.columns.find((column) => column === "Set-Strain[Degree]") ?? nextMerged.columns.find((column) => column === "T-SUM[Sec]") ?? "";
      const defaultY = nextMerged.columns.find((column) => column === "G''[kPa]") ?? nextMerged.columns.find((column) => column === "G'[kPa]") ?? "";
      setXAxis((current) => current || defaultX);
      setYAxes((current) => (current.length > 0 ? current : defaultY ? [defaultY] : []));
      setActiveStep("table");
      setMessage(`${parsed.length} file${parsed.length === 1 ? "" : "s"} parsed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not parse the selected files.");
    } finally {
      setIsParsing(false);
    }
  }

  function updateCell(rowIndex: number, column: string, value: string) {
    setEditedRows((currentRows) =>
      currentRows.map((row, index) => (index === rowIndex ? { ...row, [column]: value } : row)),
    );
  }

  function toggleRow(rowIndex: number) {
    setSelectedRows((current) => {
      const next = new Set(current);
      next.has(rowIndex) ? next.delete(rowIndex) : next.add(rowIndex);
      return next;
    });
  }

  function toggleColumn(column: string) {
    setSelectedColumns((current) => {
      const next = new Set(current);
      next.has(column) ? next.delete(column) : next.add(column);
      return next;
    });
  }

  function invertRows() {
    setSelectedRows((current) => new Set(rows.map((_, index) => index).filter((index) => !current.has(index))));
  }

  function invertColumns() {
    setSelectedColumns((current) => new Set(columns.filter((column) => !current.has(column))));
  }

  function selectedExportRows() {
    const rowIndexes = selectedRows.size > 0 ? selectedRows : new Set(rows.map((_, index) => index));
    const exportColumns = selectedColumns.size > 0 ? columns.filter((column) => selectedColumns.has(column)) : columns;

    return {
      exportColumns,
      exportRows: rows.filter((_, index) => rowIndexes.has(index)),
    };
  }

  const chartRows = useMemo(() => {
    const allowedSamples = selectedSamples.length > 0 ? new Set(selectedSamples) : new Set(sampleLabels);
    const allowedPcounts = selectedPcounts.length > 0 ? new Set(selectedPcounts) : new Set(pcountValues);
    const rowIndexes = selectedRows.size > 0 ? selectedRows : new Set(rows.map((_, index) => index));
    return rows.filter((row, index) => {
      const pcount = row.Pcount === null || row.Pcount === undefined ? "" : String(row.Pcount);
      return rowIndexes.has(index) && allowedSamples.has(String(row.Sample)) && (pcountValues.length === 0 || allowedPcounts.has(pcount));
    });
  }, [rows, selectedRows, selectedSamples, sampleLabels, selectedPcounts, pcountValues]);

  const baseChartOptions = useMemo<Options>(() => {
    const series: SeriesOptionsType[] = yAxes.flatMap((metric) =>
      sampleLabels
        .filter((sample) => selectedSamples.length === 0 || selectedSamples.includes(sample))
        .map((sample) => {
          const points = chartRows
            .filter((row) => row.Sample === sample)
            .map((row) => {
              const x = parseNumber(row[xAxis]);
              const y = parseNumber(row[metric]);
              return x !== null && y !== null ? [x, y] : null;
            })
            .filter((point): point is [number, number] => point !== null)
            .sort((a, b) => a[0] - b[0]);

          return {
            type: chartType === "line-markers" ? "line" : chartType,
            name: `${sample} - ${metric}`,
            data: points,
          } as SeriesOptionsType;
        }),
    );

    return {
      chart: {
        type: chartType === "line-markers" ? "line" : chartType,
        backgroundColor: "transparent",
        style: { fontFamily: "Inter, ui-sans-serif, system-ui" },
      },
      credits: { enabled: false },
      exporting: {
        enabled: highchartsModulesReady,
        fallbackToExportServer: false,
      },
      title: { text: yAxes.length > 0 ? yAxes.join(", ") : "Select a y-axis metric" },
      subtitle: { text: xAxis ? `x-axis: ${xAxis}` : "Select an x-axis column" },
      xAxis: {
        title: { text: xAxis || undefined },
        gridLineWidth: 1,
      },
      yAxis: { title: { text: yAxes.join(", ") || undefined } },
      legend: {
        align: "center",
        verticalAlign: "bottom",
        itemStyle: { color: "#172026", fontWeight: "600" },
      },
      tooltip: {
        shared: false,
        valueDecimals: 3,
      },
      plotOptions: {
        series: {
          animation: { duration: 350 },
          marker: { enabled: chartType === "scatter" || chartType === "line-markers" },
        },
      },
      series,
    };
  }, [chartRows, chartType, sampleLabels, selectedSamples, xAxis, yAxes, highchartsModulesReady]);

  const chartOptions = useMemo<Options>(
    () => (appliedCustomConfig ? deepMergeOptions(baseChartOptions, appliedCustomConfig) : baseChartOptions),
    [appliedCustomConfig, baseChartOptions],
  );

  useEffect(() => {
    if (!appliedCustomConfig) {
      setCustomConfigText(formatOptions(baseChartOptions));
    }
  }, [appliedCustomConfig, baseChartOptions]);

  function applyChartConfig() {
    try {
      const parsed = JSON.parse(customConfigText);
      if (!isPlainObject(parsed)) {
        setCustomConfigError("Chart config must be a JSON object.");
        return;
      }

      setAppliedCustomConfig(parsed as Options);
      setCustomConfigError("");
    } catch (error) {
      setCustomConfigError(error instanceof Error ? error.message : "Invalid JSON config.");
    }
  }

  function resetChartConfig() {
    setAppliedCustomConfig(null);
    setCustomConfigError("");
    setCustomConfigText(formatOptions(baseChartOptions));
  }

  function saveChartConfig() {
    const name = chartConfigName.trim() || "Untitled chart";
    const nextPreset: ChartConfigPreset = {
      name,
      configText: customConfigText,
      updatedAt: new Date().toISOString(),
    };
    const nextPresets = [nextPreset, ...chartConfigPresets.filter((preset) => preset.name !== name)];
    setChartConfigPresets(nextPresets);
    writeChartPresets(nextPresets);
    setCustomConfigError("");
  }

  function loadChartConfig(name: string) {
    const preset = chartConfigPresets.find((item) => item.name === name);
    if (!preset) return;
    setChartConfigName(preset.name);
    setCustomConfigText(preset.configText);
    setCustomConfigError("");
  }

  function deleteChartConfig(name: string) {
    const nextPresets = chartConfigPresets.filter((preset) => preset.name !== name);
    setChartConfigPresets(nextPresets);
    writeChartPresets(nextPresets);
  }

  return (
    <main className="app-shell" data-highcharts-modules={highchartsModulesReady ? "ready" : highchartsModuleError ? "error" : "loading"}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Smart Board RPA</p>
          <h1>Local data workbench for RPA measurement files</h1>
        </div>
        <div className="stepper" aria-label="Workflow steps">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <button
                key={step.key}
                className={classNames("step-button", activeStep === step.key && "is-active")}
                onClick={() => setActiveStep(step.key)}
                disabled={step.key !== "upload" && samples.length === 0}
              >
                <Icon size={17} />
                <span>{index + 1}</span>
                <strong>{step.label}</strong>
              </button>
            );
          })}
        </div>
      </header>

      {message && <div className="notice">{message}</div>}
      {warnings.length > 0 && (
        <div className="warning-list">
          {warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      )}
      {highchartsModuleError && <div className="warning-list"><span>Highcharts exporting tools failed to load: {highchartsModuleError}</span></div>}

      {activeStep === "upload" && (
        <UploadStep isParsing={isParsing} onFiles={handleFiles} samples={samples} />
      )}

      {activeStep === "table" && (
        <TableStep
          columns={columns}
          rows={rows}
          selectedRows={selectedRows}
          selectedColumns={selectedColumns}
          isParsing={isParsing}
          onFiles={handleFiles}
          onCellChange={updateCell}
          onToggleRow={toggleRow}
          onToggleColumn={toggleColumn}
          onInvertRows={invertRows}
          onInvertColumns={invertColumns}
          onConfirm={() => setActiveStep("chart")}
          onDownloadCsv={() => {
            const { exportColumns, exportRows } = selectedExportRows();
            downloadCsv(exportColumns, exportRows);
          }}
          onDownloadXlsx={() => {
            const { exportColumns, exportRows } = selectedExportRows();
            downloadXlsx(exportColumns, exportRows, samples);
          }}
        />
      )}

      {activeStep === "chart" && (
        <ChartStep
          columns={columns}
          numericColumns={numericColumns}
          samples={samples}
          sampleLabels={sampleLabels}
          selectedSamples={selectedSamples}
          pcountValues={pcountValues}
          selectedPcounts={selectedPcounts}
          xAxis={xAxis}
          yAxes={yAxes}
          chartType={chartType}
          chartOptions={chartOptions}
          customConfigText={customConfigText}
          customConfigError={customConfigError}
          chartConfigName={chartConfigName}
          chartConfigPresets={chartConfigPresets}
          isMetadataHelperOpen={isMetadataHelperOpen}
          isCustomizationOpen={isCustomizationOpen}
          onXAxis={setXAxis}
          onYAxes={setYAxes}
          onSamples={setSelectedSamples}
          onPcounts={setSelectedPcounts}
          onChartType={setChartType}
          onCustomConfigText={setCustomConfigText}
          onChartConfigName={setChartConfigName}
          onApplyConfig={applyChartConfig}
          onResetConfig={resetChartConfig}
          onSaveConfig={saveChartConfig}
          onLoadConfig={loadChartConfig}
          onDeleteConfig={deleteChartConfig}
          onToggleMetadataHelper={() => setIsMetadataHelperOpen((current) => !current)}
          onToggleCustomization={() => setIsCustomizationOpen((current) => !current)}
        />
      )}
    </main>
  );
}

type UploadStepProps = {
  isParsing: boolean;
  samples: ParsedSample[];
  onFiles: (files: File[]) => void;
};

function UploadStep({ isParsing, samples, onFiles }: UploadStepProps) {
  return (
    <section className="upload-grid">
      <label className="dropzone">
        <FileSpreadsheet size={44} />
        <span>Drop RPA files here or choose files</span>
        <small>CSV, XLS, and XLSX files are parsed locally in this browser.</small>
        <input
          type="file"
          multiple
          accept=".csv,.xls,.xlsx"
          onChange={(event) => onFiles(fileListToArray(event.target.files))}
        />
      </label>
      <aside className="run-card">
        <p className="eyebrow">Parser contract</p>
        <ul>
          <li>A1:A13 become metadata keys.</li>
          <li>B1:B13 become metadata values.</li>
          <li>Row 15 becomes the measurement header.</li>
          <li>Rows 16+ become editable measurements.</li>
        </ul>
        <div className="sample-count">
          <strong>{samples.length}</strong>
          <span>sample{samples.length === 1 ? "" : "s"} loaded</span>
        </div>
        {isParsing && <div className="inline-status">Parsing files...</div>}
      </aside>
    </section>
  );
}

type TableStepProps = {
  columns: string[];
  rows: DataRow[];
  selectedRows: Set<number>;
  selectedColumns: Set<string>;
  isParsing: boolean;
  onFiles: (files: File[]) => void;
  onCellChange: (rowIndex: number, column: string, value: string) => void;
  onToggleRow: (rowIndex: number) => void;
  onToggleColumn: (column: string) => void;
  onInvertRows: () => void;
  onInvertColumns: () => void;
  onConfirm: () => void;
  onDownloadCsv: () => void;
  onDownloadXlsx: () => void;
};

function TableStep({
  columns,
  rows,
  selectedRows,
  selectedColumns,
  isParsing,
  onFiles,
  onCellChange,
  onToggleRow,
  onToggleColumn,
  onInvertRows,
  onInvertColumns,
  onConfirm,
  onDownloadCsv,
  onDownloadXlsx,
}: TableStepProps) {
  return (
    <section className="workspace">
      <div className="toolbar">
        <label className="icon-button">
          <Upload size={17} />
          <span>Upload more</span>
          <input
            type="file"
            multiple
            accept=".csv,.xls,.xlsx"
            onChange={(event) => onFiles(fileListToArray(event.target.files))}
          />
        </label>
        <button className="icon-button" onClick={onInvertRows}>
          <RefreshCcw size={17} />
          <span>Invert rows</span>
        </button>
        <button className="icon-button" onClick={onInvertColumns}>
          <RefreshCcw size={17} />
          <span>Invert columns</span>
        </button>
        <button className="icon-button" onClick={onDownloadCsv}>
          <Download size={17} />
          <span>CSV</span>
        </button>
        <button className="icon-button" onClick={onDownloadXlsx}>
          <Download size={17} />
          <span>XLSX</span>
        </button>
        <button className="primary-button" onClick={onConfirm} disabled={rows.length === 0}>
          <Check size={17} />
          <span>Confirm</span>
        </button>
      </div>

      {isParsing && <div className="inline-status">Adding files...</div>}

      <div className="table-frame">
        <table className="data-table">
          <thead>
            <tr>
              <th className="select-cell">Rows</th>
              {columns.map((column) => (
                <th key={column} className={selectedColumns.has(column) ? "is-selected" : ""}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedColumns.has(column)}
                      onChange={() => onToggleColumn(column)}
                    />
                    <span>{column}</span>
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="empty-cell">
                  Upload files with measurement rows after row 15 to populate the table.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={selectedRows.has(rowIndex) ? "is-selected" : ""}>
                  <td className="select-cell">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(rowIndex)}
                      onChange={() => onToggleRow(rowIndex)}
                      aria-label={`Select row ${rowIndex + 1}`}
                    />
                  </td>
                  {columns.map((column) => (
                    <td key={column}>
                      <input
                        value={row[column] === null || row[column] === undefined ? "" : String(row[column])}
                        onChange={(event) => onCellChange(rowIndex, column, event.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type ChartStepProps = {
  columns: string[];
  numericColumns: string[];
  samples: ParsedSample[];
  sampleLabels: string[];
  selectedSamples: string[];
  pcountValues: string[];
  selectedPcounts: string[];
  xAxis: string;
  yAxes: string[];
  chartType: ChartType;
  chartOptions: Options;
  customConfigText: string;
  customConfigError: string;
  chartConfigName: string;
  chartConfigPresets: ChartConfigPreset[];
  isMetadataHelperOpen: boolean;
  isCustomizationOpen: boolean;
  onXAxis: (column: string) => void;
  onYAxes: (columns: string[]) => void;
  onSamples: (samples: string[]) => void;
  onPcounts: (pcounts: string[]) => void;
  onChartType: (chartType: ChartType) => void;
  onCustomConfigText: (text: string) => void;
  onChartConfigName: (name: string) => void;
  onApplyConfig: () => void;
  onResetConfig: () => void;
  onSaveConfig: () => void;
  onLoadConfig: (name: string) => void;
  onDeleteConfig: (name: string) => void;
  onToggleMetadataHelper: () => void;
  onToggleCustomization: () => void;
};

function ChartStep({
  columns,
  numericColumns,
  samples,
  sampleLabels,
  selectedSamples,
  pcountValues,
  selectedPcounts,
  xAxis,
  yAxes,
  chartType,
  chartOptions,
  customConfigText,
  customConfigError,
  chartConfigName,
  chartConfigPresets,
  isMetadataHelperOpen,
  isCustomizationOpen,
  onXAxis,
  onYAxes,
  onSamples,
  onPcounts,
  onChartType,
  onCustomConfigText,
  onChartConfigName,
  onApplyConfig,
  onResetConfig,
  onSaveConfig,
  onLoadConfig,
  onDeleteConfig,
  onToggleMetadataHelper,
  onToggleCustomization,
}: ChartStepProps) {
  function toggleMultiValue(current: string[], value: string) {
    return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  }

  const visibleMetadataSamples = samples.filter(
    (sample) => selectedSamples.length === 0 || selectedSamples.includes(sample.label),
  );

  return (
    <section className="chart-workbench">
      <aside className="chart-sidebar">
        <div className="field-block">
          <label htmlFor="x-axis">x-axis</label>
          <select id="x-axis" value={xAxis} onChange={(event) => onXAxis(event.target.value)}>
            <option value="">Select x-axis</option>
            {columns
              .filter((column) => !SYSTEM_COLUMNS.includes(column))
              .map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
          </select>
        </div>

        <div className="field-block">
          <span className="field-label">y-axis</span>
          <div className="check-list">
            {numericColumns.map((column) => (
              <label key={column}>
                <input
                  type="checkbox"
                  checked={yAxes.includes(column)}
                  onChange={() => onYAxes(toggleMultiValue(yAxes, column))}
                />
                <span>{column}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field-block">
          <span className="field-label">Samples</span>
          <div className="check-list compact">
            {sampleLabels.map((sample) => (
              <label key={sample}>
                <input
                  type="checkbox"
                  checked={selectedSamples.includes(sample)}
                  onChange={() => onSamples(toggleMultiValue(selectedSamples, sample))}
                />
                <span>{sample}</span>
              </label>
            ))}
          </div>
        </div>

        {pcountValues.length > 0 && (
          <div className="field-block">
            <span className="field-label">Pcount</span>
            <div className="mini-actions">
              <button onClick={() => onPcounts(pcountValues)}>All</button>
              <button onClick={() => onPcounts([])}>None</button>
            </div>
            <div className="check-list compact">
              {pcountValues.map((pcount) => (
                <label key={pcount}>
                  <input
                    type="checkbox"
                    checked={selectedPcounts.includes(pcount)}
                    onChange={() => onPcounts(toggleMultiValue(selectedPcounts, pcount))}
                  />
                  <span>{pcount}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="field-block">
          <span className="field-label">Chart type</span>
          <div className="segmented">
            {[
              ["line", LineChart],
              ["scatter", BarChart3],
              ["line-markers", LineChart],
            ].map(([type, Icon]) => {
              const TypedIcon = Icon as typeof LineChart;
              return (
                <button
                  key={type as string}
                  className={chartType === type ? "is-active" : ""}
                  onClick={() => onChartType(type as ChartType)}
                  title={type as string}
                >
                  <TypedIcon size={16} />
                  <span>{type === "line-markers" ? "line + markers" : (type as string)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="chart-panel">
        <div className="chart-title-row">
          <div>
            <p className="eyebrow">Rendered tab</p>
            <h2>Highcharts preview</h2>
          </div>
          <ChevronRight size={22} />
        </div>
        <HighchartsReact highcharts={HighchartsRuntime} options={chartOptions} />

        {visibleMetadataSamples.length > 0 && (
          <section className="metadata-helper">
            <button className="collapse-title" onClick={onToggleMetadataHelper} aria-expanded={isMetadataHelperOpen}>
              <span>
                <p className="eyebrow">Helper information</p>
                <strong>Sample metadata</strong>
              </span>
              <ChevronRight className={isMetadataHelperOpen ? "is-open" : ""} size={20} />
            </button>
            {isMetadataHelperOpen && (
              <div className="metadata-grid">
                {visibleMetadataSamples.map((sample) => (
                  <article key={sample.id} className="metadata-card">
                    <div className="metadata-card-title">
                      <strong>{sample.label}</strong>
                      <span>{sample.sourceFileName}</span>
                    </div>
                    <dl>
                      {Object.entries(sample.metadata).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{value === null || value === "" ? "N/A" : String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="config-panel">
          <button className="collapse-title" onClick={onToggleCustomization} aria-expanded={isCustomizationOpen}>
            <span>
              <p className="eyebrow">Customization</p>
              <strong>Highcharts config</strong>
            </span>
            <ChevronRight className={isCustomizationOpen ? "is-open" : ""} size={20} />
          </button>

          {isCustomizationOpen && (
            <>
              <div className="config-actions">
                <button onClick={onApplyConfig}>Apply config</button>
                <button onClick={onResetConfig}>Reset generated</button>
              </div>

              <textarea
                value={customConfigText}
                onChange={(event) => onCustomConfigText(event.target.value)}
                spellCheck={false}
                aria-label="Highcharts JSON config"
              />
              {customConfigError && <div className="config-error">{customConfigError}</div>}

              <div className="preset-row">
                <input
                  value={chartConfigName}
                  onChange={(event) => onChartConfigName(event.target.value)}
                  placeholder="Preset name"
                  aria-label="Preset name"
                />
                <button onClick={onSaveConfig}>Save preset</button>
                <select
                  value=""
                  onChange={(event) => {
                    if (event.target.value) onLoadConfig(event.target.value);
                  }}
                  aria-label="Load preset"
                >
                  <option value="">Load preset</option>
                  {chartConfigPresets.map((preset) => (
                    <option key={preset.name} value={preset.name}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => onDeleteConfig(chartConfigName)} disabled={!chartConfigPresets.some((preset) => preset.name === chartConfigName)}>
                  Delete preset
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

export default App;
