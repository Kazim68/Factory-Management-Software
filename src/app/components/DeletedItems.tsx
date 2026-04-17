import { useEffect, useMemo, useState } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
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
import { TablePagination } from "./ui/table-pagination";
import { useClientPagination } from "../hooks/useClientPagination";
import {
  billApi,
  configApi,
  expenseApi,
  laborApi,
  partyApi,
  productionApi,
  purchaseApi,
} from "../lib/api";
import {
  FILTER_TIME_PRESET_OPTIONS,
  getPresetDateRange,
  type FilterTimePreset,
} from "../lib/time-presets";
import { auth } from "../lib/auth";
import { formatCurrency, formatDate, formatDateTime } from "../lib/utils";
import type {
  ApiBill,
  ApiExpenseEntry,
  ApiLaborAdvance,
  ApiLaborProfile,
  ApiLaborWorkEntry,
  ApiMallStockMovement,
  ApiParty,
  ApiProductionOrder,
  ApiStockEntry,
  ApiUnit,
  ApiArticle,
  ApiPaymentType,
  ApiChemicalPurchase,
  ApiRexinePurchase,
  ApiMaterialPurchase,
} from "../types/api";

type DeletedTab =
  | "bills"
  | "roznamcha"
  | "purchases"
  | "labor"
  | "parties"
  | "production"
  | "stock"
  | "configuration";

type RoznamchaFilter = "ALL" | "IN_ONLY" | "OUT_ONLY" | "LABOR_ONLY" | "PARTY_ONLY";
type PurchaseKind = "ALL" | "CHEMICAL" | "REXINE" | "MATERIAL";
type LaborDeletedType = "ALL" | "PROFILE" | "WORK" | "ADVANCE";
type StockDeletedType = "MALL" | "MANUAL";
type ConfigurationDeletedType = "UNIT" | "ARTICLE" | "PAYMENT_TYPE";
type ProductionLaborFilter = "all" | "assigned" | "unassigned";

type DeletedPurchaseRecord =
  | (ApiChemicalPurchase & { purchaseType: "CHEMICAL"; itemLabel: string })
  | (ApiRexinePurchase & { purchaseType: "REXINE"; itemLabel: string })
  | (ApiMaterialPurchase & { purchaseType: "MATERIAL"; itemLabel: string });

const getDateRange = (
  timePreset: FilterTimePreset,
  dateFrom: string,
  dateTo: string,
) => {
  if (timePreset === "CUSTOM") {
    return {
      fromTs: dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null,
      toTs: dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null,
    };
  }

  const range = getPresetDateRange(timePreset, new Date());
  return {
    fromTs: range?.from.getTime() ?? null,
    toTs: range?.to.getTime() ?? null,
  };
};

const getRoznamchaReferenceLabel = (entry: ApiExpenseEntry) => {
  const sourceSystem = String(entry.sourceSystem ?? "").toUpperCase();
  if (sourceSystem === "BILL_PAYMENT_RECEIVED") return "Customer";
  if (sourceSystem === "PARTY_PAYMENT_RECEIVED") {
    return entry.party?.type === "CUSTOMER" ? "Customer" : "Party";
  }
  if (sourceSystem === "PARTY_PAYMENT_PAID") {
    return entry.party?.type === "SUPPLIER" ? "Supplier" : "Party";
  }
  if (sourceSystem === "LABOR_ADVANCE") return "Labor";
  if (sourceSystem === "CHEMICAL_PURCHASE") return "Chemical";
  if (sourceSystem === "REXINE_PURCHASE") return "Rexine";
  if (sourceSystem === "MATERIAL_PURCHASE") return "Material";
  if (sourceSystem === "B_MALL_SALE") return "B-Mall Sale";
  if (sourceSystem === "C_MALL_SALE") return "C-Mall Sale";
  if (sourceSystem.startsWith("BILL_SALE|")) return "Sale";

  switch (entry.module) {
    case "CHEMICAL":
      return "Chemical";
    case "REXINE":
      return "Rexine";
    case "MATERIAL":
      return "Material";
    case "LABOR":
      return "Labor";
    default:
      return "Misc";
  }
};

const getRoznamchaPartyLaborLabel = (entry: ApiExpenseEntry) => {
  if (
    String(entry.sourceSystem ?? "").toUpperCase().startsWith("BILL_SALE|") &&
    entry.description
  ) {
    const [, reference] = entry.description.split(" - ");
    return reference || entry.description;
  }

  return (
    entry.party?.name ||
    entry.labor?.name ||
    entry.laborAdvance?.labor?.name ||
    "-"
  );
};

const getRoznamchaPaymentTypeLabel = (entry: ApiExpenseEntry) =>
  String(entry.paymentType ?? "CASH").toUpperCase() === "CHEQUE"
    ? "Cheque"
    : String(entry.paymentType ?? "CASH").toUpperCase() === "CASH"
      ? "Cash"
      : "Khata";

const getRoznamchaInOut = (amount: number) => (amount < 0 ? "In" : "Out");

const getRoznamchaActorLabel = (entry: ApiExpenseEntry) => {
  const sourceSystem = String(entry.sourceSystem ?? "");
  const taggedActor = sourceSystem.match(
    /^ROZNAMCHA_MANUAL(?:\|([^|]+)\|([^|]+))?$/,
  );

  if (taggedActor?.[1] && taggedActor?.[2]) {
    return `${taggedActor[1]} (${taggedActor[2]})`;
  }

  if (entry.source === "MANUAL" || typeof entry.source === "undefined") {
    const sessionUser = auth.getSessionUser();
    if (sessionUser?.username && sessionUser?.role) {
      return `${sessionUser.username} (${sessionUser.role})`;
    }
    return "Manual Entry";
  }

  return "System";
};

const getProductionProgressDozen = (order: ApiProductionOrder) => {
  const completed = Number(order.completedDozen ?? 0);
  if (!["MACHINEMAN", "PACKING"].includes(order.department)) return completed;
  return (
    completed +
    Number(order.bMallDozen ?? 0) +
    Number(order.cMallDozen ?? 0)
  );
};

const getProductionStatusLabel = (status: string) =>
  status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getMallTypeLabel = (mallType: ApiMallStockMovement["mallType"]) =>
  mallType === "B_MALL" ? "B-Mall" : "C-Mall";

const getMallDirectionLabel = (
  mallType: ApiMallStockMovement["mallType"],
  direction: ApiMallStockMovement["direction"],
) => {
  const label = getMallTypeLabel(mallType);
  return direction === "IN" ? `${label} In` : `${label} Out`;
};

