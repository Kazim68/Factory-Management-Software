import { FileOutput } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { collectRowsFromSelector, exportRowsToExcel, exportRowsToPdf, printRows } from '../lib/report';

interface TabReportActionsProps {
  title: string;
  selector: string;
}

export function TabReportActions({ title, selector }: TabReportActionsProps) {
  const runReportAction = (type: 'excel' | 'pdf' | 'print') => {
    const rows = collectRowsFromSelector(title, selector);

    if (type === 'excel') {
      exportRowsToExcel(title, rows);
      toast.success('Excel report generated');
      return;
    }

    if (type === 'pdf') {
      exportRowsToPdf(title, rows);
      toast.success('PDF print dialog opened');
      return;
    }

    printRows(title, rows);
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
