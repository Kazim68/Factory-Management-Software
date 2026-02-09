
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Plus, Eye, Wallet } from "lucide-react";
import { formatCurrency, formatDate, getCurrentDate } from "../lib/utils";
import { configApi, laborApi } from "../lib/api";
import type {
  ApiArticle,
  ApiExpenseCategory,
  ApiLaborCategory,
  ApiLaborLedger,
  ApiLaborProfile,
  ApiLaborWorkEntry,
  ApiLaborAdvance,
  ApiPaymentType,
} from "../types/api";
import { toast } from "sonner";

type UiWorkEntry = ApiLaborWorkEntry & {
  laborName: string;
  articleName: string;
};

type UiAdvance = ApiLaborAdvance & {
  laborName: string;
};

export function LaborManagement() {
  const [profiles, setProfiles] = useState<ApiLaborProfile[]>([]);
  const [categories, setCategories] = useState<ApiLaborCategory[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<ApiPaymentType[]>([]);
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ApiExpenseCategory[]>([]);
  const [workEntries, setWorkEntries] = useState<UiWorkEntry[]>([]);
  const [advanceEntries, setAdvanceEntries] = useState<UiAdvance[]>([]);
  const [ledgerMap, setLedgerMap] = useState<Record<string, ApiLaborLedger>>({});
  const [isLoading, setIsLoading] = useState(false);

  const [laborDialog, setLaborDialog] = useState(false);
  const [workDialog, setWorkDialog] = useState(false);
  const [kharchaDialog, setKharchaDialog] = useState(false);
  const [ledgerDialog, setLedgerDialog] = useState(false);

  const [viewingLaborId, setViewingLaborId] = useState<string | null>(null);
  const [editingLaborId, setEditingLaborId] = useState<string | null>(null);
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);

  const [laborForm, setLaborForm] = useState({
    name: "",
    categoryId: "",
    paymentTypeId: "",
    defaultRate: "",
  });

  const [workForm, setWorkForm] = useState({
    laborId: "",
    date: getCurrentDate(),
    articleId: "",
    quantity: "",
    rate: "",
  });

  const [kharchaForm, setKharchaForm] = useState({
    laborId: "",
    date: getCurrentDate(),
    categoryId: "",
    amount: "",
    reason: "",
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [
        profileData,
        categoryData,
        paymentData,
        articleData,
        expenseCategoryData,
      ] = await Promise.all([
        laborApi.listProfiles(),
        configApi.listLaborCategories(),
        configApi.listPaymentTypes(),
        configApi.listArticles(),
        configApi.listExpenseCategories(),
      ]);

      setProfiles(profileData);
      setCategories(categoryData);
      setPaymentTypes(paymentData);
      setArticles(articleData);
      setExpenseCategories(expenseCategoryData);

      const ledgerEntries = await Promise.all(
        profileData.map((profile) =>
          laborApi.getLedger(profile.id).catch(() => ({
            workEntries: [],
            advances: [],
            totalEarnings: 0,
            totalAdvances: 0,
            netPayable: 0,
          }))
        )
      );

      const nextLedgerMap: Record<string, ApiLaborLedger> = {};
      profileData.forEach((profile, index) => {
        nextLedgerMap[profile.id] = ledgerEntries[index];
      });
      setLedgerMap(nextLedgerMap);

      const articleNameById = Object.fromEntries(
        articleData.map((article) => [article.id, article.name])
      );
      const laborNameById = Object.fromEntries(
        profileData.map((profile) => [profile.id, profile.name])
      );

      const flattenedWork = ledgerEntries.flatMap((ledger) =>
        ledger.workEntries.map((entry) => ({
          ...entry,
          laborName: laborNameById[entry.laborId] ?? "Unknown",
          articleName: articleNameById[entry.articleId] ?? "Unknown",
        }))
      );
      const flattenedAdvances = ledgerEntries.flatMap((ledger) =>
        ledger.advances.map((advance) => ({
          ...advance,
          laborName: laborNameById[advance.laborId] ?? "Unknown",
        }))
      );

      setWorkEntries(flattenedWork);
      setAdvanceEntries(flattenedAdvances);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load labor data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLaborSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!laborForm.categoryId) {
      toast.error("Please select a category");
      return;
    }
    if (!laborForm.paymentTypeId) {
      toast.error("Please select a payment type");
      return;
    }

    try {
      if (editingLaborId) {
        await laborApi.updateProfile(editingLaborId, {
          name: laborForm.name.trim(),
          categoryId: laborForm.categoryId,
          paymentTypeId: laborForm.paymentTypeId,
          defaultRate: laborForm.defaultRate
            ? parseFloat(laborForm.defaultRate)
            : undefined,
        });
        toast.success("Labor updated");
      } else {
        await laborApi.createProfile({
          name: laborForm.name.trim(),
          categoryId: laborForm.categoryId,
          paymentTypeId: laborForm.paymentTypeId,
          defaultRate: laborForm.defaultRate
            ? parseFloat(laborForm.defaultRate)
            : undefined,
        });
        toast.success("Labor added");
      }
      await loadData();
      setLaborForm({
        name: "",
        categoryId: "",
        paymentTypeId: "",
        defaultRate: "",
      });
      setEditingLaborId(null);
      setLaborDialog(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to add labor.");
    }
  };

  const handleWorkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workForm.laborId || !workForm.articleId) {
      toast.error("Please select labor and article");
      return;
    }

    const quantity = parseFloat(workForm.quantity);
    const rate = parseFloat(workForm.rate);
    if (!Number.isFinite(quantity) || !Number.isFinite(rate)) {
      toast.error("Enter valid quantity and rate");
      return;
    }

    const total = quantity * rate;

    try {
      if (editingWorkId) {
        await laborApi.updateWorkEntry(editingWorkId, {
          laborId: workForm.laborId,
          articleId: workForm.articleId,
          startDate: workForm.date,
          endDate: workForm.date,
          quantity,
          rate,
          total,
        });
        toast.success("Work entry updated");
      } else {
        await laborApi.createWorkEntry({
          laborId: workForm.laborId,
          articleId: workForm.articleId,
          startDate: workForm.date,
          endDate: workForm.date,
          quantity,
          rate,
          total,
        });
        toast.success("Work entry added");
      }
      await loadData();
      setWorkForm({
        laborId: "",
        date: getCurrentDate(),
        articleId: "",
        quantity: "",
        rate: "",
      });
      setEditingWorkId(null);
      setWorkDialog(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to add work entry.");
    }
  };

  const handleKharchaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kharchaForm.laborId) {
      toast.error("Please select labor");
      return;
    }
    if (!kharchaForm.categoryId && !editingAdvanceId) {
      toast.error("Please select an expense category");
      return;
    }
    const amount = parseFloat(kharchaForm.amount);
    if (!Number.isFinite(amount)) {
      toast.error("Enter a valid amount");
      return;
    }

    try {
      if (editingAdvanceId) {
        await laborApi.updateAdvance(editingAdvanceId, {
          laborId: kharchaForm.laborId,
          date: kharchaForm.date,
          amount,
          reason: kharchaForm.reason,
          categoryId: kharchaForm.categoryId || undefined,
        });
        toast.success("Kharcha updated");
      } else {
        await laborApi.createAdvance({
          laborId: kharchaForm.laborId,
          date: kharchaForm.date,
          amount,
          reason: kharchaForm.reason,
          categoryId: kharchaForm.categoryId,
        });
        toast.success("Kharcha recorded");
      }
      await loadData();
      setKharchaForm({
        laborId: "",
        date: getCurrentDate(),
        categoryId: "",
        amount: "",
        reason: "",
      });
      setEditingAdvanceId(null);
      setKharchaDialog(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to record kharcha.");
    }
  };

  const startEditLabor = (labor: ApiLaborProfile) => {
    setEditingLaborId(labor.id);
    setLaborForm({
      name: labor.name,
      categoryId: labor.categoryId,
      paymentTypeId: labor.paymentTypeId,
      defaultRate: labor.defaultRate ? String(labor.defaultRate) : "",
    });
    setLaborDialog(true);
  };

  const deleteLabor = async (laborId: string) => {
    if (!confirm("Delete this labor profile?")) return;
    try {
      await laborApi.deleteProfile(laborId);
      toast.success("Labor deleted");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete labor.");
    }
  };

  const startEditWork = (work: UiWorkEntry) => {
    setEditingWorkId(work.id);
    setWorkForm({
      laborId: work.laborId,
      date: work.startDate.slice(0, 10),
      articleId: work.articleId,
      quantity: String(work.quantity),
      rate: String(work.rate),
    });
    setWorkDialog(true);
  };

  const deleteWork = async (workId: string) => {
    if (!confirm("Delete this work entry?")) return;
    try {
      await laborApi.deleteWorkEntry(workId);
      toast.success("Work entry deleted");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete work entry.");
    }
  };

  const startEditAdvance = (advance: UiAdvance) => {
    setEditingAdvanceId(advance.id);
    setKharchaForm({
      laborId: advance.laborId,
      date: advance.date.slice(0, 10),
      categoryId: "",
      amount: String(advance.amount),
      reason: advance.reason || "",
    });
    setKharchaDialog(true);
  };

  const deleteAdvance = async (advanceId: string) => {
    if (!confirm("Delete this advance?")) return;
    try {
      await laborApi.deleteAdvance(advanceId);
      toast.success("Advance deleted");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete advance.");
    }
  };

  const getLaborSummary = (laborId: string) =>
    ledgerMap[laborId] ?? {
      workEntries: [],
      advances: [],
      totalEarnings: 0,
      totalAdvances: 0,
      netPayable: 0,
    };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Labor Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="labors">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="labors">Labor Profiles</TabsTrigger>
              <TabsTrigger value="work">Work Entries</TabsTrigger>
              <TabsTrigger value="kharcha">Kharcha (Advances)</TabsTrigger>
            </TabsList>

            <TabsContent value="labors" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={laborDialog} onOpenChange={setLaborDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Labor
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                  <DialogTitle>{editingLaborId ? "Edit" : "Add"} Labor</DialogTitle>
                </DialogHeader>
                    <form onSubmit={handleLaborSubmit} className="space-y-4">
                      <div>
                        <Label>Labor Name</Label>
                        <Input
                          defaultValue={laborForm.name}
                          onChange={(e) =>
                            setLaborForm({ ...laborForm, name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Category</Label>
                        <Select
                          value={laborForm.categoryId}
                          onValueChange={(value) =>
                            setLaborForm({ ...laborForm, categoryId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Payment Type</Label>
                        <Select
                          value={laborForm.paymentTypeId}
                          onValueChange={(value) =>
                            setLaborForm({ ...laborForm, paymentTypeId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Default Rate (optional)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={laborForm.defaultRate}
                          onChange={(e) =>
                            setLaborForm({
                              ...laborForm,
                              defaultRate: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setLaborDialog(false)}
                        >
                          Cancel
                        </Button>
                      <Button type="submit">
                        {editingLaborId ? "Update" : "Save"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Payment Type</TableHead>
                    <TableHead>Total Earned</TableHead>
                    <TableHead>Kharcha</TableHead>
                    <TableHead>Net Payable</TableHead>
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
                        Loading labor profiles...
                      </TableCell>
                    </TableRow>
                  ) : profiles.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground"
                      >
                        No labors yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    profiles.map((labor) => {
                      const summary = getLaborSummary(labor.id);
                      return (
                        <TableRow key={labor.id}>
                          <TableCell>{labor.name}</TableCell>
                          <TableCell>{labor.category?.name || "-"}</TableCell>
                          <TableCell>{labor.paymentType?.name || "-"}</TableCell>
                          <TableCell>
                            {formatCurrency(summary.totalEarnings)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(summary.totalAdvances)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                summary.netPayable > 0 ? "text-green-600" : ""
                              }
                            >
                              {formatCurrency(summary.netPayable)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setViewingLaborId(labor.id);
                                  setLedgerDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditLabor(labor)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteLabor(labor.id)}
                              >
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
            </TabsContent>

            <TabsContent value="work" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={workDialog} onOpenChange={setWorkDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Work Entry
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                  <DialogTitle>
                    {editingWorkId ? "Edit" : "Add"} Work Entry
                  </DialogTitle>
                </DialogHeader>
                    <form onSubmit={handleWorkSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Date</Label>
                          <Input
                            type="date"
                            value={workForm.date}
                            onChange={(e) =>
                              setWorkForm({
                                ...workForm,
                                date: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label>Labor</Label>
                          <Select
                            value={workForm.laborId}
                            onValueChange={(value) =>
                              setWorkForm({
                                ...workForm,
                                laborId: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select labor" />
                            </SelectTrigger>
                            <SelectContent>
                              {profiles.map((labor) => (
                                <SelectItem key={labor.id} value={labor.id}>
                                  {labor.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Article</Label>
                          <Select
                            value={workForm.articleId}
                            onValueChange={(value) =>
                              setWorkForm({
                                ...workForm,
                                articleId: value,
                              })
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
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            step="1"
                            value={workForm.quantity}
                            onChange={(e) =>
                              setWorkForm({
                                ...workForm,
                                quantity: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label>Rate</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={workForm.rate}
                            onChange={(e) =>
                              setWorkForm({
                                ...workForm,
                                rate: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                      </div>
                      {workForm.quantity && workForm.rate && (
                        <div className="p-3 bg-muted rounded">
                          <p>
                            Total: {" "}
                            {formatCurrency(
                              parseFloat(workForm.quantity) *
                                parseFloat(workForm.rate)
                            )}
                          </p>
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setWorkDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">
                          {editingWorkId ? "Update" : "Add"} Work
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Labor</TableHead>
                    <TableHead>Article</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Total</TableHead>
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
                        Loading work entries...
                      </TableCell>
                    </TableRow>
                  ) : workEntries.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        No work entries yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    workEntries.map((work) => (
                      <TableRow key={work.id}>
                        <TableCell>{formatDate(work.startDate)}</TableCell>
                        <TableCell>{work.laborName}</TableCell>
                        <TableCell>{work.articleName}</TableCell>
                        <TableCell>{Number(work.quantity)}</TableCell>
                        <TableCell>{formatCurrency(Number(work.rate))}</TableCell>
                        <TableCell>{formatCurrency(Number(work.total))}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditWork(work)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteWork(work.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="kharcha" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={kharchaDialog} onOpenChange={setKharchaDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Wallet className="mr-2 h-4 w-4" />
                      Add Kharcha
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                  <DialogTitle>
                    {editingAdvanceId ? "Edit" : "Record"} Kharcha (Advance)
                  </DialogTitle>
                </DialogHeader>
                    <form onSubmit={handleKharchaSubmit} className="space-y-4">
                      <div>
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={kharchaForm.date}
                          onChange={(e) =>
                            setKharchaForm({
                              ...kharchaForm,
                              date: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Labor</Label>
                        <Select
                          value={kharchaForm.laborId}
                          onValueChange={(value) =>
                            setKharchaForm({ ...kharchaForm, laborId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select labor" />
                          </SelectTrigger>
                          <SelectContent>
                            {profiles.map((labor) => (
                              <SelectItem key={labor.id} value={labor.id}>
                                {labor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Expense Category</Label>
                        <Select
                          value={kharchaForm.categoryId}
                          onValueChange={(value) =>
                            setKharchaForm({ ...kharchaForm, categoryId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {expenseCategories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={kharchaForm.amount}
                          onChange={(e) =>
                            setKharchaForm({
                              ...kharchaForm,
                              amount: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Reason</Label>
                        <Input
                          value={kharchaForm.reason}
                          onChange={(e) =>
                            setKharchaForm({
                              ...kharchaForm,
                              reason: e.target.value,
                            })
                          }
                          placeholder="Reason for advance..."
                          required
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setKharchaDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">
                          {editingAdvanceId ? "Update" : "Record"} Kharcha
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Labor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        Loading advances...
                      </TableCell>
                    </TableRow>
                  ) : advanceEntries.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        No kharcha entries yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    advanceEntries.map((kharcha) => (
                      <TableRow key={kharcha.id}>
                        <TableCell>{formatDate(kharcha.date)}</TableCell>
                        <TableCell>{kharcha.laborName}</TableCell>
                        <TableCell>
                          {formatCurrency(Number(kharcha.amount))}
                        </TableCell>
                        <TableCell>{kharcha.reason || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditAdvance(kharcha)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteAdvance(kharcha.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={ledgerDialog} onOpenChange={setLedgerDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Labor Ledger - {profiles.find((l) => l.id === viewingLaborId)?.name}
            </DialogTitle>
          </DialogHeader>
          {viewingLaborId && (() => {
            const summary = getLaborSummary(viewingLaborId);
            const workRows = summary.workEntries.map((work) => ({
              ...work,
              articleName:
                articles.find((article) => article.id === work.articleId)?.name ??
                "Unknown",
            }));
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Total Earned</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl">
                        {formatCurrency(summary.totalEarnings)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Total Kharcha</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl">
                        {formatCurrency(summary.totalAdvances)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Net Payable</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl text-green-600">
                        {formatCurrency(summary.netPayable)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <h3 className="mb-2">Work History</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Article</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workRows.map((work) => (
                        <TableRow key={work.id}>
                          <TableCell>{formatDate(work.startDate)}</TableCell>
                          <TableCell>{work.articleName}</TableCell>
                          <TableCell>{Number(work.quantity)}</TableCell>
                          <TableCell>{formatCurrency(Number(work.rate))}</TableCell>
                          <TableCell>{formatCurrency(Number(work.total))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <h3 className="mb-2">Kharcha History</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.advances.map((kharcha) => (
                        <TableRow key={kharcha.id}>
                          <TableCell>{formatDate(kharcha.date)}</TableCell>
                          <TableCell>{formatCurrency(Number(kharcha.amount))}</TableCell>
                          <TableCell>{kharcha.reason || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