export function DeletedItems() {
  const [activeTab, setActiveTab] = useState<DeletedTab>("bills");
  const [isLoading, setIsLoading] = useState(false);
  const [bills, setBills] = useState<ApiBill[]>([]);
  const [expenses, setExpenses] = useState<ApiExpenseEntry[]>([]);
  const [profiles, setProfiles] = useState<ApiLaborProfile[]>([]);
  const [workEntries, setWorkEntries] = useState<ApiLaborWorkEntry[]>([]);
  const [advances, setAdvances] = useState<ApiLaborAdvance[]>([]);
  const [parties, setParties] = useState<ApiParty[]>([]);
  const [orders, setOrders] = useState<ApiProductionOrder[]>([]);
  const [mallMovements, setMallMovements] = useState<ApiMallStockMovement[]>([]);
  const [manualEntries, setManualEntries] = useState<ApiStockEntry[]>([]);
  const [units, setUnits] = useState<ApiUnit[]>([]);
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<ApiPaymentType[]>([]);
  const [chemicals, setChemicals] = useState<ApiChemicalPurchase[]>([]);
  const [rexine, setRexine] = useState<ApiRexinePurchase[]>([]);
  const [materials, setMaterials] = useState<ApiMaterialPurchase[]>([]);

  const [billSearchQuery, setBillSearchQuery] = useState("");
  const [billStatusFilter, setBillStatusFilter] = useState<
    "ALL" | "UNPAID" | "PARTIAL_PAID" | "PAID"
  >("ALL");
  const [billTimePreset, setBillTimePreset] =
    useState<FilterTimePreset>("THIS_MONTH");
  const [billDateFrom, setBillDateFrom] = useState("");
  const [billDateTo, setBillDateTo] = useState("");

  const [roznamchaSearchQuery, setRoznamchaSearchQuery] = useState("");
  const [roznamchaFilterDate, setRoznamchaFilterDate] = useState("");
  const [roznamchaEntryFilter, setRoznamchaEntryFilter] =
    useState<RoznamchaFilter>("ALL");

  const [purchaseSearchQuery, setPurchaseSearchQuery] = useState("");
  const [purchaseTypeFilter, setPurchaseTypeFilter] =
    useState<PurchaseKind>("ALL");
  const [purchaseTimePreset, setPurchaseTimePreset] =
    useState<FilterTimePreset>("THIS_MONTH");
  const [purchaseDateFrom, setPurchaseDateFrom] = useState("");
  const [purchaseDateTo, setPurchaseDateTo] = useState("");

  const [laborSearchQuery, setLaborSearchQuery] = useState("");
  const [laborDepartmentFilter, setLaborDepartmentFilter] = useState("ALL");
  const [laborRecordType, setLaborRecordType] =
    useState<LaborDeletedType>("ALL");
  const [laborDateFrom, setLaborDateFrom] = useState("");
  const [laborDateTo, setLaborDateTo] = useState("");

  const [partySearchQuery, setPartySearchQuery] = useState("");
  const [partyTypeFilter, setPartyTypeFilter] = useState<
    "ALL" | "CUSTOMER" | "SUPPLIER"
  >("ALL");

  const [productionSearchQuery, setProductionSearchQuery] = useState("");
  const [productionLaborFilter, setProductionLaborFilter] =
    useState<ProductionLaborFilter>("all");
  const [productionTimePreset, setProductionTimePreset] =
    useState<FilterTimePreset>("THIS_MONTH");
  const [productionDateFrom, setProductionDateFrom] = useState("");
  const [productionDateTo, setProductionDateTo] = useState("");

  const [stockDeletedType, setStockDeletedType] =
    useState<StockDeletedType>("MALL");
  const [mallSearchQuery, setMallSearchQuery] = useState("");
  const [mallTypeFilter, setMallTypeFilter] = useState<
    "ALL" | "B_MALL" | "C_MALL"
  >("ALL");
  const [mallDirectionFilter, setMallDirectionFilter] = useState<
    "ALL" | "IN" | "OUT"
  >("ALL");
  const [mallTimePreset, setMallTimePreset] =
    useState<FilterTimePreset>("THIS_MONTH");
  const [mallDateFrom, setMallDateFrom] = useState("");
  const [mallDateTo, setMallDateTo] = useState("");
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [manualModeFilter, setManualModeFilter] = useState<
    "ALL" | "IN_STOCK" | "PACKED"
  >("ALL");

  const [configurationType, setConfigurationType] =
    useState<ConfigurationDeletedType>("UNIT");
  const [configurationSearchQuery, setConfigurationSearchQuery] = useState("");

  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          profiles
            .map((profile) => profile.category?.name || profile.department || profile.categoryId)
            .filter(Boolean),
        ),
      ).sort((a, b) => String(a).localeCompare(String(b))),
    [profiles],
  );

  const loadDeletedData = async () => {
    setIsLoading(true);
    try {
      const [
        deletedBills,
        deletedExpenses,
        deletedProfiles,
        deletedWorkEntries,
        deletedAdvances,
        deletedParties,
        deletedOrders,
        deletedMallMovements,
        deletedManualEntries,
        deletedUnits,
        deletedArticles,
        deletedPaymentTypes,
        deletedChemicals,
        deletedRexine,
        deletedMaterials,
      ] = await Promise.all([
        billApi.listBills({ deleted: "ONLY" }),
        expenseApi.listExpenses({ deleted: "ONLY" }),
        laborApi.listProfiles({ status: "ALL", deleted: "ONLY" }),
        laborApi.listWorkEntries({ deleted: "ONLY" }),
        laborApi.listAdvances({ deleted: "ONLY" }),
        partyApi.listParties({ deleted: "ONLY" }),
        productionApi.listOrders(undefined, { deleted: "ONLY" }),
        productionApi.listMallStockMovements({ deleted: "ONLY" }),
        productionApi.listManualStockEntries({ deleted: "ONLY" }),
        configApi.listUnits({ deleted: "ONLY" }),
        configApi.listArticles({ deleted: "ONLY" }),
        configApi.listPaymentTypes({ deleted: "ONLY" }),
        purchaseApi.listChemicals({ deleted: "ONLY" }),
        purchaseApi.listRexine({ deleted: "ONLY" }),
        purchaseApi.listMaterials({ deleted: "ONLY" }),
      ]);

      setBills(deletedBills);
      setExpenses(deletedExpenses);
      setProfiles(deletedProfiles);
      setWorkEntries(deletedWorkEntries);
      setAdvances(deletedAdvances);
      setParties(deletedParties);
      setOrders(deletedOrders);
      setMallMovements(deletedMallMovements);
      setManualEntries(deletedManualEntries);
      setUnits(deletedUnits);
      setArticles(deletedArticles);
      setPaymentTypes(deletedPaymentTypes);
      setChemicals(deletedChemicals);
      setRexine(deletedRexine);
      setMaterials(deletedMaterials);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load deleted items.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDeletedData();
  }, []);

  const restoreAndReload = async (
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    try {
      await action();
      toast.success(successMessage);
      await loadDeletedData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to restore item.");
    }
  };

  const filteredBills = useMemo(() => {
    const query = billSearchQuery.trim().toLowerCase();
    const { fromTs, toTs } = getDateRange(
      billTimePreset,
      billDateFrom,
      billDateTo,
    );

    return [...bills]
      .sort(
        (a, b) =>
          new Date(b.deletedAt || b.updatedAt).getTime() -
          new Date(a.deletedAt || a.updatedAt).getTime(),
      )
      .filter((bill) => {
        if (billStatusFilter !== "ALL" && bill.paymentStatus !== billStatusFilter) {
          return false;
        }

        const billTs = new Date(bill.date).getTime();
        if (fromTs !== null && billTs < fromTs) return false;
        if (toTs !== null && billTs > toTs) return false;

        if (!query) return true;

        return [
          bill.billNumber,
          bill.party?.name || "",
          bill.paymentStatus,
          String(bill.total ?? ""),
          String(bill.remaining ?? ""),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [
    billDateFrom,
    billDateTo,
    billSearchQuery,
    billStatusFilter,
    billTimePreset,
    bills,
  ]);

  const filteredExpenses = useMemo(() => {
    const query = roznamchaSearchQuery.trim().toLowerCase();

    return [...expenses]
      .sort(
        (a, b) =>
          new Date(b.deletedAt || b.createdAt).getTime() -
          new Date(a.deletedAt || a.createdAt).getTime(),
      )
      .filter((entry) => {
        const entryDate = entry.date.slice(0, 10);
        if (roznamchaFilterDate && entryDate !== roznamchaFilterDate) {
          return false;
        }

        const amount = Number(entry.amount ?? 0);
        const isLaborEntry =
          entry.module === "LABOR" || !!entry.laborId || !!entry.laborAdvanceId;
        const isPartyEntry = !!entry.partyId;

        const matchesFilter =
          roznamchaEntryFilter === "ALL" ||
          (roznamchaEntryFilter === "IN_ONLY" && amount < 0) ||
          (roznamchaEntryFilter === "OUT_ONLY" && amount >= 0) ||
          (roznamchaEntryFilter === "LABOR_ONLY" && isLaborEntry) ||
          (roznamchaEntryFilter === "PARTY_ONLY" && isPartyEntry);

        if (!matchesFilter) return false;
        if (!query) return true;

        return [
          getRoznamchaReferenceLabel(entry),
          getRoznamchaPartyLaborLabel(entry),
          entry.description || "",
          getRoznamchaPaymentTypeLabel(entry),
          getRoznamchaInOut(amount),
          String(Math.abs(amount)),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [expenses, roznamchaEntryFilter, roznamchaFilterDate, roznamchaSearchQuery]);

  const purchaseRecords = useMemo<DeletedPurchaseRecord[]>(
    () => [
      ...chemicals.map((entry) => ({
        ...entry,
        purchaseType: "CHEMICAL" as const,
        itemLabel: "Chemical",
      })),
      ...rexine.map((entry) => ({
        ...entry,
        purchaseType: "REXINE" as const,
        itemLabel: "Rexine",
      })),
      ...materials.map((entry) => ({
        ...entry,
        purchaseType: "MATERIAL" as const,
        itemLabel: entry.article?.name || "Material",
      })),
    ],
    [chemicals, materials, rexine],
  );

  const filteredPurchases = useMemo(() => {
    const query = purchaseSearchQuery.trim().toLowerCase();
    const { fromTs, toTs } = getDateRange(
      purchaseTimePreset,
      purchaseDateFrom,
      purchaseDateTo,
    );

    return [...purchaseRecords]
      .sort(
        (a, b) =>
          new Date(b.deletedAt || b.createdAt).getTime() -
          new Date(a.deletedAt || a.createdAt).getTime(),
      )
      .filter((record) => {
        if (
          purchaseTypeFilter !== "ALL" &&
          record.purchaseType !== purchaseTypeFilter
        ) {
          return false;
        }

        const recordTs = new Date(record.date).getTime();
        if (fromTs !== null && recordTs < fromTs) return false;
        if (toTs !== null && recordTs > toTs) return false;

        if (!query) return true;

        return [
          record.purchaseType,
          record.party?.name || "",
          record.itemLabel,
          String(record.totalAmount ?? ""),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [
    purchaseDateFrom,
    purchaseDateTo,
    purchaseRecords,
    purchaseSearchQuery,
    purchaseTimePreset,
    purchaseTypeFilter,
  ]);

  const filteredLaborRecords = useMemo(() => {
    const query = laborSearchQuery.trim().toLowerCase();

    const filteredProfiles = profiles
      .filter((profile) => {
        const departmentLabel =
          profile.category?.name || profile.department || profile.categoryId;
        if (
          laborDepartmentFilter !== "ALL" &&
          departmentLabel !== laborDepartmentFilter &&
          profile.department !== laborDepartmentFilter &&
          profile.categoryId !== laborDepartmentFilter
        ) {
          return false;
        }

        if (!query) return true;
        return [profile.name, departmentLabel || "", profile.status]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .map((profile) => ({
        recordType: "PROFILE" as const,
        id: profile.id,
        deletedAt: profile.deletedAt || profile.updatedAt,
        label: profile.name,
        meta: profile.category?.name || profile.department || profile.categoryId,
        amount: profile.defaultRate == null ? "-" : formatCurrency(Number(profile.defaultRate)),
        raw: profile,
      }));

    const filteredWork = workEntries
      .filter((entry) => {
        const departmentLabel =
          entry.labor?.category?.name ||
          entry.labor?.department ||
          entry.labor?.categoryId ||
          "";
        if (
          laborDepartmentFilter !== "ALL" &&
          departmentLabel !== laborDepartmentFilter &&
          entry.labor?.department !== laborDepartmentFilter &&
          entry.labor?.categoryId !== laborDepartmentFilter
        ) {
          return false;
        }

        const entryDate = entry.startDate.slice(0, 10);
        if (laborDateFrom && entryDate < laborDateFrom) return false;
        if (laborDateTo && entryDate > laborDateTo) return false;

        if (!query) return true;

        return [
          entry.labor?.name || "",
          entry.article?.name || "",
          String(entry.quantity ?? ""),
          String(entry.total ?? ""),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .map((entry) => ({
        recordType: "WORK" as const,
        id: entry.id,
        deletedAt: entry.deletedAt || entry.createdAt,
        label: entry.labor?.name || "Unknown labor",
        meta: `${entry.article?.name || "Unknown article"} • ${formatDate(entry.startDate)}`,
        amount: formatCurrency(Number(entry.total ?? 0)),
        raw: entry,
      }));

    const filteredAdvances = advances
      .filter((entry) => {
        const departmentLabel =
          entry.labor?.category?.name ||
          entry.labor?.department ||
          entry.labor?.categoryId ||
          "";
        if (
          laborDepartmentFilter !== "ALL" &&
          departmentLabel !== laborDepartmentFilter &&
          entry.labor?.department !== laborDepartmentFilter &&
          entry.labor?.categoryId !== laborDepartmentFilter
        ) {
          return false;
        }

        const entryDate = entry.date.slice(0, 10);
        if (laborDateFrom && entryDate < laborDateFrom) return false;
        if (laborDateTo && entryDate > laborDateTo) return false;

        if (!query) return true;

        return [
          entry.labor?.name || "",
          entry.reason || "",
          String(entry.amount ?? ""),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .map((entry) => ({
        recordType: "ADVANCE" as const,
        id: entry.id,
        deletedAt: entry.deletedAt || entry.createdAt,
        label: entry.labor?.name || "Unknown labor",
        meta: entry.reason || "-",
        amount: formatCurrency(Number(entry.amount ?? 0)),
        raw: entry,
      }));

    const combined = [...filteredProfiles, ...filteredWork, ...filteredAdvances];
    return combined
      .filter((record) => laborRecordType === "ALL" || record.recordType === laborRecordType)
      .sort(
        (a, b) =>
          new Date(b.deletedAt || "").getTime() - new Date(a.deletedAt || "").getTime(),
      );
  }, [
    advances,
    laborDateFrom,
    laborDateTo,
    laborDepartmentFilter,
    laborRecordType,
    laborSearchQuery,
    profiles,
    workEntries,
  ]);

  const filteredParties = useMemo(() => {
    const query = partySearchQuery.trim().toLowerCase();
    return [...parties]
      .sort(
        (a, b) =>
          new Date(b.deletedAt || b.updatedAt).getTime() -
          new Date(a.deletedAt || a.updatedAt).getTime(),
      )
      .filter((party) => {
        if (partyTypeFilter !== "ALL" && party.type !== partyTypeFilter) {
          return false;
        }

        if (!query) return true;
        return [party.name, party.type].join(" ").toLowerCase().includes(query);
      });
  }, [parties, partySearchQuery, partyTypeFilter]);

  const filteredOrders = useMemo(() => {
    const query = productionSearchQuery.trim().toLowerCase();
    const { fromTs, toTs } = getDateRange(
      productionTimePreset,
      productionDateFrom,
      productionDateTo,
    );

    return [...orders]
      .sort(
        (a, b) =>
          new Date(b.deletedAt || b.updatedAt).getTime() -
          new Date(a.deletedAt || a.updatedAt).getTime(),
      )
      .filter((row) => {
        const hasAssignedLabor = Boolean(row.laborId || row.packingLaborId);
        if (productionLaborFilter === "assigned" && !hasAssignedLabor) {
          return false;
        }
        if (productionLaborFilter === "unassigned" && hasAssignedLabor) {
          return false;
        }

        const rowTs = new Date(row.orderDate).getTime();
        if (fromTs !== null && rowTs < fromTs) return false;
        if (toTs !== null && rowTs > toTs) return false;

        if (!query) return true;

        return [
          row.article?.name || "",
          row.size,
          row.labor?.name || "",
          row.packingLabor?.name || "",
          getProductionStatusLabel(row.status),
          String(row.quantityDozen ?? ""),
          String(getProductionProgressDozen(row)),
          String(row.pricePerDozen ?? ""),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [
    orders,
    productionDateFrom,
    productionDateTo,
    productionLaborFilter,
    productionSearchQuery,
    productionTimePreset,
  ]);

  const filteredMallMovements = useMemo(() => {
    const query = mallSearchQuery.trim().toLowerCase();
    const { fromTs, toTs } = getDateRange(mallTimePreset, mallDateFrom, mallDateTo);

    return [...mallMovements]
      .sort(
        (a, b) =>
          new Date(b.deletedAt || b.updatedAt).getTime() -
          new Date(a.deletedAt || a.updatedAt).getTime(),
      )
      .filter((entry) => {
        if (mallTypeFilter !== "ALL" && entry.mallType !== mallTypeFilter) {
          return false;
        }
        if (
          mallDirectionFilter !== "ALL" &&
          entry.direction !== mallDirectionFilter
        ) {
          return false;
        }

        const entryTs = new Date(entry.date).getTime();
        if (fromTs !== null && entryTs < fromTs) return false;
        if (toTs !== null && entryTs > toTs) return false;

        if (!query) return true;

        return [
          getMallTypeLabel(entry.mallType),
          getMallDirectionLabel(entry.mallType, entry.direction),
          entry.reference || "",
          entry.note || "",
          String(entry.quantityDozen ?? ""),
          String(entry.totalAmount ?? ""),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [
    mallDateFrom,
    mallDateTo,
    mallDirectionFilter,
    mallMovements,
    mallSearchQuery,
    mallTimePreset,
    mallTypeFilter,
  ]);

  const filteredManualEntries = useMemo(() => {
    const query = manualSearchQuery.trim().toLowerCase();
    return [...manualEntries]
      .sort(
        (a, b) =>
          new Date(b.deletedAt || b.updatedAt).getTime() -
          new Date(a.deletedAt || a.updatedAt).getTime(),
      )
      .filter((entry) => {
        if (manualModeFilter !== "ALL" && entry.mode !== manualModeFilter) {
          return false;
        }

        if (!query) return true;
        return [
          entry.article?.name || "",
          entry.note || "",
          entry.mode === "PACKED" ? "Packed A-Mall" : "Ready A-Mall",
          String(entry.quantityDozen ?? ""),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [manualEntries, manualModeFilter, manualSearchQuery]);

  const configurationRecords = useMemo(
    () => ({
      UNIT: units.filter((unit) =>
        [unit.name, unit.symbol || ""]
          .join(" ")
          .toLowerCase()
          .includes(configurationSearchQuery.trim().toLowerCase()),
      ),
      ARTICLE: articles.filter((article) =>
        [article.name, article.code || ""]
          .join(" ")
          .toLowerCase()
          .includes(configurationSearchQuery.trim().toLowerCase()),
      ),
      PAYMENT_TYPE: paymentTypes.filter((paymentType) =>
        [paymentType.name, paymentType.unit?.name || ""]
          .join(" ")
          .toLowerCase()
          .includes(configurationSearchQuery.trim().toLowerCase()),
      ),
    }),
    [articles, configurationSearchQuery, paymentTypes, units],
  );

  const {
    currentPage: billsPage,
    setCurrentPage: setBillsPage,
    pageSize: billsPageSize,
    setPageSize: setBillsPageSize,
    totalPages: billsTotalPages,
    totalItems: billsTotalItems,
    startItem: billsStartItem,
    endItem: billsEndItem,
    paginatedItems: paginatedBills,
    goToPreviousPage: goToPreviousBillsPage,
    goToNextPage: goToNextBillsPage,
  } = useClientPagination(filteredBills);

  const roznamchaPagination = useClientPagination(filteredExpenses);
  const purchasesPagination = useClientPagination(filteredPurchases);
  const laborPagination = useClientPagination(filteredLaborRecords);
  const partiesPagination = useClientPagination(filteredParties);
  const productionPagination = useClientPagination(filteredOrders);
  const mallPagination = useClientPagination(filteredMallMovements);
  const manualPagination = useClientPagination(filteredManualEntries);
  const configPagination = useClientPagination(configurationRecords[configurationType]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Deleted Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DeletedTab)}>
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-2">
              <TabsTrigger value="bills">Bills</TabsTrigger>
              <TabsTrigger value="roznamcha">Roznamcha</TabsTrigger>
              <TabsTrigger value="purchases">Purchases</TabsTrigger>
              <TabsTrigger value="labor">Labor</TabsTrigger>
              <TabsTrigger value="parties">Parties</TabsTrigger>
              <TabsTrigger value="production">Production</TabsTrigger>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="configuration">Configuration</TabsTrigger>
            </TabsList>

            <TabsContent value="bills" className="space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
                <div className="min-w-[240px] flex-1 md:max-w-[360px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                    Search
                  </Label>
                  <Input
                    value={billSearchQuery}
                    onChange={(event) => setBillSearchQuery(event.target.value)}
                    placeholder="Search bill number or party..."
                  />
                </div>
                <div className="min-w-[200px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                    Status
                  </Label>
                  <Select
                    value={billStatusFilter}
                    onValueChange={(value) =>
                      setBillStatusFilter(value as typeof billStatusFilter)
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="UNPAID">Unpaid</SelectItem>
                      <SelectItem value="PARTIAL_PAID">Partial Paid</SelectItem>
                      <SelectItem value="PAID">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[200px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                    Time
                  </Label>
                  <Select
                    value={billTimePreset}
                    onValueChange={(value) =>
                      setBillTimePreset(value as FilterTimePreset)
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FILTER_TIME_PRESET_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {billTimePreset === "CUSTOM" && (
                  <>
                    <div>
                      <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">From</Label>
                      <Input type="date" value={billDateFrom} onChange={(event) => setBillDateFrom(event.target.value)} className="w-40" />
                    </div>
                    <div>
                      <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">To</Label>
                      <Input type="date" value={billDateTo} onChange={(event) => setBillDateTo(event.target.value)} className="w-40" />
                    </div>
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBillSearchQuery("");
                    setBillStatusFilter("ALL");
                    setBillTimePreset("THIS_MONTH");
                    setBillDateFrom("");
                    setBillDateTo("");
                  }}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Deleted At</TableHead>
                    <TableHead>Undo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading deleted bills...</TableCell></TableRow>
                  ) : paginatedBills.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No deleted bills found.</TableCell></TableRow>
                  ) : (
                    paginatedBills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell>{bill.billNumber}</TableCell>
                        <TableCell>{formatDate(bill.date)}</TableCell>
                        <TableCell>{bill.party?.name || "-"}</TableCell>
                        <TableCell>{formatCurrency(Number(bill.total ?? 0))}</TableCell>
                        <TableCell>{formatDateTime(bill.deletedAt || bill.updatedAt)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              restoreAndReload(() => billApi.restoreBill(bill.id), "Bill restored.")
                            }
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Undo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={billsPage}
                totalPages={billsTotalPages}
                totalItems={billsTotalItems}
                startItem={billsStartItem}
                endItem={billsEndItem}
                pageSize={billsPageSize}
                setPageSize={setBillsPageSize}
                goToPreviousPage={goToPreviousBillsPage}
                goToNextPage={goToNextBillsPage}
                setCurrentPage={setBillsPage}
              />
            </TabsContent>

            <TabsContent value="roznamcha" className="space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
                <div className="min-w-[240px] flex-1 md:max-w-[360px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Search</Label>
                  <Input value={roznamchaSearchQuery} onChange={(event) => setRoznamchaSearchQuery(event.target.value)} placeholder="Search deleted entry..." />
                </div>
                <div className="min-w-[180px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Type</Label>
                  <Select value={roznamchaEntryFilter} onValueChange={(value) => setRoznamchaEntryFilter(value as RoznamchaFilter)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Entries</SelectItem>
                      <SelectItem value="IN_ONLY">In Only</SelectItem>
                      <SelectItem value="OUT_ONLY">Out Only</SelectItem>
                      <SelectItem value="LABOR_ONLY">Labor Only</SelectItem>
                      <SelectItem value="PARTY_ONLY">Party Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Date</Label>
                  <Input type="date" value={roznamchaFilterDate} onChange={(event) => setRoznamchaFilterDate(event.target.value)} />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => {
                  setRoznamchaSearchQuery("");
                  setRoznamchaEntryFilter("ALL");
                  setRoznamchaFilterDate("");
                }}>
                  <Filter className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Party/Labor</TableHead>
                    <TableHead>In/Out</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Deleted At</TableHead>
                    <TableHead>Undo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading deleted Roznamcha entries...</TableCell></TableRow>
                  ) : roznamchaPagination.paginatedItems.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No deleted Roznamcha entries found.</TableCell></TableRow>
                  ) : (
                    roznamchaPagination.paginatedItems.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.date)}</TableCell>
                        <TableCell>{getRoznamchaReferenceLabel(entry)}</TableCell>
                        <TableCell>{getRoznamchaPartyLaborLabel(entry)}</TableCell>
                        <TableCell>{getRoznamchaInOut(Number(entry.amount ?? 0))}</TableCell>
                        <TableCell>{formatCurrency(Math.abs(Number(entry.amount ?? 0)))}</TableCell>
                        <TableCell>{formatDateTime(entry.deletedAt || entry.createdAt)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => restoreAndReload(() => expenseApi.restoreExpense(entry.id), "Roznamcha entry restored.")}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Undo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={roznamchaPagination.currentPage}
                totalPages={roznamchaPagination.totalPages}
                totalItems={roznamchaPagination.totalItems}
                startItem={roznamchaPagination.startItem}
                endItem={roznamchaPagination.endItem}
                pageSize={roznamchaPagination.pageSize}
                setPageSize={roznamchaPagination.setPageSize}
                goToPreviousPage={roznamchaPagination.goToPreviousPage}
                goToNextPage={roznamchaPagination.goToNextPage}
                setCurrentPage={roznamchaPagination.setCurrentPage}
              />
            </TabsContent>

            <TabsContent value="purchases" className="space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
                <div className="min-w-[240px] flex-1 md:max-w-[360px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Search</Label>
                  <Input value={purchaseSearchQuery} onChange={(event) => setPurchaseSearchQuery(event.target.value)} placeholder="Search supplier or item..." />
                </div>
                <div className="min-w-[180px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Type</Label>
                  <Select value={purchaseTypeFilter} onValueChange={(value) => setPurchaseTypeFilter(value as PurchaseKind)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="CHEMICAL">Chemical</SelectItem>
                      <SelectItem value="REXINE">Rexine</SelectItem>
                      <SelectItem value="MATERIAL">Material</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[180px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Time</Label>
                  <Select value={purchaseTimePreset} onValueChange={(value) => setPurchaseTimePreset(value as FilterTimePreset)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FILTER_TIME_PRESET_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {purchaseTimePreset === "CUSTOM" && (
                  <>
                    <div>
                      <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">From</Label>
                      <Input type="date" value={purchaseDateFrom} onChange={(event) => setPurchaseDateFrom(event.target.value)} />
                    </div>
                    <div>
                      <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">To</Label>
                      <Input type="date" value={purchaseDateTo} onChange={(event) => setPurchaseDateTo(event.target.value)} />
                    </div>
                  </>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => {
                  setPurchaseSearchQuery("");
                  setPurchaseTypeFilter("ALL");
                  setPurchaseTimePreset("THIS_MONTH");
                  setPurchaseDateFrom("");
                  setPurchaseDateTo("");
                }}>
                  <Filter className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Deleted At</TableHead>
                    <TableHead>Undo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading deleted purchases...</TableCell></TableRow>
                  ) : purchasesPagination.paginatedItems.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No deleted purchases found.</TableCell></TableRow>
                  ) : (
                    purchasesPagination.paginatedItems.map((record) => (
                      <TableRow key={`${record.purchaseType}-${record.id}`}>
                        <TableCell>{formatDate(record.date)}</TableCell>
                        <TableCell>{record.purchaseType}</TableCell>
                        <TableCell>{record.party?.name || "-"}</TableCell>
                        <TableCell>{record.itemLabel}</TableCell>
                        <TableCell>{formatCurrency(Number(record.totalAmount ?? 0))}</TableCell>
                        <TableCell>{formatDateTime(record.deletedAt || record.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              restoreAndReload(
                                () =>
                                  record.purchaseType === "CHEMICAL"
                                    ? purchaseApi.restoreChemical(record.id)
                                    : record.purchaseType === "REXINE"
                                      ? purchaseApi.restoreRexine(record.id)
                                      : purchaseApi.restoreMaterial(record.id),
                                "Purchase restored.",
                              )
                            }
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Undo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={purchasesPagination.currentPage}
                totalPages={purchasesPagination.totalPages}
                totalItems={purchasesPagination.totalItems}
                startItem={purchasesPagination.startItem}
                endItem={purchasesPagination.endItem}
                pageSize={purchasesPagination.pageSize}
                setPageSize={purchasesPagination.setPageSize}
                goToPreviousPage={purchasesPagination.goToPreviousPage}
                goToNextPage={purchasesPagination.goToNextPage}
                setCurrentPage={purchasesPagination.setCurrentPage}
              />
            </TabsContent>

            <TabsContent value="labor" className="space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
                <div className="min-w-[240px] flex-1 md:max-w-[360px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Search</Label>
                  <Input value={laborSearchQuery} onChange={(event) => setLaborSearchQuery(event.target.value)} placeholder="Search labor or article..." />
                </div>
                <div className="min-w-[200px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Department</Label>
                  <Select value={laborDepartmentFilter} onValueChange={setLaborDepartmentFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Departments</SelectItem>
                      {departmentOptions.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[180px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Record Type</Label>
                  <Select value={laborRecordType} onValueChange={(value) => setLaborRecordType(value as LaborDeletedType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      <SelectItem value="PROFILE">Profiles</SelectItem>
                      <SelectItem value="WORK">Work Entries</SelectItem>
                      <SelectItem value="ADVANCE">Advances</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">From</Label>
                  <Input type="date" value={laborDateFrom} onChange={(event) => setLaborDateFrom(event.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">To</Label>
                  <Input type="date" value={laborDateTo} onChange={(event) => setLaborDateTo(event.target.value)} />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => {
                  setLaborSearchQuery("");
                  setLaborDepartmentFilter("ALL");
                  setLaborRecordType("ALL");
                  setLaborDateFrom("");
                  setLaborDateTo("");
                }}>
                  <Filter className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Deleted At</TableHead>
                    <TableHead>Undo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading deleted labor records...</TableCell></TableRow>
                  ) : laborPagination.paginatedItems.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No deleted labor records found.</TableCell></TableRow>
                  ) : (
                    laborPagination.paginatedItems.map((record) => (
                      <TableRow key={`${record.recordType}-${record.id}`}>
                        <TableCell>{record.recordType}</TableCell>
                        <TableCell>{record.label}</TableCell>
                        <TableCell>{record.meta}</TableCell>
                        <TableCell>{record.amount}</TableCell>
                        <TableCell>{formatDateTime(record.deletedAt)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              restoreAndReload(
                                () =>
                                  record.recordType === "PROFILE"
                                    ? laborApi.restoreProfile(record.id)
                                    : record.recordType === "WORK"
                                      ? laborApi.restoreWorkEntry(record.id)
                                      : laborApi.restoreAdvance(record.id),
                                "Labor record restored.",
                              )
                            }
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Undo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={laborPagination.currentPage}
                totalPages={laborPagination.totalPages}
                totalItems={laborPagination.totalItems}
                startItem={laborPagination.startItem}
                endItem={laborPagination.endItem}
                pageSize={laborPagination.pageSize}
                setPageSize={laborPagination.setPageSize}
                goToPreviousPage={laborPagination.goToPreviousPage}
                goToNextPage={laborPagination.goToNextPage}
                setCurrentPage={laborPagination.setCurrentPage}
              />
            </TabsContent>

            <TabsContent value="parties" className="space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
                <div className="min-w-[240px] flex-1 md:max-w-[360px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Search</Label>
                  <Input value={partySearchQuery} onChange={(event) => setPartySearchQuery(event.target.value)} placeholder="Search party name..." />
                </div>
                <div className="min-w-[180px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Type</Label>
                  <Select value={partyTypeFilter} onValueChange={(value) => setPartyTypeFilter(value as typeof partyTypeFilter)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Parties</SelectItem>
                      <SelectItem value="CUSTOMER">Customers</SelectItem>
                      <SelectItem value="SUPPLIER">Suppliers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => {
                  setPartySearchQuery("");
                  setPartyTypeFilter("ALL");
                }}>
                  <Filter className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Deleted At</TableHead>
                    <TableHead>Undo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading deleted parties...</TableCell></TableRow>
                  ) : partiesPagination.paginatedItems.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No deleted parties found.</TableCell></TableRow>
                  ) : (
                    partiesPagination.paginatedItems.map((party) => (
                      <TableRow key={party.id}>
                        <TableCell>{party.name}</TableCell>
                        <TableCell>{party.type}</TableCell>
                        <TableCell>{formatDateTime(party.deletedAt || party.updatedAt)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => restoreAndReload(() => partyApi.restoreParty(party.id), "Party restored.")}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Undo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={partiesPagination.currentPage}
                totalPages={partiesPagination.totalPages}
                totalItems={partiesPagination.totalItems}
                startItem={partiesPagination.startItem}
                endItem={partiesPagination.endItem}
                pageSize={partiesPagination.pageSize}
                setPageSize={partiesPagination.setPageSize}
                goToPreviousPage={partiesPagination.goToPreviousPage}
                goToNextPage={partiesPagination.goToNextPage}
                setCurrentPage={partiesPagination.setCurrentPage}
              />
            </TabsContent>

            <TabsContent value="production" className="space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
                <div className="min-w-[240px] flex-1 md:max-w-[360px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Search</Label>
                  <Input value={productionSearchQuery} onChange={(event) => setProductionSearchQuery(event.target.value)} placeholder="Search article, size or labor..." />
                </div>
                <div className="min-w-[180px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Labor Filter</Label>
                  <Select value={productionLaborFilter} onValueChange={(value) => setProductionLaborFilter(value as ProductionLaborFilter)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[180px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Time</Label>
                  <Select value={productionTimePreset} onValueChange={(value) => setProductionTimePreset(value as FilterTimePreset)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FILTER_TIME_PRESET_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {productionTimePreset === "CUSTOM" && (
                  <>
                    <div>
                      <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">From</Label>
                      <Input type="date" value={productionDateFrom} onChange={(event) => setProductionDateFrom(event.target.value)} />
                    </div>
                    <div>
                      <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">To</Label>
                      <Input type="date" value={productionDateTo} onChange={(event) => setProductionDateTo(event.target.value)} />
                    </div>
                  </>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => {
                  setProductionSearchQuery("");
                  setProductionLaborFilter("all");
                  setProductionTimePreset("THIS_MONTH");
                  setProductionDateFrom("");
                  setProductionDateTo("");
                }}>
                  <Filter className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Labor</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deleted At</TableHead>
                    <TableHead>Undo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading deleted production orders...</TableCell></TableRow>
                  ) : productionPagination.paginatedItems.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No deleted production orders found.</TableCell></TableRow>
                  ) : (
                    productionPagination.paginatedItems.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>{order.article?.name || "-"}</TableCell>
                        <TableCell>{order.size}</TableCell>
                        <TableCell>{order.labor?.name || order.packingLabor?.name || "-"}</TableCell>
                        <TableCell>{order.quantityDozen}</TableCell>
                        <TableCell>{getProductionStatusLabel(order.status)}</TableCell>
                        <TableCell>{formatDateTime(order.deletedAt || order.updatedAt)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => restoreAndReload(() => productionApi.restoreOrder(order.id), "Production order restored.")}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Undo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={productionPagination.currentPage}
                totalPages={productionPagination.totalPages}
                totalItems={productionPagination.totalItems}
                startItem={productionPagination.startItem}
                endItem={productionPagination.endItem}
                pageSize={productionPagination.pageSize}
                setPageSize={productionPagination.setPageSize}
                goToPreviousPage={productionPagination.goToPreviousPage}
                goToNextPage={productionPagination.goToNextPage}
                setCurrentPage={productionPagination.setCurrentPage}
              />
            </TabsContent>

            <TabsContent value="stock" className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[180px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Deleted Stock Type</Label>
                  <Select value={stockDeletedType} onValueChange={(value) => setStockDeletedType(value as StockDeletedType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALL">Mall Movements</SelectItem>
                      <SelectItem value="MANUAL">Manual Entries</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {stockDeletedType === "MALL" ? (
                <>
                  <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
                    <div className="min-w-[240px] flex-1 md:max-w-[360px]">
                      <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Search</Label>
                      <Input value={mallSearchQuery} onChange={(event) => setMallSearchQuery(event.target.value)} placeholder="Search mall movement..." />
                    </div>
                    <div className="min-w-[180px]">
                      <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Type</Label>
                      <Select value={mallTypeFilter} onValueChange={(value) => setMallTypeFilter(value as typeof mallTypeFilter)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Types</SelectItem>
                          <SelectItem value="B_MALL">B-Mall</SelectItem>
                          <SelectItem value="C_MALL">C-Mall</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-[180px]">
                      <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Direction</Label>
                      <Select value={mallDirectionFilter} onValueChange={(value) => setMallDirectionFilter(value as typeof mallDirectionFilter)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All</SelectItem>
                          <SelectItem value="IN">In</SelectItem>
                          <SelectItem value="OUT">Out</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-[180px]">
                      <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Time</Label>
                      <Select value={mallTimePreset} onValueChange={(value) => setMallTimePreset(value as FilterTimePreset)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FILTER_TIME_PRESET_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {mallTimePreset === "CUSTOM" && (
                      <>
                        <div>
                          <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">From</Label>
                          <Input type="date" value={mallDateFrom} onChange={(event) => setMallDateFrom(event.target.value)} />
                        </div>
                        <div>
                          <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">To</Label>
                          <Input type="date" value={mallDateTo} onChange={(event) => setMallDateTo(event.target.value)} />
                        </div>
                      </>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                      setMallSearchQuery("");
                      setMallTypeFilter("ALL");
                      setMallDirectionFilter("ALL");
                      setMallTimePreset("THIS_MONTH");
                      setMallDateFrom("");
                      setMallDateTo("");
                    }}>
                      <Filter className="mr-2 h-4 w-4" />
                      Reset Filters
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Deleted At</TableHead>
                        <TableHead>Undo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading deleted mall movements...</TableCell></TableRow>
                      ) : mallPagination.paginatedItems.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No deleted mall movements found.</TableCell></TableRow>
                      ) : (
                        mallPagination.paginatedItems.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{formatDate(entry.date)}</TableCell>
                            <TableCell>{getMallTypeLabel(entry.mallType)}</TableCell>
                            <TableCell>{entry.direction}</TableCell>
                            <TableCell>{entry.quantityDozen}</TableCell>
                            <TableCell>{formatDateTime(entry.deletedAt || entry.updatedAt)}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => restoreAndReload(() => productionApi.restoreMallStockMovement(entry.id), "Mall stock movement restored.")}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Undo
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <TablePagination
                    currentPage={mallPagination.currentPage}
                    totalPages={mallPagination.totalPages}
                    totalItems={mallPagination.totalItems}
                    startItem={mallPagination.startItem}
                    endItem={mallPagination.endItem}
                    pageSize={mallPagination.pageSize}
                    setPageSize={mallPagination.setPageSize}
                    goToPreviousPage={mallPagination.goToPreviousPage}
                    goToNextPage={mallPagination.goToNextPage}
                    setCurrentPage={mallPagination.setCurrentPage}
                  />
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
                    <div className="min-w-[240px] flex-1 md:max-w-[360px]">
                      <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Search</Label>
                      <Input value={manualSearchQuery} onChange={(event) => setManualSearchQuery(event.target.value)} placeholder="Search article or note..." />
                    </div>
                    <div className="min-w-[180px]">
                      <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Mode</Label>
                      <Select value={manualModeFilter} onValueChange={(value) => setManualModeFilter(value as typeof manualModeFilter)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Modes</SelectItem>
                          <SelectItem value="IN_STOCK">Ready A-Mall</SelectItem>
                          <SelectItem value="PACKED">Packed A-Mall</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                      setManualSearchQuery("");
                      setManualModeFilter("ALL");
                    }}>
                      <Filter className="mr-2 h-4 w-4" />
                      Reset Filters
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Article</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Deleted At</TableHead>
                        <TableHead>Undo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading deleted manual entries...</TableCell></TableRow>
                      ) : manualPagination.paginatedItems.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No deleted manual entries found.</TableCell></TableRow>
                      ) : (
                        manualPagination.paginatedItems.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{entry.article?.name || "-"}</TableCell>
                            <TableCell>{entry.mode === "PACKED" ? "Packed A-Mall" : "Ready A-Mall"}</TableCell>
                            <TableCell>{entry.quantityDozen}</TableCell>
                            <TableCell>{formatDateTime(entry.deletedAt || entry.updatedAt)}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => restoreAndReload(() => productionApi.restoreManualStockEntry(entry.id), "Manual stock entry restored.")}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Undo
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <TablePagination
                    currentPage={manualPagination.currentPage}
                    totalPages={manualPagination.totalPages}
                    totalItems={manualPagination.totalItems}
                    startItem={manualPagination.startItem}
                    endItem={manualPagination.endItem}
                    pageSize={manualPagination.pageSize}
                    setPageSize={manualPagination.setPageSize}
                    goToPreviousPage={manualPagination.goToPreviousPage}
                    goToNextPage={manualPagination.goToNextPage}
                    setCurrentPage={manualPagination.setCurrentPage}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="configuration" className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Configuration Type</Label>
                  <Select value={configurationType} onValueChange={(value) => setConfigurationType(value as ConfigurationDeletedType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNIT">Units</SelectItem>
                      <SelectItem value="ARTICLE">Articles</SelectItem>
                      <SelectItem value="PAYMENT_TYPE">Payment Types</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
                <div className="min-w-[240px] flex-1 md:max-w-[360px]">
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">Search Current Type</Label>
                  <Input value={configurationSearchQuery} onChange={(event) => setConfigurationSearchQuery(event.target.value)} placeholder="Search deleted configuration..." />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfigurationSearchQuery("")}>
                  <Filter className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Deleted At</TableHead>
                    <TableHead>Undo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading deleted configuration...</TableCell></TableRow>
                  ) : configPagination.paginatedItems.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No deleted configuration found.</TableCell></TableRow>
                  ) : configurationType === "UNIT" ? (
                    (configPagination.paginatedItems as ApiUnit[]).map((unit) => (
                      <TableRow key={unit.id}>
                        <TableCell>{unit.name}</TableCell>
                        <TableCell>{unit.symbol || "-"}</TableCell>
                        <TableCell>{formatDateTime(unit.deletedAt || unit.updatedAt)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => restoreAndReload(() => configApi.restoreUnit(unit.id), "Unit restored.")}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Undo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : configurationType === "ARTICLE" ? (
                    (configPagination.paginatedItems as ApiArticle[]).map((article) => (
                      <TableRow key={article.id}>
                        <TableCell>{article.name}</TableCell>
                        <TableCell>{article.code || "-"}</TableCell>
                        <TableCell>{formatDateTime(article.deletedAt || article.updatedAt)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => restoreAndReload(() => configApi.restoreArticle(article.id), "Article restored.")}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Undo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    (configPagination.paginatedItems as ApiPaymentType[]).map((paymentType) => (
                      <TableRow key={paymentType.id}>
                        <TableCell>{paymentType.name}</TableCell>
                        <TableCell>{paymentType.unit?.name || "-"}</TableCell>
                        <TableCell>{formatDateTime(paymentType.deletedAt || paymentType.updatedAt)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => restoreAndReload(() => configApi.restorePaymentType(paymentType.id), "Payment type restored.")}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Undo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={configPagination.currentPage}
                totalPages={configPagination.totalPages}
                totalItems={configPagination.totalItems}
                startItem={configPagination.startItem}
                endItem={configPagination.endItem}
                pageSize={configPagination.pageSize}
                setPageSize={configPagination.setPageSize}
                goToPreviousPage={configPagination.goToPreviousPage}
                goToNextPage={configPagination.goToNextPage}
                setCurrentPage={configPagination.setCurrentPage}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

