
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
import { Plus } from "lucide-react";
import { formatCurrency, formatDate, getCurrentDate } from "../lib/utils";
import { configApi, partyApi, purchaseApi } from "../lib/api";
import type { ApiChemicalPurchase, ApiExpenseCategory, ApiParty } from "../types/api";
import { toast } from "sonner";

type PaymentType = "cash" | "credit";

export function ChemicalManagement() {
  const [transactions, setTransactions] = useState<ApiChemicalPurchase[]>([]);
  const [parties, setParties] = useState<ApiParty[]>([]);
  const [categories, setCategories] = useState<ApiExpenseCategory[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: getCurrentDate(),
    partyId: "",
    categoryId: "",
    weight: "",
    rate: "",
    paymentType: "cash" as PaymentType,
    detail: "",
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [purchaseData, partyData, categoryData] = await Promise.all([
        purchaseApi.listChemicals(),
        partyApi.listParties(),
        configApi.listExpenseCategories(),
      ]);
      setTransactions(purchaseData);
      setParties(partyData);
      setCategories(categoryData);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load chemical purchases.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.categoryId) {
      toast.error("Select an expense category");
      return;
    }

    const weight = parseFloat(formData.weight);
    const rate = parseFloat(formData.rate);
    if (!Number.isFinite(weight) || !Number.isFinite(rate)) {
      toast.error("Enter valid quantity and rate");
      return;
    }

    const totalAmount = weight * rate;

    try {
      if (editingId) {
        await purchaseApi.updateChemical(editingId, {
          date: formData.date,
          partyId: formData.partyId || undefined,
          categoryId: formData.categoryId,
          quantityKg: weight,
          ratePerKg: rate,
          totalAmount,
          paymentType: formData.paymentType === "credit" ? "CREDIT" : "CASH",
          description: formData.detail || undefined,
        });
        toast.success("Chemical purchase updated");
      } else {
        await purchaseApi.createChemical({
          date: formData.date,
          partyId: formData.partyId || undefined,
          categoryId: formData.categoryId,
          quantityKg: weight,
          ratePerKg: rate,
          totalAmount,
          paymentType: formData.paymentType === "credit" ? "CREDIT" : "CASH",
          description: formData.detail || undefined,
        });
        toast.success("Chemical purchase added");
      }
      await loadData();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save chemical purchase.");
    }
  };

  const resetForm = () => {
    setFormData({
      date: getCurrentDate(),
      partyId: "",
      categoryId: "",
      weight: "",
      rate: "",
      paymentType: "cash",
      detail: "",
    });
    setEditingId(null);
  };

  const startEdit = (purchase: ApiChemicalPurchase) => {
    setEditingId(purchase.id);
    setFormData({
      date: purchase.date.slice(0, 10),
      partyId: purchase.partyId || "",
      categoryId: purchase.expenses?.[0]?.categoryId || "",
      weight: String(purchase.quantityKg),
      rate: String(purchase.ratePerKg),
      paymentType: purchase.paymentType === "CREDIT" ? "credit" : "cash",
      detail: purchase.expenses?.[0]?.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (purchaseId: string) => {
    if (!confirm("Delete this purchase?")) return;
    try {
      await purchaseApi.deleteChemical(purchaseId);
      toast.success("Purchase deleted");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete purchase.");
    }
  };

  const getDetail = (purchase: ApiChemicalPurchase) =>
    purchase.expenses?.[0]?.description || "-";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Chemical Management</CardTitle>
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
                  Add Chemical Purchase
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? "Edit" : "Add"} Chemical Purchase
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
                    <div>
                      <Label>Expense Category</Label>
                      <Select
                        value={formData.categoryId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, categoryId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Weight (kg)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.weight}
                        onChange={(e) =>
                          setFormData({ ...formData, weight: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label>Rate per kg</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.rate}
                        onChange={(e) =>
                          setFormData({ ...formData, rate: e.target.value })
                        }
                        required
                      />
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
                    <Label>Details</Label>
                    <Input
                      value={formData.detail}
                      onChange={(e) =>
                        setFormData({ ...formData, detail: e.target.value })
                      }
                      placeholder="Additional details..."
                    />
                  </div>
                  {formData.weight && formData.rate && (
                    <div className="p-3 bg-muted rounded">
                      <p>
                        Total: {" "}
                        {formatCurrency(
                          parseFloat(formData.weight) * parseFloat(formData.rate)
                        )}
                      </p>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingId ? "Update" : "Add"} Transaction
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
                <TableHead>Date</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Weight (kg)</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment Type</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    Loading transactions...
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No transactions yet
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => {
                  const total = Number(transaction.totalAmount);
                  const paid = transaction.paymentType === "CASH" ? total : 0;
                  const balance = transaction.paymentType === "CREDIT" ? total : 0;
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>{formatDate(transaction.date)}</TableCell>
                      <TableCell>{transaction.party?.name || "-"}</TableCell>
                      <TableCell>{transaction.quantityKg}</TableCell>
                      <TableCell>{formatCurrency(Number(transaction.ratePerKg))}</TableCell>
                      <TableCell>{formatCurrency(total)}</TableCell>
                      <TableCell>
                        <span
                          className={
                            transaction.paymentType === "CASH"
                              ? "text-green-600"
                              : "text-orange-600"
                          }
                        >
                          {transaction.paymentType}
                        </span>
                      </TableCell>
                      <TableCell>{formatCurrency(paid)}</TableCell>
                      <TableCell>
                        <span
                          className={
                            balance > 0 ? "text-red-600" : "text-green-600"
                          }
                        >
                          {formatCurrency(balance)}
                        </span>
                      </TableCell>
                      <TableCell>{getDetail(transaction)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(transaction)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(transaction.id)}>
                            Delete
                          </Button>
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
    </div>
  );
}
