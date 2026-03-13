import { FileOutput } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { buildCombinedTablePayload, collectTablesFromContainer, exportTableToExcel, exportTableToPdf, printTable } from '../lib/report';

interface TabReportActionsProps {
  title: string;
  selector: string;
}

export function TabReportActions({ title, selector }: TabReportActionsProps) {
  const runReportAction = (type: 'excel' | 'pdf' | 'print') => {
    const scope = document.querySelector(selector) as HTMLElement | null;
    const tables = collectTablesFromContainer('tab-report', title, scope);

    if (tables.length === 0) {
      toast.error('No table found in this tab');
      return;
    }

    const payload = buildCombinedTablePayload(title, tables);

    if (type === 'excel') {
      exportTableToExcel(payload);
      toast.success('Excel report generated');
      return;
    }

    if (type === 'pdf') {
      exportTableToPdf(payload);
      toast.success('PDF print dialog opened');
      return;
    }

    printTable(payload);
    toast.success('Print dialog opened');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FileOutput className="h-4 w-4 mr-2" />
          Export Current Tab
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => runReportAction('excel')}>Export to Excel</DropdownMenuItem>
        <DropdownMenuItem onClick={() => runReportAction('pdf')}>Export to PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={() => runReportAction('print')}>Direct Print</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
