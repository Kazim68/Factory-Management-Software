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
import { Card, CardContent } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Plus, Trash2, Eye, Filter, Printer } from "lucide-react";
import { chequeApi, configApi, purchaseApi } from "../lib/api";
import { formatCurrency, formatDate, getCurrentDate } from "../lib/utils";
import type {
  ApiArticle,
  ApiCheque,
  ApiChemicalPurchase,
  ApiMaterialPurchase,
  ApiPaymentMethod,
  ApiRexinePurchase,
} from "../types/api";
import { toast } from "sonner";

type SupplierOption = {
  id: string;
  name: string;
  currentBalance: number;
};

type PurchaseType = "CHEMICAL" | "REXINE" | "MATERIAL";
type PurchaseSection = "suppliers" | "records";
type RecordsTimePreset =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "YEARLY"
  | "CUSTOM"
  | "THIS_MONTH";

type PurchaseRow = {
  id: string;
  type: PurchaseType | "";
  articleId: string;
  quantity: string;
  rate: string;
};

type UnifiedPurchaseRecord = {
  id: string;
  date: string;
  supplierName: string;
  type: PurchaseType;
  itemName: string;
  quantityLabel: string;
  rateLabel: string;
  totalAmount: number;
  paymentType: ApiPaymentMethod;
  description: string;
};

const PURCHASE_TYPES: PurchaseType[] = ["CHEMICAL", "REXINE", "MATERIAL"];

