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
import type {
  ApiArticle,
  ApiExpenseCategory,
  ApiLaborCategory,
  ApiPaymentType,
  ApiUnit,
} from "../types/api";

type LoadState = "idle" | "loading" | "error";

export function Configuration() {
  const [units, setUnits] = useState<ApiUnit[]>([]);
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [laborCategories, setLaborCategories] = useState<ApiLaborCategory[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<ApiPaymentType[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ApiExpenseCategory[]>([]);
  const [status, setStatus] = useState<LoadState>("idle");

  const [unitDialog, setUnitDialog] = useState(false);
  const [articleDialog, setArticleDialog] = useState(false);
  const [laborDialog, setLaborDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [expenseDialog, setExpenseDialog] = useState(false);

  const [unitForm, setUnitForm] = useState({ name: "", symbol: "" });
  const [articleForm, setArticleForm] = useState({ name: "", code: "" });
  const [laborForm, setLaborForm] = useState({ name: "" });
  const [paymentForm, setPaymentForm] = useState({
    name: "",
    unitId: "none",
  });
  const [expenseForm, setExpenseForm] = useState({ name: "" });

  const loadConfig = async () => {
    setStatus("loading");
    try {
      const [unitsData, articlesData, laborData, paymentData, expenseData] =
        await Promise.all([
          configApi.listUnits(),
          configApi.listArticles(),
          configApi.listLaborCategories(),
          configApi.listPaymentTypes(),
          configApi.listExpenseCategories(),
        ]);

      setUnits(unitsData);
      setArticles(articlesData);
      setLaborCategories(laborData);
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
      await configApi.createUnit({
        name: unitForm.name.trim(),
        symbol: unitForm.symbol.trim() || undefined,
      });
      toast.success("Unit added");
      setUnitForm({ name: "", symbol: "" });
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
      await configApi.createArticle({
        name: articleForm.name.trim(),
        code: articleForm.code.trim() || undefined,
      });
      toast.success("Article added");
      setArticleForm({ name: "", code: "" });
      setArticleDialog(false);
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save article.");
    }
  };

  const handleLaborSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await configApi.createLaborCategory({ name: laborForm.name.trim() });
      toast.success("Labor category added");
      setLaborForm({ name: "" });
      setLaborDialog(false);
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save labor category.");
    }
  };

  const handlePaymentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await configApi.createPaymentType({
        name: paymentForm.name.trim(),
        unitId: paymentForm.unitId === "none" ? undefined : paymentForm.unitId,
      });
      toast.success("Payment type added");
      setPaymentForm({ name: "", unitId: "none" });
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
      await configApi.createExpenseCategory({
        name: expenseForm.name.trim(),
      });
      toast.success("Expense category added");
      setExpenseForm({ name: "" });
      setExpenseDialog(false);
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save expense category.");
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
          <Tabs defaultValue="units">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="units">Units</TabsTrigger>
              <TabsTrigger value="articles">Articles</TabsTrigger>
              <TabsTrigger value="labor">Labor Categories</TabsTrigger>
              <TabsTrigger value="payment">Payment Types</TabsTrigger>
              <TabsTrigger value="expenses">Expense Categories</TabsTrigger>
            </TabsList>

            <TabsContent value="units" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={unitDialog} onOpenChange={setUnitDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Unit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Unit</DialogTitle>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? renderEmpty(2, "Loading units...")
                    : units.length === 0
                      ? renderEmpty(2, "No units yet")
                      : units.map((unit) => (
                          <TableRow key={unit.id}>
                            <TableCell>{unit.name}</TableCell>
                            <TableCell>{unit.symbol || "-"}</TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="articles" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={articleDialog} onOpenChange={setArticleDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Article
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Article</DialogTitle>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? renderEmpty(2, "Loading articles...")
                    : articles.length === 0
                      ? renderEmpty(2, "No articles yet")
                      : articles.map((article) => (
                          <TableRow key={article.id}>
                            <TableCell>{article.name}</TableCell>
                            <TableCell>{article.code || "-"}</TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="labor" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={laborDialog} onOpenChange={setLaborDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Labor Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Labor Category</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleLaborSubmit} className="space-y-4">
                      <div>
                        <Label>Category Name</Label>
                        <Input
                          value={laborForm.name}
                          onChange={(event) =>
                            setLaborForm({ name: event.target.value })
                          }
                          required
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? renderEmpty(1, "Loading labor categories...")
                    : laborCategories.length === 0
                      ? renderEmpty(1, "No labor categories yet")
                      : laborCategories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell>{category.name}</TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="payment" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Payment Type
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Payment Type</DialogTitle>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? renderEmpty(2, "Loading payment types...")
                    : paymentTypes.length === 0
                      ? renderEmpty(2, "No payment types yet")
                      : paymentTypes.map((type) => (
                          <TableRow key={type.id}>
                            <TableCell>{type.name}</TableCell>
                            <TableCell>{type.unit?.name || "-"}</TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="expenses" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Expense Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Expense Category</DialogTitle>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? renderEmpty(1, "Loading expense categories...")
                    : expenseCategories.length === 0
                      ? renderEmpty(1, "No expense categories yet")
                      : expenseCategories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell>{category.name}</TableCell>
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
