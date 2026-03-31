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
import { billApi, configApi, partyApi } from "../lib/api";
import { formatCurrency, formatDate, getCurrentDate } from "../lib/utils";
import type {
  ApiArticle,
  ApiBill,
  ApiBillLedgerEntry,
  ApiPaymentMethod,
  ApiParty,
} from "../types/api";
import { toast } from "sonner";

type BillItemForm = {
  articleId: string;
  articleName: string;
  size: string;
  quantity: number;
  price: number;
  total: number;
};

const createEmptyBillItem = (): BillItemForm => ({
  articleId: "",
  articleName: "",
  size: "",
  quantity: 0,
  price: 0,
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
      const [billData, partyData, articleData] = await Promise.all([
        billApi.listBills(),
        partyApi.listParties(),
        configApi.listArticles(),
      ]);
      setBills(billData);
      setParties(partyData);
      setArticles(articleData);
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

    if (field === "quantity" || field === "price") {
      newItems[index].total = newItems[index].quantity * newItems[index].price;
    }

    setItems(newItems);
  };

  const resetForm = () => {
    setFormData({
      date: getCurrentDate(),
      partyId: "",
    });
    setItems([
      { articleId: "", articleName: "", quantity: 0, price: 0, total: 0 },
    ]);
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
      (item) => item.articleId && item.quantity > 0 && item.price > 0,
    );
    if (validItems.length === 0) {
      toast.error("Please add at least one valid item");
      return;
    }

    try {
      const payload = {
        date: formData.date,
        partyId: formData.partyId,
        type: "RECEIVABLE" as const,
        status: "CONFIRMED" as const,
        lines: validItems.map((item) => ({
          articleId: item.articleId,
          size: item.size.trim() || null,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
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
          articleId: line.articleId,
          articleName:
            line.article?.name ||
            articles.find((article) => article.id === line.articleId)?.name ||
            "",
          size: line.size || "",
          quantity: Number(line.quantity),
          price: Number(line.price),
          total: Number(line.total),
        }))
      )
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

  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

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
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                          <TableHead>Total</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Select
                                value={item.articleId}
                                onValueChange={(value) =>
                                  updateItem(index, "articleId", value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select article" />
                                </SelectTrigger>
                                <SelectContent>
                                  {articles.map((article) => (
                                    <SelectItem
                                      key={article.id}
                                      value={article.id}
                                    >
                                      {article.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.size}
                                onChange={(e) =>
                                  updateItem(index, "size", e.target.value)
                                }
                                placeholder="Size"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
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
                  </div>

                  <div className="flex justify-between items-center p-4 bg-muted rounded">
                    <span className="text-lg">Grand Total:</span>
                    <span className="text-2xl">
                      {formatCurrency(grandTotal)}
                    </span>
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
                <TableHead>Bill No.</TableHead>
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
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      No bill ledger records
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
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
