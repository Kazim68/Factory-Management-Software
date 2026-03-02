interface ReportRow {
  section: string;
  metric: string;
  value: string | number;
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
  const normalized = String(value).replace(/\"/g, '""');
  return `"${normalized}"`;
}

export function exportRowsToExcel(title: string, rows: ReportRow[]) {
  const csvHeader = ['Section', 'Metric', 'Value'];
  const csvBody = rows.map((row) =>
    [sanitizeCsvValue(row.section), sanitizeCsvValue(row.metric), sanitizeCsvValue(row.value)].join(',')
  );
  const csv = [csvHeader.join(','), ...csvBody].join('\n');

  downloadBlob(
    `${title.toLowerCase().replace(/\s+/g, '-')}-report.xls`,
    csv,
    'application/vnd.ms-excel;charset=utf-8;'
  );
}

function openReportWindow(title: string, htmlContent: string) {
  const printWindow = window.open('', '_blank', 'width=1000,height=700');
  if (!printWindow) return null;

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { margin-bottom: 4px; }
          p { color: #666; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
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

function buildHtmlTable(title: string, rows: ReportRow[]) {
  const renderedRows = rows
    .map(
      (row) => `<tr><td>${row.section}</td><td>${row.metric}</td><td>${String(row.value)}</td></tr>`
    )
    .join('');

  return `
    <h1>${title}</h1>
    <p>Generated on ${new Date().toLocaleString()}</p>
    <table>
      <thead>
        <tr>
          <th>Section</th>
          <th>Metric</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        ${renderedRows}
      </tbody>
    </table>
  `;
}

export function printRows(title: string, rows: ReportRow[]) {
  const html = buildHtmlTable(title, rows);
  const printWindow = openReportWindow(title, html);
  printWindow?.print();
}

export function exportRowsToPdf(title: string, rows: ReportRow[]) {
  const html = buildHtmlTable(`${title} (PDF)`, rows);
  const printWindow = openReportWindow(title, html);
  printWindow?.print();
}

export function collectPageRows(pageName: string, container: HTMLElement | null): ReportRow[] {
  if (!container) {
    return [{ section: pageName, metric: 'Info', value: 'No content found' }];
  }

  const rows: ReportRow[] = [];
  const cards = container.querySelectorAll('[class*="Card"], [data-slot="card"]');

  if (cards.length > 0) {
    cards.forEach((card, index) => {
      const title = card.querySelector('h1, h2, h3, h4, [data-slot="card-title"]')?.textContent?.trim();
      const text = card.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (text) {
        rows.push({
          section: title || `${pageName} Card ${index + 1}`,
          metric: 'Summary',
          value: text.slice(0, 160),
        });
      }
    });
  }

  const tables = Array.from(container.querySelectorAll('table'));
  tables.forEach((table, tableIndex) => {
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) =>
      th.textContent?.trim() || ''
    );
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));

    bodyRows.forEach((tr, rowIndex) => {
      const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim() || '');
      if (cells.length > 0) {
        rows.push({
          section: `${pageName} Table ${tableIndex + 1}`,
          metric: headers.length > 0 ? headers.join(' | ') : `Row ${rowIndex + 1}`,
          value: cells.join(' | '),
        });
      }
    });
  });

  if (rows.length === 0) {
    const pageText = container.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    rows.push({
      section: pageName,
      metric: 'Snapshot',
      value: pageText.slice(0, 220) || 'No reportable data found',
    });
  }

  return rows;
}

export type { ReportRow };
