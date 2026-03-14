import { FileOutput } from "lucide-react";
import { Button } from "./ui/button";

interface TabReportActionsProps {
  title: string;
  selector: string;
}

export function TabReportActions({ title, selector }: TabReportActionsProps) {
  void title;
  void selector;

  return (
    <Button variant="outline" size="sm" disabled>
      <FileOutput className="h-4 w-4 mr-2" />
      Reports Coming Soon
    </Button>
  );
}
