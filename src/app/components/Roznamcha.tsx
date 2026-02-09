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
import { configApi, expenseApi, laborApi, partyApi } from "../lib/api";
import type {
  ApiExpenseCategory,
  ApiExpenseEntry,
  ApiExpenseModule,
  ApiLaborProfile,
  ApiParty,
} from "../types/api";
import { toast } from "sonner";

export function Roznamcha() {
  const [entries, setEntries] = useState<ApiExpenseEntry[]>([]);
  const [categories, setCategories] = useState<ApiExpenseCategory[]>([]);
  const [parties, setParties] = useState<ApiParty[]>([]);
  const [labors, setLabors] = useState<ApiLaborProfile[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ApiExpenseEntry | null>(null);

  const [formData, setFormData] = useState({
    date: getCurrentDate(),
    module: "MISC" as ApiExpenseModule,
    categoryId: "",
    partyId: "",
    laborId: "",
    amount: "",
    description: "",
  });

  const [filterDate, setFilterDate] = useState(getCurrentDate());

  const loadData = async (dateFilter: string) => {
    setIsLoading(true);
    try {
      const start = dateFilter;
      const end = dateFilter;
      const [expenseEntries, categoryData, partyData, laborData] =
        await Promise.all([
          expenseApi.listExpenses({ start, end }),
          configApi.listExpenseCategories(),
          partyApi.listParties(),
          laborApi.listProfiles(),
        ]);
      setEntries(expenseEntries);
      setCategories(categoryData);
      setParties(partyData);
      setLabors(laborData);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load expenses.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (filterDate) {
      loadData(filterDate);
    }
  }, [filterDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.categoryId) {
      toast.error("Select an expense category.");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (!Number.isFinite(amount)) {
      toast.error("Enter a valid amount.");
      return;
    }

    try {
      if (editingEntry) {
        if (editingEntry.laborAdvanceId) {
          await laborApi.updateAdvance(editingEntry.laborAdvanceId, {
            laborId: formData.laborId,
            date: formData.date,
            amount,
            reason: formData.description,
            categoryId: formData.categoryId,
          });
        } else {
          await expenseApi.updateExpense(editingEntry.id, {
            date: formData.date,
            categoryId: formData.categoryId,
            partyId: formData.partyId || undefined,
            laborId: formData.module === "LABOR" ? formData.laborId : undefined,
            module: formData.module,
            amount,
            description: formData.description,
          });
        }
        toast.success("Expense updated");
      } else if (formData.module === "LABOR") {
        if (!formData.laborId) {
          toast.error("Select a labor profile.");
          return;
        }
        await expenseApi.createExpense({
          date: formData.date,
          categoryId: formData.categoryId,
          laborId: formData.laborId,
          module: formData.module,
          amount,
          description: formData.description,
        });
        toast.success("Expense recorded");
      } else {
        await expenseApi.createExpense({
          date: formData.date,
          categoryId: formData.categoryId,
          partyId: formData.partyId || undefined,
          module: formData.module,
          amount,
          description: formData.description,
        });
        toast.success("Expense recorded");
      }

      await loadData(filterDate);
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save expense.");
    }
  };

  const resetForm = () => {
    setFormData({
      date: getCurrentDate(),
      module: "MISC",
      categoryId: "",
      partyId: "",
      laborId: "",
      amount: "",
      description: "",
    });
    setEditingEntry(null);
  };

  const startEdit = (entry: ApiExpenseEntry) => {
    setEditingEntry(entry);
    setFormData({
      date: entry.date.slice(0, 10),
      module: entry.module,
      categoryId: entry.categoryId,
      partyId: entry.partyId || "",
      laborId: entry.laborId || entry.laborAdvance?.laborId || "",
      amount: String(entry.amount),
      description: entry.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (entry: ApiExpenseEntry) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await expenseApi.deleteExpense(entry.id);
      toast.success("Expense deleted");
      await loadData(filterDate);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete expense.");
    }
  };

  const filteredEntries = entries;

  const totalExpenses = filteredEntries.reduce(
    (sum, entry) => sum + Number(entry.amount ?? 0),
    0
  );

  const getPartyLaborLabel = (entry: ApiExpenseEntry) =>
    entry.party?.name ||
    entry.labor?.name ||
    entry.laborAdvance?.labor?.name ||
    "-";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Roznamcha (Daily Expenses)</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                      {editingEntry ? "Edit Expense" : "Record Daily Expense"}
                    </DialogTitle>
                  </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Module</Label>
                      <Select
                        value={formData.module}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            module: value as ApiExpenseModule,
                          })
                        }
                        disabled={!!editingEntry?.laborAdvanceId}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MISC">Misc</SelectItem>
                          <SelectItem value="CHEMICAL">Chemical</SelectItem>
                          <SelectItem value="REXINE">Rexine</SelectItem>
                          <SelectItem value="MATERIAL">Material</SelectItem>
                          <SelectItem
                            value="LABOR"
                            disabled={!!editingEntry && !editingEntry.laborAdvanceId}
                          >
                            Labor
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.module === "CHEMICAL" ||
                  formData.module === "MATERIAL" ||
                  formData.module === "REXINE" ? (
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
                          <SelectItem value="">No party</SelectItem>
                          {parties.map((party) => (
                            <SelectItem key={party.id} value={party.id}>
                              {party.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {formData.module === "LABOR" && (
                    <div>
                      <Label>Labor</Label>
                      <Select
                        value={formData.laborId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, laborId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select labor" />
                        </SelectTrigger>
                        <SelectContent>
                          {labors.map((labor) => (
                            <SelectItem key={labor.id} value={labor.id}>
                              {labor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter description..."
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingEntry ? "Update Expense" : "Record Expense"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-4">
            <div className="flex-1">
              <Label>Filter by Date</Label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) =>
                  setFilterDate(e.target.value || getCurrentDate())
                }
                placeholder="All dates"
              />
            </div>
            <div className="p-4 bg-muted rounded">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl">{formatCurrency(totalExpenses)}</p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Expense Type</TableHead>
                <TableHead>Party/Labor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Loading expenses...
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No expenses recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>{entry.category?.name || "-"}</TableCell>
                    <TableCell>{getPartyLaborLabel(entry)}</TableCell>
                    <TableCell>{formatCurrency(Number(entry.amount))}</TableCell>
                    <TableCell>{entry.description || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(entry)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(entry)}
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
        </CardContent>
      </Card>
    </div>
  );
}
