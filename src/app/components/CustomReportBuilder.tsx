import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { buildCombinedTablePayload, exportTableToExcel, exportTableToPdf, getStoredReportTables, printTable, type ReportTable } from '../lib/report';

export function CustomReportBuilder() {
  const [reportTables, setReportTables] = useState<ReportTable[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [reportTitle, setReportTitle] = useState('Custom Report');

  useEffect(() => {
    const load = () => setReportTables(getStoredReportTables());
    load();
    const interval = window.setInterval(load, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const modules = useMemo(() => {
    const map = new Map<string, string>();
    reportTables.forEach((table) => map.set(table.moduleKey, table.moduleLabel));
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [reportTables]);

  const scopedTables = useMemo(
    () => (selectedModule === 'all' ? reportTables : reportTables.filter((table) => table.moduleKey === selectedModule)),
    [reportTables, selectedModule]
  );

  const availableColumns = useMemo(
    () => Array.from(new Set(scopedTables.flatMap((table) => table.columns))),
    [scopedTables]
  );

  useEffect(() => {
    setSelectedColumns(availableColumns);
    if (selectedModule === 'all') {
      setReportTitle('Custom Report - All Modules');
    } else {
      const label = modules.find((module) => module.key === selectedModule)?.label ?? selectedModule;
      setReportTitle(`Custom Report - ${label}`);
    }
  }, [availableColumns, selectedModule, modules]);

  const payload = useMemo(() => {
    const combined = buildCombinedTablePayload(reportTitle || 'Custom Report', scopedTables);
    const filteredColumns = ['Table', ...combined.table.columns.filter((column) => column !== 'Table' && selectedColumns.includes(column))];
    const selectedIndices = filteredColumns.map((column) => combined.table.columns.indexOf(column)).filter((index) => index >= 0);

    const filteredRows = combined.table.rows
      .filter((row) => {
        if (!search.trim()) return true;
        const query = search.toLowerCase();
        return row.some((cell) => String(cell).toLowerCase().includes(query));
      })
      .map((row) => selectedIndices.map((index) => row[index] ?? ''));

    return {
      ...combined,
      table: {
        columns: filteredColumns,
        rows: filteredRows,
      },
      metadata: {
        ...combined.metadata,
        filters: [...(combined.metadata?.filters ?? []), ...(search.trim() ? [`Search: ${search.trim()}`] : [])],
      },
    };
  }, [reportTitle, scopedTables, selectedColumns, search]);

  const toggleColumn = (column: string) => {
    setSelectedColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2">Custom Report Builder</h2>
        <p className="text-muted-foreground">Select one module (or all modules), choose columns once, then export all table data together.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Module scope</Label>
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger>
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>
                  {modules.map((module) => (
                    <SelectItem key={module.key} value={module.key}>{module.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Search rows</Label>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search in all selected tables" />
            </div>
            <div className="space-y-2">
              <Label>Report title</Label>
              <Input value={reportTitle} onChange={(event) => setReportTitle(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Columns</Label>
            <div className="grid gap-2 md:grid-cols-3">
              {availableColumns.map((column) => (
                <label key={column} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
                  <Checkbox checked={selectedColumns.includes(column)} onCheckedChange={() => toggleColumn(column)} />
                  <span className="text-sm">{column}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {payload.table.columns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No table data found for the selected scope.</p>
          ) : (
            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    {payload.table.columns.map((column) => (
                      <th key={column} className="p-2 text-left">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payload.table.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b">
                      {row.map((cell, cellIndex) => (
                        <td key={`${rowIndex}-${cellIndex}`} className="p-2">{cell}</td>
                      ))}
                    </tr>
                  ))}
                  {payload.table.rows.length === 0 && (
                    <tr>
                      <td className="p-3 text-muted-foreground" colSpan={payload.table.columns.length}>No rows found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Label className="text-sm">Generate custom report:</Label>
            <Button onClick={() => exportTableToExcel(payload)} disabled={payload.table.columns.length === 0}>Excel</Button>
            <Button variant="secondary" onClick={() => exportTableToPdf(payload)} disabled={payload.table.columns.length === 0}>PDF</Button>
            <Button variant="outline" onClick={() => printTable(payload)} disabled={payload.table.columns.length === 0}>Print</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
