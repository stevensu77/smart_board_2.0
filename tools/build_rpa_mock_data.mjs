import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.join(process.cwd(), "outputs/rpa_mock_data");
const outputPath = path.join(outputDir, "rubber_rpa_mock_data.xlsx");

const headers = [
  "T-SUM[Sec]",
  "T[Sec]",
  "P-TYP",
  "P-COUNT",
  "SUB-NO",
  "CYCLE",
  "Set-Temp[°C]",
  "Freq[Hz]",
  "Set-Strain[Degree]",
  "S'[Lbin]",
  "S''[Lbin]",
  "S*[Lbin]",
  "G'[kPa]",
  "G''[kPa]",
  "G*[kPa]",
  "N'[Pa*Sec]",
  "N''[Pa*Sec]",
  "Speed[LB/min]",
  "Up-Module[%]",
  "Lo-Temp[°C]",
  "Strain-Mean[Degree]",
  "Strain-Lo[Degree]",
  "Strain-Hi[Degree]",
  "Pressure[kPa]",
  "Tan.Delta",
  "Phase[°]",
  "J'",
  "J''",
  "J*",
  "Shear rate[sec-1]",
];

const rows = [
  [30, 30, "SS", 1, 1, 1, 60.0, 1.667, 0.50, 7.82, 1.18, 7.91, 682.4, 103.1, 690.1, 9.85, 65.18, 0.12, 100.0, 59.8, 0.50, 0.49, 0.51, 414, 0.151, 8.59, 0.00143, 0.00022, 0.00145, 0.091],
  [60, 30, "SS", 2, 1, 1, 60.0, 1.667, 0.75, 7.65, 1.21, 7.75, 667.6, 105.6, 675.9, 10.09, 63.77, 0.18, 97.8, 59.9, 0.75, 0.74, 0.76, 416, 0.158, 8.98, 0.00146, 0.00023, 0.00148, 0.137],
  [90, 30, "SS", 3, 1, 1, 60.0, 1.667, 1.00, 7.39, 1.24, 7.49, 645.1, 108.3, 654.1, 10.35, 61.62, 0.24, 94.5, 60.0, 1.00, 0.99, 1.01, 417, 0.168, 9.52, 0.00150, 0.00025, 0.00153, 0.183],
  [120, 30, "SS", 4, 1, 1, 60.0, 1.667, 1.50, 7.02, 1.28, 7.14, 612.8, 111.7, 622.9, 10.67, 58.53, 0.36, 89.8, 60.1, 1.50, 1.48, 1.52, 419, 0.182, 10.33, 0.00157, 0.00029, 0.00161, 0.274],
  [150, 30, "SS", 5, 1, 1, 60.0, 1.667, 2.00, 6.66, 1.31, 6.79, 581.3, 114.4, 592.5, 10.93, 55.52, 0.48, 85.2, 60.0, 2.00, 1.98, 2.02, 421, 0.197, 11.16, 0.00166, 0.00033, 0.00169, 0.365],
  [180, 30, "SS", 6, 1, 1, 60.0, 1.667, 2.50, 6.31, 1.34, 6.45, 550.8, 116.9, 563.1, 11.17, 52.61, 0.60, 80.7, 59.9, 2.50, 2.47, 2.53, 422, 0.212, 11.96, 0.00175, 0.00037, 0.00179, 0.457],
  [210, 30, "SS", 7, 1, 1, 60.0, 1.667, 3.00, 5.98, 1.37, 6.14, 522.0, 119.6, 535.5, 11.43, 49.86, 0.72, 76.5, 60.0, 3.00, 2.97, 3.03, 424, 0.229, 12.90, 0.00182, 0.00042, 0.00187, 0.548],
  [240, 30, "SS", 8, 1, 1, 60.0, 1.667, 3.50, 5.69, 1.39, 5.86, 496.7, 121.4, 511.3, 11.60, 47.44, 0.84, 72.8, 60.1, 3.50, 3.46, 3.54, 426, 0.244, 13.71, 0.00190, 0.00046, 0.00196, 0.639],
  [270, 30, "SS", 9, 1, 1, 60.0, 1.667, 4.00, 5.43, 1.41, 5.61, 474.0, 123.1, 489.7, 11.76, 45.27, 0.96, 69.5, 60.0, 4.00, 3.96, 4.04, 427, 0.260, 14.56, 0.00198, 0.00051, 0.00204, 0.731],
  [300, 30, "SS", 10, 1, 1, 60.0, 1.667, 5.00, 5.02, 1.45, 5.23, 438.2, 126.6, 456.1, 12.09, 41.85, 1.20, 64.2, 59.9, 5.00, 4.95, 5.05, 430, 0.289, 16.14, 0.00210, 0.00061, 0.00219, 0.913],
  [330, 30, "SS", 11, 1, 1, 60.0, 1.667, 6.00, 4.70, 1.49, 4.93, 410.3, 130.1, 430.4, 12.42, 39.18, 1.44, 60.1, 60.0, 6.00, 5.94, 6.06, 432, 0.317, 17.60, 0.00221, 0.00070, 0.00232, 1.096],
  [360, 30, "SS", 12, 1, 1, 60.0, 1.667, 7.00, 4.46, 1.52, 4.71, 389.3, 132.7, 411.3, 12.67, 37.18, 1.68, 57.0, 60.1, 7.00, 6.93, 7.07, 434, 0.341, 18.83, 0.00230, 0.00078, 0.00243, 1.279],
  [390, 30, "SS", 13, 1, 1, 60.0, 1.667, 8.00, 4.25, 1.55, 4.52, 371.0, 135.3, 394.9, 12.92, 35.43, 1.92, 54.4, 60.0, 8.00, 7.92, 8.08, 436, 0.365, 20.04, 0.00238, 0.00087, 0.00254, 1.462],
  [420, 30, "SS", 14, 1, 1, 60.0, 1.667, 9.00, 4.08, 1.58, 4.38, 356.2, 138.0, 382.1, 13.18, 34.02, 2.16, 52.2, 59.9, 9.00, 8.91, 9.09, 438, 0.387, 21.16, 0.00244, 0.00094, 0.00261, 1.644],
  [450, 30, "SS", 15, 1, 1, 60.0, 1.667, 10.00, 3.92, 1.61, 4.24, 342.2, 140.6, 369.9, 13.43, 32.68, 2.40, 50.1, 60.0, 10.00, 9.90, 10.10, 441, 0.411, 22.34, 0.00250, 0.00103, 0.00270, 1.827],
];