const getPresetDateRange = (preset: RecordsTimePreset, now: Date) => {
  const from = new Date(now);
  const to = new Date(now);

  if (preset === "DAILY") {
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  if (preset === "WEEKLY") {
    const day = now.getDay();
    const mondayOffset = (day + 6) % 7;
    from.setDate(now.getDate() - mondayOffset);
    from.setHours(0, 0, 0, 0);
    to.setDate(from.getDate() + 6);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  if (preset === "MONTHLY" || preset === "THIS_MONTH") {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    to.setMonth(now.getMonth() + 1, 0);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  if (preset === "YEARLY") {
    from.setMonth(0, 1);
    from.setHours(0, 0, 0, 0);
    to.setMonth(11, 31);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  return null;
};

const createEmptyRow = (): PurchaseRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type: "",
  articleId: "",
  quantity: "",
  rate: "",
});

const roundMoney = (value: number) => Number(value.toFixed(2));

export function SupplierCombinedPurchase({
  suppliers,
  isLoadingSuppliers,
  onAddSupplier,
  onEditSupplier,
  onViewSupplierLedger,
}: {
  suppliers: SupplierOption[];
  isLoadingSuppliers: boolean;
  onAddSupplier: () => void;
  onEditSupplier: (supplierId: string) => void;
  onViewSupplierLedger: (supplierId: string) => void;
}) {
  const [activeSection, setActiveSection] = useState<PurchaseSection>(() => {
    if (typeof window === "undefined") return "suppliers";
    const stored = localStorage.getItem("party.supplierPurchase.activeSection");
    return stored === "records" ? "records" : "suppliers";
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isLoadingCheques, setIsLoadingCheques] = useState(false);

  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [records, setRecords] = useState<UnifiedPurchaseRecord[]>([]);
  const [availableCheques, setAvailableCheques] = useState<ApiCheque[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState(getCurrentDate());
  const [paymentType, setPaymentType] = useState<ApiPaymentMethod>("KHATA");
  const [amountPaid, setAmountPaid] = useState("");
  const [selectedChequeId, setSelectedChequeId] = useState("");
  const [rows, setRows] = useState<PurchaseRow[]>([createEmptyRow()]);
  const [recordTypeFilters, setRecordTypeFilters] = useState<PurchaseType[]>([
    ...PURCHASE_TYPES,
  ]);
  const [recordsTimePreset, setRecordsTimePreset] =
    useState<RecordsTimePreset>("THIS_MONTH");
  const [recordsDateFrom, setRecordsDateFrom] = useState("");
  const [recordsDateTo, setRecordsDateTo] = useState("");

  const supplierNameMap = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers],
  );

  const articleMap = useMemo(
    () => new Map(articles.map((article) => [article.id, article.name])),
    [articles],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("party.supplierPurchase.activeSection", activeSection);
  }, [activeSection]);

  useEffect(() => {
    let active = true;
    Promise.all([configApi.listArticles()])
      .then(([articleData]) => {
        if (!active) return;
        setArticles(articleData);
      })
      .catch((error) => {
        console.error(error);
        if (active) toast.error("Failed to load purchase configuration.");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoadingRecords(true);

    Promise.all([
      purchaseApi.listChemicals(),
      purchaseApi.listRexine(),
      purchaseApi.listMaterials(),
    ])
      .then(([chemicalData, rexineData, materialData]) => {
        if (!active) return;

        const unified = [
          ...chemicalData.map((entry) =>
            mapChemicalToRecord(entry, supplierNameMap),
          ),
          ...rexineData.map((entry) =>
            mapRexineToRecord(entry, supplierNameMap),
          ),
          ...materialData.map((entry) =>
            mapMaterialToRecord(entry, supplierNameMap, articleMap),
          ),
        ].sort((a, b) => {
          const byDate =
            new Date(b.date).getTime() - new Date(a.date).getTime();
          if (byDate !== 0) return byDate;
          return b.id.localeCompare(a.id);
        });

        setRecords(unified);
      })
      .catch((error) => {
        console.error(error);
        if (active) toast.error("Failed to load purchase records.");
      })
      .finally(() => {
        if (active) setIsLoadingRecords(false);
      });

    return () => {
      active = false;
    };
  }, [supplierNameMap, articleMap]);

  useEffect(() => {
    if (suppliers.length === 0) {
      setSupplierId("");
      return;
    }

    setSupplierId((prev) =>
      prev && suppliers.some((supplier) => supplier.id === prev)
        ? prev
        : suppliers[0].id,
    );
  }, [suppliers]);

  useEffect(() => {
    if (!isDialogOpen || paymentType !== "CHEQUE") {
      setAvailableCheques([]);
      setSelectedChequeId("");
      setIsLoadingCheques(false);
      return;
    }

    let active = true;
    setIsLoadingCheques(true);
    chequeApi
      .listAvailableCheques()
      .then((cheques) => {
        if (!active) return;
        setAvailableCheques(cheques);
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          toast.error("Failed to load available cheques.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingCheques(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isDialogOpen, paymentType]);

  const grossTotal = useMemo(
    () =>
      roundMoney(
        rows.reduce((sum, row) => {
          const quantity = Number.parseFloat(row.quantity || "0");
          const rate = Number.parseFloat(row.rate || "0");
          if (!Number.isFinite(quantity) || !Number.isFinite(rate)) return sum;
          return sum + quantity * rate;
        }, 0),
      ),
    [rows],
  );

  const filteredRecords = useMemo(() => {
    if (recordTypeFilters.length === 0) return [];
    const filters = new Set(recordTypeFilters);

    let fromTs: number | null = null;
    let toTs: number | null = null;

    if (recordsTimePreset === "CUSTOM") {
      fromTs = recordsDateFrom
        ? new Date(`${recordsDateFrom}T00:00:00`).getTime()
        : null;
      toTs = recordsDateTo
        ? new Date(`${recordsDateTo}T23:59:59.999`).getTime()
        : null;
    } else {
      const range = getPresetDateRange(recordsTimePreset, new Date());
      fromTs = range?.from.getTime() ?? null;
      toTs = range?.to.getTime() ?? null;
    }

    return records.filter((record) => {
      if (!filters.has(record.type)) return false;
      const recordTs = new Date(record.date).getTime();
      if (!Number.isFinite(recordTs)) return false;
      if (fromTs !== null && recordTs < fromTs) return false;
      if (toTs !== null && recordTs > toTs) return false;
      return true;
    });
  }, [
    records,
    recordTypeFilters,
    recordsDateFrom,
    recordsDateTo,
    recordsTimePreset,
  ]);

  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === supplierId,
  );
  const selectedCheque = availableCheques.find(
    (cheque) => cheque.id === selectedChequeId,
  );

  useEffect(() => {
    if (paymentType === "CASH") {
      setAmountPaid(String(grossTotal));
      return;
    }

    if (paymentType === "KHATA") {
      setAmountPaid((prev) => {
        const numeric = Number.parseFloat(prev || "0");
        if (!Number.isFinite(numeric) || numeric <= 0) return "";
        return String(Math.min(numeric, grossTotal));
      });
      return;
    }

    if (paymentType === "CHEQUE") {
      if (selectedCheque) {
        setAmountPaid(String(Number(selectedCheque.amount ?? 0)));
      } else {
        setAmountPaid("");
      }
    }
  }, [paymentType, grossTotal, selectedCheque]);

  const resetDialog = () => {
    setDate(getCurrentDate());
    setPaymentType("KHATA");
    setAmountPaid("");
    setSelectedChequeId("");
    setRows([createEmptyRow()]);
  };

  const toggleRecordTypeFilter = (type: PurchaseType) => {
    setRecordTypeFilters((prev) => {
      if (prev.includes(type)) {
        return prev.filter((item) => item !== type);
      }
      return [...prev, type];
    });
  };

  const clearRecordsFilters = () => {
    setRecordTypeFilters([...PURCHASE_TYPES]);
    setRecordsTimePreset("THIS_MONTH");
    setRecordsDateFrom("");
    setRecordsDateTo("");
  };

  const setRow = (rowId: string, patch: Partial<PurchaseRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const next = { ...row, ...patch };
        if (patch.type && patch.type !== "MATERIAL") {
          next.articleId = "";
        }
        return next;
      }),
    );
  };

  const availableTypesForRow = (rowId: string) => {
    const rowType = rows.find((row) => row.id === rowId)?.type;
    const selectedByOthers = new Set(
      rows
        .filter((row) => row.id !== rowId)
        .map((row) => row.type)
        .filter(
          (type): type is PurchaseType => type !== "" && type !== "MATERIAL",
        ),
    );

    return PURCHASE_TYPES.filter(
      (type) =>
        type === "MATERIAL" || !selectedByOthers.has(type) || type === rowType,
    );
  };

  const canAddRow = rows.every((row) => row.type !== "");

  const addRow = () => {
    if (!canAddRow) return;
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => {
      if (prev.length === 1) return [createEmptyRow()];
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const parsePositive = (value: string) => {
    const next = Number(value);
    return Number.isFinite(next) && next > 0 ? next : null;
  };

  const getUsedMaterialArticleIds = (currentRowId: string) =>
    new Set(
      rows
        .filter(
          (row) =>
            row.id !== currentRowId &&
            row.type === "MATERIAL" &&
            !!row.articleId,
        )
        .map((row) => row.articleId),
    );

  const saveRecords = async () => {
    if (!supplierId) {
      toast.error("Please select a supplier.");
      return;
    }

    if (rows.length === 0 || rows.every((row) => !row.type)) {
      toast.error("Add at least one purchase row.");
      return;
    }

    const payloadRows: Array<{
      type: PurchaseType;
      quantity: number;
      rate: number;
      articleId?: string;
    }> = [];

    for (const row of rows) {
      if (!row.type) {
        toast.error("Please select buy type in all rows.");
        return;
      }

      const quantity = parsePositive(row.quantity);
      const rate = parsePositive(row.rate);
      if (!quantity || !rate) {
        toast.error("Quantity and rate must be greater than zero.");
        return;
      }

      if (row.type === "MATERIAL") {
        if (!row.articleId) {
          toast.error("Article is required for material rows.");
          return;
        }
        payloadRows.push({
          type: row.type,
          quantity,
          rate,
          articleId: row.articleId,
        });
        continue;
      }

      payloadRows.push({
        type: row.type,
        quantity,
        rate,
      });
    }

    const parsedAmountPaid = Number.parseFloat(amountPaid || "0");
    const safeAmountPaid = Number.isFinite(parsedAmountPaid)
      ? parsedAmountPaid
      : 0;

    if (paymentType === "KHATA" && safeAmountPaid > grossTotal) {
      toast.error("Amount paid cannot exceed gross total for khata.");
      return;
    }

    if (paymentType === "CHEQUE") {
      if (!selectedChequeId) {
        toast.error("Please select a cheque.");
        return;
      }
      if (!selectedCheque) {
        toast.error("Selected cheque is invalid.");
        return;
      }
      const chequeAmount = Number(selectedCheque.amount ?? 0);
      if (Math.abs(chequeAmount - safeAmountPaid) > 0.0001) {
        toast.error("Amount paid must match selected cheque amount.");
        return;
      }
    }

    setIsSaving(true);
    try {
      await purchaseApi.createCombined({
        date,
        partyId: supplierId,
        paymentType,
        amountPaid: safeAmountPaid,
        chequeId: paymentType === "CHEQUE" ? selectedChequeId : undefined,
        rows: payloadRows,
      });

      toast.success(
        `Saved ${payloadRows.length} purchase entr${payloadRows.length === 1 ? "y" : "ies"}.`,
      );
      setIsDialogOpen(false);
      resetDialog();
      setIsLoadingRecords(true);
      const [chemicalData, rexineData, materialData] = await Promise.all([
        purchaseApi.listChemicals(),
        purchaseApi.listRexine(),
        purchaseApi.listMaterials(),
      ]);
      const unified = [
        ...chemicalData.map((entry) =>
          mapChemicalToRecord(entry, supplierNameMap),
        ),
        ...rexineData.map((entry) => mapRexineToRecord(entry, supplierNameMap)),
        ...materialData.map((entry) =>
          mapMaterialToRecord(entry, supplierNameMap, articleMap),
        ),
      ].sort((a, b) => {
        const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (byDate !== 0) return byDate;
        return b.id.localeCompare(a.id);
      });
      setRecords(unified);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save purchases.");
    } finally {
      setIsSaving(false);
      setIsLoadingRecords(false);
    }
  };

  const printFilteredRecords = async () => {
    try {
      const html = await purchaseApi.getPrintableSupplierPurchases({
        types: recordTypeFilters,
        timePreset: recordsTimePreset,
        start:
          recordsTimePreset === "CUSTOM"
            ? recordsDateFrom || undefined
            : undefined,
        end:
          recordsTimePreset === "CUSTOM"
            ? recordsDateTo || undefined
            : undefined,
      });

      const printWindow = window.open("", "", "width=1000,height=700");
      if (!printWindow) {
        toast.error("Unable to open print window.");
        return;
      }

      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate printable report.");
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs
          value={activeSection}
          onValueChange={(value) => setActiveSection(value as PurchaseSection)}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <TabsList className="grid w-full max-w-[320px] grid-cols-2">
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
              <TabsTrigger value="records">Purchase Records</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="suppliers" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Suppliers</h3>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onAddSupplier}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Supplier
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Current Balance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingSuppliers ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      Loading suppliers...
                    </TableCell>
                  </TableRow>
                ) : suppliers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      No suppliers yet
                    </TableCell>
                  </TableRow>
                ) : (
                  suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell>{supplier.name}</TableCell>
                      <TableCell>
                        <span
                          className={
                            supplier.currentBalance > 0
                              ? "text-green-600"
                              : supplier.currentBalance < 0
                                ? "text-red-600"
                                : ""
                          }
                        >
                          {formatCurrency(supplier.currentBalance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewSupplierLedger(supplier.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onEditSupplier(supplier.id)}
                          >
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="records" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex h-8 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                    <Filter className="h-4 w-4" />
                    Type Filters ({recordTypeFilters.length}/
                    {PURCHASE_TYPES.length})
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Record Types</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {PURCHASE_TYPES.map((type) => (
                      <DropdownMenuCheckboxItem
                        key={type}
                        checked={recordTypeFilters.includes(type)}
                        onCheckedChange={() => toggleRecordTypeFilter(type)}
                      >
                        {toTitle(type)}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <Select
                    value={recordsTimePreset}
                    onValueChange={(value) =>
                      setRecordsTimePreset(value as RecordsTimePreset)
                    }
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Select time filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                      <SelectItem value="THIS_MONTH">This Month</SelectItem>
                      <SelectItem value="CUSTOM">Custom Date Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {recordsTimePreset === "CUSTOM" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">
                        From
                      </Label>
                      <Input
                        type="date"
                        value={recordsDateFrom}
                        onChange={(event) =>
                          setRecordsDateFrom(event.target.value)
                        }
                        className="w-40"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">
                        To
                      </Label>
                      <Input
                        type="date"
                        value={recordsDateTo}
                        onChange={(event) =>
                          setRecordsDateTo(event.target.value)
                        }
                        className="w-40"
                      />
                    </div>
                  </>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearRecordsFilters}
                >
                  Reset Filters
                </Button>
              </div>

              <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) resetDialog();
                }}
              >
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={printFilteredRecords}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Purchase
                  </Button>
                </div>
                <DialogContent className="flex h-[88vh] w-[96vw] max-w-[96vw] flex-col overflow-hidden sm:max-w-[96vw]">
                  <DialogHeader>
                    <DialogTitle>Add Supplier Purchase</DialogTitle>
                  </DialogHeader>

                  <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <div>
                        <Label>Supplier</Label>
                        <Select
                          value={supplierId}
                          onValueChange={setSupplierId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Current Balance:{" "}
                          {formatCurrency(
                            selectedSupplier?.currentBalance ?? 0,
                          )}
                        </p>
                      </div>

                      <div>
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={date}
                          onChange={(event) => setDate(event.target.value)}
                        />
                      </div>

                      <div>
                        <Label>Payment Type</Label>
                        <Select
                          value={paymentType}
                          onValueChange={(value) =>
                            setPaymentType(value as ApiPaymentMethod)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="KHATA">KHATA</SelectItem>
                            <SelectItem value="CASH">CASH</SelectItem>
                            <SelectItem value="CHEQUE">CHEQUE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Amount Paid</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={amountPaid}
                          onChange={(event) => {
                            if (
                              paymentType === "CASH" ||
                              paymentType === "CHEQUE"
                            )
                              return;
                            const next = Number.parseFloat(
                              event.target.value || "0",
                            );
                            if (!Number.isFinite(next)) {
                              setAmountPaid("");
                              return;
                            }
                            setAmountPaid(String(Math.min(next, grossTotal)));
                          }}
                          disabled={
                            paymentType === "CASH" || paymentType === "CHEQUE"
                          }
                        />
                      </div>
                    </div>

                    {paymentType === "CHEQUE" && (
                      <div>
                        <Label>Select Cheque</Label>
                        <Select
                          value={selectedChequeId}
                          onValueChange={setSelectedChequeId}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                isLoadingCheques
                                  ? "Loading cheques..."
                                  : "Select available cheque"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCheques.length === 0 ? (
                              <SelectItem value="__none" disabled>
                                No available cheques
                              </SelectItem>
                            ) : (
                              availableCheques.map((cheque) => (
                                <SelectItem key={cheque.id} value={cheque.id}>
                                  {cheque.chequeNumber || "No Cheque #"} -{" "}
                                  {formatCurrency(Number(cheque.amount ?? 0))}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <Label>Purchase Rows</Label>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addRow}
                          disabled={!canAddRow}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Row
                        </Button>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Buy Type</TableHead>
                            <TableHead>Article</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Rate</TableHead>
                            <TableHead>Row Total</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row, index) => {
                            const typeOptions = availableTypesForRow(row.id);
                            const rowTotal =
                              Number.parseFloat(row.quantity || "0") *
                              Number.parseFloat(row.rate || "0");
                            const quantityLabel =
                              row.type === "CHEMICAL"
                                ? "Kg"
                                : row.type === "REXINE"
                                  ? "Meter"
                                  : "Qty";
                            const rateLabel =
                              row.type === "CHEMICAL"
                                ? "Rate/Kg"
                                : row.type === "REXINE"
                                  ? "Rate/Meter"
                                  : "Rate/Unit";
                            const usedMaterialIds = getUsedMaterialArticleIds(
                              row.id,
                            );
                            const availableMaterialArticles = articles.filter(
                              (article) => !usedMaterialIds.has(article.id),
                            );

                            return (
                              <TableRow key={row.id}>
                                <TableCell>
                                  <Select
                                    value={row.type}
                                    onValueChange={(value) =>
                                      setRow(row.id, {
                                        type: value as PurchaseType,
                                        articleId: "",
                                        quantity: "",
                                        rate: "",
                                      })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {typeOptions.map((type) => (
                                        <SelectItem key={type} value={type}>
                                          {toTitle(type)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  {row.type === "MATERIAL" ? (
                                    <Select
                                      value={row.articleId}
                                      onValueChange={(value) =>
                                        setRow(row.id, { articleId: value })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select article" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableMaterialArticles.map(
                                          (article) => (
                                            <SelectItem
                                              key={article.id}
                                              value={article.id}
                                            >
                                              {article.name}
                                            </SelectItem>
                                          ),
                                        )}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">
                                      Raw Material
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={row.quantity}
                                      onChange={(event) =>
                                        setRow(row.id, {
                                          quantity: event.target.value,
                                        })
                                      }
                                      disabled={!row.type}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      {quantityLabel}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={row.rate}
                                      onChange={(event) =>
                                        setRow(row.id, {
                                          rate: event.target.value,
                                        })
                                      }
                                      disabled={!row.type}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      {rateLabel}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {formatCurrency(
                                    Number.isFinite(rowTotal) ? rowTotal : 0,
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeRow(row.id)}
                                    aria-label={`Remove row ${index + 1}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="grid gap-3 rounded bg-muted p-4 md:grid-cols-3">
                      <div className="rounded bg-background/70 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Gross Total
                        </p>
                        <p className="mt-1 font-medium">
                          {formatCurrency(grossTotal)}
                        </p>
                      </div>
                      <div className="rounded bg-background/70 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Amount Paid
                        </p>
                        <p className="mt-1 font-medium">
                          {formatCurrency(
                            Number.parseFloat(amountPaid || "0") || 0,
                          )}
                        </p>
                      </div>
                      <div className="rounded bg-background/70 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Pending
                        </p>
                        <p className="mt-1 font-medium">
                          {formatCurrency(
                            roundMoney(
                              grossTotal -
                                (Number.parseFloat(amountPaid || "0") || 0),
                            ),
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pb-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={saveRecords}
                        disabled={isSaving || grossTotal <= 0}
                      >
                        {isSaving ? "Saving..." : "Save Purchases"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingRecords ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      Loading purchase records...
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      No purchase records yet
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={`${record.type}-${record.id}`}>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{record.supplierName}</TableCell>
                      <TableCell>{toTitle(record.type)}</TableCell>
                      <TableCell>{record.itemName}</TableCell>
                      <TableCell>{record.quantityLabel}</TableCell>
                      <TableCell>{record.rateLabel}</TableCell>
                      <TableCell>
                        {formatCurrency(record.totalAmount)}
                      </TableCell>
                      <TableCell>{record.paymentType}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

const toTitle = (value: string) =>
  value
    .toLowerCase()
    .replace(
      /(^|_)([a-z])/g,
      (_, prefix: string, letter: string) =>
        `${prefix === "_" ? " " : ""}${letter.toUpperCase()}`,
    );

const mapChemicalToRecord = (
  entry: ApiChemicalPurchase,
  supplierMap: Map<string, string>,
): UnifiedPurchaseRecord => ({
  id: entry.id,
  date: entry.date,
  supplierName:
    entry.party?.name ||
    (entry.partyId ? supplierMap.get(entry.partyId) : undefined) ||
    "Unknown",
  type: "CHEMICAL",
  itemName: "Raw Material",
  quantityLabel: `${Number(entry.quantityKg)} kg`,
  rateLabel: `${formatCurrency(Number(entry.ratePerKg))}/kg`,
  totalAmount: Number(entry.totalAmount),
  paymentType: entry.paymentType,
  description: entry.expenses?.[0]?.description || "",
});

const mapRexineToRecord = (
  entry: ApiRexinePurchase,
  supplierMap: Map<string, string>,
): UnifiedPurchaseRecord => ({
  id: entry.id,
  date: entry.date,
  supplierName:
    entry.party?.name ||
    (entry.partyId ? supplierMap.get(entry.partyId) : undefined) ||
    "Unknown",
  type: "REXINE",
  itemName: "Raw Material",
  quantityLabel: `${Number(entry.quantityMeter)} meter`,
  rateLabel: `${formatCurrency(Number(entry.ratePerMeter))}/meter`,
  totalAmount: Number(entry.totalAmount),
  paymentType: entry.paymentType,
  description: entry.expenses?.[0]?.description || "",
});

const mapMaterialToRecord = (
  entry: ApiMaterialPurchase,
  supplierMap: Map<string, string>,
  articleMap: Map<string, string>,
): UnifiedPurchaseRecord => {
  const unitLabel = entry.unit?.symbol || entry.unit?.name || "unit";
  const articleName =
    entry.article?.name ||
    (entry.articleId ? articleMap.get(entry.articleId) : undefined) ||
    "-";

  return {
    id: entry.id,
    date: entry.date,
    supplierName:
      entry.party?.name ||
      (entry.partyId ? supplierMap.get(entry.partyId) : undefined) ||
      "Unknown",
    type: "MATERIAL",
    itemName: articleName,
    quantityLabel: `${Number(entry.quantity)} ${unitLabel}`,
    rateLabel: `${formatCurrency(Number(entry.pricePerUnit))}/${unitLabel}`,
    totalAmount: Number(entry.totalAmount),
    paymentType: entry.paymentType,
    description: entry.expenses?.[0]?.description || "",
  };
};
