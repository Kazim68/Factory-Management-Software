import { useEffect, useMemo, useState } from "react";
import { Filter, Pencil, Plus, Trash2 } from "lucide-react";
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
import { SearchableSelect } from "./ui/searchable-select";
import { Textarea } from "./ui/textarea";
import { configApi, productionApi } from "../lib/api";
import {
  FILTER_TIME_PRESET_OPTIONS,
  getPresetDateRange,
  type FilterTimePreset,
} from "../lib/time-presets";
import { formatCurrency, formatDate, getCurrentDate } from "../lib/utils";
import { useClientPagination } from "../hooks/useClientPagination";
import type {
  ApiArticle,
  ApiMallStockMovement,
  ApiMallStockType,
  ApiStockArticleRow,
  ApiStockEntry,
  ApiStockMode,
  ApiStockMovementDirection,
  ApiStockSummary,
} from "../types/api";
import type { UserRole } from "../types";
import { TablePagination } from "./ui/table-pagination";
import { toast } from "sonner";

const emptySummary: ApiStockSummary = {
  activeOrders: 0,
  wipDozen: 0,
  readyStockDozen: 0,
  packedStockDozen: 0,
  packedAMallDozen: 0,
  packedBMallDozen: 0,
  packedCMallDozen: 0,
};

const toSafeArray = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

const toSafeSummary = (value: unknown): ApiStockSummary => ({
  ...emptySummary,
  ...(value && typeof value === "object" ? (value as Partial<ApiStockSummary>) : {}),
});

const createManualStockForm = (articleId = "") => ({
  articleId,
  mode: "IN_STOCK" as ApiStockMode,
  quantityDozen: "",
  note: "",
});

const createMallMovementForm = () => ({
  mallType: "B_MALL" as ApiMallStockType,
  direction: "OUT" as ApiStockMovementDirection,
  date: getCurrentDate(),
  quantityDozen: "",
  ratePerDozen: "",
  reference: "",
  note: "",
});

const getMallTypeLabel = (mallType: ApiMallStockType) =>
  mallType === "C_MALL" ? "C-Mall" : "B-Mall";