const workbook = Workbook.create();
const sheet = workbook.worksheets.getOrAdd("RPA Mock Data", {
  renameFirstIfOnlyNewSpreadsheet: true,
});

const data = [headers, ...rows];
sheet.getRange("A1:AD16").values = data;

const usedRange = sheet.getRange("A1:AD16");
usedRange.format = {
  font: { name: "Calibri", size: 10, color: "#111827" },
  borders: { preset: "inside", style: "thin", color: "#D1D5DB" },
  verticalAlignment: "center",
};

sheet.getRange("A1:AD1").format = {
  fill: "#1F4E78",
  font: { name: "Calibri", size: 10, color: "#FFFFFF", bold: true },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "outside", style: "thin", color: "#163A5A" },
};

sheet.getRange("A2:AD16").format = {
  font: { name: "Calibri", size: 10, color: "#111827" },
  borders: { preset: "inside", style: "thin", color: "#E5E7EB" },
  verticalAlignment: "center",
};

sheet.getRange("A2:F16").format.horizontalAlignment = "center";
sheet.getRange("G2:AD16").format.horizontalAlignment = "right";
sheet.getRange("A1:AD16").format.autofitColumns();
sheet.getRange("A1:AD1").format.autofitRows();

sheet.getRange("G2:G16").format.numberFormat = "0.0";
sheet.getRange("H2:H16").format.numberFormat = "0.000";
sheet.getRange("I2:K16").format.numberFormat = "0.00";
sheet.getRange("L2:O16").format.numberFormat = "0.0";
sheet.getRange("P2:Q16").format.numberFormat = "0.00";
sheet.getRange("R2:R16").format.numberFormat = "0.00";
sheet.getRange("S2:W16").format.numberFormat = "0.00";
sheet.getRange("X2:X16").format.numberFormat = "0";
sheet.getRange("Y2:Y16").format.numberFormat = "0.000";
sheet.getRange("Z2:Z16").format.numberFormat = "0.00";
sheet.getRange("AA2:AC16").format.numberFormat = "0.00000";
sheet.getRange("AD2:AD16").format.numberFormat = "0.000";

sheet.freezePanes.freezeRows(1);
sheet.showGridLines = false;

await fs.mkdir(outputDir, { recursive: true });

const preview = await workbook.inspect({
  kind: "table",
  range: "RPA Mock Data!A1:AD16",
  include: "values",
  tableMaxRows: 18,
  tableMaxCols: 30,
});
console.log(preview.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

await workbook.render({
  sheetName: "RPA Mock Data",
  range: "A1:AD16",
  format: "png",
  scale: 1,
});

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`Saved ${outputPath}`);
