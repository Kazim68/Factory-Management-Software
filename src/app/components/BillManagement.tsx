
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
import { Plus, Minus, Printer } from "lucide-react";
import { billApi, configApi, partyApi } from "../lib/api";
import { formatCurrency, formatDate, getCurrentDate } from "../lib/utils";
import type { ApiArticle, ApiBill, ApiParty } from "../types/api";
import { toast } from "sonner";

type PaymentType = "cash" | "credit";

type BillItemForm = {
  articleId: string;
  articleName: string;
  quantity: number;
  price: number;
  total: number;
};

export function BillManagement() {
  const [bills, setBills] = useState<ApiBill[]>([]);
  const [parties, setParties] = useState<ApiParty[]>([]);
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: getCurrentDate(),
    partyId: "",
    paymentType: "cash" as PaymentType,
  });

  const [items, setItems] = useState<BillItemForm[]>([
    { articleId: "", articleName: "", quantity: 0, price: 0, total: 0 },
  ]);

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
    setItems([...items, { articleId: "", articleName: "", quantity: 0, price: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const party = parties.find((p) => p.id === formData.partyId);
    if (!party) {
      toast.error("Please select a party");
      return;
    }

    const validItems = items.filter(
      (item) => item.articleId && item.quantity > 0 && item.price > 0
    );
    if (validItems.length === 0) {
      toast.error("Please add at least one valid item");
      return;
    }

    const grandTotal = validItems.reduce((sum, item) => sum + item.total, 0);

    try {
      const payload = {
        date: formData.date,
        partyId: formData.partyId,
        type: formData.paymentType === "credit" ? "CREDIT" : "CASH",
        status: "CONFIRMED" as const,
        lines: validItems.map((item) => ({
          articleId: item.articleId,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
      };

      if (editingBillId) {
        const bill = await billApi.updateBill(editingBillId, payload);
        if (bill.type === "CREDIT" && bill.status !== "CONFIRMED") {
          await billApi.confirmBill(bill.id);
        }
        toast.success("Bill updated successfully");
      } else {
        const bill = await billApi.createBill(payload);
        if (bill.type === "CREDIT") {
          await billApi.confirmBill(bill.id);
        }
        toast.success("Bill created successfully");
      }
      await loadData();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save bill.");
    }
  };

  const resetForm = () => {
    setFormData({
      date: getCurrentDate(),
      partyId: "",
      paymentType: "cash",
    });
    setItems([{ articleId: "", articleName: "", quantity: 0, price: 0, total: 0 }]);
    setEditingBillId(null);
  };

  const startEdit = (bill: ApiBill) => {
    setEditingBillId(bill.id);
    setFormData({
      date: bill.date.slice(0, 10),
      partyId: bill.partyId || "",
      paymentType: bill.type === "CREDIT" ? "credit" : "cash",
    });
    setItems(
      bill.lines.map((line) => ({
        articleId: line.articleId,
        articleName:
          line.article?.name ||
          articles.find((article) => article.id === line.articleId)?.name ||
          "",
        quantity: Number(line.quantity),
        price: Number(line.price),
        total: Number(line.total),
      }))
    );
    setIsDialogOpen(true);
  };

  const handleDelete = async (billId: string) => {
    if (!confirm("Delete this bill?")) return;
    try {
      await billApi.deleteBill(billId);
      toast.success("Bill deleted");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete bill.");
    }
  };

  const printBill = (bill: ApiBill) => {
    const printWindow = window.open("", "", "width=800,height=600");
    if (!printWindow) return;

    const rows = bill.lines.map((line) => {
      const articleName = line.article?.name ||
        articles.find((article) => article.id === line.articleId)?.name ||
        "Unknown";
      return `
                <tr>
                  <td>${articleName}</td>
                  <td>${line.quantity}</td>
                  <td>${formatCurrency(Number(line.price))}</td>
                  <td>${formatCurrency(Number(line.total))}</td>
                </tr>
              `;
    }).join("");

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
            <p><strong>Payment Type:</strong> ${bill.type}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="total">
            <p>Grand Total: ${formatCurrency(Number(bill.total))}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

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
                  <div className="grid grid-cols-3 gap-4">
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
                    <div>
                      <Label>Payment Type</Label>
                      <Select
                        value={formData.paymentType}
                        onValueChange={(value: PaymentType) =>
                          setFormData({ ...formData, paymentType: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
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
                                    <SelectItem key={article.id} value={article.id}>
                                      {article.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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
                                    parseFloat(e.target.value) || 0
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
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>{formatCurrency(item.total)}</TableCell>
                            <TableCell>
                              {items.length > 1 && (
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
                    <span className="text-2xl">{formatCurrency(grandTotal)}</span>
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
                <TableHead>Items</TableHead>
                <TableHead>Grand Total</TableHead>
                <TableHead>Payment Type</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Loading bills...
                  </TableCell>
                </TableRow>
              ) : bills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No bills yet
                  </TableCell>
                </TableRow>
              ) : (
                bills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell>{bill.billNumber}</TableCell>
                    <TableCell>{formatDate(bill.date)}</TableCell>
                    <TableCell>{bill.party?.name || "-"}</TableCell>
                    <TableCell>{bill.lines.length} item(s)</TableCell>
                    <TableCell>{formatCurrency(Number(bill.total))}</TableCell>
                    <TableCell>
                      <span
                        className={
                          bill.type === "CASH"
                            ? "text-green-600"
                            : "text-orange-600"
                        }
                      >
                        {bill.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => printBill(bill)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(bill)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(bill.id)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
