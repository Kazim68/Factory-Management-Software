import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { productionApi } from "../lib/api";
import type { ApiStockArticleRow, ApiStockMode, ApiStockSummary } from "../types/api";
import { toast } from "sonner";

const emptySummary: ApiStockSummary = {
  activeOrders: 0,
  wipDozen: 0,
  readyStockDozen: 0,
  packedStockDozen: 0,
};

export function StockControl() {
  const [mode, setMode] = useState<ApiStockMode>("IN_STOCK");
  const [query, setQuery] = useState("");
  const [summary, setSummary] = useState<ApiStockSummary>(emptySummary);
  const [rows, setRows] = useState<ApiStockArticleRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSummary = async () => {
    try {
      const data = await productionApi.getStockSummary();
      setSummary(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load stock summary.");
    }
  };

  const loadRows = async (nextMode: ApiStockMode, nextQuery: string) => {
    setIsLoading(true);
    try {
      const data = await productionApi.listStockByArticle({
        mode: nextMode,
        q: nextQuery,
      });
      setRows(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load stock list.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    loadRows(mode, query);
  }, [mode, query]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">
          Shoes stock analytics and article-wise stock visibility.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{summary.activeOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">WIP (Dozen)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{summary.wipDozen}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ready Stock (Dozen)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600">{summary.readyStockDozen}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Packed Stock (Dozen)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{summary.packedStockDozen}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Article Stock List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1 max-w-[420px]">
              <Label
                htmlFor="stock-article-search"
                className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground"
              >
                Search Article
              </Label>
              <Input
                id="stock-article-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by article name/code..."
              />
            </div>
            <div>
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                Stock Filter
              </Label>
              <Tabs value={mode} onValueChange={(value) => setMode(value as ApiStockMode)}>
                <TabsList>
                  <TabsTrigger value="IN_STOCK">In Stock</TabsTrigger>
                  <TabsTrigger value="PACKED">Packed</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="rounded border">
            <div className="grid grid-cols-[1fr_auto] gap-2 border-b bg-muted/50 px-4 py-2 text-sm">
              <span>Article</span>
              <span>Quantity (Dozen)</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {isLoading ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Loading stock rows...
                </div>
              ) : rows.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No articles found for this filter.
                </div>
              ) : (
                rows.map((row) => (
                  <div
                    key={row.articleId}
                    className="grid grid-cols-[1fr_auto] items-center gap-2 border-b px-4 py-3 last:border-b-0"
                  >
                    <span>{row.articleName}</span>
                    <Badge variant="secondary">{row.quantityDozen}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
