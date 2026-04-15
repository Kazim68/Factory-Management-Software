import { useEffect, useMemo, useState } from 'react';
import { auth } from '../lib/auth';
import type { AuditLog } from '../types';
import { useClientPagination } from '../hooks/useClientPagination';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { TablePagination } from './ui/table-pagination';
import { SearchableSelect } from './ui/searchable-select';
import { formatDateTime } from '../lib/utils';

export function AuditLogs() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<'ALL' | 'CREATED' | 'UPDATED' | 'DELETED'>('ALL');
  const [actorFilter, setActorFilter] = useState('ALL');

  useEffect(() => {
    setAuditLogs(auth.listAuditLogs());
  }, []);

  const actorOptions = useMemo(
    () => Array.from(new Set(auditLogs.map((log) => log.actorName))).sort((a, b) => a.localeCompare(b)),
    [auditLogs],
  );
  const actorFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All users' },
      ...actorOptions.map((actorName) => ({ value: actorName, label: actorName })),
    ],
    [actorOptions],
  );

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return auditLogs.filter((log) => {
      const matchesAction =
        actionFilter === 'ALL' || log.action.toUpperCase().includes(actionFilter.toUpperCase());
      const matchesActor = actorFilter === 'ALL' || log.actorName === actorFilter;
      const matchesSearch =
        !term ||
        log.action.toLowerCase().includes(term) ||
        log.actorName.toLowerCase().includes(term) ||
        (log.targetUserName ?? '').toLowerCase().includes(term) ||
        (log.detail ?? '').toLowerCase().includes(term);

      return matchesAction && matchesActor && matchesSearch;
    });
  }, [actionFilter, actorFilter, auditLogs, search]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems,
    startItem,
    endItem,
    paginatedItems,
    goToPreviousPage,
    goToNextPage,
  } = useClientPagination(filteredLogs);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search action, user, or details"
          />

          <Select value={actionFilter} onValueChange={(value) => setActionFilter(value as typeof actionFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All actions</SelectItem>
              <SelectItem value="CREATED">Created</SelectItem>
              <SelectItem value="UPDATED">Updated</SelectItem>
              <SelectItem value="DELETED">Deleted</SelectItem>
            </SelectContent>
          </Select>

          <SearchableSelect
            value={actorFilter}
            onValueChange={setActorFilter}
            options={actorFilterOptions}
            placeholder="Filter by user"
            searchPlaceholder="Search user..."
            emptyMessage="No users found."
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Done By</TableHead>
              <TableHead>Target User</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No matching audit logs.
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDateTime(log.timestamp)}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.actorName}</TableCell>
                  <TableCell>{log.targetUserName ?? '-'}</TableCell>
                  <TableCell>{log.detail ?? '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          startItem={startItem}
          endItem={endItem}
          pageSize={pageSize}
          setPageSize={setPageSize}
          goToPreviousPage={goToPreviousPage}
          goToNextPage={goToNextPage}
          setCurrentPage={setCurrentPage}
        />
      </CardContent>
    </Card>
  );
}
