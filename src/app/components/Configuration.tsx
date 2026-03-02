import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { configApi } from "../lib/api";
import { TabReportActions } from "./TabReportActions";
import type {
  ApiArticle,
  ApiExpenseCategory,
  ApiPaymentType,
  ApiUnit,
} from "../types/api";

type LoadState = "idle" | "loading" | "error";

export function Configuration() {
  const [units, setUnits] = useState<ApiUnit[]>([]);
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<ApiPaymentType[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ApiExpenseCategory[]>([]);
  const [status, setStatus] = useState<LoadState>("idle");

  const [unitDialog, setUnitDialog] = useState(false);
  const [articleDialog, setArticleDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [expenseDialog, setExpenseDialog] = useState(false);

  const [editingUnit, setEditingUnit] = useState<ApiUnit | null>(null);
  const [editingArticle, setEditingArticle] = useState<ApiArticle | null>(null);
  const [editingPayment, setEditingPayment] = useState<ApiPaymentType | null>(null);
  const [editingExpense, setEditingExpense] = useState<ApiExpenseCategory | null>(
    null
  );

  const [unitForm, setUnitForm] = useState({ name: "", symbol: "" });
  const [articleForm, setArticleForm] = useState({ name: "", code: "" });
  const [paymentForm, setPaymentForm] = useState({
    name: "",
    unitId: "none",
  });
  const [expenseForm, setExpenseForm] = useState({ name: "" });
  const [activeTab, setActiveTab] = useState("units");

  const loadConfig = async () => {
    setStatus("loading");
    try {
      const [unitsData, articlesData, paymentData, expenseData] =
        await Promise.all([
          configApi.listUnits(),
          configApi.listArticles(),
          configApi.listPaymentTypes(),
          configApi.listExpenseCategories(),
        ]);

      setUnits(unitsData);
      setArticles(articlesData);
      setPaymentTypes(paymentData);
      setExpenseCategories(expenseData);
      setStatus("idle");
    } catch (error) {
      console.error(error);
      setStatus("error");
      toast.error("Failed to load configuration data.");
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleUnitSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingUnit) {
        await configApi.updateUnit(editingUnit.id, {
          name: unitForm.name.trim(),
          symbol: unitForm.symbol.trim() || null,
        });
        toast.success("Unit updated");
      } else {
        await configApi.createUnit({
          name: unitForm.name.trim(),
          symbol: unitForm.symbol.trim() || undefined,
        });
        toast.success("Unit added");
      }
      setUnitForm({ name: "", symbol: "" });
      setEditingUnit(null);
      setUnitDialog(false);
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save unit.");
    }
  };

  const handleArticleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingArticle) {
        await configApi.updateArticle(editingArticle.id, {
          name: articleForm.name.trim(),
          code: articleForm.code.trim() || null,
        });
        toast.success("Article updated");
      } else {
        await configApi.createArticle({
          name: articleForm.name.trim(),
          code: articleForm.code.trim() || undefined,
        });
        toast.success("Article added");
      }
      setArticleForm({ name: "", code: "" });
      setEditingArticle(null);
      setArticleDialog(false);
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save article.");
    }
  };


  const handlePaymentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingPayment) {
        await configApi.updatePaymentType(editingPayment.id, {
          name: paymentForm.name.trim(),
          unitId: paymentForm.unitId === "none" ? null : paymentForm.unitId,
        });
        toast.success("Payment type updated");
      } else {
        await configApi.createPaymentType({
          name: paymentForm.name.trim(),
          unitId: paymentForm.unitId === "none" ? undefined : paymentForm.unitId,
        });
        toast.success("Payment type added");
      }
      setPaymentForm({ name: "", unitId: "none" });
      setEditingPayment(null);
      setPaymentDialog(false);
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save payment type.");
    }
  };

  const handleExpenseSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingExpense) {
        await configApi.updateExpenseCategory(editingExpense.id, {
          name: expenseForm.name.trim(),
        });
        toast.success("Expense category updated");
      } else {
        await configApi.createExpenseCategory({
          name: expenseForm.name.trim(),
        });
        toast.success("Expense category added");
      }
      setExpenseForm({ name: "" });
      setEditingExpense(null);
      setExpenseDialog(false);
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save expense category.");
    }
  };

  const startUnitEdit = (unit: ApiUnit) => {
    setEditingUnit(unit);
    setUnitForm({ name: unit.name, symbol: unit.symbol || "" });
    setUnitDialog(true);
  };

  const startArticleEdit = (article: ApiArticle) => {
    setEditingArticle(article);
    setArticleForm({ name: article.name, code: article.code || "" });
    setArticleDialog(true);
  };


  const startPaymentEdit = (payment: ApiPaymentType) => {
    setEditingPayment(payment);
    setPaymentForm({ name: payment.name, unitId: payment.unitId || "none" });
    setPaymentDialog(true);
  };

  const startExpenseEdit = (category: ApiExpenseCategory) => {
    setEditingExpense(category);
    setExpenseForm({ name: category.name });
    setExpenseDialog(true);
  };

  const handleUnitDelete = async (unit: ApiUnit) => {
    if (!confirm(`Delete unit "${unit.name}"?`)) return;
    try {
      await configApi.deleteUnit(unit.id);
      toast.success("Unit deleted");
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete unit.");
    }
  };

  const handleArticleDelete = async (article: ApiArticle) => {
    if (!confirm(`Delete article "${article.name}"?`)) return;
    try {
      await configApi.deleteArticle(article.id);
      toast.success("Article deleted");
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete article.");
    }
  };


  const handlePaymentDelete = async (payment: ApiPaymentType) => {
    if (!confirm(`Delete payment type "${payment.name}"?`)) return;
    try {
      await configApi.deletePaymentType(payment.id);
      toast.success("Payment type deleted");
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete payment type.");
    }
  };

  const handleExpenseDelete = async (category: ApiExpenseCategory) => {
    if (!confirm(`Delete expense category "${category.name}"?`)) return;
    try {
      await configApi.deleteExpenseCategory(category.id);
      toast.success("Expense category deleted");
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete expense category.");
    }
  };

  const renderEmpty = (colSpan: number, message: string) => (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );

  const isLoading = status === "loading";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>System Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="units" value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between gap-3">
              <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="units">Units</TabsTrigger>
              <TabsTrigger value="articles">Articles</TabsTrigger>
              <TabsTrigger value="payment">Payment Types</TabsTrigger>
              <TabsTrigger value="expenses">Expense Categories</TabsTrigger>
              </TabsList>
              <TabReportActions
                title={`Configuration ${activeTab} report`}
                selector={`[data-report-tab="${activeTab}"]`}
              />
            </div>

            <TabsContent value="units" className="space-y-4" data-report-tab="units">
              <div className="flex justify-end">
                <Dialog
                  open={unitDialog}
                  onOpenChange={(open) => {
                    setUnitDialog(open);
                    if (!open) {
                      setEditingUnit(null);
                      setUnitForm({ name: "", symbol: "" });
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingUnit(null);
                        setUnitForm({ name: "", symbol: "" });
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Unit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingUnit ? "Edit Unit" : "Add Unit"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleUnitSubmit} className="space-y-4">
                      <div>
                        <Label>Unit Name</Label>
                        <Input
                          value={unitForm.name}
                          onChange={(event) =>
                            setUnitForm({ ...unitForm, name: event.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Symbol (optional)</Label>
                        <Input
                          value={unitForm.symbol}
                          onChange={(event) =>
                            setUnitForm({ ...unitForm, symbol: event.target.value })
                          }
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setUnitDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? renderEmpty(3, "Loading units...")
                    : units.length === 0
                      ? renderEmpty(3, "No units yet")
                      : units.map((unit) => (
                          <TableRow key={unit.id}>
                            <TableCell>{unit.name}</TableCell>
                            <TableCell>{unit.symbol || "-"}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startUnitEdit(unit)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUnitDelete(unit)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="articles" className="space-y-4" data-report-tab="articles">
              <div className="flex justify-end">
                <Dialog
                  open={articleDialog}
                  onOpenChange={(open) => {
                    setArticleDialog(open);
                    if (!open) {
                      setEditingArticle(null);
                      setArticleForm({ name: "", code: "" });
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingArticle(null);
                        setArticleForm({ name: "", code: "" });
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Article
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingArticle ? "Edit Article" : "Add Article"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleArticleSubmit} className="space-y-4">
                      <div>
                        <Label>Article Name</Label>
                        <Input
                          value={articleForm.name}
                          onChange={(event) =>
                            setArticleForm({
                              ...articleForm,
                              name: event.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Code (optional)</Label>
                        <Input
                          value={articleForm.code}
                          onChange={(event) =>
                            setArticleForm({
                              ...articleForm,
                              code: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setArticleDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? renderEmpty(3, "Loading articles...")
                    : articles.length === 0
                      ? renderEmpty(3, "No articles yet")
                      : articles.map((article) => (
                          <TableRow key={article.id}>
                            <TableCell>{article.name}</TableCell>
                            <TableCell>{article.code || "-"}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startArticleEdit(article)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleArticleDelete(article)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
            </TabsContent>


            <TabsContent value="payment" className="space-y-4" data-report-tab="payment">
              <div className="flex justify-end">
                <Dialog
                  open={paymentDialog}
                  onOpenChange={(open) => {
                    setPaymentDialog(open);
                    if (!open) {
                      setEditingPayment(null);
                      setPaymentForm({ name: "", unitId: "none" });
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingPayment(null);
                        setPaymentForm({ name: "", unitId: "none" });
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Payment Type
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingPayment ? "Edit Payment Type" : "Add Payment Type"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handlePaymentSubmit} className="space-y-4">
                      <div>
                        <Label>Payment Type Name</Label>
                        <Input
                          value={paymentForm.name}
                          onChange={(event) =>
                            setPaymentForm({
                              ...paymentForm,
                              name: event.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Unit (optional)</Label>
                        <Select
                          value={paymentForm.unitId}
                          onValueChange={(value) =>
                            setPaymentForm({ ...paymentForm, unitId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="No unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No unit</SelectItem>
                            {units.map((unit) => (
                              <SelectItem key={unit.id} value={unit.id}>
                                {unit.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPaymentDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? renderEmpty(3, "Loading payment types...")
                    : paymentTypes.length === 0
                      ? renderEmpty(3, "No payment types yet")
                      : paymentTypes.map((type) => (
                          <TableRow key={type.id}>
                            <TableCell>{type.name}</TableCell>
                            <TableCell>{type.unit?.name || "-"}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startPaymentEdit(type)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handlePaymentDelete(type)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="expenses" className="space-y-4" data-report-tab="expenses">
              <div className="flex justify-end">
                <Dialog
                  open={expenseDialog}
                  onOpenChange={(open) => {
                    setExpenseDialog(open);
                    if (!open) {
                      setEditingExpense(null);
                      setExpenseForm({ name: "" });
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingExpense(null);
                        setExpenseForm({ name: "" });
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Expense Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingExpense
                          ? "Edit Expense Category"
                          : "Add Expense Category"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleExpenseSubmit} className="space-y-4">
                      <div>
                        <Label>Category Name</Label>
                        <Input
                          value={expenseForm.name}
                          onChange={(event) =>
                            setExpenseForm({ name: event.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setExpenseDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? renderEmpty(2, "Loading expense categories...")
                    : expenseCategories.length === 0
                      ? renderEmpty(2, "No expense categories yet")
                      : expenseCategories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell>{category.name}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startExpenseEdit(category)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleExpenseDelete(category)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
