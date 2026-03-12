import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  exportTableToExcel,
  exportTableToPdf,
  getStoredReportTables,
  printTable,
  type ReportTable,
} from '../lib/report';

type SortDirection = 'asc' | 'desc';

export function CustomReportBuilder() {
  const [reportTables, setReportTables] = useState<ReportTable[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sortColumn, setSortColumn] = useState<string>('none');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [reportTitle, setReportTitle] = useState('Custom Report');

  useEffect(() => {
    const load = () => {
      const tables = getStoredReportTables();
      setReportTables(tables);

      if (!selectedModule && tables.length > 0) {
        setSelectedModule(tables[0].moduleKey);
      }
    };

    load();
    const interval = window.setInterval(load, 1000);
    return () => window.clearInterval(interval);
  }, [selectedModule]);

  const modules = useMemo(() => {
    const map = new Map<string, string>();
    reportTables.forEach((table) => {
      map.set(table.moduleKey, table.moduleLabel);
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [reportTables]);

  const availableTables = useMemo(
    () => reportTables.filter((table) => table.moduleKey === selectedModule),
    [reportTables, selectedModule]
  );

  useEffect(() => {
    if (availableTables.length === 0) {
      setSelectedTableId('');
      return;
    }

    const exists = availableTables.some((table) => table.id === selectedTableId);
    if (!exists) {
      setSelectedTableId(availableTables[0].id);
    }
  }, [availableTables, selectedTableId]);

  const selectedTable = useMemo(
    () => availableTables.find((table) => table.id === selectedTableId) ?? null,
    [availableTables, selectedTableId]
  );

  useEffect(() => {
    if (!selectedTable) {
      setSelectedColumns([]);
      setFilterValues({});
      return;
    }
    setSelectedColumns(selectedTable.columns);
    setFilterValues({});
    setSortColumn('none');
    setReportTitle(`${selectedTable.moduleLabel} - ${selectedTable.title}`);
  }, [selectedTable?.id]);

  const previewRows = useMemo(() => {
    if (!selectedTable) return [] as string[][];

    const filtered = selectedTable.rows.filter((row) =>
      selectedTable.columns.every((column, index) => {
        const filter = filterValues[column]?.trim();
        if (!filter) return true;
        return String(row[index] ?? '').toLowerCase().includes(filter.toLowerCase());
      })
    );

    if (sortColumn === 'none') return filtered;

    const columnIndex = selectedTable.columns.indexOf(sortColumn);
    if (columnIndex < 0) return filtered;

    return [...filtered].sort((a, b) => {
      const left = String(a[columnIndex] ?? '').toLowerCase();
      const right = String(b[columnIndex] ?? '').toLowerCase();
      if (left === right) return 0;
      if (sortDirection === 'asc') return left > right ? 1 : -1;
      return left < right ? 1 : -1;
    });
  }, [selectedTable, filterValues, sortColumn, sortDirection]);

  const previewColumns = useMemo(() => {
    if (!selectedTable) return [] as string[];
    return selectedTable.columns.filter((column) => selectedColumns.includes(column));
  }, [selectedTable, selectedColumns]);

  const projectedRows = useMemo(() => {
    if (!selectedTable) return [] as string[][];
    const indices = previewColumns.map((column) => selectedTable.columns.indexOf(column));
    return previewRows.map((row) => indices.map((index) => row[index] ?? ''));
  }, [selectedTable, previewRows, previewColumns]);

  const appliedFilters = useMemo(() => {
    const customFilters = Object.entries(filterValues)
      .filter(([, value]) => value.trim().length > 0)
      .map(([column, value]) => `${column}: ${value.trim()}`);

    if (!selectedTable) return customFilters;
    return [...selectedTable.filters, ...customFilters];
  }, [filterValues, selectedTable]);

  const payload = useMemo(() => {
    const sortMeta = sortColumn !== 'none' ? [`${sortColumn} ${sortDirection.toUpperCase()}`] : selectedTable?.sort ?? [];
    return {
      title: reportTitle || 'Custom Report',
      table: {
        columns: previewColumns,
        rows: projectedRows,
      },
      metadata: {
        generatedAt: new Date().toLocaleString(),
        filters: appliedFilters,
        sort: sortMeta,
      },
    };
  }, [reportTitle, previewColumns, projectedRows, appliedFilters, sortColumn, sortDirection, selectedTable]);

  const toggleColumn = (column: string) => {
    setSelectedColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2">Custom Report Builder</h2>
        <p className="text-muted-foreground">
          Choose a module and table snapshot, pick fields, apply filters, preview, and export.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Module</Label>
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger>
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.key} value={module.key}>
                      {module.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Table</Label>
              <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select table" />
                </SelectTrigger>
                <SelectContent>
                  {availableTables.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Report title</Label>
              <Input value={reportTitle} onChange={(event) => setReportTitle(event.target.value)} />
            </div>
          </div>

          {selectedTable && (
            <>
              <div className="space-y-2">
                <Label>Fields / columns</Label>
                <div className="grid gap-2 md:grid-cols-3">
                  {selectedTable.columns.map((column) => (
                    <label key={column} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
                      <Checkbox checked={selectedColumns.includes(column)} onCheckedChange={() => toggleColumn(column)} />
                      <span className="text-sm">{column}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Filters</Label>
                <div className="grid gap-2 md:grid-cols-3">
                  {selectedTable.columns.map((column) => (
                    <div key={column} className="space-y-1">
                      <Label className="text-xs">{column}</Label>
                      <Input
                        value={filterValues[column] ?? ''}
                        onChange={(event) =>
                          setFilterValues((current) => ({ ...current, [column]: event.target.value }))
                        }
                        placeholder={`Filter ${column}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Sort by</Label>
                  <Select value={sortColumn} onValueChange={setSortColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder="No sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No sort</SelectItem>
                      {selectedTable.columns.map((column) => (
                        <SelectItem key={column} value={column}>
                          {column}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <Select value={sortDirection} onValueChange={(value) => setSortDirection(value as SortDirection)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedTable || previewColumns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Select a table and at least one field to preview.</p>
          ) : (
            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    {previewColumns.map((column) => (
                      <th key={column} className="p-2 text-left">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projectedRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b">
                      {row.map((cell, cellIndex) => (
                        <td key={`${rowIndex}-${cellIndex}`} className="p-2">{cell}</td>
                      ))}
                    </tr>
                  ))}
                  {projectedRows.length === 0 && (
                    <tr>
                      <td className="p-3 text-muted-foreground" colSpan={previewColumns.length}>No rows match the selected filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Label className="text-sm">Generate custom report:</Label>
            <Button onClick={() => exportTableToExcel(payload)} disabled={previewColumns.length === 0}>Excel</Button>
            <Button variant="secondary" onClick={() => exportTableToPdf(payload)} disabled={previewColumns.length === 0}>PDF</Button>
            <Button variant="outline" onClick={() => printTable(payload)} disabled={previewColumns.length === 0}>Print</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
