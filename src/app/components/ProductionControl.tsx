import { useEffect, useMemo, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { configApi, productionApi } from "../lib/api";
import type {
  ApiArticle,
  ApiLaborDepartment,
  ApiProductionOrder,
} from "../types/api";
import { toast } from "sonner";

const DEPARTMENTS: ApiLaborDepartment[] = [
  "PRESSMAN",
  "UPPERMAN",
  "PRINTING",
  "DC",
  "MACHINEMAN",
  "PACKING",
];

const DEPARTMENT_TITLE: Record<ApiLaborDepartment, string> = {
  PRESSMAN: "Pressman",
  UPPERMAN: "Upperman",
  PRINTING: "Printing",
  DC: "DC",
  MACHINEMAN: "Machineman",
  PACKING: "Packing",
};

const statusLabel = (status: ApiProductionOrder["status"]) => {
  if (status === "PARTIALLY_COMPLETE") return "Partially Complete";
  if (status === "COMPLETE") return "Complete";
  return "Incomplete";
};

export function ProductionControl() {
  const [orders, setOrders] = useState<ApiProductionOrder[]>([]);
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [departmentLabors, setDepartmentLabors] = useState<
    Record<ApiLaborDepartment, Array<{ id: string; name: string }>>
  >({
    PRESSMAN: [],
    UPPERMAN: [],
    PRINTING: [],
    DC: [],
    MACHINEMAN: [],
    PACKING: [],
  });
  const [activeTab, setActiveTab] = useState<ApiLaborDepartment>("PRESSMAN");
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [orderData, articleData, laborData] = await Promise.all([
        productionApi.listOrders(),
        configApi.listArticles(),
        productionApi.listDepartmentLabors(),
      ]);
      setOrders(orderData);
      setArticles(articleData);

      const grouped: Record<ApiLaborDepartment, Array<{ id: string; name: string }>> = {
        PRESSMAN: [],
        UPPERMAN: [],
        PRINTING: [],
        DC: [],
        MACHINEMAN: [],
        PACKING: [],
      };
      laborData.forEach((labor) => {
        grouped[labor.department].push({ id: labor.id, name: labor.name });
      });
      setDepartmentLabors(grouped);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load production data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const byDepartment = useMemo(
    () =>
      DEPARTMENTS.reduce(
        (acc, department) => {
          acc[department] = orders.filter(
            (order) =>
              order.department === department &&
              Number(order.completedDozen) < Number(order.quantityDozen)
          );
          return acc;
        },
        {} as Record<ApiLaborDepartment, ApiProductionOrder[]>
      ),
    [orders]
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">
          Department-wise labor assignments and production order tracking.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department Sections</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as ApiLaborDepartment)}
          >
            <TabsList className="w-full justify-start overflow-x-auto">
              {DEPARTMENTS.map((department) => (
                <TabsTrigger key={department} value={department}>
                  {DEPARTMENT_TITLE[department]}
                </TabsTrigger>
              ))}
            </TabsList>

            {DEPARTMENTS.map((department) => (
              <TabsContent key={department} value={department} className="pt-4">
                <DepartmentSection
                  department={department}
                  rows={byDepartment[department] ?? []}
                  articles={articles}
                  departmentLabors={departmentLabors[department] ?? []}
                  isLoading={isLoading}
                  onRefresh={loadData}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function DepartmentSection({
  department,
  rows,
  articles,
  departmentLabors,
  isLoading,
  onRefresh,
}: {
  department: ApiLaborDepartment;
  rows: ApiProductionOrder[];
  articles: ApiArticle[];
  departmentLabors: Array<{ id: string; name: string }>;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    articleId: "",
    laborId: "unassigned",
    quantityDozen: "",
    pricePerDozen: "",
  });
  const [assignLaborValue, setAssignLaborValue] = useState("unassigned");
  const [assignPriceValue, setAssignPriceValue] = useState("");
  const [doneQtyValue, setDoneQtyValue] = useState("");
  const [editForm, setEditForm] = useState({
    articleId: "",
    quantityDozen: "",
    pricePerDozen: "",
  });

  useEffect(() => {
    if (!formData.articleId && articles.length > 0) {
      setFormData((prev) => ({ ...prev, articleId: articles[0].id }));
    }
    if (!editForm.articleId && articles.length > 0) {
      setEditForm((prev) => ({ ...prev, articleId: articles[0].id }));
    }
  }, [articles, editForm.articleId, formData.articleId]);

  const selectedOrder = rows.find((row) => row.id === selectedOrderId) || null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantityDozen = Number(formData.quantityDozen);
    const pricePerDozen = Number(formData.pricePerDozen);
    if (!Number.isFinite(quantityDozen) || quantityDozen <= 0) return;
    if (!Number.isFinite(pricePerDozen) || pricePerDozen <= 0) return;
    if (!formData.articleId) return;

    try {
      setSaving(true);
      await productionApi.createOrder({
        department,
        articleId: formData.articleId,
        laborId: formData.laborId === "unassigned" ? undefined : formData.laborId,
        quantityDozen,
        pricePerDozen,
      });
      toast.success("Order added.");
      setFormData({
        articleId: articles[0]?.id ?? "",
        laborId: "unassigned",
        quantityDozen: "",
        pricePerDozen: "",
      });
      setOpen(false);
      await onRefresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to add order.");
    } finally {
      setSaving(false);
    }
  };

  const openAssignDialog = (row: ApiProductionOrder) => {
    setSelectedOrderId(row.id);
    setAssignLaborValue(row.laborId || "unassigned");
    setAssignPriceValue(
      row.pricePerDozen
        ? String(
            department === "UPPERMAN" ? Number(row.pricePerDozen) / 12 : row.pricePerDozen
          )
        : ""
    );
    setAssignOpen(true);
  };

  const openDoneDialog = (row: ApiProductionOrder) => {
    setSelectedOrderId(row.id);
    const remaining = Math.max(
      Number(row.quantityDozen) - Number(row.completedDozen),
      0
    );
    setDoneQtyValue(String(remaining));
    setDoneOpen(true);
  };

  const openEditDialog = (row: ApiProductionOrder) => {
    setSelectedOrderId(row.id);
    setEditForm({
      articleId: row.articleId,
      quantityDozen: String(row.quantityDozen),
      pricePerDozen: String(row.pricePerDozen),
    });
    setEditOpen(true);
  };

  const submitAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;
    const priceInput = Number(assignPriceValue);
    if (!Number.isFinite(priceInput) || priceInput <= 0) {
      toast.error("Enter a valid price.");
      return;
    }

    try {
      setSaving(true);
      await productionApi.assignLabor(selectedOrderId, {
        laborId: assignLaborValue === "unassigned" ? undefined : assignLaborValue,
        pricePerDozen: department === "UPPERMAN" ? priceInput * 12 : priceInput,
      });
      toast.success("Labor assigned.");
      setAssignOpen(false);
      await onRefresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to assign labor.");
    } finally {
      setSaving(false);
    }
  };

  const submitDone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId || !selectedOrder) return;
    const value = Number(doneQtyValue);
    const alreadyCompleted = Number(selectedOrder.completedDozen);
    const totalQuantity = Number(selectedOrder.quantityDozen);
    const remaining = Math.max(totalQuantity - alreadyCompleted, 0);
    if (!Number.isFinite(value) || value < 0) return;
    if (value > remaining) {
      toast.error(`You can add up to ${remaining} dozen only.`);
      return;
    }
    try {
      setSaving(true);
      await productionApi.updateCompletion(selectedOrderId, alreadyCompleted + value);
      toast.success("Completed quantity updated.");
      setDoneOpen(false);
      await onRefresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update completed quantity.");
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;
    const quantityDozen = Number(editForm.quantityDozen);
    const pricePerDozen = Number(editForm.pricePerDozen);
    if (!Number.isFinite(quantityDozen) || quantityDozen <= 0) return;
    if (!Number.isFinite(pricePerDozen) || pricePerDozen <= 0) return;
    try {
      setSaving(true);
      await productionApi.updateOrder(selectedOrderId, {
        articleId: editForm.articleId,
        quantityDozen,
        pricePerDozen,
      });
      toast.success("Order updated.");
      setEditOpen(false);
      await onRefresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3>{DEPARTMENT_TITLE[department]} Orders</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Add Order</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {DEPARTMENT_TITLE[department]} Order</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Article</Label>
                <Select
                  value={formData.articleId}
                  onValueChange={(value) => setFormData({ ...formData, articleId: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
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
                <Label>Labor</Label>
                <Select
                  value={formData.laborId}
                  onValueChange={(value) => setFormData({ ...formData, laborId: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {departmentLabors.map((labor) => (
                      <SelectItem key={labor.id} value={labor.id}>
                        {labor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity (Dozen)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.quantityDozen}
                  onChange={(e) => setFormData({ ...formData, quantityDozen: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Price Per Dozen</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.pricePerDozen}
                  onChange={(e) => setFormData({ ...formData, pricePerDozen: e.target.value })}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  Add
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Labor</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitAssign} className="space-y-4">
            <div>
              <Label>Labor</Label>
              <Select value={assignLaborValue} onValueChange={setAssignLaborValue}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {departmentLabors.map((labor) => (
                    <SelectItem key={labor.id} value={labor.id}>
                      {labor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{department === "UPPERMAN" ? "Price Per Pair" : "Price Per Dozen"}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={assignPriceValue}
                onChange={(e) => setAssignPriceValue(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                Assign
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Completed Quantity</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitDone} className="space-y-4">
            <div>
              <Label>Completed (Dozen)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                max={
                  selectedOrder
                    ? Math.max(
                        Number(selectedOrder.quantityDozen) -
                          Number(selectedOrder.completedDozen),
                        0
                      )
                    : undefined
                }
                value={doneQtyValue}
                onChange={(e) => setDoneQtyValue(e.target.value)}
                required
              />
              {selectedOrder && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Total: {selectedOrder.quantityDozen} dozen | Already done:{" "}
                  {selectedOrder.completedDozen} dozen | Left:{" "}
                  {Math.max(
                    Number(selectedOrder.quantityDozen) -
                      Number(selectedOrder.completedDozen),
                    0
                  )}{" "}
                  dozen
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDoneOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div>
              <Label>Article</Label>
              <Select
                value={editForm.articleId}
                onValueChange={(value) => setEditForm({ ...editForm, articleId: value })}
              >
                <SelectTrigger>
                  <SelectValue />
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
              <Label>Quantity (Dozen)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editForm.quantityDozen}
                onChange={(e) => setEditForm({ ...editForm, quantityDozen: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Price Per Dozen</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editForm.pricePerDozen}
                onChange={(e) => setEditForm({ ...editForm, pricePerDozen: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Article</TableHead>
            <TableHead>Labor</TableHead>
            <TableHead>Quantity (Dozen)</TableHead>
            <TableHead>{department === "UPPERMAN" ? "Price / Pair" : "Price / Dozen"}</TableHead>
            <TableHead>Completed Qty</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Loading orders...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No orders in this department.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.article?.name || "-"}</TableCell>
                <TableCell>{row.labor?.name || "-"}</TableCell>
                <TableCell>{row.quantityDozen}</TableCell>
                <TableCell>
                  {department === "UPPERMAN"
                    ? Number(row.pricePerDozen) / 12
                    : row.pricePerDozen}
                </TableCell>
                <TableCell>{row.completedDozen}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      row.status === "COMPLETE"
                        ? "default"
                        : row.status === "PARTIALLY_COMPLETE"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {statusLabel(row.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {department === "PRESSMAN" ? (
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(row)}>
                        Edit
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => openAssignDialog(row)}>
                        Assign Labor
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => openDoneDialog(row)}
                      disabled={department !== "PRESSMAN" && !row.laborId}
                    >
                      Done
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
