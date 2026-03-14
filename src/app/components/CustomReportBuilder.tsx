import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function CustomReportBuilder() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2">Reports</h2>
        <p className="text-muted-foreground">
          The previous DOM/table-based report logic has been removed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backend Reports Pending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Next step is to build report endpoints and query them directly from
            the app.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
