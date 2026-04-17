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
import { SearchableSelect } from "./ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Plus,
  Minus,
  Filter,
  Printer,
  Pencil,
  Trash2,
  BadgeCheck,
} from "lucide-react";
import { billApi, configApi, partyApi, productionApi } from "../lib/api";
import {
  FILTER_TIME_PRESET_OPTIONS,
  getPresetDateRange,
  type FilterTimePreset,
} from "../lib/time-presets";
import { printBillInvoice } from "../lib/bill-print";
import { formatCurrency, formatDate, getCurrentDate } from "../lib/utils";
import { useClientPagination } from "../hooks/useClientPagination";
import type {
  ApiArticle,
  ApiBill,
  ApiParty,
  ApiStockArticleRow,
} from "../types/api";
import { TablePagination } from "./ui/table-pagination";
import { toast } from "sonner";

type BillItemForm = {
  stockVariantKey: string;
  articleId: string;
  articleName: string;
  size: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
};

type StockVariantOption = {
  key: string;
  articleId: string;
  articleName: string;
  size: string;
  quantityDozen: number;
};

type BillTotalsInput = {
  quantity: number | string;
  price: number | string;
  discount?: number | string | null;
};

const PAIRS_PER_DOZEN = 12;

const normalizeSize = (value?: string | null) => {
  const normalized = String(value ?? "").trim();
  return normalized || "-";
};

const getStockVariantKey = (articleId: string, size: string) =>
  `${articleId}::${normalizeSize(size)}`;

