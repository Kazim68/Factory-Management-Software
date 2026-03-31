import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import { configApi, productionApi } from "../lib/api";
import type {
  ApiArticle,
  ApiStockArticleRow,
  ApiStockEntry,
  ApiStockMode,
  ApiStockSummary,
} from "../types/api";
import type { UserRole } from "../types";
import { toast } from "sonner";

const emptySummary: ApiStockSummary = {
  activeOrders: 0,
  wipDozen: 0,
  readyStockDozen: 0,
  packedStockDozen: 0,
};

const createManualStockForm = (articleId = "") => ({
  articleId,
  mode: "IN_STOCK" as ApiStockMode,
  quantityDozen: "",
  note: "",
});

export function StockControl({
  currentUserRole,
}: {
  currentUserRole: UserRole;
}) {
  const canManageManualStock =
    currentUserRole === "admin" || currentUserRole === "super_admin";

  const [mode, setMode] = useState<ApiStockMode>("IN_STOCK");
  const [query, setQuery] = useState("");
  const [summary, setSummary] = useState<ApiStockSummary>(emptySummary);
  const [rows, setRows] = useState<ApiStockArticleRow[]>([]);
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [manualEntries, setManualEntries] = useState<ApiStockEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isManualLoading, setIsManualLoading] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ApiStockEntry | null>(null);
  const [manualForm, setManualForm] = useState(createManualStockForm());

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

  const loadManualEntries = async () => {
    if (!canManageManualStock) return;

    setIsManualLoading(true);
    try {
      const data = await productionApi.listManualStockEntries();
      setManualEntries(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load manual stock entries.");
    } finally {
      setIsManualLoading(false);
    }
  };

  const loadArticles = async () => {
    if (!canManageManualStock) return;

    try {
      const data = await configApi.listArticles();
      setArticles(data);
      setManualForm((prev) =>
        prev.articleId || data.length === 0
          ? prev
          : { ...prev, articleId: data[0].id }
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to load articles.");
    }
  };

  const refreshStockData = async () => {
    await Promise.all([loadSummary(), loadRows(mode, query), loadManualEntries()]);
  };

  useEffect(() => {
    loadSummary();
    if (canManageManualStock) {
      loadManualEntries();
      loadArticles();
    }
  }, [canManageManualStock]);

  useEffect(() => {
    loadRows(mode, query);
  }, [mode, query]);

  const resetManualForm = () => {
    setEditingEntry(null);
    setManualForm(createManualStockForm(articles[0]?.id ?? ""));
  };

  const openCreateDialog = () => {
    setEditingEntry(null);
    setManualForm(createManualStockForm(articles[0]?.id ?? ""));
    setManualDialogOpen(true);
  };

  const openEditDialog = (entry: ApiStockEntry) => {
    setEditingEntry(entry);
    setManualForm({
      articleId: entry.articleId,
      mode: entry.mode,
      quantityDozen: String(entry.quantityDozen),
      note: entry.note || "",
    });
    setManualDialogOpen(true);
  };

  const handleManualSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const quantityDozen = Number(manualForm.quantityDozen);
    if (!manualForm.articleId) {
      toast.error("Please select an article.");
      return;
    }
    if (!Number.isFinite(quantityDozen) || quantityDozen <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }

    try {
      if (editingEntry) {
        await productionApi.updateManualStockEntry(editingEntry.id, {
          articleId: manualForm.articleId,
          mode: manualForm.mode,
          quantityDozen,
          note: manualForm.note.trim() || null,
        });
        toast.success("Manual stock updated.");
      } else {
        await productionApi.createManualStockEntry({
          articleId: manualForm.articleId,
          mode: manualForm.mode,
          quantityDozen,
          note: manualForm.note.trim() || undefined,
        });
        toast.success("Manual stock added.");
      }

      setManualDialogOpen(false);
      resetManualForm();
      await refreshStockData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save manual stock.");
    }
  };

  const handleManualDelete = async (entry: ApiStockEntry) => {
    if (!confirm("Delete this manual stock entry?")) return;

    try {
      await productionApi.deleteManualStockEntry(entry.id);
      toast.success("Manual stock entry deleted.");
      await refreshStockData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete manual stock entry.");
    }
  };

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
            <div className="text-2xl text-green-600">
              {summary.readyStockDozen}
            </div>
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
              <Tabs
                value={mode}
                onValueChange={(value) => setMode(value as ApiStockMode)}
              >
                <TabsList>
                  <TabsTrigger value="IN_STOCK">In Stock</TabsTrigger>
                  <TabsTrigger value="PACKED">Packed</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>
                    {mode === "PACKED" ? "A-Mall (Dozen)" : "Quantity (Dozen)"}
                  </TableHead>
                  {mode === "PACKED" && <TableHead>B-Mall (Dozen)</TableHead>}
                  {mode === "PACKED" && <TableHead>C-Mall (Dozen)</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={mode === "PACKED" ? 4 : 2}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Loading stock rows...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={mode === "PACKED" ? 4 : 2}
                      className="text-center text-sm text-muted-foreground"
                    >
                      No articles found for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.articleId}>
                      <TableCell>{row.articleName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.quantityDozen}</Badge>
                      </TableCell>
                      {mode === "PACKED" && (
                        <TableCell>
                          <Badge variant="secondary">{row.bMallDozen}</Badge>
                        </TableCell>
                      )}
                      {mode === "PACKED" && (
                        <TableCell>
                          <Badge variant="secondary">{row.cMallDozen}</Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {canManageManualStock && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Manual Stock Entries</CardTitle>
              <p className="text-sm text-muted-foreground">
                Admin and super admin can add stock directly and manage it here.
              </p>
            </div>
            <Dialog
              open={manualDialogOpen}
              onOpenChange={(open) => {
                setManualDialogOpen(open);
                if (!open) resetManualForm();
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} disabled={articles.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Stock
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingEntry ? "Edit Manual Stock" : "Add Manual Stock"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <Label>Article</Label>
                    <Select
                      value={manualForm.articleId}
                      onValueChange={(value) =>
                        setManualForm((prev) => ({ ...prev, articleId: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select article" />
                      </SelectTrigger>
                      <SelectContent>
                        {articles.map((article) => (
                          <SelectItem key={article.id} value={article.id}>
                            {article.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Stock Type</Label>
                    <Select
                      value={manualForm.mode}
                      onValueChange={(value) =>
                        setManualForm((prev) => ({
                          ...prev,
                          mode: value as ApiStockMode,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IN_STOCK">In Stock</SelectItem>
                        <SelectItem value="PACKED">Packed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quantity (Dozen)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={manualForm.quantityDozen}
                      onChange={(e) =>
                        setManualForm((prev) => ({
                          ...prev,
                          quantityDozen: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Note</Label>
                    <Textarea
                      value={manualForm.note}
                      onChange={(e) =>
                        setManualForm((prev) => ({
                          ...prev,
                          note: e.target.value,
                        }))
                      }
                      placeholder="Optional note"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setManualDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingEntry ? "Update Stock" : "Add Stock"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {articles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add at least one article in Configuration before adding stock.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity (Dozen)</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isManualLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-sm text-muted-foreground"
                      >
                        Loading manual stock entries...
                      </TableCell>
                    </TableRow>
                  ) : manualEntries.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No manual stock entries yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    manualEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.article?.name || "-"}</TableCell>
                        <TableCell>
                          {entry.mode === "PACKED" ? "Packed" : "In Stock"}
                        </TableCell>
                        <TableCell>{entry.quantityDozen}</TableCell>
                        <TableCell>{entry.note || "-"}</TableCell>
                        <TableCell>
                          {new Date(entry.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => openEditDialog(entry)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleManualDelete(entry)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
