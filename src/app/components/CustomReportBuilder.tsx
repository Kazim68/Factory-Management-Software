import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { exportRowsToExcel, exportRowsToPdf, printRows, type ReportRow } from '../lib/report';

type ReportWidget = {
  id: string;
  section: string;
  metric: string;
  value: string;
};

const widgets: ReportWidget[] = [
  { id: 'rev', section: 'Finance', metric: 'Revenue Overview', value: 'Current billing and collection snapshot' },
  { id: 'exp', section: 'Finance', metric: 'Expense Overview', value: 'Operational and miscellaneous expenses' },
  { id: 'party', section: 'Parties', metric: 'Party Activity', value: 'Recent customer/supplier transactions' },
  { id: 'bill', section: 'Bills', metric: 'Bill Status', value: 'Generated, pending and paid bill trends' },
  { id: 'labor', section: 'Labor', metric: 'Labor Summary', value: 'Attendance, earnings and advances summary' },
  { id: 'stock', section: 'Inventory', metric: 'Stock Summary', value: 'Chemicals, rexine and materials positions' },
  { id: 'audit', section: 'Security', metric: 'Audit Trace', value: 'Recent changes and user activity trail' },
];

export function CustomReportBuilder() {
  const [selected, setSelected] = useState<string[]>(['rev', 'exp']);

  const reportRows = useMemo<ReportRow[]>(
    () =>
      widgets
        .filter((widget) => selected.includes(widget.id))
        .map((widget) => ({
          section: widget.section,
          metric: widget.metric,
          value: widget.value,
        })),
    [selected]
  );

  const toggleWidget = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2">Custom Report Builder</h2>
        <p className="text-muted-foreground">
          Build your own report by clicking the sections you want, then export to Excel, PDF, or print directly.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select report sections</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {widgets.map((widget) => (
            <label
              key={widget.id}
              className="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
            >
              <Checkbox
                checked={selected.includes(widget.id)}
                onCheckedChange={() => toggleWidget(widget.id)}
              />
              <div>
                <div className="font-medium">{widget.metric}</div>
                <div className="text-sm text-muted-foreground">{widget.value}</div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reportRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sections selected.</p>
          ) : (
            reportRows.map((row, index) => (
              <div key={`${row.metric}-${index}`} className="rounded-md border p-3">
                <p className="text-sm font-medium">{row.section} - {row.metric}</p>
                <p className="text-sm text-muted-foreground">{row.value}</p>
              </div>
            ))
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Label className="text-sm">Generate custom report:</Label>
            <Button onClick={() => exportRowsToExcel('Custom Report', reportRows)} disabled={reportRows.length === 0}>Excel</Button>
            <Button variant="secondary" onClick={() => exportRowsToPdf('Custom Report', reportRows)} disabled={reportRows.length === 0}>PDF</Button>
            <Button variant="outline" onClick={() => printRows('Custom Report', reportRows)} disabled={reportRows.length === 0}>Print</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
