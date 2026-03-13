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

const ACTION_COLUMN_MATCHERS = ['action', 'actions', 'operation', 'operations'];

const REPORT_STORAGE_KEY = 'factory.report.tables';

function isVisible(element: Element) {
  const htmlElement = element as HTMLElement;
  if (htmlElement.hidden) return false;
  if (element.closest('[hidden], [aria-hidden="true"], [data-state="inactive"]')) return false;
  if (htmlElement.getAttribute('data-state') === 'inactive') return false;
  const style = window.getComputedStyle(htmlElement);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  return true;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function sanitizeCsvValue(value: string | number) {
  const normalized = String(value).replace(/"/g, '""');
  return `"${normalized}"`;
}

function normalizeFileName(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildCsv(columns: string[], rows: string[][]) {
  const header = columns.map((column) => sanitizeCsvValue(column)).join(',');
  const body = rows.map((row) => row.map((value) => sanitizeCsvValue(value)).join(','));
  return [header, ...body].join('\n');
}

function openReportWindow(title: string, htmlContent: string) {
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) return null;

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #222; }
          h1 { margin-bottom: 6px; }
          .meta { margin: 4px 0; color: #555; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f4f4f4; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  printWindow.document.close();

  return printWindow;
}

function buildHtmlTable(payload: ReportExportPayload) {
  const generatedAt = payload.metadata?.generatedAt || new Date().toLocaleString();
  const filters = payload.metadata?.filters ?? [];
  const sort = payload.metadata?.sort ?? [];

  const header = payload.table.columns
    .map((column) => `<th>${escapeHtml(column)}</th>`)
    .join('');

  const rows = payload.table.rows
    .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`)
    .join('');

  return `
    <h1>${escapeHtml(payload.title)}</h1>
    <p class="meta">Generated on ${escapeHtml(generatedAt)}</p>
    ${filters.length > 0 ? `<p class="meta">Filters: ${escapeHtml(filters.join(', '))}</p>` : ''}
    ${sort.length > 0 ? `<p class="meta">Sort: ${escapeHtml(sort.join(', '))}</p>` : ''}
    <table>
      <thead><tr>${header}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function exportTableToExcel(payload: ReportExportPayload) {
  const csv = buildCsv(payload.table.columns, payload.table.rows);
  downloadBlob(
    `${normalizeFileName(payload.title)}.xlsx`,
    csv,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;'
  );
}

export function printTable(payload: ReportExportPayload) {
  const html = buildHtmlTable(payload);
  const printWindow = openReportWindow(payload.title, html);
  printWindow?.print();
}

export function exportTableToPdf(payload: ReportExportPayload) {
  const html = buildHtmlTable(payload);
  const printWindow = openReportWindow(payload.title, html);
  printWindow?.print();
}

export function exportRowsToExcel(title: string, rows: ReportRow[]) {
  const payload: ReportExportPayload = {
    title,
    table: {
      columns: ['Section', 'Metric', 'Value'],
      rows: rows.map((row) => [String(row.section), String(row.metric), String(row.value)]),
    },
  };
  exportTableToExcel(payload);
}

export function printRows(title: string, rows: ReportRow[]) {
  const payload: ReportExportPayload = {
    title,
    table: {
      columns: ['Section', 'Metric', 'Value'],
      rows: rows.map((row) => [String(row.section), String(row.metric), String(row.value)]),
    },
  };
  printTable(payload);
}

export function exportRowsToPdf(title: string, rows: ReportRow[]) {
  const payload: ReportExportPayload = {
    title,
    table: {
      columns: ['Section', 'Metric', 'Value'],
      rows: rows.map((row) => [String(row.section), String(row.metric), String(row.value)]),
    },
  };
  exportTableToPdf(payload);
}

function collectAppliedFilters(container: HTMLElement) {
  const filters: string[] = [];
  const controls = Array.from(container.querySelectorAll('input, select, [role="combobox"], textarea'));

  controls.forEach((control) => {
    if (!isVisible(control)) return;
    const element = control as HTMLInputElement;
    const value =
      element.value?.trim() ||
      control.getAttribute('data-state') ||
      control.getAttribute('aria-label') ||
      '';

    if (!value || ['button', 'submit', 'reset', 'hidden'].includes(element.type)) return;

    const label =
      control.getAttribute('aria-label') ||
      control.getAttribute('placeholder') ||
      control.getAttribute('name') ||
      control.id ||
      'Filter';

    if (label.toLowerCase().includes('search') && value.length < 1) return;

    filters.push(`${label}: ${value}`);
  });

  return Array.from(new Set(filters));
}

function getCellText(cell: Element) {
  return cell.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function isActionColumn(columnName: string) {
  const normalized = columnName.toLowerCase().trim();
  return ACTION_COLUMN_MATCHERS.some((matcher) => normalized === matcher || normalized.includes(matcher));
}

function isColumnVisible(table: HTMLTableElement, index: number) {
  const header = table.querySelector(`thead th:nth-child(${index + 1})`);
  if (header && !isVisible(header)) return false;
  const firstCell = table.querySelector(`tbody tr td:nth-child(${index + 1})`);
  if (firstCell && !isVisible(firstCell)) return false;
  return true;
}

export function collectTablesFromContainer(
  moduleKey: string,
  moduleLabel: string,
  container: HTMLElement | null
): ReportTable[] {
  if (!container) return [];

  const baseFilters = collectAppliedFilters(container);

  return Array.from(container.querySelectorAll('table'))
    .filter((table) => isVisible(table))
    .map((table, tableIndex) => {
      const htmlTable = table as HTMLTableElement;
      const section = table.closest('[data-report-tab], [data-slot="card"], section, article, .rounded-md, .space-y-4');
      const heading = section?.querySelector('h1,h2,h3,h4,h5,[data-slot="card-title"]')?.textContent?.trim();
      const title = heading || `${moduleLabel} Table ${tableIndex + 1}`;

      const headers = Array.from(table.querySelectorAll('thead th'));
      const fallbackColumnCount = Math.max(
        ...Array.from(table.querySelectorAll('tbody tr')).map((row) => row.querySelectorAll('td').length),
        0
      );

      const allColumns = headers.length > 0
        ? headers.map(getCellText)
        : Array.from({ length: fallbackColumnCount }).map((_, index) => `Column ${index + 1}`)
      ;

      const visibleIndices = (headers.length > 0
        ? headers.map((_, index) => index)
        : Array.from({ length: fallbackColumnCount }).map((_, index) => index)
      ).filter((index) => isColumnVisible(htmlTable, index));

      const exportIndices = visibleIndices.filter((index) => !isActionColumn(allColumns[index] ?? ''));
      const columns = exportIndices.map((index) => allColumns[index]);

      const rows = Array.from(table.querySelectorAll('tbody tr'))
        .filter((row) => isVisible(row))
        .map((row) => {
          const cells = Array.from(row.querySelectorAll('td'));
          return exportIndices.map((cellIndex) => getCellText(cells[cellIndex] ?? document.createElement('td')));
        })
        .filter((row) => row.some((value) => value.length > 0));

      const sort = headers
        .map((header, headerIndex) => {
          const sortValue = header.getAttribute('aria-sort');
          if (!sortValue || sortValue === 'none') return null;
          const direction = sortValue === 'ascending' ? 'ASC' : 'DESC';
          if (!exportIndices.includes(headerIndex)) return null;
          return `${allColumns[headerIndex] || getCellText(header)} ${direction}`;
        })
        .filter((value): value is string => Boolean(value));

      return {
        id: `${moduleKey}-${tableIndex + 1}`,
        moduleKey,
        moduleLabel,
        title,
        columns,
        rows,
        filters: baseFilters,
        sort,
        generatedAt: new Date().toLocaleString(),
      };
    })
    .filter((table) => table.columns.length > 0);
}

export function saveModuleReportTables(moduleKey: string, moduleLabel: string, tables: ReportTable[]) {
  const current = getStoredReportTables();
  const others = current.filter((table) => table.moduleKey !== moduleKey);
  const normalized = tables.map((table) => ({ ...table, moduleKey, moduleLabel }));
  const next = [...others, ...normalized];
  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(next));
}

export function getStoredReportTables() {
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEY);
    if (!raw) return [] as ReportTable[];
    const parsed = JSON.parse(raw) as ReportTable[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as ReportTable[];
  }
}

export function collectPageRows(pageName: string, container: HTMLElement | null): ReportRow[] {
  const tables = collectTablesFromContainer(pageName, pageName, container);

  if (tables.length === 0) {
    return [{ section: pageName, metric: 'Info', value: 'No reportable table found' }];
  }

  return tables.flatMap((table) =>
    table.rows.flatMap((row, rowIndex) =>
      row.map((cellValue, cellIndex) => ({
        section: `${table.title} Row ${rowIndex + 1}`,
        metric: table.columns[cellIndex] || `Column ${cellIndex + 1}`,
        value: cellValue,
      }))
    )
  );
}

export function collectRowsFromSelector(pageName: string, selector: string): ReportRow[] {
  const scope = document.querySelector(selector) as HTMLElement | null;
  return collectPageRows(pageName, scope);
}

export function buildCombinedTablePayload(title: string, tables: ReportTable[]): ReportExportPayload {
  const rows = tables.flatMap((table) =>
    table.rows.map((row) => {
      const rowAsRecord = table.columns.reduce<Record<string, string>>((acc, column, index) => {
        acc[column] = row[index] ?? '';
        return acc;
      }, {});

      return [table.title, ...table.columns.map((column) => rowAsRecord[column] ?? '')];
    })
  );

  const allColumns = Array.from(
    new Set(
      tables.flatMap((table) => table.columns)
    )
  );

  const normalizedRows = tables.flatMap((table) =>
    table.rows.map((row) => {
      const rowAsRecord = table.columns.reduce<Record<string, string>>((acc, column, index) => {
        acc[column] = row[index] ?? '';
        return acc;
      }, {});

      return [table.title, ...allColumns.map((column) => rowAsRecord[column] ?? '')];
    })
  );

  return {
    title,
    table: {
      columns: ['Table', ...allColumns],
      rows: normalizedRows.length > 0 ? normalizedRows : rows,
    },
    metadata: {
      generatedAt: new Date().toLocaleString(),
      filters: Array.from(new Set(tables.flatMap((table) => table.filters))),
      sort: Array.from(new Set(tables.flatMap((table) => table.sort))),
    },
  };
}