const toBillLineSize = (size: string) => {
  const normalized = normalizeSize(size);
  return normalized === "-" ? null : normalized;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

const formatQuantityValue = (value: number) => String(Number(value.toFixed(2)));

const calculateLineDiscount = (
  quantity: number,
  price: number,
  discount: number,
) => roundMoney(discount * quantity * PAIRS_PER_DOZEN);

const calculateLineTotal = (
  quantity: number,
  price: number,
  discount: number,
) =>
  roundMoney(
    quantity * PAIRS_PER_DOZEN * price -
      calculateLineDiscount(quantity, price, discount),
  );

const calculateGrossLineTotal = (quantity: number, price: number) =>
  roundMoney(quantity * PAIRS_PER_DOZEN * price);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const calculateBillTotals = (lines: BillTotalsInput[]) => {
  const totalQuantityDozen = Number(
    lines
      .reduce((sum, line) => sum + Number(line.quantity || 0), 0)
      .toFixed(2),
  );
  const grossTotal = roundMoney(
    lines.reduce(
      (sum, line) =>
        sum +
        Number(line.quantity || 0) *
          PAIRS_PER_DOZEN *
          Number(line.price || 0),
      0,
    ),
  );
  const discountTotal = roundMoney(
    lines.reduce(
      (sum, line) =>
        sum +
        calculateLineDiscount(
          Number(line.quantity || 0),
          Number(line.price || 0),
          Number(line.discount || 0),
        ),
      0,
    ),
  );

  return {
    totalQuantityDozen,
    totalQuantityPairs: totalQuantityDozen * PAIRS_PER_DOZEN,
    grossTotal,
    discountTotal,
    grandTotal: roundMoney(grossTotal - discountTotal),
  };
};

const isCompleteBillItem = (item: BillItemForm) =>
  Boolean(item.stockVariantKey && item.articleId) &&
  Number(item.quantity) > 0 &&
  Number(item.price) > 0 &&
  Number(item.discount) >= 0 &&
  Number(item.discount) <= Number(item.price);

const getBillTotalsFromBill = (bill: ApiBill) => {
  if (!Array.isArray(bill.lines) || bill.lines.length === 0) {
    const grandTotal = roundMoney(Number(bill.total ?? 0));
    const totalPaid = roundMoney(Number(bill.totalPaid ?? 0));
    return {
      totalQuantityDozen: 0,
      totalQuantityPairs: 0,
      grossTotal: grandTotal,
      discountTotal: 0,
      grandTotal,
      totalPaid,
      remaining: roundMoney(Math.max(grandTotal - totalPaid, 0)),
    };
  }

  const totals = calculateBillTotals(
    bill.lines.map((line) => ({
      quantity: line.quantity,
      price: line.price,
      discount: line.discount,
    })),
  );
  const totalPaid = roundMoney(Number(bill.totalPaid ?? 0));

  return {
    ...totals,
    totalPaid,
    remaining: roundMoney(Math.max(totals.grandTotal - totalPaid, 0)),
  };
};

const createEmptyBillItem = (): BillItemForm => ({
  stockVariantKey: "",
  articleId: "",
  articleName: "",
  size: "",
  quantity: 0,
  price: 0,
  discount: 0,
  total: 0,
});

const ensureMinimumRows = (rows: BillItemForm[], minimum = 3) => {
  const nextRows = [...rows];
  while (nextRows.length < minimum) {
    nextRows.push(createEmptyBillItem());
  }
  return nextRows;
};

export function BillManagement() {
  const [bills, setBills] = useState<ApiBill[]>([]);
  const [parties, setParties] = useState<ApiParty[]>([]);
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [stockVariantOptions, setStockVariantOptions] = useState<
    StockVariantOption[]
  >([]);
  const [availableStockByVariant, setAvailableStockByVariant] = useState<
    Record<string, number>
  >({});
  const [billSearchQuery, setBillSearchQuery] = useState("");
  const [billStatusFilter, setBillStatusFilter] = useState<
    "ALL" | "UNPAID" | "PARTIAL_PAID" | "PAID"
  >("ALL");
  const [billTimePreset, setBillTimePreset] =
    useState<FilterTimePreset>("THIS_MONTH");
  const [billDateFrom, setBillDateFrom] = useState("");
  const [billDateTo, setBillDateTo] = useState("");

  const [formData, setFormData] = useState({
    date: getCurrentDate(),
    partyId: "",
  });

  const [items, setItems] = useState<BillItemForm[]>(ensureMinimumRows([]));
  const stockVariantOptionsByKey = useMemo(
    () => new Map(stockVariantOptions.map((variant) => [variant.key, variant])),
    [stockVariantOptions],
  );

  const applyPackedStockRows = (stockRows: ApiStockArticleRow[]) => {
    const rows = (stockRows ?? []) as ApiStockArticleRow[];
    const byVariant = rows.reduce<Record<string, number>>((acc, row) => {
      const key = getStockVariantKey(row.articleId, row.size);
      acc[key] = (acc[key] ?? 0) + Number(row.quantityDozen ?? 0);
      return acc;
    }, {});

    const options = rows
      .map((row) => {
        const key = getStockVariantKey(row.articleId, row.size);
        return {
          key,
          articleId: row.articleId,
          articleName: row.articleName,
          size: normalizeSize(row.size),
          quantityDozen: Number(byVariant[key] ?? 0),
        };
      })
      .filter(
        (row, index, all) => all.findIndex((r) => r.key === row.key) === index,
      )
      .filter((row) => row.quantityDozen > 0)
      .sort((a, b) => {
        const byName = a.articleName.localeCompare(b.articleName);
        if (byName !== 0) return byName;
        return a.size.localeCompare(b.size);
      });

    setStockVariantOptions(options);
    setAvailableStockByVariant(byVariant);
  };

  const loadPackedStockOptions = async (excludeBillId?: string) => {
    try {
      const stockRows = await productionApi.listStockByArticle({
        mode: "PACKED",
        excludeBillId,
      });
      applyPackedStockRows(stockRows);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load packed stock.");
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [billData, partyData, articleData, stockRows] = await Promise.all([
        billApi.listBills(),
        partyApi.listParties({ type: "CUSTOMER" }),
        configApi.listArticles(),
        productionApi.listStockByArticle({ mode: "PACKED" }),
      ]);
      setBills(billData);
      setParties(partyData);
      setArticles(articleData);
      applyPackedStockRows(stockRows);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load bills.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isDialogOpen || editingBillId) return;
    void loadPackedStockOptions();
  }, [editingBillId, isDialogOpen]);

  const addItem = () => {
    setItems([...items, createEmptyBillItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length > 3) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === "articleId") {
      const article = articles.find((a) => a.id === value);
      if (article) {
        newItems[index].articleName = article.name;
      }
    }

    if (field === "stockVariantKey") {
      const selected = stockVariantOptions.find(
        (option) => option.key === value,
      );
      if (selected) {
        newItems[index].articleId = selected.articleId;
        newItems[index].articleName = selected.articleName;
        newItems[index].size = selected.size;
      } else {
        newItems[index].articleId = "";
        newItems[index].articleName = "";
        newItems[index].size = "";
      }
    }

    if (field === "quantity" || field === "price" || field === "discount") {
      newItems[index].total = calculateLineTotal(
        newItems[index].quantity,
        newItems[index].price,
        newItems[index].discount,
      );
    }

    setItems(newItems);
  };

  const resetForm = () => {
    setFormData({
      date: getCurrentDate(),
      partyId: "",
    });
    setItems(ensureMinimumRows([]));
    setEditingBillId(null);
    void loadPackedStockOptions();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const party = parties.find((p) => p.id === formData.partyId);
    if (!party) {
      toast.error("Please select a party");
      return;
    }

    const resolvedItems = items.map((item) => {
      const selectedVariant = item.stockVariantKey
        ? stockVariantOptionsByKey.get(item.stockVariantKey)
        : undefined;
      const articleId = selectedVariant?.articleId || item.articleId;
      const articleName = selectedVariant?.articleName || item.articleName;
      const size = selectedVariant?.size || normalizeSize(item.size);
      const stockVariantKey =
        selectedVariant?.key ||
        item.stockVariantKey ||
        (articleId ? getStockVariantKey(articleId, size) : "");

      return {
        ...item,
        articleId,
        articleName,
        size,
        stockVariantKey,
      };
    });

    const hasIncompleteVariantSelection = resolvedItems.some(
      (item) =>
        (item.articleId ||
          item.quantity > 0 ||
          item.price > 0 ||
          item.discount > 0) &&
        !item.stockVariantKey,
    );

    if (hasIncompleteVariantSelection) {
      toast.error("Please select a packed stock variant for each bill line.");
      return;
    }

    const validItems = resolvedItems.filter(
      (item) =>
        item.stockVariantKey &&
        item.articleId &&
        item.quantity > 0 &&
        item.price > 0 &&
        item.discount >= 0 &&
        item.discount <= item.price,
    );
    if (validItems.length === 0) {
      toast.error("Please add at least one valid item");
      return;
    }

    const requestedByVariant = validItems.reduce<Record<string, number>>(
      (acc, item) => {
        acc[item.stockVariantKey] =
          (acc[item.stockVariantKey] ?? 0) + Number(item.quantity);
        return acc;
      },
      {},
    );

    for (const [variantKey, requested] of Object.entries(requestedByVariant)) {
      const available = Number(availableStockByVariant[variantKey] ?? 0);
      if (requested > available) {
        const selected = stockVariantOptionsByKey.get(variantKey);
        const matchingItem = validItems.find(
          (item) => item.stockVariantKey === variantKey,
        );
        const [, rawSize = "-"] = variantKey.split("::");
        const articleName =
          selected?.articleName ||
          matchingItem?.articleName ||
          "Selected article";
        const sizeLabel =
          selected?.size || matchingItem?.size || rawSize || "-";
        toast.error(
          `${articleName} (${sizeLabel}) has only ${available} dozen available in packed stock.`,
        );
        return;
      }
    }

    try {
      const payload = {
        date: formData.date,
        partyId: formData.partyId,
        type: "RECEIVABLE" as const,
        status: "CONFIRMED" as const,
        lines: validItems.map((item) => ({
          articleId: item.articleId,
          size: toBillLineSize(item.size),
          quantity: item.quantity,
          price: item.price,
          discount: item.discount,
          total: calculateLineTotal(item.quantity, item.price, item.discount),
        })),
      };

      if (editingBillId) {
        const bill = await billApi.updateBill(editingBillId, payload);
        if (bill.type === "RECEIVABLE" && bill.status !== "CONFIRMED") {
          await billApi.confirmBill(bill.id);
        }
        toast.success("Bill updated");
      } else {
        const bill = await billApi.createBill(payload);
        if (bill.type === "RECEIVABLE") {
          await billApi.confirmBill(bill.id);
        }
        toast.success("Bill created");
      }
      await loadData();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save bill.");
    }
  };

  const startEdit = async (bill: ApiBill) => {
    setEditingBillId(bill.id);
    setFormData({
      date: bill.date.slice(0, 10),
      partyId: bill.partyId || "",
    });
    setItems(
      ensureMinimumRows(
        bill.lines.map((line) => ({
          stockVariantKey: getStockVariantKey(
            line.articleId,
            normalizeSize(line.size),
          ),
          articleId: line.articleId,
          articleName:
            line.article?.name ||
            articles.find((article) => article.id === line.articleId)?.name ||
            "",
          size: normalizeSize(line.size),
          quantity: Number(line.quantity),
          price: Number(line.price),
          discount: Number(line.discount ?? 0),
          total: Number(line.total),
        })),
      ),
    );
    await loadPackedStockOptions(bill.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (bill: ApiBill) => {
    if (!confirm("Delete this bill?")) return;
    try {
      await billApi.deleteBill(bill.id);
      toast.success("Bill moved to Deleted Items.");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete bill.");
    }
  };

  const handleVerify = async (bill: ApiBill) => {
    try {
      await billApi.verifyBill(bill.id);
      toast.success("Bill verified");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to verify bill.");
    }
  };

  const printBill = (bill: ApiBill) => {
    const printed = printBillInvoice(bill, {
      fallbackArticleNames: new Map(
        articles.map((article) => [article.id, article.name]),
      ),
    });
    if (!printed) {
      toast.error("Unable to open print preview.");
    }
  };

  const completedItems = useMemo(
    () => items.filter(isCompleteBillItem),
    [items],
  );
  const { totalQuantityDozen, grossTotal, discountTotal, grandTotal } = useMemo(
    () => calculateBillTotals(completedItems),
    [completedItems],
  );

  const getAvailableQuantity = (stockVariantKey: string) =>
    Number(availableStockByVariant[stockVariantKey] ?? 0);

  const sortedBills = useMemo(
    () =>
      [...bills].sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return String(b.billNumber).localeCompare(String(a.billNumber));
      }),
    [bills],
  );

  const filteredBills = useMemo(() => {
    const query = billSearchQuery.trim().toLowerCase();
    let fromTs: number | null = null;
    let toTs: number | null = null;

    if (billTimePreset === "CUSTOM") {
      fromTs = billDateFrom
        ? new Date(`${billDateFrom}T00:00:00`).getTime()
        : null;
      toTs = billDateTo
        ? new Date(`${billDateTo}T23:59:59.999`).getTime()
        : null;
    } else {
      const range = getPresetDateRange(billTimePreset, new Date());
      fromTs = range?.from.getTime() ?? null;
      toTs = range?.to.getTime() ?? null;
    }

    return sortedBills.filter((bill) => {
      if (billStatusFilter !== "ALL" && bill.paymentStatus !== billStatusFilter) {
        return false;
      }

      const billTs = new Date(bill.date).getTime();
      if (fromTs !== null && billTs < fromTs) return false;
      if (toTs !== null && billTs > toTs) return false;

      if (!query) return true;

      const searchable = [
        bill.billNumber,
        bill.party?.name || "",
        bill.paymentStatus,
        String(bill.total ?? ""),
        String(bill.remaining ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    billDateFrom,
    billDateTo,
    billSearchQuery,
    billStatusFilter,
    billTimePreset,
    sortedBills,
  ]);

  const {
    currentPage: billsPage,
    setCurrentPage: setBillsPage,
    pageSize: billsPageSize,
    setPageSize: setBillsPageSize,
    totalPages: billsTotalPages,
    totalItems: billsTotalItems,
    startItem: billsStartItem,
    endItem: billsEndItem,
    paginatedItems: paginatedBills,
    goToPreviousPage: goToPreviousBillsPage,
    goToNextPage: goToNextBillsPage,
  } = useClientPagination(filteredBills);

  const partyOptions = useMemo(
    () => parties.map((party) => ({ value: party.id, label: party.name })),
    [parties],
  );

  const stockVariantSelectOptions = useMemo(
    () =>
      stockVariantOptions.map((variant) => ({
        value: variant.key,
        label: `${variant.articleName} (${variant.size})`,
        description: `${variant.quantityDozen} dozen available`,
      })),
    [stockVariantOptions],
  );

  const clearBillFilters = () => {
    setBillSearchQuery("");
    setBillStatusFilter("ALL");
    setBillTimePreset("THIS_MONTH");
    setBillDateFrom("");
    setBillDateTo("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Bill Management</CardTitle>
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Bill
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[99vw] max-w-[99vw] sm:max-w-[99vw] max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingBillId ? "Edit" : "Create New"} Bill
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) =>
                          setFormData({ ...formData, date: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label>Party</Label>
                      <SearchableSelect
                        value={formData.partyId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, partyId: value })
                        }
                        options={partyOptions}
                        placeholder="Select party"
                        searchPlaceholder="Search party..."
                        emptyMessage="No parties found."
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Bill Items</Label>
                      <Button type="button" size="sm" onClick={addItem}>
                        <Plus className="h-4 w-4 mr-1" /> Add Row
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Article</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Quantity (Dozen)</TableHead>
                          <TableHead>Price / Pair</TableHead>
                          <TableHead>Discount / Pair</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div className="space-y-1.5">
                                <SearchableSelect
                                  value={item.stockVariantKey}
                                  onValueChange={(value) =>
                                    updateItem(index, "stockVariantKey", value)
                                  }
                                  options={stockVariantSelectOptions}
                                  placeholder="Select stock variant"
                                  searchPlaceholder="Search article or size..."
                                  emptyMessage="No stock variants found."
                                />
                                {item.stockVariantKey && (
                                  <p className="text-xs text-muted-foreground">
                                    Available packed stock:{" "}
                                    {getAvailableQuantity(item.stockVariantKey)}{" "}
                                    dozen
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.size}
                                placeholder="Auto-selected"
                                readOnly
                                disabled
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                max={
                                  item.stockVariantKey
                                    ? getAvailableQuantity(item.stockVariantKey)
                                    : undefined
                                }
                                value={item.quantity || ""}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "quantity",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.price || ""}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "price",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.discount || ""}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "discount",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>{formatCurrency(item.total)}</TableCell>
                            <TableCell>
                              {items.length > 3 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeItem(index)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Quantity is entered in dozen, while price and discount are
                      per pair.
                      Example:{" "}
                      <span className="font-medium">
                        12 dozen x 12 pairs x price 100 = 14,400
                      </span>
                    </p>
                  </div>

                  <div className="grid gap-3 rounded bg-muted p-4 md:grid-cols-4">
                    <div className="rounded bg-background/70 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Total Quantity
                      </p>
                      <p className="mt-1 font-medium">
                        {formatQuantityValue(totalQuantityDozen)} dozen
                      </p>
                    </div>
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
                        Discount
                      </p>
                      <p className="mt-1 font-medium">
                        {formatCurrency(discountTotal)}
                      </p>
                    </div>
                    <div className="rounded bg-background/70 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Grand Total
                      </p>
                      <p className="mt-1 text-xl font-semibold">
                        {formatCurrency(grandTotal)}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingBillId ? "Update" : "Create"} Bill
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
            <div className="min-w-[240px] flex-1 md:max-w-[360px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                Search
              </Label>
              <Input
                value={billSearchQuery}
                onChange={(event) => setBillSearchQuery(event.target.value)}
                placeholder="Search bill number or party..."
              />
            </div>
            <div className="min-w-[200px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                Status
              </Label>
              <Select
                value={billStatusFilter}
                onValueChange={(value) =>
                  setBillStatusFilter(value as typeof billStatusFilter)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                  <SelectItem value="PARTIAL_PAID">Partial Paid</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                Time
              </Label>
              <Select
                value={billTimePreset}
                onValueChange={(value) =>
                  setBillTimePreset(value as FilterTimePreset)
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
            {billTimePreset === "CUSTOM" && (
              <>
                <div>
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                    From
                  </Label>
                  <Input
                    type="date"
                    value={billDateFrom}
                    onChange={(event) => setBillDateFrom(event.target.value)}
                    className="w-40"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                    To
                  </Label>
                  <Input
                    type="date"
                    value={billDateTo}
                    onChange={(event) => setBillDateTo(event.target.value)}
                    className="w-40"
                  />
                </div>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearBillFilters}
            >
              <Filter className="mr-2 h-4 w-4" />
              Reset Filters
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Total Qty</TableHead>
                <TableHead>Grand Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    Loading bills...
                  </TableCell>
                </TableRow>
              ) : bills.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No bills yet
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBills.map((bill) => {
                  const billTotals = getBillTotalsFromBill(bill);
                  const total = billTotals.grandTotal;
                  const remaining = billTotals.remaining;
                  const totalPaid = billTotals.totalPaid;
                  const canDelete = remaining === total && totalPaid === 0;
                  const canEdit = remaining > 0;
                  const canVerify = remaining === 0 && !bill.isVerified;

                  return (
                    <TableRow key={bill.id}>
                      <TableCell>{bill.billNumber}</TableCell>
                    <TableCell>{formatDate(bill.date)}</TableCell>
                    <TableCell>{bill.party?.name || "-"}</TableCell>
                    <TableCell>
                      {formatQuantityValue(billTotals.totalQuantityDozen)} dozen
                    </TableCell>
                    <TableCell>{formatCurrency(total)}</TableCell>
                    <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => printBill(bill)}
                            title="Print"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          {canEdit && (
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => startEdit(bill)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleDelete(bill)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          {canVerify && (
                            <Button
                              size="icon"
                              variant="default"
                              onClick={() => handleVerify(bill)}
                              title="Verify"
                              className="bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-amber-300 animate-pulse"
                            >
                              <BadgeCheck className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <TablePagination
            currentPage={billsPage}
            totalPages={billsTotalPages}
            totalItems={billsTotalItems}
            startItem={billsStartItem}
            endItem={billsEndItem}
            pageSize={billsPageSize}
            setPageSize={setBillsPageSize}
            goToPreviousPage={goToPreviousBillsPage}
            goToNextPage={goToNextBillsPage}
            setCurrentPage={setBillsPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
