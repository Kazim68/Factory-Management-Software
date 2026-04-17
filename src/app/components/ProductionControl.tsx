import { Fragment, useEffect, useMemo, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { SearchableSelect } from "./ui/searchable-select";
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
import { useClientPagination } from "../hooks/useClientPagination";
import {
  FILTER_TIME_PRESET_OPTIONS,
  getPresetDateRange,
  type FilterTimePreset,
} from "../lib/time-presets";
import type {
  ApiArticle,
  ApiLaborCategory,
  ApiLaborDepartment,
  ApiProductionOrder,
} from "../types/api";
import { TablePagination } from "./ui/table-pagination";
import { Filter, Plus, Printer, Trash2 } from "lucide-react";
import { formatDateTime, getDateKey } from "../lib/utils";
import { toast } from "sonner";

type OrderLineItem = {
  key: number;
  articleId: string;
  size: string;
  quantityDozen: string;
  pricePerDozen: string;
};

const makeEmptyLine = (key: number, defaultArticleId: string): OrderLineItem => ({
  key,
  articleId: defaultArticleId,
  size: "",
  quantityDozen: "",
  pricePerDozen: "",
});

const formatDateHeader = (dateString: string): string => {
  try {
    return formatDateTime(dateString, "en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
};

const toDateKey = (dateString: string): string => {
  try {
    return getDateKey(dateString);
  } catch {
    return "unknown";
  }
};

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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

const DEFAULT_DEPARTMENT_TITLE: Record<ApiLaborDepartment, string> = {
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

const formatRateValue = (value: number) => {
  if (!Number.isFinite(value)) return "0";
  const rounded = Number(value.toFixed(4));
  return String(rounded);
};

const toDisplayDepartmentPrice = (
  department: ApiLaborDepartment,
  pricePerDozen: number | string | null | undefined,
) => {
  const numericPrice = Number(pricePerDozen ?? 0);
  if (!Number.isFinite(numericPrice)) return "";
  if (department === "UPPERMAN") {
    return formatRateValue(numericPrice / 12);
  }
  return formatRateValue(numericPrice);
};

const toStoredDepartmentPrice = (
  department: ApiLaborDepartment,
  inputValue: string,
) => {
  const numericValue = Number(inputValue);
  if (!Number.isFinite(numericValue)) return NaN;
  return department === "UPPERMAN" ? numericValue * 12 : numericValue;
};

export function ProductionControl() {
  const [orders, setOrders] = useState<ApiProductionOrder[]>([]);
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [laborCategories, setLaborCategories] = useState<ApiLaborCategory[]>(
    [],
  );
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
      const [orderData, articleData, laborData, laborCategoryData] =
        await Promise.all([
          productionApi.listOrders(),
          configApi.listArticles(),
          productionApi.listDepartmentLabors(),
          configApi.listLaborCategories(),
        ]);
      setOrders(orderData);
      setArticles(articleData);
      setLaborCategories(laborCategoryData);

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

  const departmentTitle = useMemo(
    () =>
      laborCategories.reduce(
        (acc, category) => {
          acc[category.id as ApiLaborDepartment] =
            category.name ||
            DEFAULT_DEPARTMENT_TITLE[category.id as ApiLaborDepartment];
          return acc;
        },
        { ...DEFAULT_DEPARTMENT_TITLE },
      ),
    [laborCategories],
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
                  {departmentTitle[department]}
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
                  departmentLabel={departmentTitle[department]}
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
  departmentLabel,
  packingLabors,
  isLoading,
  onRefresh,
}: {
  department: ApiLaborDepartment;
  rows: ApiProductionOrder[];
  articles: ApiArticle[];
  departmentLabors: Array<{ id: string; name: string }>;
  departmentLabel: string;
  packingLabors: Array<{ id: string; name: string }>;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"ORDER" | "OPENING_STOCK">(
    "ORDER",
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [laborFilter, setLaborFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [timePreset, setTimePreset] = useState<FilterTimePreset>("THIS_MONTH");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [lineKeyCounter, setLineKeyCounter] = useState(1);
  const [orderDate, setOrderDate] = useState(toLocalDateString(new Date()));
  const [orderLines, setOrderLines] = useState<OrderLineItem[]>(() => [
    makeEmptyLine(0, ""),
  ]);

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
    size: "",
    laborId: "unassigned",
    packingLaborId: "unassigned",
    quantityDozen: "",
    pricePerDozen: "",
    packingPricePerDozen: "",
  });

  useEffect(() => {
    if (articles.length > 0) {
      setOrderLines((prev) =>
        prev.map((line) =>
          !line.articleId ? { ...line, articleId: articles[0].id } : line,
        ),
      );
    }
    if (!editForm.articleId && articles.length > 0) {
      setEditForm((prev) => ({ ...prev, articleId: articles[0].id }));
    }
  }, [articles, editForm.articleId]);

  const selectedOrder = rows.find((row) => row.id === selectedOrderId) || null;
  const isMergedFinalDepartment = department === "MACHINEMAN";
  const isPressmanDepartment = department === "PRESSMAN";
  const isPrintingDepartment = department === "PRINTING";
  const isUppermanDepartment = department === "UPPERMAN";
  const doneNextDepartmentOptions = selectedOrder
    ? getRemainingDepartments(selectedOrder.department).filter((item) =>
        selectedOrder.department === "UPPERMAN" ? item !== "PRINTING" : true,
      )
    : [];
  const doneUpperDepartmentOptions = doneNextDepartmentOptions.filter(
    (item) => item !== "PRINTING",
  );

  const addLine = () => {
    const nextKey = lineKeyCounter + 1;
    setLineKeyCounter(nextKey);
    setOrderLines((prev) => [
      ...prev,
      makeEmptyLine(nextKey, articles[0]?.id ?? ""),
    ]);
  };

  const removeLine = (key: number) => {
    setOrderLines((prev) => prev.filter((line) => line.key !== key));
  };

  const updateLine = (
    key: number,
    field: keyof Omit<OrderLineItem, "key">,
    value: string,
  ) => {
    setOrderLines((prev) =>
      prev.map((line) =>
        line.key === key ? { ...line, [field]: value } : line,
      ),
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = orderLines.filter((line) => {
      const qty = Number(line.quantityDozen);
      const price = toStoredDepartmentPrice(department, line.pricePerDozen);
      return (
        line.articleId &&
        line.size.trim() &&
        Number.isFinite(qty) &&
        qty > 0 &&
        Number.isFinite(price) &&
        (createMode === "OPENING_STOCK" ? price >= 0 : price > 0)
      );
    });
    if (validLines.length === 0) {
      toast.error(
        createMode === "OPENING_STOCK"
          ? "Add at least one valid opening stock line."
          : "Add at least one valid article line.",
      );
      return;
    }

    try {
      setSaving(true);
      await productionApi.createBulkOrders({
        department,
        orderDate,
        items: validLines.map((line) => ({
          articleId: line.articleId,
          size: line.size.trim(),
          quantityDozen: Number(line.quantityDozen),
          pricePerDozen: toStoredDepartmentPrice(department, line.pricePerDozen),
        })),
      });
      toast.success(
        createMode === "OPENING_STOCK"
          ? `${validLines.length} opening stock line(s) added.`
          : `${validLines.length} order(s) added.`,
      );
      setOrderLines([makeEmptyLine(0, articles[0]?.id ?? "")]);
      setLineKeyCounter(1);
      setOrderDate(toLocalDateString(new Date()));
      setCreateMode("ORDER");
      setOpen(false);
      await onRefresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to add orders.");
    } finally {
      setSaving(false);
    }
  };

  const articleOptions = useMemo(
    () => articles.map((article) => ({ value: article.id, label: article.name })),
    [articles],
  );

  const departmentLaborOptions = useMemo(
    () => [
      { value: "unassigned", label: "Unassigned" },
      ...departmentLabors.map((labor) => ({
        value: labor.id,
        label: labor.name,
      })),
    ],
    [departmentLabors],
  );

  const packingLaborOptions = useMemo(
    () => [
      { value: "unassigned", label: "Unassigned" },
      ...packingLabors.map((labor) => ({
        value: labor.id,
        label: labor.name,
      })),
    ],
    [packingLabors],
  );

  const articleNameById = useMemo(
    () => new Map(articles.map((article) => [article.id, article.name])),
    [articles],
  );

  const visibleRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let fromTs: number | null = null;
    let toTs: number | null = null;

    if (timePreset === "CUSTOM") {
      fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
      toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    } else {
      const range = getPresetDateRange(timePreset, new Date());
      fromTs = range?.from.getTime() ?? null;
      toTs = range?.to.getTime() ?? null;
    }

    return rows.filter((row) => {
      const hasAssignedLabor = Boolean(row.laborId || row.packingLaborId);

      if (laborFilter === "assigned" && !hasAssignedLabor) return false;
      if (laborFilter === "unassigned" && hasAssignedLabor) return false;

      const rowTs = new Date(row.orderDate).getTime();
      if (fromTs !== null && rowTs < fromTs) return false;
      if (toTs !== null && rowTs > toTs) return false;

      if (!query) return true;

      return [
        articleNameById.get(row.articleId) ?? "",
        row.size,
        row.labor?.name ?? "",
        row.packingLabor?.name ?? "",
        statusLabel(row.status),
        String(row.quantityDozen ?? ""),
        String(getOrderProgressDozen(row)),
        String(row.pricePerDozen ?? ""),
        toDateKey(row.orderDate),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    articleNameById,
    dateFrom,
    dateTo,
    laborFilter,
    rows,
    searchQuery,
    timePreset,
  ]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems,
    startItem,
    endItem,
    paginatedItems: paginatedRows,
    goToPreviousPage,
    goToNextPage,
  } = useClientPagination(visibleRows);

  const rowsByDate = useMemo(() => {
    if (!isPressmanDepartment) return null;
    const groups: Record<string, typeof paginatedRows> = {};
    for (const row of paginatedRows) {
      const key = toDateKey(row.orderDate);
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [paginatedRows, isPressmanDepartment]);

  const rowsByLaborName = useMemo(() => {
    if (department !== "UPPERMAN") return null;
    const groups: Record<string, typeof paginatedRows> = {};
    for (const row of paginatedRows) {
      const key = row.labor?.name || "Unassigned";
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });
  }, [paginatedRows, department]);

  const clearFilters = () => {
    setSearchQuery("");
    setLaborFilter("all");
    setTimePreset("THIS_MONTH");
    setDateFrom("");
    setDateTo("");
  };

  const openAssignDialog = (row: ApiProductionOrder) => {
    setSelectedOrderId(row.id);
    setAssignLaborValue(row.laborId || "unassigned");
    setAssignPriceValue(
      row.pricePerDozen
        ? toDisplayDepartmentPrice(department, row.pricePerDozen)
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
      size: row.size,
      laborId: row.laborId || "unassigned",
      packingLaborId: row.packingLaborId || "unassigned",
      quantityDozen: String(row.quantityDozen),
      pricePerDozen: toDisplayDepartmentPrice(department, row.pricePerDozen),
      packingPricePerDozen: String(row.packingPricePerDozen ?? 0),
    });
    setEditOpen(true);
  };

  const canDeleteOrder = (row: ApiProductionOrder) =>
    getOrderProgressDozen(row) <= 0 && Number(row.forwardedDozen ?? 0) <= 0;

  const handleDeleteOrder = async (row: ApiProductionOrder) => {
    if (!canDeleteOrder(row)) {
      toast.error("Only orders with no completed or forwarded work can be deleted.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${row.article?.name || "this"} ${departmentLabel} order (${row.size})?`,
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      await productionApi.deleteOrder(row.id);
      toast.success("Order moved to Deleted Items.");
      await onRefresh();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete order.",
      );
    } finally {
      setSaving(false);
    }
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
          pricePerDozen: toStoredDepartmentPrice(
            department,
            assignPriceValue,
          ),
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
    const pricePerDozen = toStoredDepartmentPrice(
      department,
      editForm.pricePerDozen,
    );
    const packingPricePerDozen = Number(editForm.packingPricePerDozen || 0);
    const nextLaborId =
      editForm.laborId === "unassigned" ? null : editForm.laborId;
    const nextPackingLaborId =
      editForm.packingLaborId === "unassigned"
        ? null
        : editForm.packingLaborId;
    const minimumQuantity = getOrderProgressDozen(selectedOrder);

    if (!Number.isFinite(quantityDozen) || quantityDozen <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }
    if (quantityDozen < minimumQuantity) {
      toast.error(`Quantity cannot be less than ${minimumQuantity} dozen already completed.`);
      return;
    }
    if (!Number.isFinite(pricePerDozen) || pricePerDozen < 0) {
      toast.error("Enter a valid price.");
      return;
    }
    if (nextLaborId && pricePerDozen <= 0) {
      toast.error(
        department === "UPPERMAN"
          ? "Price per pair must be greater than 0 when labor is assigned."
          : "Price per dozen must be greater than 0 when labor is assigned.",
      );
      return;
    }
    if (!editForm.size.trim()) {
      toast.error("Size is required.");
      return;
    }
    if (isMergedFinalDepartment) {
      if (!Number.isFinite(packingPricePerDozen) || packingPricePerDozen < 0) {
        toast.error("Enter a valid packing price.");
        return;
      }
      if (nextPackingLaborId && packingPricePerDozen <= 0) {
        toast.error("Packing price must be greater than 0 when packing labor is assigned.");
        return;
      }
    }

    try {
      setSaving(true);
      await productionApi.updateOrder(selectedOrderId, {
        articleId: editForm.articleId,
        size: editForm.size.trim(),
        quantityDozen,
        ...(isMergedFinalDepartment ? {} : { pricePerDozen }),
      });

      if (isMergedFinalDepartment) {
        await productionApi.assignLabor(selectedOrderId, {
          machinemanLaborId: nextLaborId ?? undefined,
          machinemanPricePerDozen: pricePerDozen,
          packingLaborId: nextPackingLaborId ?? undefined,
          packingPricePerDozen,
        });
      } else {
        const currentLaborId = selectedOrder.laborId ?? null;
        if (currentLaborId !== nextLaborId) {
          await productionApi.assignLabor(selectedOrderId, {
            laborId: nextLaborId ?? undefined,
          });
        }
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

  const printDepartmentOrders = async () => {
    try {
      setPrinting(true);
      const html = await productionApi.getPrintableOrders();
      const printWindow = window.open("", "", "width=1000,height=700");
      if (!printWindow) {
        toast.error("Unable to open print window.");
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate printable department report.");
    } finally {
      setPrinting(false);
    }
  };

  const printDailyPressmanOrders = async (dateStr: string) => {
    try {
      setPrinting(true);
      const html = await productionApi.getPrintableDailyPressmanOrders(dateStr);
      const printWindow = window.open("", "", "width=1000,height=700");
      if (!printWindow) {
        toast.error("Unable to open print window.");
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate printable daily report.");
    } finally {
      setPrinting(false);
    }
  };

  const openAddForDate = (dateStr: string) => {
    setOrderDate(dateStr);
    setOrderLines([makeEmptyLine(0, articles[0]?.id ?? "")]);
    setLineKeyCounter(1);
    setCreateMode("ORDER");
    setOpen(true);
  };

  const openCreateDialog = (mode: "ORDER" | "OPENING_STOCK") => {
    setCreateMode(mode);
    setOrderDate(toLocalDateString(new Date()));
    setOrderLines([makeEmptyLine(0, articles[0]?.id ?? "")]);
    setLineKeyCounter(1);
    setOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3>{departmentLabel} Orders</h3>
          <div className="flex flex-wrap items-center gap-2">
            {isPressmanDepartment && (
              <Button
                size="sm"
                type="button"
                onClick={() => openCreateDialog("ORDER")}
              >
                Add Order
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={printDepartmentOrders}
              disabled={printing}
            >
              <Printer className="mr-2 h-4 w-4" />
              {printing ? "Preparing..." : "Print"}
            </Button>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => openCreateDialog("OPENING_STOCK")}
            >
              Opening Stock
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {createMode === "OPENING_STOCK"
                ? `Add ${departmentLabel} Opening Stock`
                : `Add ${departmentLabel} Order`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {createMode === "OPENING_STOCK" && (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Use this one-time setup flow to bring already-in-hand stock
                directly into the {departmentLabel} queue. Price is optional
                here because you can assign or update labor rates later.
              </div>
            )}
            <div>
              <Label>
                {createMode === "OPENING_STOCK" ? "Setup Date" : "Order Date"}
              </Label>
              <Input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Articles</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addLine}
                >
                  <Plus className="mr-1 h-3 w-3" /> Add Article
                </Button>
              </div>
              {orderLines.map((line, idx) => (
                <div
                  key={line.key}
                  className="rounded-md border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Item {idx + 1}
                    </span>
                    {orderLines.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() => removeLine(line.key)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <Label className="text-xs">Article</Label>
                      <SearchableSelect
                        value={line.articleId}
                        onValueChange={(value) =>
                          updateLine(line.key, "articleId", value)
                        }
                        options={articleOptions}
                        placeholder="Select article"
                        searchPlaceholder="Search article..."
                        emptyMessage="No articles found."
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Size</Label>
                      <Input
                        value={line.size}
                        onChange={(e) =>
                          updateLine(line.key, "size", e.target.value)
                        }
                        placeholder="Size"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Quantity (Dozen)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantityDozen}
                        onChange={(e) =>
                          updateLine(
                            line.key,
                            "quantityDozen",
                            e.target.value,
                          )
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs">
                        {department === "UPPERMAN"
                          ? createMode === "OPENING_STOCK"
                            ? "Price Per Pair (Optional)"
                            : "Price Per Pair"
                          : createMode === "OPENING_STOCK"
                            ? "Price Per Dozen (Optional)"
                            : "Price Per Dozen"}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.pricePerDozen}
                        onChange={(e) =>
                          updateLine(
                            line.key,
                            "pricePerDozen",
                            e.target.value,
                          )
                        }
                        required={createMode !== "OPENING_STOCK"}
                      />
                    </div>
                  </div>
                </div>
              ))}
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
                {createMode === "OPENING_STOCK"
                  ? `Add ${orderLines.length > 1 ? `${orderLines.length} Opening Stock Lines` : "Opening Stock"}`
                  : `Add ${orderLines.length > 1 ? `${orderLines.length} Orders` : "Order"}`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border border-dashed bg-muted/30 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1 md:max-w-[360px]">
            <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
              Search
            </Label>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search article, size, labor, or date..."
            />
          </div>
          <div className="min-w-[180px]">
            <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
              Assignment
            </Label>
            <Select
              value={laborFilter}
              onValueChange={(value) => setLaborFilter(value as typeof laborFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px]">
            <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
              Time
            </Label>
            <Select
              value={timePreset}
              onValueChange={(value) => setTimePreset(value as FilterTimePreset)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_TIME_PRESET_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {timePreset === "CUSTOM" && (
            <>
              <div>
                <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                  From
                </Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                  To
                </Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="w-40"
                />
              </div>
            </>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            <Filter className="mr-2 h-4 w-4" />
            Reset Filters
          </Button>
        </div>
      </div>

      {false && isUppermanDepartment && (
        <div className="flex items-center gap-2 px-0.5">
          <span className="text-sm text-muted-foreground font-medium">Filter:</span>
          <div className="flex gap-1.5">
            {(["all", "assigned", "unassigned"] as const).map((filter) => (
              <Button
                key={filter}
                size="sm"
                variant={laborFilter === filter ? "default" : "outline"}
                onClick={() => setLaborFilter(filter)}
                className="h-8"
              >
                {filter === "all" && "All"}
                {filter === "assigned" && "✓ Assigned"}
                {filter === "unassigned" && "✗ Unassigned"}
              </Button>
            ))}
          </div>
        </div>
      )}

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
              <SearchableSelect
                value={assignLaborValue}
                onValueChange={setAssignLaborValue}
                options={departmentLaborOptions}
                placeholder="Select labor"
                searchPlaceholder="Search labor..."
                emptyMessage="No labor found."
              />
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
                  <SearchableSelect
                    value={assignPackingLaborValue}
                    onValueChange={setAssignPackingLaborValue}
                    options={packingLaborOptions}
                    placeholder="Select packing labor"
                    searchPlaceholder="Search packing labor..."
                    emptyMessage="No packing labor found."
                  />
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
                      {doneUpperDepartmentOptions.map((nextDepartment) => (
                        <SelectItem key={nextDepartment} value={nextDepartment}>
                          {DEFAULT_DEPARTMENT_TITLE[nextDepartment]}
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
                          {DEFAULT_DEPARTMENT_TITLE[nextDepartment]}
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
            <DialogTitle>Update Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div>
              <Label>Article</Label>
              <SearchableSelect
                value={editForm.articleId}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, articleId: value })
                }
                options={articleOptions}
                placeholder="Select article"
                searchPlaceholder="Search article..."
                emptyMessage="No articles found."
              />
            </div>
            <div>
              <Label>Size</Label>
              <Input
                value={editForm.size}
                onChange={(e) =>
                  setEditForm({ ...editForm, size: e.target.value })
                }
                placeholder="Enter size"
                required
              />
            </div>
            {isMergedFinalDepartment ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Machineman Labor</Label>
                  <SearchableSelect
                    value={editForm.laborId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, laborId: value })
                    }
                    options={departmentLaborOptions}
                    placeholder="Select labor"
                    searchPlaceholder="Search labor..."
                    emptyMessage="No labor found."
                  />
                </div>
                <div>
                  <Label>Packing Labor</Label>
                  <SearchableSelect
                    value={editForm.packingLaborId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, packingLaborId: value })
                    }
                    options={packingLaborOptions}
                    placeholder="Select packing labor"
                    searchPlaceholder="Search packing labor..."
                    emptyMessage="No packing labor found."
                  />
                </div>
              </div>
            ) : (
              <div>
                <Label>Labor</Label>
                <SearchableSelect
                  value={editForm.laborId}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, laborId: value })
                  }
                  options={departmentLaborOptions}
                  placeholder="Select labor"
                  searchPlaceholder="Search labor..."
                  emptyMessage="No labor found."
                />
              </div>
            )}
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
            {isMergedFinalDepartment ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Machineman Price Per Dozen</Label>
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
                <div>
                  <Label>Packing Price Per Dozen</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.packingPricePerDozen}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        packingPricePerDozen: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>
            ) : (
              <div>
                <Label>
                  {department === "UPPERMAN" ? "Price Per Pair" : "Price Per Dozen"}
                </Label>
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
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                Update
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            {isPressmanDepartment && <TableHead>Date</TableHead>}
            <TableHead>Article</TableHead>
            <TableHead>Size</TableHead>
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
                colSpan={isPressmanDepartment ? 9 : 8}
                className="text-center text-muted-foreground"
              >
                Loading orders...
              </TableCell>
            </TableRow>
          ) : visibleRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={isPressmanDepartment ? 9 : 8}
                className="text-center text-muted-foreground"
              >
                No orders in this department.
              </TableCell>
            </TableRow>
          ) : isPressmanDepartment && rowsByDate ? (
            rowsByDate.map(([dateKey, dateRows]) => (
              <Fragment key={`date-group-${dateKey}`}>
                <TableRow key={`date-${dateKey}`}>
                  <TableCell
                    colSpan={9}
                    className="bg-muted/50 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">📅 {formatDateHeader(dateKey)}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => openAddForDate(dateKey)}
                          title="Add Order for this Date"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => printDailyPressmanOrders(dateKey)}
                          disabled={printing}
                          title="Print Daily Orders"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
                {dateRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {toDateKey(row.orderDate)}
                    </TableCell>
                    <TableCell>{row.article?.name || "-"}</TableCell>
                    <TableCell>{row.size || "-"}</TableCell>
                    <TableCell>{row.labor?.name || "-"}</TableCell>
                    <TableCell>{row.quantityDozen}</TableCell>
                    <TableCell>{row.pricePerDozen}</TableCell>
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
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(row)}
                        >
                          Update
                        </Button>
                        <Button
                          size="sm"
                          variant={row.laborId ? "outline" : "default"}
                          className={row.laborId ? "" : "bg-orange-600 hover:bg-orange-700"}
                          onClick={() => openAssignDialog(row)}
                        >
                          {row.laborId ? "Update Labor" : "Assign Labor"}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openDoneDialog(row)}
                          disabled={!row.laborId}
                          title={
                            row.laborId
                              ? "Mark this order done"
                              : "Assign labor before marking this order done"
                          }
                        >
                          Done
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteOrder(row)}
                          disabled={!canDeleteOrder(row) || saving}
                          title={
                            canDeleteOrder(row)
                              ? "Delete this order"
                              : "Only orders with no completed or forwarded work can be deleted"
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))
          ) : isUppermanDepartment && rowsByLaborName ? (
            rowsByLaborName.map(([laborName, laborRows]) => (
              <Fragment key={`labor-group-${laborName}`}>
                <TableRow key={`labor-${laborName}`}>
                  <TableCell
                    colSpan={8}
                    className="bg-muted/50 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {laborName === "Unassigned" ? "🔲 Unassigned" : `👤 ${laborName}`}
                      </span>
                      <Badge variant="secondary" className="ml-auto w-fit">
                        {laborRows.length} {laborRows.length === 1 ? "order" : "orders"}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
                {laborRows.map((row) => (
                  <TableRow key={row.id} className={!row.laborId ? "bg-red-50 dark:bg-red-950/20" : ""}>
                    <TableCell>{row.article?.name || "-"}</TableCell>
                    <TableCell>{row.size || "-"}</TableCell>
                    <TableCell>
                      {row.labor?.name ? (
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                          {row.labor.name}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                          Unassigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{row.quantityDozen}</TableCell>
                    <TableCell>
                      {toDisplayDepartmentPrice(department, row.pricePerDozen)}
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
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(row)}
                        >
                          Update
                        </Button>
                        <Button
                          size="sm"
                          variant={row.laborId ? "outline" : "default"}
                          onClick={() => openAssignDialog(row)}
                          className={row.laborId ? "" : "bg-orange-600 hover:bg-orange-700"}
                        >
                          {row.laborId ? "Update Labor" : "Assign Labor"}
                        </Button>
                        {row.laborId && (
                          <Button
                            size="sm"
                            onClick={() => openDoneDialog(row)}
                          >
                            Done
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteOrder(row)}
                          disabled={!canDeleteOrder(row) || saving}
                          title={
                            canDeleteOrder(row)
                              ? "Delete this order"
                              : "Only orders with no completed or forwarded work can be deleted"
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))
          ) : (
            paginatedRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.article?.name || "-"}</TableCell>
                <TableCell>{row.size || "-"}</TableCell>
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
                      ? toDisplayDepartmentPrice(department, row.pricePerDozen)
                      : toDisplayDepartmentPrice(department, row.pricePerDozen)}
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
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const canDoMerged = isMergedFinalDepartment
                        ? !!row.laborId && !!row.packingLaborId
                        : !!row.laborId;
                      return (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(row)}
                          >
                            Update
                          </Button>
                          {canDoMerged ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAssignDialog(row)}
                            >
                              Update Labor
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
                              className="bg-orange-600 hover:bg-orange-700"
                              onClick={() => openAssignDialog(row)}
                            >
                              Assign Labor
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteOrder(row)}
                            disabled={!canDeleteOrder(row) || saving}
                            title={
                              canDeleteOrder(row)
                                ? "Delete this order"
                                : "Only orders with no completed or forwarded work can be deleted"
                            }
                          >
                            Delete
                          </Button>
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
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        startItem={startItem}
        endItem={endItem}
        pageSize={pageSize}
        setPageSize={setPageSize}
        goToPreviousPage={goToPreviousPage}
        goToNextPage={goToNextPage}
        setCurrentPage={setCurrentPage}
      />
    </div>
);
}
