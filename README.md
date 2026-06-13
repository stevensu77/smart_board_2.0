# Smart Board 2.0

Smart Board 2.0 is a local-first RPA spreadsheet visualization app. It lets you upload multiple `.csv`, `.xls`, or `.xlsx` files, parse RPA metadata and measurement rows in the browser, edit the merged table, and render Highcharts visualizations without a backend.

Uploaded files stay local to the browser. The app is designed for quick lab-data review, sample comparison, and chart iteration.

## Version

Current version: `0.1.0`

## Main Features

- Upload multiple local `.csv`, `.xls`, and `.xlsx` RPA files.
- Parse Excel sheet `Result` by default.
- Parse `A1:A13` as metadata keys and `B1:B13` as metadata values.
- Treat row 15 as measurement headers and rows 16+ as measurement data.
- Normalize RPA columns such as `P-COUNT` to `Pcount`.
- Stop measurement columns at `Shear rate[sec-1]` to avoid trailing empty columns.
- Assign uploaded files as `Sample A`, `Sample B`, `Sample C`, and so on.
- Merge samples into one editable table.
- Select and invert table rows and columns.
- Download edited data as CSV.
- Download edited data as XLSX with a separate `Metadata` sheet.
- Render Highcharts charts grouped by sample and selected y-axis metrics.
- Filter chart data by `Pcount`.
- Use Highcharts built-in export and fullscreen controls.
- Edit Highcharts chart options as JSON.
- Save, load, and delete chart config presets from browser `localStorage`.
- View sample metadata as collapsible helper information in the Chart page.

## Demo Input Files

Example RPA input workbooks are included:

```text
row data table/raw_input_tableA.xlsx
row data table/raw_input_tableB.xlsx
row data table/raw_input_tableC.xlsx
```

These files use the expected RPA structure:

- metadata keys in `A1:A13`
- metadata values in `B1:B13`
- measurement headers on row 15
- measurement data starting on row 16

## Tech Stack

- React
- TypeScript
- Vite
- Highcharts
- Highcharts React
- SheetJS `xlsx`
- Lucide React
- Vitest

## Requirements

Install these before running the project:

- Node.js 20 or newer
- npm

You do not need a Highcharts API key for local rendering. Highcharts licensing depends on your use case, especially for commercial usage.

## Install

Clone the repository:

```bash
git clone https://github.com/stevensu77/smart_board_2.0.git
cd smart_board_2.0
```

Install dependencies:

```bash
npm install
```

## Run Locally

Start the Vite development server:

```bash
npm run dev
```

Open the local URL shown in the terminal. It is usually:

```text
http://127.0.0.1:5173/
```

If port `5173` is already in use, Vite may choose another port.

## Test

Run parser and merge tests:

```bash
npm test
```

## Build

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Deploy To GitHub Pages

This project includes a GitHub Actions workflow for GitHub Pages:

```text
.github/workflows/deploy.yml
```

The Vite base path is configured for the project URL:

```text
https://stevensu77.github.io/smart_board_2.0/
```

To enable deployment in GitHub:

1. Open the repository on GitHub.
2. Go to `Settings` -> `Pages`.
3. Set `Build and deployment` source to `GitHub Actions`.
4. Push changes to the `main` branch.

GitHub will build the app and publish the `dist` output automatically.

## How To Use

1. Open the app in your browser.
2. Upload one or more RPA spreadsheet files.
3. Review parsed warnings, if any.
4. Use the `Data table` step to inspect, edit, select, and download merged rows.
5. Confirm into the `Chart` step.
6. Choose the x-axis, y-axis metrics, samples, Pcount values, and chart type.
7. Use the chart export menu to download chart outputs or view fullscreen.
8. Open `Helper information` to compare sample metadata.
9. Open `Customization` to edit the Highcharts JSON config.
10. Save useful chart configs as local presets.

## Project Structure

```text
smart_board_2.0/
  .github/workflows/deploy.yml
  row data table/
    raw_input_tableA.xlsx
    raw_input_tableB.xlsx
    raw_input_tableC.xlsx
  src/
    data/
      exporters.ts
      rpaParser.test.ts
      rpaParser.ts
    App.tsx
    main.tsx
    styles.css
    types.ts
    vite-env.d.ts
  index.html
  package.json
  package-lock.json
  tsconfig.json
  vite.config.ts
  README.md
```

## Notes

- The app is local-first and currently has no backend.
- Spreadsheet parsing is handled in the browser with SheetJS `xlsx`.
- Saved chart configs are stored in browser `localStorage`, so they stay on the same browser and machine until deleted.
- Very large files may need table virtualization in a future version.
