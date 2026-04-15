import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Pencil, CheckCircle2, Filter } from "lucide-react";
import { chequeApi } from "../lib/api";
import {
  FILTER_TIME_PRESET_OPTIONS,
  getPresetDateRange,
  type FilterTimePreset,
} from "../lib/time-presets";
import { formatCurrency, formatDate, getCurrentDate } from "../lib/utils";
import { useClientPagination } from "../hooks/useClientPagination";
import type { ApiCheque } from "../types/api";
import { TablePagination } from "./ui/table-pagination";
import { toast } from "sonner";

export function ChequeManagement() {
  const [cheques, setCheques] = useState<ApiCheque[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | ApiCheque["status"]
  >("ALL");
  const [originFilter, setOriginFilter] = useState<"ALL" | "CUSTOMER" | "OWN">(
    "ALL",
  );
  const [timePreset, setTimePreset] = useState<FilterTimePreset>("THIS_MONTH");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingCheque, setEditingCheque] = useState<ApiCheque | null>(null);
  const [editData, setEditData] = useState({
    date: "",
    amount: "",
    chequeNumber: "",
    notes: "",
  });
  const [cashingCheque, setCashingCheque] = useState<ApiCheque | null>(null);
  const [cashData, setCashData] = useState({
    date: getCurrentDate(),
    notes: "",
  });

  const loadCheques = async () => {
    setIsLoading(true);
    try {
      const data = await chequeApi.listCheques();
      setCheques(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load cheques.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCheques();
  }, []);

  const getOriginLabel = (cheque: ApiCheque) =>
    cheque.originType === "CUSTOMER" ? "Customer Cheque" : "Own Cheque";

  const filteredCheques = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let fromTs: number | null = null;
    let toTs: number | null = null;

    if (timePreset === "CUSTOM") {
      fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
      toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    } else {
      const range = getPresetDateRange(timePreset, new Date());
      fromTs = range?.from.getTime() ?? null;
      toTs = range?.to.getTime() ?? null;
    }

    return cheques.filter((cheque) => {
      if (statusFilter !== "ALL" && cheque.status !== statusFilter) {
        return false;
      }
      if (originFilter !== "ALL" && cheque.originType !== originFilter) {
        return false;
      }

      const chequeTs = new Date(cheque.date).getTime();
      if (fromTs !== null && chequeTs < fromTs) return false;
      if (toTs !== null && chequeTs > toTs) return false;

      if (!query) return true;

      const searchable = [
        cheque.chequeNumber || "",
        cheque.sourceParty?.name || "",
        cheque.usedParty?.name || "",
        getOriginLabel(cheque),
        cheque.status,
        String(cheque.amount ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [cheques, dateFrom, dateTo, originFilter, searchQuery, statusFilter, timePreset]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems,
    startItem,
    endItem,
    paginatedItems: paginatedCheques,
    goToPreviousPage,
    goToNextPage,
  } = useClientPagination(filteredCheques);

  const openEdit = (cheque: ApiCheque) => {
    setEditingCheque(cheque);
    setEditData({
      date: cheque.date.slice(0, 10),
      amount: String(Number(cheque.amount ?? 0)),
      chequeNumber: cheque.chequeNumber ?? "",
      notes: cheque.notes ?? "",
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCheque) return;

    const amount = Math.abs(Number(editData.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid cheque amount.");
      return;
    }

    try {
      await chequeApi.updateCheque(editingCheque.id, {
        date: editData.date,
        amount,
        chequeNumber: editData.chequeNumber || undefined,
        notes: editData.notes || undefined,
      });
      toast.success("Cheque updated");
      setEditingCheque(null);
      await loadCheques();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update cheque.");
    }
  };

  const openCashDialog = (cheque: ApiCheque) => {
    setCashingCheque(cheque);
    setCashData({
      date: getCurrentDate(),
      notes: cheque.notes ?? "",
    });
  };

  const markCashed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashingCheque) return;
    try {
      await chequeApi.cashCheque(cashingCheque.id, {
        date: cashData.date,
        notes: cashData.notes || undefined,
      });
      toast.success("Cheque marked as cashed");
      setCashingCheque(null);
      await loadCheques();
    } catch (error) {
      console.error(error);
      toast.error("Failed to mark cheque as cashed.");
    }
  };

  const statusBadge = (status: ApiCheque["status"]) => {
    if (status === "AVAILABLE") {
      return <Badge className="bg-green-100 text-green-700">Available</Badge>;
    }
    if (status === "USED") {
      return <Badge className="bg-blue-100 text-blue-700">Used</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-700">Cashed</Badge>;
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setOriginFilter("ALL");
    setTimePreset("THIS_MONTH");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cheques</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1 md:max-w-[320px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                Search
              </Label>
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search cheque number or party..."
              />
            </div>
            <div className="min-w-[180px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                Status
              </Label>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as typeof statusFilter)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="AVAILABLE">Available</SelectItem>
                  <SelectItem value="USED">Used</SelectItem>
                  <SelectItem value="CASHED">Cashed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                Type
              </Label>
              <Select
                value={originFilter}
                onValueChange={(value) =>
                  setOriginFilter(value as typeof originFilter)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="CUSTOMER">Customer Cheque</SelectItem>
                  <SelectItem value="OWN">Own Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                Time
              </Label>
              <Select
                value={timePreset}
                onValueChange={(value) =>
                  setTimePreset(value as FilterTimePreset)
                }
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
            {timePreset === "CUSTOM" && (
              <>
                <div>
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                    From
                  </Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="w-40"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                    To
                  </Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="w-40"
                  />
                </div>
              </>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <Filter className="mr-2 h-4 w-4" />
              Reset Filters
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cheque Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Cheque #</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Used For</TableHead>
                <TableHead>Cashed On</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    Loading cheques...
                  </TableCell>
                </TableRow>
              ) : filteredCheques.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    {cheques.length === 0
                      ? "No cheques found"
                      : "No cheques match the selected filters."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCheques.map((cheque) => (
                  <TableRow key={cheque.id}>
                    <TableCell>{formatDate(cheque.date)}</TableCell>
                    <TableCell>{getOriginLabel(cheque)}</TableCell>
                    <TableCell>{cheque.chequeNumber || "-"}</TableCell>
                    <TableCell>
                      {formatCurrency(Number(cheque.amount ?? 0))}
                    </TableCell>
                    <TableCell>
                      {cheque.sourceParty?.name ||
                        (cheque.originType === "OWN" ? "Own cheque" : "-")}
                    </TableCell>
                    <TableCell>{cheque.usedParty?.name || "-"}</TableCell>
                    <TableCell>
                      {cheque.cashedAt ? formatDate(cheque.cashedAt) : "-"}
                    </TableCell>
                    <TableCell>{statusBadge(cheque.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {cheque.status === "AVAILABLE" && (
                          <>
                            <Button
                              size="icon"
                              variant="outline"
                              title="Edit"
                              onClick={() => openEdit(cheque)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {cheque.status !== "CASHED" && (
                          <Button
                            size="icon"
                            variant="outline"
                            title="Mark Cashed"
                            onClick={() => openCashDialog(cheque)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
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

      <Dialog
        open={editingCheque !== null}
        onOpenChange={() => setEditingCheque(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Cheque</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={editData.date}
                onChange={(e) =>
                  setEditData({ ...editData, date: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={editData.amount}
                onChange={(e) =>
                  setEditData({ ...editData, amount: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Cheque Number</Label>
              <Input
                value={editData.chequeNumber}
                onChange={(e) =>
                  setEditData({ ...editData, chequeNumber: e.target.value })
                }
                placeholder="Optional cheque number"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={editData.notes}
                onChange={(e) =>
                  setEditData({ ...editData, notes: e.target.value })
                }
                placeholder="Optional notes"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingCheque(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cashingCheque !== null}
        onOpenChange={() => setCashingCheque(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Cheque as Cashed</DialogTitle>
          </DialogHeader>
          <form onSubmit={markCashed} className="space-y-4">
            <div>
              <Label>Cash Date</Label>
              <Input
                type="date"
                value={cashData.date}
                onChange={(e) =>
                  setCashData({ ...cashData, date: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={cashData.notes}
                onChange={(e) =>
                  setCashData({ ...cashData, notes: e.target.value })
                }
                placeholder="Optional notes"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCashingCheque(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Mark Cashed</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
