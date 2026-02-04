
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
import type {
  ApiArticle,
  ApiExpenseCategory,
  ApiMaterialPurchase,
  ApiParty,
} from "../types/api";
import { toast } from "sonner";

type PaymentType = "cash" | "credit";

export function MaterialManagement() {
  const [transactions, setTransactions] = useState<ApiMaterialPurchase[]>([]);
  const [parties, setParties] = useState<ApiParty[]>([]);
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [categories, setCategories] = useState<ApiExpenseCategory[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: getCurrentDate(),
    partyId: "",
    categoryId: "",
    articleId: "",
    quantity: "",
    pricePerPair: "",
    paymentType: "cash" as PaymentType,
    detail: "",
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [purchaseData, partyData, articleData, categoryData] =
        await Promise.all([
          purchaseApi.listMaterials(),
          partyApi.listParties(),
          configApi.listArticles(),
          configApi.listExpenseCategories(),
        ]);
      setTransactions(purchaseData);
      setParties(partyData);
      setArticles(articleData);
      setCategories(categoryData);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load material purchases.");
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
    if (!formData.articleId) {
      toast.error("Please select an article");
      return;
    }

    const quantity = parseFloat(formData.quantity);
    const pricePerPair = parseFloat(formData.pricePerPair);
    if (!Number.isFinite(quantity) || !Number.isFinite(pricePerPair)) {
      toast.error("Enter valid quantity and price");
      return;
    }

    const totalAmount = quantity * pricePerPair;

    try {
      if (editingId) {
        await purchaseApi.updateMaterial(editingId, {
          date: formData.date,
          partyId: formData.partyId || undefined,
          categoryId: formData.categoryId,
          articleId: formData.articleId,
          quantity,
          pricePerUnit: pricePerPair,
          totalAmount,
          paymentType: formData.paymentType === "credit" ? "CREDIT" : "CASH",
          description: formData.detail || undefined,
        });
        toast.success("Material purchase updated");
      } else {
        await purchaseApi.createMaterial({
          date: formData.date,
          partyId: formData.partyId || undefined,
          categoryId: formData.categoryId,
          articleId: formData.articleId,
          quantity,
          pricePerUnit: pricePerPair,
          totalAmount,
          paymentType: formData.paymentType === "credit" ? "CREDIT" : "CASH",
          description: formData.detail || undefined,
        });
        toast.success("Material purchase added");
      }
      await loadData();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save material purchase.");
    }
  };

  const resetForm = () => {
    setFormData({
      date: getCurrentDate(),
      partyId: "",
      categoryId: "",
      articleId: "",
      quantity: "",
      pricePerPair: "",
      paymentType: "cash",
      detail: "",
    });
    setEditingId(null);
  };

  const getDetail = (purchase: ApiMaterialPurchase) =>
    purchase.expenses?.[0]?.description || "-";

  const startEdit = (purchase: ApiMaterialPurchase) => {
    setEditingId(purchase.id);
    setFormData({
      date: purchase.date.slice(0, 10),
      partyId: purchase.partyId || "",
      categoryId: purchase.expenses?.[0]?.categoryId || "",
      articleId: purchase.articleId || "",
      quantity: String(purchase.quantity),
      pricePerPair: String(purchase.pricePerUnit),
      paymentType: purchase.paymentType === "CREDIT" ? "credit" : "cash",
      detail: purchase.expenses?.[0]?.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (purchaseId: string) => {
    if (!confirm("Delete this purchase?")) return;
    try {
      await purchaseApi.deleteMaterial(purchaseId);
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
            <CardTitle>Material (Bakal) Management</CardTitle>
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
                  Add Material Purchase
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? "Edit" : "Add"} Material Purchase
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
                      <Label>Article</Label>
                      <Select
                        value={formData.articleId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, articleId: value })
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
                      <Label>Quantity (pairs)</Label>
                      <Input
                        type="number"
                        step="1"
                        value={formData.quantity}
                        onChange={(e) =>
                          setFormData({ ...formData, quantity: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label>Price per pair</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.pricePerPair}
                        onChange={(e) =>
                          setFormData({ ...formData, pricePerPair: e.target.value })
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
                  {formData.quantity && formData.pricePerPair && (
                    <div className="p-3 bg-muted rounded">
                      <p>
                        Total: {" "}
                        {formatCurrency(
                          parseFloat(formData.quantity) *
                            parseFloat(formData.pricePerPair)
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
                <TableHead>Article</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Price/Pair</TableHead>
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
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
                    Loading transactions...
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
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
                      <TableCell>
                        {transaction.article?.name ||
                          articles.find((article) => article.id === transaction.articleId)?.name ||
                          "-"}
                      </TableCell>
                      <TableCell>{transaction.quantity}</TableCell>
                      <TableCell>{formatCurrency(Number(transaction.pricePerUnit))}</TableCell>
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
