import { formatDateTime } from "./utils";
import {
  getDirectionForLanguage,
  getStoredLanguage,
  translateRows,
  translateText,
} from "./i18n";

export interface ReportRow {
  section: string;
  metric: string;
  value: string | number;
}

export interface ReportTable {
  id: string;
  moduleKey: string;
  moduleLabel: string;
  title: string;
  columns: string[];
  rows: string[][];
  filters: string[];
  sort: string[];
  generatedAt: string;
}

export interface ReportExportPayload {
  title: string;
  table: {
    columns: string[];
    rows: string[][];
  };
  metadata?: {
    generatedAt?: string;
    filters?: string[];
    sort?: string[];
  };
}

export interface BackendReportQuery {
  reportKey: string;
  from?: string;
  to?: string;
  filters?: Record<string, string | number | boolean | undefined>;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeCsvValue(value: string | number) {
  const normalized = String(value).replace(/"/g, '""');
  return `"${normalized}"`;
}

function normalizeFileName(title: string) {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "report";
}

function buildCsv(columns: string[], rows: string[][]) {
  const header = columns.map((column) => sanitizeCsvValue(column)).join(",");
  const body = rows.map((row) =>
    row.map((value) => sanitizeCsvValue(value)).join(","),
  );
  return [header, ...body].join("\n");
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
}

function buildHtmlTable(payload: ReportExportPayload) {
  const language = getStoredLanguage();
  const direction = getDirectionForLanguage(language);
  const languageCode = language === "ur" ? "ur" : "en";
  const fontFamily =
    language === "ur"
      ? '"Noto Nastaliq Urdu", "Noto Naskh Arabic", "Segoe UI", Arial, sans-serif'
      : "Arial, sans-serif";
  const generatedAt =
    payload.metadata?.generatedAt || formatDateTime(new Date());
  const filters = payload.metadata?.filters ?? [];
  const translatedColumns = payload.table.columns.map((column) =>
    translateText(column, language),
  );
  const translatedRows = translateRows(payload.table.rows, language);

  const header = translatedColumns
    .map((column) => `<th>${escapeHtml(column)}</th>`)
    .join("");

  const rows = translatedRows
    .map(
      (row) =>
        `<tr>${row.map((value) => `<td>${escapeHtml(String(value))}</td>`).join("")}</tr>`,
    )
    .join("");

  return `
    <html lang="${languageCode}" dir="${direction}">
      <head>
        <title>${escapeHtml(translateText(payload.title, language))}</title>
        <style>
          body { font-family: ${fontFamily}; margin: 20px; color: #222; direction: ${direction}; text-align: ${direction === "rtl" ? "right" : "left"}; }
          h1 { margin-bottom: 6px; }
          .meta { margin: 4px 0; color: #555; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: ${direction === "rtl" ? "right" : "left"}; font-size: 12px; }
          th { background: #f4f4f4; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(translateText(payload.title, language))}</h1>
        <p class="meta">${escapeHtml(translateText("Generated on", language))} ${escapeHtml(generatedAt)}</p>
        ${filters.length > 0 ? `<p class="meta">${escapeHtml(translateText("Filters", language))}: ${escapeHtml(filters.map((filter) => translateText(filter, language)).join(", "))}</p>` : ""}
        <table>
          <thead><tr>${header}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
}

// NOTE: DOM/table-based report collection has been removed intentionally.
export function collectTablesFromContainer(
  moduleKey: string,
  moduleLabel: string,
  container: HTMLElement | null,
): ReportTable[] {
  void moduleKey;
  void moduleLabel;
  void container;
  return [];
}

// NOTE: localStorage report snapshots have been removed intentionally.
export function saveModuleReportTables(
  moduleKey: string,
  moduleLabel: string,
  tables: ReportTable[],
) {
  void moduleKey;
  void moduleLabel;
  void tables;
}

export function getStoredReportTables(): ReportTable[] {
  return [];
}

export function collectPageRows(
  pageName: string,
  container: HTMLElement | null,
): ReportRow[] {
  void pageName;
  void container;
  return [];
}

export function collectRowsFromSelector(
  pageName: string,
  selector: string,
): ReportRow[] {
  void pageName;
  void selector;
  return [];
}

export function buildCombinedTablePayload(
  title: string,
  tables: ReportTable[],
): ReportExportPayload {
  const allColumns = Array.from(
    new Set(tables.flatMap((table) => table.columns)),
  );
  const rows = tables.flatMap((table) =>
    table.rows.map((row) => {
      const map = table.columns.reduce<Record<string, string>>(
        (acc, column, index) => {
          acc[column] = row[index] ?? "";
          return acc;
        },
        {},
      );
      return [table.title, ...allColumns.map((column) => map[column] ?? "")];
    }),
  );

  return {
    title,
    table: {
      columns: ["Table", ...allColumns],
      rows,
    },
    metadata: {
      generatedAt: formatDateTime(new Date()),
      filters: Array.from(new Set(tables.flatMap((table) => table.filters))),
      sort: Array.from(new Set(tables.flatMap((table) => table.sort))),
    },
  };
}

// Export actions are disabled until backend report endpoints are implemented.
export function exportTableToExcel(payload: ReportExportPayload): boolean {
  try {
    const language = getStoredLanguage();
    const translatedColumns = payload.table.columns.map((column) =>
      translateText(column, language),
    );
    const translatedRows = translateRows(payload.table.rows, language);
    const csv = `\uFEFF${buildCsv(
      translatedColumns,
      translatedRows.map((row) => row.map((value) => String(value))),
    )}`;
    downloadBlob(
      `${normalizeFileName(payload.title)}.csv`,
      csv,
      "text/csv;charset=utf-8;",
    );
    return true;
  } catch {
    return false;
  }
}

export function printTable(payload: ReportExportPayload): boolean {
  try {
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return false;
    printWindow.document.write(buildHtmlTable(payload));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    return true;
  } catch {
    return false;
  }
}

export function exportTableToPdf(payload: ReportExportPayload): boolean {
  return printTable(payload);
}

export function exportRowsToExcel(title: string, rows: ReportRow[]) {
  void title;
  void rows;
}

export function printRows(title: string, rows: ReportRow[]) {
  void title;
  void rows;
}

export function exportRowsToPdf(title: string, rows: ReportRow[]) {
  void title;
  void rows;
}

export async function fetchBackendReport(
  query: BackendReportQuery,
): Promise<ReportExportPayload> {
  void query;
  throw new Error("Backend report endpoints are not implemented yet.");
}
