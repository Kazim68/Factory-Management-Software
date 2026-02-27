import { useEffect, useMemo, useState } from 'react';
import { auth } from '../lib/auth';
import type { AuditLog } from '../types';
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

          <Select value={actorFilter} onValueChange={setActorFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All users</SelectItem>
              {actorOptions.map((actorName) => (
                <SelectItem key={actorName} value={actorName}>
                  {actorName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.actorName}</TableCell>
                  <TableCell>{log.targetUserName ?? '-'}</TableCell>
                  <TableCell>{log.detail ?? '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
