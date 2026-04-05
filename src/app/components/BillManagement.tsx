import { useEffect, useState } from "react";
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
  Printer,
  Eye,
  Banknote,
  Pencil,
  Trash2,
  BadgeCheck,
  CheckCircle2,
} from "lucide-react";
import { billApi, configApi, partyApi, productionApi } from "../lib/api";
import { formatCurrency, formatDate, getCurrentDate } from "../lib/utils";
import type {
  ApiArticle,
  ApiBill,
  ApiBillLedgerEntry,
  ApiPaymentMethod,
  ApiParty,
  ApiStockArticleRow,
} from "../types/api";
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

const calculateLineDiscount = (
  quantity: number,
  price: number,
  discount: number,
) => roundMoney(discount * quantity);

const calculateLineTotal = (
  quantity: number,
  price: number,
  discount: number,
) =>
  roundMoney(
    quantity * price - calculateLineDiscount(quantity, price, discount),
  );

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

  const [ledgerBill, setLedgerBill] = useState<ApiBill | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<ApiBillLedgerEntry[]>([]);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);

  const [paymentBill, setPaymentBill] = useState<ApiBill | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    date: getCurrentDate(),
    amount: "",
    method: "KHATA" as ApiPaymentMethod,
    description: "",
  });

  const [formData, setFormData] = useState({
    date: getCurrentDate(),
    partyId: "",
  });

  const [items, setItems] = useState<BillItemForm[]>(ensureMinimumRows([]));

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
          (row, index, all) =>
            all.findIndex((r) => r.key === row.key) === index,
        )
        .filter((row) => row.quantityDozen > 0)
        .sort((a, b) => {
          const byName = a.articleName.localeCompare(b.articleName);
          if (byName !== 0) return byName;
          return a.size.localeCompare(b.size);
        });

      setStockVariantOptions(options);
      setAvailableStockByVariant(byVariant);
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const party = parties.find((p) => p.id === formData.partyId);
    if (!party) {
      toast.error("Please select a party");
      return;
    }

    const validItems = items.filter(
      (item) =>
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
        const key = getStockVariantKey(item.articleId, item.size);
        acc[key] = (acc[key] ?? 0) + Number(item.quantity);
        return acc;
      },
    );

    for (const [variantKey, requested] of Object.entries(requestedByVariant)) {
      const available = Number(availableStockByVariant[variantKey] ?? 0);
      if (requested > available) {
        const selected = stockVariantOptions.find(
          (option) => option.key === variantKey,
        );
        const articleName = selected?.articleName || "Selected article";
        const sizeLabel = selected?.size || "-";
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

  const startEdit = (bill: ApiBill) => {
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
    setIsDialogOpen(true);
  };

  const handleDelete = async (bill: ApiBill) => {
    if (!confirm("Delete this bill?")) return;
    try {
      await billApi.deleteBill(bill.id);
      toast.success("Bill deleted");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete bill.");
    }
  };

  const openLedger = async (bill: ApiBill) => {
    try {
      const entries = await billApi.getLedger(bill.id);
      setLedgerBill(bill);
      setLedgerEntries(entries);
      setIsLedgerOpen(true);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load bill ledger.");
    }
  };

  const openPayment = (bill: ApiBill) => {
    setPaymentBill(bill);
    setPaymentData({
      date: getCurrentDate(),
      amount: String(Number(bill.remaining ?? 0)),
      method: "KHATA",
      description: "",
    });
    setIsPaymentOpen(true);
  };

  const handleReceivePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentBill) return;

    const amount = Math.abs(Number(paymentData.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter valid amount.");
      return;
    }

    try {
      await billApi.receivePayment(paymentBill.id, {
        amount,
        date: paymentData.date,
        method: paymentData.method,
        description: paymentData.description || undefined,
      });
      toast.success("Payment received");
      setIsPaymentOpen(false);
      setPaymentBill(null);
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to receive payment.");
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
    const printWindow = window.open("", "", "width=800,height=600");
    if (!printWindow) return;

    const rows = bill.lines
      .map((line) => {
        const articleName =
          line.article?.name ||
          articles.find((article) => article.id === line.articleId)?.name ||
          "Unknown";
        return `
                <tr>
                  <td>${articleName}</td>
                  <td>${line.size ?? "-"}</td>
                  <td>${line.quantity}</td>
                  <td>${formatCurrency(Number(line.price))}</td>
                  <td>${formatCurrency(Number(line.total))}</td>
                </tr>
              `;
      })
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill ${bill.billNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .info { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total { text-align: right; font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>SALES BILL</h1>
            <p>Bill No: ${bill.billNumber}</p>
          </div>
          <div class="info">
            <p><strong>Date:</strong> ${formatDate(bill.date)}</p>
            <p><strong>Party:</strong> ${bill.party?.name || "-"}</p>
            <p><strong>Grand Total:</strong> ${formatCurrency(Number(bill.total))}</p>
            <p><strong>Remaining:</strong> ${formatCurrency(Number(bill.remaining ?? 0))}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Size</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const grossTotal = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
    0,
  );
  const discountTotal = items.reduce(
    (sum, item) =>
      sum +
      calculateLineDiscount(
        Number(item.quantity || 0),
        Number(item.price || 0),
        Number(item.discount || 0),
      ),
    0,
  );
  const grandTotal = roundMoney(grossTotal - discountTotal);

  const getAvailableQuantity = (stockVariantKey: string) =>
    Number(availableStockByVariant[stockVariantKey] ?? 0);

  const getStatusLabel = (bill: ApiBill) => {
    if (bill.paymentStatus === "PAID") return "Paid";
    if (bill.paymentStatus === "PARTIAL_PAID") return "Partial Paid";
    return "Unpaid";
  };

  const getStatusClass = (bill: ApiBill) => {
    if (bill.paymentStatus === "PAID") return "text-green-600";
    if (bill.paymentStatus === "PARTIAL_PAID") return "text-orange-600";
    return "text-red-600";
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
                      <Select
                        value={formData.partyId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, partyId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select party" />
                        </SelectTrigger>
                        <SelectContent>
                          {parties.map((party) => (
                            <SelectItem key={party.id} value={party.id}>
                              {party.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                          <TableHead>Quantity</TableHead>
                          <TableHead>Price</TableHead>
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
                                <Select
                                  value={item.stockVariantKey}
                                  onValueChange={(value) =>
                                    updateItem(index, "stockVariantKey", value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select stock variant" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {stockVariantOptions.map((variant) => (
                                      <SelectItem
                                        key={variant.key}
                                        value={variant.key}
                                      >
                                        {variant.articleName} ({variant.size})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
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
                      Discount is deducted directly from the pair price.
                      Example:{" "}
                      <span className="font-medium">
                        price 1200, discount 100, net 1100
                      </span>
                    </p>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Grand Total</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    Loading bills...
                  </TableCell>
                </TableRow>
              ) : bills.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    No bills yet
                  </TableCell>
                </TableRow>
              ) : (
                bills.map((bill) => {
                  const total = Number(bill.total ?? 0);
                  const remaining = Number(bill.remaining ?? 0);
                  const totalPaid = Number(bill.totalPaid ?? 0);
                  const canDelete = remaining === total && totalPaid === 0;
                  const canEdit = remaining > 0;
                  const canReceive = remaining > 0;
                  const canVerify = remaining === 0 && !bill.isVerified;

                  return (
                    <TableRow key={bill.id}>
                      <TableCell>{bill.billNumber}</TableCell>
                      <TableCell>{formatDate(bill.date)}</TableCell>
                      <TableCell>{bill.party?.name || "-"}</TableCell>
                      <TableCell>{formatCurrency(total)}</TableCell>
                      <TableCell>{formatCurrency(remaining)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={getStatusClass(bill)}>
                            {getStatusLabel(bill)}
                          </span>
                          {bill.paymentStatus === "PAID" && bill.isVerified && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                      </TableCell>
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
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => openLedger(bill)}
                            title="View Ledger"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canReceive && (
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => openPayment(bill)}
                              title="Receive Payment"
                            >
                              <Banknote className="h-4 w-4" />
                            </Button>
                          )}
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
        </CardContent>
      </Card>

      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Receive Payment {paymentBill ? `- ${paymentBill.billNumber}` : ""}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReceivePayment} className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={paymentData.date}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, date: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={paymentData.amount}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, amount: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select
                value={paymentData.method}
                onValueChange={(value) =>
                  setPaymentData({
                    ...paymentData,
                    method: value as ApiPaymentMethod,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="KHATA">Khata</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={paymentData.description}
                onChange={(e) =>
                  setPaymentData({
                    ...paymentData,
                    description: e.target.value,
                  })
                }
                placeholder="Optional note"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPaymentOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Receive</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isLedgerOpen} onOpenChange={setIsLedgerOpen}>
        <DialogContent className="w-[50vw] max-w-[1400px] sm:max-w-[1400px] h-[82vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Bill Ledger {ledgerBill ? `- ${ledgerBill.billNumber}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      No bill ledger records
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell>{entry.reference || "-"}</TableCell>
                      <TableCell title={entry.description || "-"}>
                        {entry.description
                          ? entry.description.slice(0, 12)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {entry.kind === "RECEIVABLE" ? "Receivable" : "Payment"}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(Number(entry.amount ?? 0))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
