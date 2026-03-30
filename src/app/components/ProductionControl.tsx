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
];

const MERGED_FINAL_DEPARTMENTS: ApiLaborDepartment[] = [
  "MACHINEMAN",
  "PACKING",
];

const getOrderProgressDozen = (order: ApiProductionOrder) => {
  if (!MERGED_FINAL_DEPARTMENTS.includes(order.department)) {
    return Number(order.completedDozen);
  }
  return (
    Number(order.completedDozen) +
    Number(order.bMallDozen ?? 0) +
    Number(order.cMallDozen ?? 0)
  );
};

const getRemainingDepartments = (
  department: ApiLaborDepartment,
): ApiLaborDepartment[] => {
  const currentIndex = DEPARTMENTS.indexOf(department);
  if (currentIndex === -1) return [];
  return DEPARTMENTS.slice(currentIndex + 1);
};

const DEPARTMENT_TITLE: Record<ApiLaborDepartment, string> = {
  PRESSMAN: "Pressman",
  UPPERMAN: "Upperman",
  PRINTING: "Printing",
  DC: "DC",
  MACHINEMAN: "Machineman + Packing",
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

      const grouped: Record<
        ApiLaborDepartment,
        Array<{ id: string; name: string }>
      > = {
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
          acc[department] = orders.filter((order) => {
            const belongsToMergedFinal =
              department === "MACHINEMAN" &&
              MERGED_FINAL_DEPARTMENTS.includes(order.department);
            const belongsToDepartment =
              order.department === department || belongsToMergedFinal;
            return (
              belongsToDepartment &&
              getOrderProgressDozen(order) < Number(order.quantityDozen)
            );
          });
          return acc;
        },
        {} as Record<ApiLaborDepartment, ApiProductionOrder[]>,
      ),
    [orders],
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
                  packingLabors={departmentLabors.PACKING ?? []}
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
  packingLabors,
  isLoading,
  onRefresh,
}: {
  department: ApiLaborDepartment;
  rows: ApiProductionOrder[];
  articles: ApiArticle[];
  departmentLabors: Array<{ id: string; name: string }>;
  packingLabors: Array<{ id: string; name: string }>;
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
  const [assignPackingLaborValue, setAssignPackingLaborValue] =
    useState("unassigned");
  const [assignPackingPriceValue, setAssignPackingPriceValue] = useState("");
  const [doneQtyValue, setDoneQtyValue] = useState("");
  const [doneBMallValue, setDoneBMallValue] = useState("");
  const [doneCMallValue, setDoneCMallValue] = useState("");
  const [doneNextDepartmentValue, setDoneNextDepartmentValue] = useState("");
  const [doneUpperValue, setDoneUpperValue] = useState("");
  const [doneUpperDepartmentValue, setDoneUpperDepartmentValue] = useState("");
  const [donePtawaValue, setDonePtawaValue] = useState("");
  const [donePtawaDepartmentValue, setDonePtawaDepartmentValue] =
    useState("SKIP");
  const [editForm, setEditForm] = useState({
    articleId: "",
    laborId: "unassigned",
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
  const isMergedFinalDepartment = department === "MACHINEMAN";
  const isPressmanDepartment = department === "PRESSMAN";
  const isPrintingDepartment = department === "PRINTING";
  const doneNextDepartmentOptions = selectedOrder
    ? getRemainingDepartments(selectedOrder.department).filter((item) =>
        selectedOrder.department === "UPPERMAN" ? item !== "PRINTING" : true,
      )
    : [];
  const doneUpperDepartmentOptions = doneNextDepartmentOptions.filter(
    (item) => item !== "PRINTING",
  );

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
        laborId:
          formData.laborId === "unassigned" ? undefined : formData.laborId,
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
            department === "UPPERMAN"
              ? Number(row.pricePerDozen) / 12
              : row.pricePerDozen,
          )
        : "",
    );
    setAssignPackingLaborValue(row.packingLaborId || "unassigned");
    setAssignPackingPriceValue(
      row.packingPricePerDozen ? String(row.packingPricePerDozen) : "",
    );
    setAssignOpen(true);
  };

  const openDoneDialog = (row: ApiProductionOrder) => {
    setSelectedOrderId(row.id);
    const remaining = Math.max(
      Number(row.quantityDozen) - getOrderProgressDozen(row),
      0,
    );
    setDoneQtyValue(String(remaining));
    setDoneUpperValue(String(remaining));
    setDonePtawaValue("");
    const options = getRemainingDepartments(row.department).filter(
      (item) => item !== "PRINTING",
    );
    setDoneUpperDepartmentValue(options[0] ?? "");
    setDonePtawaDepartmentValue("SKIP");
    setDoneBMallValue("");
    setDoneCMallValue("");
    const nextOptions = getRemainingDepartments(row.department).filter(
      (item) => (row.department === "UPPERMAN" ? item !== "PRINTING" : true),
    );
    setDoneNextDepartmentValue(nextOptions[0] ?? "");
    setDoneOpen(true);
  };

  const openEditDialog = (row: ApiProductionOrder) => {
    setSelectedOrderId(row.id);
    setEditForm({
      articleId: row.articleId,
      laborId: row.laborId || "unassigned",
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

    const packingPriceInput = Number(assignPackingPriceValue);
    if (
      isMergedFinalDepartment &&
      (!Number.isFinite(packingPriceInput) || packingPriceInput <= 0)
    ) {
      toast.error("Enter a valid packing price.");
      return;
    }

    try {
      setSaving(true);
      if (isMergedFinalDepartment) {
        await productionApi.assignLabor(selectedOrderId, {
          machinemanLaborId:
            assignLaborValue === "unassigned" ? undefined : assignLaborValue,
          machinemanPricePerDozen: priceInput,
          packingLaborId:
            assignPackingLaborValue === "unassigned"
              ? undefined
              : assignPackingLaborValue,
          packingPricePerDozen: packingPriceInput,
        });
      } else {
        await productionApi.assignLabor(selectedOrderId, {
          laborId:
            assignLaborValue === "unassigned" ? undefined : assignLaborValue,
          pricePerDozen:
            department === "UPPERMAN" ? priceInput * 12 : priceInput,
        });
      }
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
    const upperValue = Number(doneUpperValue || 0);
    const ptawaValue = Number(donePtawaValue || 0);
    const bMallDelta = Number(doneBMallValue || 0);
    const cMallDelta = Number(doneCMallValue || 0);
    const alreadyCompleted = Number(selectedOrder.completedDozen);
    const totalQuantity = Number(selectedOrder.quantityDozen);
    const remaining = Math.max(
      totalQuantity - getOrderProgressDozen(selectedOrder),
      0,
    );
    if (!Number.isFinite(value) || value < 0) return;
    if (!Number.isFinite(upperValue) || upperValue < 0) return;
    if (!Number.isFinite(ptawaValue) || ptawaValue < 0) return;
    if (!Number.isFinite(bMallDelta) || bMallDelta < 0) return;
    if (!Number.isFinite(cMallDelta) || cMallDelta < 0) return;

    const totalDelta = value + bMallDelta + cMallDelta;
    if (!isPressmanDepartment && totalDelta > remaining) {
      toast.error(`You can add up to ${remaining} dozen only.`);
      return;
    }
    if (isPressmanDepartment && upperValue <= 0) {
      toast.error("Upper quantity must be greater than 0.");
      return;
    }
    if (
      isPressmanDepartment &&
      upperValue > 0 &&
      (!doneUpperDepartmentValue || doneUpperDepartmentValue === "PRINTING")
    ) {
      toast.error("Upper can only be assigned to non-printing department.");
      return;
    }
    if (
      isPressmanDepartment &&
      donePtawaDepartmentValue !== "SKIP" &&
      donePtawaDepartmentValue !== "PRINTING"
    ) {
      toast.error("Ptawa can only go to printing or be skipped.");
      return;
    }
    if (
      !isMergedFinalDepartment &&
      !isPressmanDepartment &&
      !isPrintingDepartment &&
      value > 0 &&
      doneNextDepartmentOptions.length > 0 &&
      !doneNextDepartmentValue
    ) {
      toast.error("Select next department.");
      return;
    }

    try {
      setSaving(true);
      await productionApi.updateCompletion(selectedOrderId, {
        completedDozen:
          alreadyCompleted +
          (isPressmanDepartment ? upperValue + ptawaValue : value),
        nextDepartment:
          !isMergedFinalDepartment &&
          !isPressmanDepartment &&
          !isPrintingDepartment &&
          value > 0 &&
          doneNextDepartmentValue
            ? (doneNextDepartmentValue as ApiLaborDepartment)
            : undefined,
        bMallDozenDelta: isMergedFinalDepartment ? bMallDelta : undefined,
        cMallDozenDelta: isMergedFinalDepartment ? cMallDelta : undefined,
        upperDozenDelta: isPressmanDepartment ? upperValue : undefined,
        upperNextDepartment: isPressmanDepartment
          ? (doneUpperDepartmentValue as ApiLaborDepartment)
          : undefined,
        ptawaDozenDelta: isPressmanDepartment ? ptawaValue : undefined,
        ptawaNextDepartment:
          isPressmanDepartment &&
          donePtawaDepartmentValue === "PRINTING" &&
          ptawaValue > 0
            ? "PRINTING"
            : undefined,
      });
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
    if (!selectedOrderId || !selectedOrder) return;
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

      const currentLaborId = selectedOrder.laborId ?? null;
      const nextLaborId =
        editForm.laborId === "unassigned" ? null : editForm.laborId;
      if (currentLaborId !== nextLaborId) {
        await productionApi.assignLabor(selectedOrderId, {
          laborId: nextLaborId ?? undefined,
        });
      }

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
              <DialogTitle>
                Add {DEPARTMENT_TITLE[department]} Order
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Article</Label>
                <Select
                  value={formData.articleId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, articleId: value })
                  }
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
                  onValueChange={(value) =>
                    setFormData({ ...formData, laborId: value })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, quantityDozen: e.target.value })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, pricePerDozen: e.target.value })
                  }
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
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
              <Label>
                {isMergedFinalDepartment ? "Machineman Labor" : "Labor"}
              </Label>
              <Select
                value={assignLaborValue}
                onValueChange={setAssignLaborValue}
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
              <Label>
                {department === "UPPERMAN"
                  ? "Price Per Pair"
                  : "Price Per Dozen"}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={assignPriceValue}
                onChange={(e) => setAssignPriceValue(e.target.value)}
                required
              />
            </div>
            {isMergedFinalDepartment && (
              <>
                <div>
                  <Label>Packing Labor</Label>
                  <Select
                    value={assignPackingLaborValue}
                    onValueChange={setAssignPackingLaborValue}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {packingLabors.map((labor) => (
                        <SelectItem key={labor.id} value={labor.id}>
                          {labor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Packing Price Per Dozen</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={assignPackingPriceValue}
                    onChange={(e) => setAssignPackingPriceValue(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignOpen(false)}
              >
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
              <Label>
                {isPressmanDepartment
                  ? "Upper (Dozen)"
                  : isMergedFinalDepartment
                    ? "A-Mall (Dozen)"
                    : "Completed (Dozen)"}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                max={
                  isPressmanDepartment
                    ? undefined
                    : selectedOrder
                      ? Math.max(
                          Number(selectedOrder.quantityDozen) -
                            getOrderProgressDozen(selectedOrder),
                          0,
                        )
                      : undefined
                }
                value={isPressmanDepartment ? doneUpperValue : doneQtyValue}
                onChange={(e) =>
                  isPressmanDepartment
                    ? setDoneUpperValue(e.target.value)
                    : setDoneQtyValue(e.target.value)
                }
                required
              />
              {selectedOrder && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {`Total: ${selectedOrder.quantityDozen} dozen | Already done: ${
                    isMergedFinalDepartment
                      ? getOrderProgressDozen(selectedOrder)
                      : selectedOrder.completedDozen
                  } dozen | Left: ${Math.max(
                    Number(selectedOrder.quantityDozen) -
                      getOrderProgressDozen(selectedOrder),
                    0,
                  )} dozen`}
                </p>
              )}
            </div>
            {isPressmanDepartment && (
              <>
                <div>
                  <Label>Upper Department</Label>
                  <Select
                    value={doneUpperDepartmentValue}
                    onValueChange={setDoneUpperDepartmentValue}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select upper department" />
                    </SelectTrigger>
                    <SelectContent>
                      {doneUpperDepartmentOptions
                        .filter(
                          (nextDepartment) => nextDepartment !== "PRINTING",
                        )
                        .map((nextDepartment) => (
                          <SelectItem
                            key={nextDepartment}
                            value={nextDepartment}
                          >
                            {DEPARTMENT_TITLE[nextDepartment]}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Ptawa (Optional Dozen)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={donePtawaValue}
                      onChange={(e) => setDonePtawaValue(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Ptawa Department</Label>
                    <Select
                      value={donePtawaDepartmentValue}
                      onValueChange={setDonePtawaDepartmentValue}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SKIP">Skip</SelectItem>
                        <SelectItem value="PRINTING">Printing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
            {isMergedFinalDepartment && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>B-Mall (Optional)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={doneBMallValue}
                    onChange={(e) => setDoneBMallValue(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>C-Mall (Optional)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={doneCMallValue}
                    onChange={(e) => setDoneCMallValue(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            )}
            {!isMergedFinalDepartment &&
              !isPressmanDepartment &&
              !isPrintingDepartment &&
              doneNextDepartmentOptions.length > 0 && (
                <div>
                  <Label>Next Department</Label>
                  <Select
                    value={doneNextDepartmentValue}
                    onValueChange={setDoneNextDepartmentValue}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select next department" />
                    </SelectTrigger>
                    <SelectContent>
                      {doneNextDepartmentOptions.map((nextDepartment) => (
                        <SelectItem key={nextDepartment} value={nextDepartment}>
                          {DEPARTMENT_TITLE[nextDepartment]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Only departments ahead in hierarchy are shown.
                  </p>
                </div>
              )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDoneOpen(false)}
              >
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
                onValueChange={(value) =>
                  setEditForm({ ...editForm, articleId: value })
                }
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
                value={editForm.laborId}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, laborId: value })
                }
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
                value={editForm.quantityDozen}
                onChange={(e) =>
                  setEditForm({ ...editForm, quantityDozen: e.target.value })
                }
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
                onChange={(e) =>
                  setEditForm({ ...editForm, pricePerDozen: e.target.value })
                }
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
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
            <TableHead>
              {department === "UPPERMAN" ? "Price / Pair" : "Price / Dozen"}
            </TableHead>
            <TableHead>
              {isMergedFinalDepartment ? "A-Mall Qty" : "Completed Qty"}
            </TableHead>
            <TableHead>Status</TableHead>
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
                Loading orders...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground"
              >
                No orders in this department.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.article?.name || "-"}</TableCell>
                <TableCell>
                  {isMergedFinalDepartment
                    ? `${row.labor?.name || "-"} / ${row.packingLabor?.name || "-"}`
                    : row.labor?.name || "-"}
                </TableCell>
                <TableCell>{row.quantityDozen}</TableCell>
                <TableCell>
                  {isMergedFinalDepartment
                    ? `${row.pricePerDozen} / ${row.packingPricePerDozen}`
                    : department === "UPPERMAN"
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
                    {(() => {
                      const canDoMerged = isMergedFinalDepartment
                        ? !!row.laborId && !!row.packingLaborId
                        : !!row.laborId;
                      return (
                        <>
                          {department === "PRESSMAN" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(row)}
                            >
                              Edit
                            </Button>
                          ) : canDoMerged ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAssignDialog(row)}
                            >
                              Assign Labor
                            </Button>
                          ) : null}
                          {canDoMerged ? (
                            <Button
                              size="sm"
                              onClick={() => openDoneDialog(row)}
                            >
                              Done
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => openAssignDialog(row)}
                            >
                              Assign Labor
                            </Button>
                          )}
                        </>
                      );
                    })()}
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
