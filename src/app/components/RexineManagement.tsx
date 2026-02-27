
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
import type { ApiExpenseCategory, ApiParty, ApiRexinePurchase } from "../types/api";
import { toast } from "sonner";

type PaymentType = "cash" | "payable";

export function RexineManagement() {
  const [transactions, setTransactions] = useState<ApiRexinePurchase[]>([]);
  const [parties, setParties] = useState<ApiParty[]>([]);
  const [categories, setCategories] = useState<ApiExpenseCategory[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: getCurrentDate(),
    partyId: "",
    categoryId: "",
    meters: "",
    rate: "",
    paymentType: "cash" as PaymentType,
    detail: "",
  });

  const getPartyName = (partyId?: string | null) =>
    parties.find((party) => party.id === partyId)?.name || "Unknown";

  const getCategoryName = (categoryId?: string | null) =>
    categories.find((category) => category.id === categoryId)?.name || "Unknown";

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [purchaseData, partyData, categoryData] = await Promise.all([
        purchaseApi.listRexine(),
        partyApi.listParties(),
        configApi.listExpenseCategories(),
      ]);
      setTransactions(purchaseData);
      setParties(partyData);
      setCategories(categoryData);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load rexine purchases.");
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

    const meters = parseFloat(formData.meters);
    const rate = parseFloat(formData.rate);
    if (!Number.isFinite(meters) || !Number.isFinite(rate)) {
      toast.error("Enter valid quantity and rate");
      return;
    }

    const totalAmount = meters * rate;

    try {
      if (editingId) {
        const current = transactions.find((entry) => entry.id === editingId);
        await purchaseApi.updateRexine(editingId, {
          date: formData.date,
          partyId: formData.partyId || undefined,
          categoryId: formData.categoryId,
          quantityMeter: meters,
          ratePerMeter: rate,
          totalAmount,
          paymentType: formData.paymentType === "payable" ? "KHATA" : "CASH",
          description: formData.detail || undefined,
        }, {
          itemLabel: getPartyName(formData.partyId),
          fieldLabels: {
            partyId: getPartyName(formData.partyId),
            categoryId: getCategoryName(formData.categoryId),
          },
          previousValues: {
            date: current?.date?.slice(0, 10),
            partyId: getPartyName(current?.partyId),
            categoryId: getCategoryName(current?.expenses?.[0]?.categoryId),
            quantityMeter: current?.quantityMeter,
            ratePerMeter: current?.ratePerMeter,
            totalAmount: current?.totalAmount,
            paymentType: current?.paymentType,
            description: current?.expenses?.[0]?.description || undefined,
          },
        });
        toast.success("Rexine purchase updated");
      } else {
        await purchaseApi.createRexine({
          date: formData.date,
          partyId: formData.partyId || undefined,
          categoryId: formData.categoryId,
          quantityMeter: meters,
          ratePerMeter: rate,
          totalAmount,
          paymentType: formData.paymentType === "payable" ? "KHATA" : "CASH",
          description: formData.detail || undefined,
        }, {
          itemLabel: getPartyName(formData.partyId),
        });
        toast.success("Rexine purchase added");
      }
      await loadData();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save rexine purchase.");
    }
  };

  const resetForm = () => {
    setFormData({
      date: getCurrentDate(),
      partyId: "",
      categoryId: "",
      meters: "",
      rate: "",
      paymentType: "cash",
      detail: "",
    });
    setEditingId(null);
  };

  const getDetail = (purchase: ApiRexinePurchase) =>
    purchase.expenses?.[0]?.description || "-";

  const startEdit = (purchase: ApiRexinePurchase) => {
    setEditingId(purchase.id);
    setFormData({
      date: purchase.date.slice(0, 10),
      partyId: purchase.partyId || "",
      categoryId: purchase.expenses?.[0]?.categoryId || "",
      meters: String(purchase.quantityMeter),
      rate: String(purchase.ratePerMeter),
      paymentType: ["CREDIT", "KHATA"].includes(String(purchase.paymentType))
        ? "payable"
        : "cash",
      detail: purchase.expenses?.[0]?.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (purchaseId: string) => {
    if (!confirm("Delete this purchase?")) return;
    try {
      const purchase = transactions.find((entry) => entry.id === purchaseId);
      await purchaseApi.deleteRexine(purchaseId, {
        itemLabel: getPartyName(purchase?.partyId),
      });
      toast.success("Purchase deleted");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete purchase.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Rexine Management</CardTitle>
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
                  Add Rexine Purchase
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? "Edit" : "Add"} Rexine Purchase
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
                          {parties
                            .filter((party) => party.type === "SUPPLIER")
                            .map((party) => (
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
                      <Label>Meters</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.meters}
                        onChange={(e) =>
                          setFormData({ ...formData, meters: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label>Rate per meter</Label>
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
                      <Label>Settlement Type</Label>
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
                          <SelectItem value="payable">Payable</SelectItem>
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
                  {formData.meters && formData.rate && (
                    <div className="p-3 bg-muted rounded">
                      <p>
                        Total: {" "}
                        {formatCurrency(
                          parseFloat(formData.meters) * parseFloat(formData.rate)
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
                <TableHead>Meters</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Settlement Type</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Loading transactions...
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No transactions yet
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => {
                  const total = Number(transaction.totalAmount);
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>{formatDate(transaction.date)}</TableCell>
                      <TableCell>{transaction.party?.name || "-"}</TableCell>
                      <TableCell>{transaction.quantityMeter}</TableCell>
                      <TableCell>{formatCurrency(Number(transaction.ratePerMeter))}</TableCell>
                      <TableCell>{formatCurrency(total)}</TableCell>
                      <TableCell>
                        <span
                          className={
                            transaction.paymentType === "CASH"
                              ? "text-green-600"
                              : "text-orange-600"
                          }
                      >
                        {["CREDIT", "KHATA"].includes(String(transaction.paymentType))
                          ? "PAYABLE"
                          : "CASH"}
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