const getMallDirectionLabel = (
  mallType: ApiMallStockType,
  direction: ApiStockMovementDirection,
) => {
  if (direction === "IN") return "Add / Adjust";
  return mallType === "C_MALL" ? "One-Time Sale" : "Mixed Sale";
};

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
  const [mallMovements, setMallMovements] = useState<ApiMallStockMovement[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isManualLoading, setIsManualLoading] = useState(false);
  const [isMallLoading, setIsMallLoading] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [mallDialogOpen, setMallDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ApiStockEntry | null>(null);
  const [editingMallMovement, setEditingMallMovement] =
    useState<ApiMallStockMovement | null>(null);
  const [mallSearchQuery, setMallSearchQuery] = useState("");
  const [mallTypeFilter, setMallTypeFilter] = useState<
    "ALL" | ApiMallStockType
  >("ALL");
  const [mallDirectionFilter, setMallDirectionFilter] = useState<
    "ALL" | ApiStockMovementDirection
  >("ALL");
  const [mallTimePreset, setMallTimePreset] =
    useState<FilterTimePreset>("THIS_MONTH");
  const [mallDateFrom, setMallDateFrom] = useState("");
  const [mallDateTo, setMallDateTo] = useState("");
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [manualModeFilter, setManualModeFilter] = useState<
    "ALL" | ApiStockMode
  >("ALL");
  const [manualForm, setManualForm] = useState(createManualStockForm());
  const [mallForm, setMallForm] = useState(createMallMovementForm());

  const loadSummary = async () => {
    try {
      const data = await productionApi.getStockSummary();
      setSummary(toSafeSummary(data));
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
      setRows(toSafeArray<ApiStockArticleRow>(data));
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
      setManualEntries(toSafeArray<ApiStockEntry>(data));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load manual stock entries.");
    } finally {
      setIsManualLoading(false);
    }
  };

  const loadMallMovements = async () => {
    setIsMallLoading(true);
    try {
      const data = await productionApi.listMallStockMovements();
      setMallMovements(toSafeArray<ApiMallStockMovement>(data));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load B/C mall stock history.");
    } finally {
      setIsMallLoading(false);
    }
  };

  const loadArticles = async () => {
    if (!canManageManualStock) return;

    try {
      const data = await configApi.listArticles();
      const safeArticles = toSafeArray<ApiArticle>(data);
      setArticles(safeArticles);
      setManualForm((prev) =>
        prev.articleId || safeArticles.length === 0
          ? prev
          : { ...prev, articleId: safeArticles[0].id },
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to load articles.");
    }
  };

  const refreshStockData = async () => {
    await Promise.all([
      loadSummary(),
      loadRows(mode, query),
      loadManualEntries(),
      loadMallMovements(),
    ]);
  };

  useEffect(() => {
    loadSummary();
    loadMallMovements();
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

  const resetMallForm = () => {
    setEditingMallMovement(null);
    setMallForm(createMallMovementForm());
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

  const openCreateMallDialog = () => {
    setEditingMallMovement(null);
    setMallForm(createMallMovementForm());
    setMallDialogOpen(true);
  };

  const openEditMallDialog = (entry: ApiMallStockMovement) => {
    setEditingMallMovement(entry);
    setMallForm({
      mallType: entry.mallType,
      direction: entry.direction,
      date: entry.date.slice(0, 10),
      quantityDozen: String(entry.quantityDozen),
      ratePerDozen:
        entry.ratePerDozen == null ? "" : String(entry.ratePerDozen),
      reference: entry.reference || "",
      note: entry.note || "",
    });
    setMallDialogOpen(true);
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

  const handleMallSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const quantityDozen = Number(mallForm.quantityDozen);
    const ratePerDozen = Number(mallForm.ratePerDozen);
    if (!Number.isFinite(quantityDozen) || quantityDozen <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }
    if (
      mallForm.direction === "OUT" &&
      (!Number.isFinite(ratePerDozen) || ratePerDozen <= 0)
    ) {
      toast.error("Enter a valid price per pair.");
      return;
    }

    try {
      if (editingMallMovement) {
        await productionApi.updateMallStockMovement(editingMallMovement.id, {
          mallType: mallForm.mallType,
          direction: mallForm.direction,
          date: mallForm.date,
          quantityDozen,
          ratePerDozen:
            mallForm.direction === "OUT" ? ratePerDozen : null,
          reference: mallForm.reference.trim() || null,
          note: mallForm.note.trim() || null,
        });
        toast.success("Mall stock movement updated.");
      } else {
        await productionApi.createMallStockMovement({
          mallType: mallForm.mallType,
          direction: mallForm.direction,
          date: mallForm.date,
          quantityDozen,
          ratePerDozen:
            mallForm.direction === "OUT" ? ratePerDozen : undefined,
          reference: mallForm.reference.trim() || undefined,
          note: mallForm.note.trim() || undefined,
        });
        toast.success("Mall stock movement recorded.");
      }

      setMallDialogOpen(false);
      resetMallForm();
      await refreshStockData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save B/C mall movement.");
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

  const handleMallDelete = async (entry: ApiMallStockMovement) => {
    if (!confirm("Delete this B/C mall stock entry?")) return;

    try {
      await productionApi.deleteMallStockMovement(entry.id);
      toast.success("Mall stock movement deleted.");
      await refreshStockData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete B/C mall stock entry.");
    }
  };

  const mallSaleTotal =
    Number(mallForm.quantityDozen || 0) *
    12 *
    Number(mallForm.ratePerDozen || 0);

  const filteredMallMovements = useMemo(() => {
    const query = mallSearchQuery.trim().toLowerCase();
    let fromTs: number | null = null;
    let toTs: number | null = null;

    if (mallTimePreset === "CUSTOM") {
      fromTs = mallDateFrom
        ? new Date(`${mallDateFrom}T00:00:00`).getTime()
        : null;
      toTs = mallDateTo ? new Date(`${mallDateTo}T23:59:59.999`).getTime() : null;
    } else {
      const range = getPresetDateRange(mallTimePreset, new Date());
      fromTs = range?.from.getTime() ?? null;
      toTs = range?.to.getTime() ?? null;
    }

    return mallMovements.filter((entry) => {
      if (mallTypeFilter !== "ALL" && entry.mallType !== mallTypeFilter) {
        return false;
      }
      if (
        mallDirectionFilter !== "ALL" &&
        entry.direction !== mallDirectionFilter
      ) {
        return false;
      }

      const entryTs = new Date(entry.date).getTime();
      if (fromTs !== null && entryTs < fromTs) return false;
      if (toTs !== null && entryTs > toTs) return false;

      if (!query) return true;

      return [
        getMallTypeLabel(entry.mallType),
        getMallDirectionLabel(entry.mallType, entry.direction),
        entry.reference || "",
        entry.note || "",
        String(entry.quantityDozen ?? ""),
        String(entry.totalAmount ?? ""),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    mallDateFrom,
    mallDateTo,
    mallDirectionFilter,
    mallMovements,
    mallSearchQuery,
    mallTimePreset,
    mallTypeFilter,
  ]);

  const filteredManualEntries = useMemo(() => {
    const query = manualSearchQuery.trim().toLowerCase();

    return manualEntries.filter((entry) => {
      if (manualModeFilter !== "ALL" && entry.mode !== manualModeFilter) {
        return false;
      }

      if (!query) return true;

      return [
        entry.article?.name || "",
        entry.note || "",
        entry.mode === "PACKED" ? "Packed A-Mall" : "Ready A-Mall",
        String(entry.quantityDozen ?? ""),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [manualEntries, manualModeFilter, manualSearchQuery]);

  const {
    currentPage: stockRowsPage,
    setCurrentPage: setStockRowsPage,
    pageSize: stockRowsPageSize,
    setPageSize: setStockRowsPageSize,
    totalPages: stockRowsTotalPages,
    totalItems: stockRowsTotalItems,
    startItem: stockRowsStartItem,
    endItem: stockRowsEndItem,
    paginatedItems: paginatedRows,
    goToPreviousPage: goToPreviousStockRowsPage,
    goToNextPage: goToNextStockRowsPage,
  } = useClientPagination(rows);

  const {
    currentPage: mallMovementsPage,
    setCurrentPage: setMallMovementsPage,
    pageSize: mallMovementsPageSize,
    setPageSize: setMallMovementsPageSize,
    totalPages: mallMovementsTotalPages,
    totalItems: mallMovementsTotalItems,
    startItem: mallMovementsStartItem,
    endItem: mallMovementsEndItem,
    paginatedItems: paginatedMallMovements,
    goToPreviousPage: goToPreviousMallMovementsPage,
    goToNextPage: goToNextMallMovementsPage,
  } = useClientPagination(filteredMallMovements);

  const {
    currentPage: manualEntriesPage,
    setCurrentPage: setManualEntriesPage,
    pageSize: manualEntriesPageSize,
    setPageSize: setManualEntriesPageSize,
    totalPages: manualEntriesTotalPages,
    totalItems: manualEntriesTotalItems,
    startItem: manualEntriesStartItem,
    endItem: manualEntriesEndItem,
    paginatedItems: paginatedManualEntries,
    goToPreviousPage: goToPreviousManualEntriesPage,
    goToNextPage: goToNextManualEntriesPage,
  } = useClientPagination(filteredManualEntries);

  const articleSelectOptions = useMemo(
    () => articles.map((article) => ({ value: article.id, label: article.name })),
    [articles],
  );

  const clearMallFilters = () => {
    setMallSearchQuery("");
    setMallTypeFilter("ALL");
    setMallDirectionFilter("ALL");
    setMallTimePreset("THIS_MONTH");
    setMallDateFrom("");
    setMallDateTo("");
  };

  const clearManualFilters = () => {
    setManualSearchQuery("");
    setManualModeFilter("ALL");
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">
          A-Mall stock stays article-wise. B-Mall and C-Mall are tracked as
          total stock with separate sale history.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
            <CardTitle className="text-sm">Packed A-Mall</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{summary.packedAMallDozen}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">B-Mall Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{summary.packedBMallDozen}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">C-Mall Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{summary.packedCMallDozen}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "PACKED" ? "Packed A-Mall Stock" : "Ready Stock by Article"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Packed view shows only A-Mall article stock. B-Mall and C-Mall are
            managed in the total stock ledger below.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] max-w-[420px] flex-1">
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
                  <TabsTrigger value="IN_STOCK">Ready Stock</TabsTrigger>
                  <TabsTrigger value="PACKED">Packed A-Mall</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>
                    {mode === "PACKED" ? "A-Mall (Dozen)" : "Quantity (Dozen)"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Loading stock rows...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-sm text-muted-foreground"
                    >
                      No articles found for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRows.map((row) => (
                    <TableRow key={`${row.articleId}-${row.size}`}>
                      <TableCell>{row.articleName}</TableCell>
                      <TableCell>{row.size}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.quantityDozen}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            currentPage={stockRowsPage}
            totalPages={stockRowsTotalPages}
            totalItems={stockRowsTotalItems}
            startItem={stockRowsStartItem}
            endItem={stockRowsEndItem}
            pageSize={stockRowsPageSize}
            setPageSize={setStockRowsPageSize}
            goToPreviousPage={goToPreviousStockRowsPage}
            goToNextPage={goToNextStockRowsPage}
            setCurrentPage={setStockRowsPage}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>B-Mall / C-Mall Stock Ledger</CardTitle>
            <p className="text-sm text-muted-foreground">
              Use this when B-Mall is sold as mixed stock or C-Mall is sold in
              one-time lots. Quantity here is entered in dozen, while sale
              price is entered per pair. It adjusts total stock only, not
              article-wise A-Mall.
            </p>
          </div>
          {canManageManualStock && (
            <Dialog
              open={mallDialogOpen}
              onOpenChange={(open) => {
                setMallDialogOpen(open);
                if (!open) resetMallForm();
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={openCreateMallDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Record B/C Movement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingMallMovement
                      ? "Edit B/C Stock Movement"
                      : "Record B/C Stock Movement"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleMallSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Mall Type</Label>
                      <Select
                        value={mallForm.mallType}
                        onValueChange={(value) =>
                          setMallForm((prev) => ({
                            ...prev,
                            mallType: value as ApiMallStockType,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="B_MALL">B-Mall</SelectItem>
                          <SelectItem value="C_MALL">C-Mall</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Entry Type</Label>
                      <Select
                        value={mallForm.direction}
                        onValueChange={(value) =>
                          setMallForm((prev) => ({
                            ...prev,
                            direction: value as ApiStockMovementDirection,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OUT">
                            {mallForm.mallType === "C_MALL"
                              ? "One-Time Sale"
                              : "Mixed Sale"}
                          </SelectItem>
                          <SelectItem value="IN">Add / Adjust</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={mallForm.date}
                        onChange={(e) =>
                          setMallForm((prev) => ({
                            ...prev,
                            date: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label>Quantity (Dozen)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={mallForm.quantityDozen}
                        onChange={(e) =>
                          setMallForm((prev) => ({
                            ...prev,
                            quantityDozen: e.target.value,
                          }))
                        }
                        required
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Enter total dozen for this B/C movement.
                      </p>
                    </div>
                  </div>
                  {mallForm.direction === "OUT" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label>Price / Pair</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={mallForm.ratePerDozen}
                          onChange={(e) =>
                            setMallForm((prev) => ({
                              ...prev,
                              ratePerDozen: e.target.value,
                            }))
                          }
                          required
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Enter the selling rate for one pair.
                        </p>
                      </div>
                      <div>
                        <Label>Sale Amount</Label>
                        <Input
                          value={String(
                            Number.isFinite(mallSaleTotal) ? mallSaleTotal : 0,
                          )}
                          disabled
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Calculated as dozen x 12 x price per pair.
                        </p>
                      </div>
                    </div>
                  )}
                  <div>
                    <Label>Buyer / Reference</Label>
                    <Input
                      value={mallForm.reference}
                      onChange={(e) =>
                        setMallForm((prev) => ({
                          ...prev,
                          reference: e.target.value,
                        }))
                      }
                      placeholder="Optional buyer name or reference"
                    />
                  </div>
                  <div>
                    <Label>Note</Label>
                    <Textarea
                      value={mallForm.note}
                      onChange={(e) =>
                        setMallForm((prev) => ({
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
                      onClick={() => setMallDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingMallMovement ? "Update Entry" : "Save Entry"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1 md:max-w-[360px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                Search
              </Label>
              <Input
                value={mallSearchQuery}
                onChange={(event) => setMallSearchQuery(event.target.value)}
                placeholder="Search buyer, note, amount..."
              />
            </div>
            <div className="min-w-[180px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                Mall Type
              </Label>
              <Select
                value={mallTypeFilter}
                onValueChange={(value) => setMallTypeFilter(value as typeof mallTypeFilter)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="B_MALL">B-Mall</SelectItem>
                  <SelectItem value="C_MALL">C-Mall</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                Entry Type
              </Label>
              <Select
                value={mallDirectionFilter}
                onValueChange={(value) =>
                  setMallDirectionFilter(value as typeof mallDirectionFilter)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Entries</SelectItem>
                  <SelectItem value="OUT">Sales</SelectItem>
                  <SelectItem value="IN">Add / Adjust</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                Time
              </Label>
              <Select
                value={mallTimePreset}
                onValueChange={(value) => setMallTimePreset(value as FilterTimePreset)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_TIME_PRESET_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mallTimePreset === "CUSTOM" && (
              <>
                <div>
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                    From
                  </Label>
                  <Input
                    type="date"
                    value={mallDateFrom}
                    onChange={(event) => setMallDateFrom(event.target.value)}
                    className="w-40"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                    To
                  </Label>
                  <Input
                    type="date"
                    value={mallDateTo}
                    onChange={(event) => setMallDateTo(event.target.value)}
                    className="w-40"
                  />
                </div>
              </>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={clearMallFilters}>
              <Filter className="mr-2 h-4 w-4" />
              Reset Filters
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Mall Type</TableHead>
                <TableHead>Entry Type</TableHead>
                <TableHead>Quantity (Dozen)</TableHead>
                <TableHead>Price / Pair</TableHead>
                <TableHead>Sale Amount</TableHead>
                <TableHead>Buyer / Ref</TableHead>
                <TableHead>Note</TableHead>
                {canManageManualStock && (
                  <TableHead className="w-[140px]">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isMallLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={canManageManualStock ? 9 : 8}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Loading B/C mall stock history...
                  </TableCell>
                </TableRow>
              ) : filteredMallMovements.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManageManualStock ? 9 : 8}
                    className="text-center text-sm text-muted-foreground"
                  >
                    {mallMovements.length === 0
                      ? "No B/C mall stock movements yet."
                      : "No B/C mall movements match the current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMallMovements.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>{getMallTypeLabel(entry.mallType)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={entry.direction === "OUT" ? "default" : "secondary"}
                      >
                        {getMallDirectionLabel(entry.mallType, entry.direction)}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.quantityDozen}</TableCell>
                    <TableCell>
                      {entry.ratePerDozen == null
                        ? "-"
                        : formatCurrency(entry.ratePerDozen)}
                    </TableCell>
                    <TableCell>
                      {entry.totalAmount == null
                        ? "-"
                        : formatCurrency(entry.totalAmount)}
                    </TableCell>
                    <TableCell>{entry.reference || "-"}</TableCell>
                    <TableCell>{entry.note || "-"}</TableCell>
                    {canManageManualStock && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => openEditMallDialog(entry)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleMallDelete(entry)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            currentPage={mallMovementsPage}
            totalPages={mallMovementsTotalPages}
            totalItems={mallMovementsTotalItems}
            startItem={mallMovementsStartItem}
            endItem={mallMovementsEndItem}
            pageSize={mallMovementsPageSize}
            setPageSize={setMallMovementsPageSize}
            goToPreviousPage={goToPreviousMallMovementsPage}
            goToNextPage={goToNextMallMovementsPage}
            setCurrentPage={setMallMovementsPage}
          />
        </CardContent>
      </Card>

      {canManageManualStock && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Manual A-Mall Stock Entries</CardTitle>
              <p className="text-sm text-muted-foreground">
                Use this for one-time A-Mall stock adjustments only. Packed here
                means packed A-Mall.
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
                <Button
                  onClick={openCreateDialog}
                  disabled={articles.length === 0}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add A-Mall Stock
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingEntry ? "Edit Manual A-Mall Stock" : "Add Manual A-Mall Stock"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <Label>Article</Label>
                    <SearchableSelect
                      value={manualForm.articleId}
                      onValueChange={(value) =>
                        setManualForm((prev) => ({ ...prev, articleId: value }))
                      }
                      options={articleSelectOptions}
                      placeholder="Select article"
                      searchPlaceholder="Search article..."
                      emptyMessage="No articles found."
                    />
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
                        <SelectItem value="IN_STOCK">Ready A-Mall</SelectItem>
                        <SelectItem value="PACKED">Packed A-Mall</SelectItem>
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
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1 md:max-w-[360px]">
                <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                  Search
                </Label>
                <Input
                  value={manualSearchQuery}
                  onChange={(event) => setManualSearchQuery(event.target.value)}
                  placeholder="Search article or note..."
                />
              </div>
              <div className="min-w-[200px]">
                <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                  Stock Type
                </Label>
                <Select
                  value={manualModeFilter}
                  onValueChange={(value) =>
                    setManualModeFilter(value as typeof manualModeFilter)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    <SelectItem value="IN_STOCK">Ready A-Mall</SelectItem>
                    <SelectItem value="PACKED">Packed A-Mall</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearManualFilters}
              >
                <Filter className="mr-2 h-4 w-4" />
                Reset Filters
              </Button>
            </div>
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
                  ) : filteredManualEntries.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-sm text-muted-foreground"
                      >
                        {manualEntries.length === 0
                          ? "No manual stock entries yet."
                          : "No manual stock entries match the current filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedManualEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.article?.name || "-"}</TableCell>
                        <TableCell>
                          {entry.mode === "PACKED" ? "Packed A-Mall" : "Ready A-Mall"}
                        </TableCell>
                        <TableCell>{entry.quantityDozen}</TableCell>
                        <TableCell>{entry.note || "-"}</TableCell>
                        <TableCell>{formatDate(entry.updatedAt)}</TableCell>
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
            <TablePagination
              currentPage={manualEntriesPage}
              totalPages={manualEntriesTotalPages}
              totalItems={manualEntriesTotalItems}
              startItem={manualEntriesStartItem}
              endItem={manualEntriesEndItem}
              pageSize={manualEntriesPageSize}
              setPageSize={setManualEntriesPageSize}
              goToPreviousPage={goToPreviousManualEntriesPage}
              goToNextPage={goToNextManualEntriesPage}
              setCurrentPage={setManualEntriesPage}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
