import { useEffect, useState } from 'react';
import { auth } from '../lib/auth';
import type { AuditLog } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

export function AuditLogs() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const loadLogs = () => setAuditLogs(auth.listAuditLogs());
    loadLogs();

    const timer = window.setInterval(loadLogs, 3000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Done By</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No audit logs yet.
                </TableCell>
              </TableRow>
            ) : (
              auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.actorName}</TableCell>
                  <TableCell>{log.entity ?? '-'}</TableCell>
                  <TableCell>{log.resourceId ?? log.targetUserName ?? '-'}</TableCell>
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
