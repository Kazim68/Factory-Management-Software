import { useEffect, useMemo, useState } from "react";
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
import { ArrowLeft, Banknote, Eye, Plus, Wallet, X } from "lucide-react";
import { formatCurrency, formatDate, getCurrentDate } from "../lib/utils";
import { configApi, expenseApi, laborApi, reportsApi } from "../lib/api";
import {
  exportTableToExcel,
  exportTableToPdf,
  type ReportExportPayload,
} from "../lib/report";
import type {
  ApiArticle,
  ApiExpenseCategory,
  ApiExpenseEntry,
  ApiLaborCategory,
  ApiLaborLedger,
  ApiLaborProfile,
  ApiLaborSummaryReport,
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

type LedgerTransactionRow = {
  date: string;
  type: "Work" | "Kharcha" | "Paid Cash";
  description: string;
  quantity: number | null;
  rate: number | null;
  earned: number;
  advance: number;
  paidCash: number;
  balance: number;
};

const toDateKey = (value: string) => value.slice(0, 10);

const isWithinDateRange = (
  value: string,
  start?: string,
  end?: string,
) => {
  const dateKey = toDateKey(value);
  if (start && dateKey < start) {
    return false;
  }
  if (end && dateKey > end) {
    return false;
  }
  return true;
};

export function LaborManagement() {
  const [profiles, setProfiles] = useState<ApiLaborProfile[]>([]);
  const [allProfiles, setAllProfiles] = useState<ApiLaborProfile[]>([]);
  const [categories, setCategories] = useState<ApiLaborCategory[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<ApiPaymentType[]>([]);
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<
    ApiExpenseCategory[]
  >([]);
  const [workEntries, setWorkEntries] = useState<UiWorkEntry[]>([]);
  const [advanceEntries, setAdvanceEntries] = useState<UiAdvance[]>([]);
  const [ledgerMap, setLedgerMap] = useState<Record<string, ApiLaborLedger>>(
    {},
  );
  const [laborPayments, setLaborPayments] = useState<ApiExpenseEntry[]>([]);
  const [laborPaymentsToday, setLaborPaymentsToday] = useState<
    ApiExpenseEntry[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLedgerView, setIsLoadingLedgerView] = useState(false);

  const [laborDialog, setLaborDialog] = useState(false);
  const [kharchaDialog, setKharchaDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(false);

  const [viewingLaborId, setViewingLaborId] = useState<string | null>(null);
  const [viewingLedger, setViewingLedger] = useState<ApiLaborLedger | null>(
    null,
  );
  const [editingLaborId, setEditingLaborId] = useState<string | null>(null);
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("labors");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [laborSearchQuery, setLaborSearchQuery] = useState("");
  const [workEntryStart, setWorkEntryStart] = useState("");
  const [workEntryEnd, setWorkEntryEnd] = useState(getCurrentDate());
  const [payingLaborId, setPayingLaborId] = useState<string | null>(null);
  const [ledgerRangeStart, setLedgerRangeStart] = useState("");
  const [ledgerRangeEnd, setLedgerRangeEnd] = useState(getCurrentDate());
  const [laborReportPeriod, setLaborReportPeriod] = useState<
    "weekly" | "monthly"
  >("weekly");
  const [laborReportStart, setLaborReportStart] = useState("");
  const [laborReportEnd, setLaborReportEnd] = useState(getCurrentDate());
  const [laborReport, setLaborReport] = useState<ApiLaborSummaryReport | null>(
    null,
  );
  const [isLoadingLaborReport, setIsLoadingLaborReport] = useState(false);
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window === "undefined") return "entries";
    return localStorage.getItem("labor.activeSection") || "entries";
  });

  const [laborForm, setLaborForm] = useState({
    name: "",
    categoryId: "",
    paymentTypeId: "",
    defaultRate: "",
  });

  const [kharchaForm, setKharchaForm] = useState({
    laborId: "",
    date: getCurrentDate(),
    categoryId: "",
    amount: "",
    reason: "",
  });
  const [payForm, setPayForm] = useState({
    date: getCurrentDate(),
    amount: "",
    mode: "CASH" as "CASH" | "KHARCHA_ADVANCE",
    description: "",
  });

  const getLaborName = (laborId?: string | null) =>
    allProfiles.find((profile) => profile.id === laborId)?.name || "Unknown";

  const getCategoryName = (categoryId?: string | null) =>
    categories.find((category) => category.id === categoryId)?.name ||
    "Unknown";

  const getPaymentTypeName = (paymentTypeId?: string | null) =>
    paymentTypes.find((paymentType) => paymentType.id === paymentTypeId)
      ?.name || "Unknown";

  const getExpenseCategoryName = (categoryId?: string | null) =>
    expenseCategories.find((category) => category.id === categoryId)?.name ||
    "Unknown";

  const loadData = async () => {
    setIsLoading(true);
    try {
      const today = getCurrentDate();
      const [
        activeProfileData,
        profileData,
        categoryData,
        paymentData,
        articleData,
        expenseCategoryData,
        laborExpenseData,
        laborExpenseTodayData,
      ] = await Promise.all([
        laborApi.listProfiles({ status: "ACTIVE" }),
        laborApi.listProfiles({ status: "ALL" }),
        configApi.listLaborCategories(),
        configApi.listPaymentTypes(),
        configApi.listArticles(),
        configApi.listExpenseCategories(),
        expenseApi.listExpenses({ module: "LABOR" }),
        expenseApi.listExpenses({ module: "LABOR", start: today, end: today }),
      ]);

      setProfiles(activeProfileData);
      setAllProfiles(profileData);
      setCategories(categoryData);
      setPaymentTypes(paymentData);
      setArticles(articleData);
      setExpenseCategories(expenseCategoryData);
      setLaborPayments(laborExpenseData);
      setLaborPaymentsToday(laborExpenseTodayData);

      const ledgerEntries = await Promise.all(
        profileData.map((profile) =>
          laborApi.getLedger(profile.id).catch(() => ({
            workEntries: [],
            advances: [],
            totalEarnings: 0,
            totalAdvances: 0,
            netPayable: 0,
          })),
        ),
      );

      const nextLedgerMap: Record<string, ApiLaborLedger> = {};
      profileData.forEach((profile, index) => {
        nextLedgerMap[profile.id] = ledgerEntries[index];
      });
      setLedgerMap(nextLedgerMap);

      const articleNameById = Object.fromEntries(
        articleData.map((article) => [article.id, article.name]),
      );
      const laborNameById = Object.fromEntries(
        profileData.map((profile) => [profile.id, profile.name]),
      );

      const flattenedWork = ledgerEntries.flatMap((ledger) =>
        ledger.workEntries.map((entry) => ({
          ...entry,
          laborName: laborNameById[entry.laborId] ?? "Unknown",
          articleName: articleNameById[entry.articleId] ?? "Unknown",
        })),
      );
      const flattenedAdvances = ledgerEntries.flatMap((ledger) =>
        ledger.advances.map((advance) => ({
          ...advance,
          laborName: laborNameById[advance.laborId] ?? "Unknown",
        })),
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

  useEffect(() => {
    let active = true;
    setIsLoadingLaborReport(true);

    const timer = window.setTimeout(() => {
      reportsApi
        .getLaborSummary({
          period: laborReportPeriod,
          start: laborReportStart || undefined,
          end: laborReportEnd || undefined,
        })
        .then((report) => {
          if (active) {
            setLaborReport(report);
          }
        })
        .catch((error) => {
          console.error(error);
          if (active) {
            toast.error("Failed to load labor report.");
          }
        })
        .finally(() => {
          if (active) {
            setIsLoadingLaborReport(false);
          }
        });
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [laborReportPeriod, laborReportStart, laborReportEnd]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("labor.activeSection", activeSection);
  }, [activeSection]);

  useEffect(() => {
    if (activeTab === "labor-paid-today" || activeTab === "kharcha") {
      setActiveTab("labors");
    }
  }, [activeTab]);

  useEffect(() => {
    if (!viewingLaborId) {
      setViewingLedger(null);
      return;
    }

    let active = true;
    setIsLoadingLedgerView(true);

    laborApi
      .getLedger(viewingLaborId, {
        start: ledgerRangeStart || undefined,
        end: ledgerRangeEnd || undefined,
      })
      .then((ledger) => {
        if (active) {
          setViewingLedger(ledger);
        }
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          toast.error("Failed to load labor ledger.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingLedgerView(false);
        }
      });

    return () => {
      active = false;
    };
  }, [viewingLaborId, ledgerRangeStart, ledgerRangeEnd]);

  const buildLaborReportPayload = (
    report: ApiLaborSummaryReport,
  ): ReportExportPayload => ({
    title: `Labor ${report.period} summary`,
    table: {
      columns: [
        "Period",
        "Labor",
        "Total Earnings",
        "Total Advances",
        "Total Paid Cash",
        "Net Payable",
      ],
      rows: report.buckets.flatMap((bucket) =>
        bucket.labors.map((labor) => [
          bucket.key,
          labor.laborName,
          labor.totalEarnings.toFixed(2),
          labor.totalAdvances.toFixed(2),
          labor.totalPaidCash.toFixed(2),
          labor.netPayable.toFixed(2),
        ]),
      ),
    },
    metadata: {
      generatedAt: new Date().toLocaleString(),
      filters: [
        `Period: ${report.period}`,
        `Range: ${new Date(report.range.start).toLocaleDateString()} - ${new Date(report.range.end).toLocaleDateString()}`,
      ],
    },
  });

  const exportLaborReport = (type: "excel" | "pdf") => {
    if (!laborReport) {
      toast.error("Load a labor report first.");
      return;
    }
    const payload = buildLaborReportPayload(laborReport);
    const ok =
      type === "excel"
        ? exportTableToExcel(payload)
        : exportTableToPdf(payload);
    if (!ok) {
      toast.error(`Failed to export ${type.toUpperCase()} report.`);
      return;
    }
    toast.success(`${type.toUpperCase()} report generated.`);
  };

  const buildLedgerExportPayload = (): ReportExportPayload | null => {
    if (!viewingLabor || !viewingLedger) {
      return null;
    }

    return {
      title: `Labor Ledger - ${viewingLabor.name}`,
      table: {
        columns: [
          "Date",
          "Type",
          "Description",
          "Quantity",
          "Rate",
          "Earned",
          "Advance",
          "Paid Cash",
          "Balance",
        ],
        rows: ledgerRows.map((row) => [
          formatDate(row.date),
          row.type,
          row.description,
          row.quantity == null ? "-" : String(row.quantity),
          row.rate == null ? "-" : formatCurrency(row.rate),
          row.earned ? formatCurrency(row.earned) : "-",
          row.advance ? formatCurrency(row.advance) : "-",
          row.paidCash ? formatCurrency(row.paidCash) : "-",
          formatCurrency(row.balance),
        ]),
      },
      metadata: {
        generatedAt: new Date().toLocaleString(),
        filters: [
          `Labor: ${viewingLabor.name}`,
          `Range: ${ledgerRangeStart || "All"} - ${ledgerRangeEnd || "Today"}`,
        ],
      },
    };
  };

  const exportLedger = (type: "excel" | "pdf") => {
    const payload = buildLedgerExportPayload();
    if (!payload) {
      toast.error("Load a ledger first.");
      return;
    }

    const ok =
      type === "excel"
        ? exportTableToExcel(payload)
        : exportTableToPdf(payload);
    if (!ok) {
      toast.error(`Failed to export ${type.toUpperCase()} ledger.`);
      return;
    }

    toast.success(`${type.toUpperCase()} ledger generated.`);
  };

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
        const current = allProfiles.find(
          (profile) => profile.id === editingLaborId,
        );
        await laborApi.updateProfile(
          editingLaborId,
          {
            name: laborForm.name.trim(),
            categoryId: laborForm.categoryId,
            paymentTypeId: laborForm.paymentTypeId,
            defaultRate: laborForm.defaultRate
              ? parseFloat(laborForm.defaultRate)
              : undefined,
          },
          {
            itemLabel: laborForm.name.trim(),
            fieldLabels: {
              categoryId: getCategoryName(laborForm.categoryId),
              paymentTypeId: getPaymentTypeName(laborForm.paymentTypeId),
            },
            previousFieldLabels: {
              categoryId: getCategoryName(current?.categoryId),
              paymentTypeId: getPaymentTypeName(current?.paymentTypeId),
            },
            previousValues: {
              name: current?.name,
              categoryId: current?.categoryId,
              paymentTypeId: current?.paymentTypeId,
              defaultRate: current?.defaultRate,
            },
          },
        );
        toast.success("Labor updated");
      } else {
        await laborApi.createProfile(
          {
            name: laborForm.name.trim(),
            categoryId: laborForm.categoryId,
            paymentTypeId: laborForm.paymentTypeId,
            defaultRate: laborForm.defaultRate
              ? parseFloat(laborForm.defaultRate)
              : undefined,
            status: "ACTIVE",
          },
          {
            itemLabel: laborForm.name.trim(),
          },
        );
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
        const current = advanceEntries.find(
          (entry) => entry.id === editingAdvanceId,
        );
        await laborApi.updateAdvance(
          editingAdvanceId,
          {
            laborId: kharchaForm.laborId,
            date: kharchaForm.date,
            amount,
            reason: kharchaForm.reason,
            categoryId: kharchaForm.categoryId || undefined,
          },
          {
            itemLabel: getLaborName(kharchaForm.laborId),
            fieldLabels: {
              laborId: getLaborName(kharchaForm.laborId),
              categoryId: getExpenseCategoryName(kharchaForm.categoryId),
            },
            previousFieldLabels: {
              laborId: getLaborName(current?.laborId),
            },
            previousValues: {
              laborId: current?.laborId,
              date: current?.date?.slice(0, 10),
              amount: current?.amount,
              reason: current?.reason || undefined,
            },
          },
        );
        toast.success("Kharcha updated");
      } else {
        await laborApi.createAdvance(
          {
            laborId: kharchaForm.laborId,
            date: kharchaForm.date,
            amount,
            reason: kharchaForm.reason,
            categoryId: kharchaForm.categoryId,
          },
          {
            itemLabel: getLaborName(kharchaForm.laborId),
          },
        );
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
    if (!confirm("Fire this labor profile?")) return;
    try {
      await laborApi.fireProfile(laborId, {
        itemLabel: getLaborName(laborId),
      });
      toast.success("Labor moved to fired status");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to fire labor.");
    }
  };

  const openPayDialog = (labor: ApiLaborProfile) => {
    const summary = getLaborSummary(labor.id);
    const totalPaid = paidByLabor[labor.id] ?? 0;
    const pendingPay = Math.max(summary.netPayable - totalPaid, 0);
    setPayingLaborId(labor.id);
    setPayForm({
      date: getCurrentDate(),
      amount: pendingPay > 0 ? String(Number(pendingPay.toFixed(2))) : "",
      mode: "CASH",
      description: "",
    });
    setPayDialog(true);
  };

  const handleLaborPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingLaborId) return;

    const amount = Number(payForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    const summary = getLaborSummary(payingLaborId);
    const totalPaid = paidByLabor[payingLaborId] ?? 0;
    const pendingPay = Math.max(summary.netPayable - totalPaid, 0);
    if (payForm.mode === "CASH" && amount > pendingPay) {
      toast.error(
        `Amount cannot exceed pending pay ${formatCurrency(pendingPay)}.`,
      );
      return;
    }

    try {
      if (payForm.mode === "KHARCHA_ADVANCE") {
        await laborApi.createAdvance({
          laborId: payingLaborId,
          date: payForm.date,
          amount,
          reason: payForm.description || "Labor advance",
        });
      } else {
        await expenseApi.createExpense({
          date: payForm.date,
          laborId: payingLaborId,
          module: "LABOR",
          paymentType: "CASH",
          amount,
          description: payForm.description || "Labor cash payment",
        });
      }
      toast.success("Labor payment recorded.");
      setPayDialog(false);
      setPayingLaborId(null);
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to record labor payment.");
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
      const advance = advanceEntries.find((entry) => entry.id === advanceId);
      await laborApi.deleteAdvance(advanceId, {
        itemLabel: getLaborName(advance?.laborId),
      });
      toast.success("Advance deleted");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete advance.");
    }
  };

  const openLedgerScreen = (laborId: string) => {
    setViewingLaborId(laborId);
    setLedgerRangeStart("");
    setLedgerRangeEnd(getCurrentDate());
  };

  const getLaborSummary = (laborId: string) =>
    ledgerMap[laborId] ?? {
      workEntries: [],
      advances: [],
      totalEarnings: 0,
      totalAdvances: 0,
      netPayable: 0,
    };

  const paidEntries = laborPayments.filter((entry) => !entry.laborAdvanceId);
  const paidByLabor = paidEntries.reduce<Record<string, number>>(
    (acc, entry) => {
      if (entry.laborId) {
        acc[entry.laborId] =
          (acc[entry.laborId] ?? 0) + Number(entry.amount ?? 0);
      }
      return acc;
    },
    {},
  );
  const paidTodayEntries = laborPaymentsToday.filter(
    (entry) => !entry.laborAdvanceId,
  );
  const normalizedLaborQuery = laborSearchQuery.trim().toLowerCase();
  const laborMatchesFilters = (labor: ApiLaborProfile) => {
    const matchesDepartment =
      departmentFilter === "ALL" ||
      labor.categoryId === departmentFilter ||
      labor.department === departmentFilter;
    const matchesSearch =
      !normalizedLaborQuery ||
      labor.name.toLowerCase().includes(normalizedLaborQuery);
    return matchesDepartment && matchesSearch;
  };
  const filteredLaborIds = new Set(
    allProfiles.filter(laborMatchesFilters).map((labor) => labor.id),
  );
  const filteredProfiles = profiles.filter((labor) =>
    filteredLaborIds.has(labor.id),
  );
  const filteredWorkEntries = workEntries
    .filter(
      (entry) =>
        filteredLaborIds.has(entry.laborId) &&
        isWithinDateRange(entry.startDate, workEntryStart, workEntryEnd),
    )
    .sort(
      (a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    );
  const filteredPaidTodayEntries = paidTodayEntries.filter(
    (entry) => entry.laborId && filteredLaborIds.has(entry.laborId),
  );
  const filteredAdvanceEntries = advanceEntries.filter((entry) =>
    filteredLaborIds.has(entry.laborId),
  );

  const viewingLabor = viewingLaborId
    ? allProfiles.find((labor) => labor.id === viewingLaborId) ?? null
    : null;

  const ledgerPaidEntries = useMemo(
    () =>
      viewingLaborId
        ? paidEntries
            .filter(
              (entry) =>
                entry.laborId === viewingLaborId &&
                isWithinDateRange(entry.date, ledgerRangeStart, ledgerRangeEnd),
            )
            .sort(
              (a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime(),
            )
        : [],
    [viewingLaborId, paidEntries, ledgerRangeStart, ledgerRangeEnd],
  );

  const ledgerRows = useMemo(() => {
    if (!viewingLedger) {
      return [] as LedgerTransactionRow[];
    }

    const workRows = viewingLedger.workEntries.map((work) => ({
      date: work.startDate,
      type: "Work" as const,
      description:
        articles.find((article) => article.id === work.articleId)?.name ??
        "Unknown",
      quantity: Number(work.quantity ?? 0),
      rate: Number(work.rate ?? 0),
      earned: Number(work.total ?? 0),
      advance: 0,
      paidCash: 0,
    }));

    const advanceRows = viewingLedger.advances.map((advance) => ({
      date: advance.date,
      type: "Kharcha" as const,
      description: advance.reason || "-",
      quantity: null,
      rate: null,
      earned: 0,
      advance: Number(advance.amount ?? 0),
      paidCash: 0,
    }));

    const paymentRows = ledgerPaidEntries.map((payment) => ({
      date: payment.date,
      type: "Paid Cash" as const,
      description: payment.description || "-",
      quantity: null,
      rate: null,
      earned: 0,
      advance: 0,
      paidCash: Number(payment.amount ?? 0),
    }));

    const rows = [...workRows, ...advanceRows, ...paymentRows].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let runningBalance = 0;
    return rows.map((row) => {
      runningBalance += row.earned - row.advance - row.paidCash;
      return {
        ...row,
        balance: runningBalance,
      };
    });
  }, [viewingLedger, ledgerPaidEntries, articles]);

  const ledgerTotals = useMemo(() => {
    if (!viewingLedger) {
      return {
        totalEarnings: 0,
        totalAdvances: 0,
        totalPaidCash: 0,
        netPayable: 0,
      };
    }

    const totalPaidCash = ledgerPaidEntries.reduce(
      (sum, entry) => sum + Number(entry.amount ?? 0),
      0,
    );

    return {
      totalEarnings: viewingLedger.totalEarnings,
      totalAdvances: viewingLedger.totalAdvances,
      totalPaidCash,
      netPayable: viewingLedger.totalEarnings - viewingLedger.totalAdvances - totalPaidCash,
    };
  }, [viewingLedger, ledgerPaidEntries]);

  if (viewingLaborId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button
              variant="ghost"
              className="mb-2 px-0"
              onClick={() => setViewingLaborId(null)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back To Labor Management
            </Button>
            <h2 className="mb-1">Labor Ledger</h2>
            <p className="text-sm text-muted-foreground">
              {viewingLabor?.name || "Unknown labor"}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                Start Date
              </Label>
              <Input
                type="date"
                value={ledgerRangeStart}
                onChange={(e) => setLedgerRangeStart(e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                End Date
              </Label>
              <Input
                type="date"
                value={ledgerRangeEnd}
                onChange={(e) => setLedgerRangeEnd(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => exportLedger("excel")}
              disabled={!viewingLedger}
            >
              Excel
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportLedger("pdf")}
              disabled={!viewingLedger}
            >
              PDF
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total Earned</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl">
                {formatCurrency(ledgerTotals.totalEarnings)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total Kharcha</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl">
                {formatCurrency(ledgerTotals.totalAdvances)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Paid Cash</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl">
                {formatCurrency(ledgerTotals.totalPaidCash)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Net Payable</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl ${
                  ledgerTotals.netPayable >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(ledgerTotals.netPayable)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ledger Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Earned</TableHead>
                  <TableHead>Advance</TableHead>
                  <TableHead>Paid Cash</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingLedgerView ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground"
                    >
                      Loading labor ledger...
                    </TableCell>
                  </TableRow>
                ) : ledgerRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground"
                    >
                      No ledger entries found for the selected range.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerRows.map((row, index) => (
                    <TableRow key={`${row.type}-${row.date}-${index}`}>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell>
                        {row.quantity == null ? "-" : row.quantity}
                      </TableCell>
                      <TableCell>
                        {row.rate == null ? "-" : formatCurrency(row.rate)}
                      </TableCell>
                      <TableCell>
                        {row.earned ? formatCurrency(row.earned) : "-"}
                      </TableCell>
                      <TableCell>
                        {row.advance ? formatCurrency(row.advance) : "-"}
                      </TableCell>
                      <TableCell>
                        {row.paidCash ? formatCurrency(row.paidCash) : "-"}
                      </TableCell>
                      <TableCell>{formatCurrency(row.balance)}</TableCell>
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

  return (
    <div className="space-y-6">
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <TabsList className="grid w-full max-w-[320px] grid-cols-2">
            <TabsTrigger value="entries">Labor Work</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="reports" className="space-y-0">
          <Card>
            <CardHeader>
              <CardTitle>Labor Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                    Report Period
                  </Label>
                  <Select
                    value={laborReportPeriod}
                    onValueChange={(value) =>
                      setLaborReportPeriod(value as "weekly" | "monthly")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                    Start Date (optional)
                  </Label>
                  <Input
                    type="date"
                    value={laborReportStart}
                    onChange={(e) => setLaborReportStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                    End Date
                  </Label>
                  <Input
                    type="date"
                    value={laborReportEnd}
                    onChange={(e) => setLaborReportEnd(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2">
                  {isLoadingLaborReport && (
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => exportLaborReport("excel")}
                    disabled={!laborReport || laborReport.buckets.length === 0}
                  >
                    Excel
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => exportLaborReport("pdf")}
                    disabled={!laborReport || laborReport.buckets.length === 0}
                  >
                    PDF
                  </Button>
                </div>
              </div>

              {laborReport && (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">
                        Total Earnings
                      </p>
                      <p className="text-lg">
                        {formatCurrency(laborReport.totals.totalEarnings)}
                      </p>
                    </div>
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">
                        Total Advances
                      </p>
                      <p className="text-lg">
                        {formatCurrency(laborReport.totals.totalAdvances)}
                      </p>
                    </div>
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">
                        Total Paid Cash
                      </p>
                      <p className="text-lg">
                        {formatCurrency(laborReport.totals.totalPaidCash)}
                      </p>
                    </div>
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">
                        Net Payable
                      </p>
                      <p className="text-lg">
                        {formatCurrency(laborReport.totals.netPayable)}
                      </p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Total Earnings</TableHead>
                        <TableHead>Total Advances</TableHead>
                        <TableHead>Total Paid Cash</TableHead>
                        <TableHead>Net Payable</TableHead>
                        <TableHead>Labors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {laborReport.buckets.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground"
                          >
                            No data found for selected period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        laborReport.buckets.map((bucket) => (
                          <TableRow key={bucket.key}>
                            <TableCell>{bucket.key}</TableCell>
                            <TableCell>
                              {formatCurrency(bucket.totalEarnings)}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(bucket.totalAdvances)}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(bucket.totalPaidCash)}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(bucket.netPayable)}
                            </TableCell>
                            <TableCell>{bucket.laborCount}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries" className="space-y-0">
          <Card>
            <CardHeader>
              <CardTitle>Labor Management</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs
                defaultValue="labors"
                value={activeTab}
                onValueChange={setActiveTab}
              >
                <div className="flex items-center justify-between gap-3">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="labors">Labor Profiles</TabsTrigger>
                    <TabsTrigger value="work">Work Entries</TabsTrigger>
                    {/* <TabsTrigger value="labor-paid-today">
                      Labor Paid Today
                    </TabsTrigger>
                    <TabsTrigger value="kharcha">
                      Kharcha (Advances)
                    </TabsTrigger> */}
                  </TabsList>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="min-w-[240px] flex-1 md:max-w-[360px]">
                    <Label
                      htmlFor="labor-search-filter"
                      className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      Search Labor
                    </Label>
                    <div className="relative">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute left-1 top-1/2 h-7 w-7 -translate-y-1/2"
                        onClick={() => setLaborSearchQuery("")}
                        disabled={!laborSearchQuery}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Input
                        id="labor-search-filter"
                        value={laborSearchQuery}
                        onChange={(e) => setLaborSearchQuery(e.target.value)}
                        placeholder="Search by labor name..."
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="min-w-[220px]">
                    <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                      Department Filter
                    </Label>
                    <Select
                      value={departmentFilter}
                      onValueChange={setDepartmentFilter}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Departments</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {activeTab === "work" && (
                    <>
                      <div className="min-w-[180px]">
                        <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                          Work Start Date
                        </Label>
                        <Input
                          type="date"
                          value={workEntryStart}
                          onChange={(e) => setWorkEntryStart(e.target.value)}
                        />
                      </div>
                      <div className="min-w-[180px]">
                        <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                          Work End Date
                        </Label>
                        <Input
                          type="date"
                          value={workEntryEnd}
                          onChange={(e) => setWorkEntryEnd(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {activeTab === "labors" && (
                      <Dialog open={laborDialog} onOpenChange={setLaborDialog}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Labor
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              {editingLaborId ? "Edit" : "Add"} Labor
                            </DialogTitle>
                          </DialogHeader>
                          <form
                            onSubmit={handleLaborSubmit}
                            className="space-y-4"
                          >
                            <div>
                              <Label>Labor Name</Label>
                              <Input
                                defaultValue={laborForm.name}
                                onChange={(e) =>
                                  setLaborForm({
                                    ...laborForm,
                                    name: e.target.value,
                                  })
                                }
                                required
                              />
                            </div>
                            <div>
                              <Label>Department</Label>
                              <Select
                                value={laborForm.categoryId}
                                onValueChange={(value) =>
                                  setLaborForm({
                                    ...laborForm,
                                    categoryId: value,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select department" />
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
                                  setLaborForm({
                                    ...laborForm,
                                    paymentTypeId: value,
                                  })
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
                    )}
                    {/* {activeTab === "kharcha" && (
                      <Dialog
                        open={kharchaDialog}
                        onOpenChange={setKharchaDialog}
                      >
                        <DialogTrigger asChild>
                          <Button>
                            <Wallet className="mr-2 h-4 w-4" />
                            Add Kharcha
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              {editingAdvanceId ? "Edit" : "Record"} Kharcha
                              (Advance)
                            </DialogTitle>
                          </DialogHeader>
                          <form
                            onSubmit={handleKharchaSubmit}
                            className="space-y-4"
                          >
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
                                  setKharchaForm({
                                    ...kharchaForm,
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
                              <Label>Expense Category</Label>
                              <Select
                                value={kharchaForm.categoryId}
                                onValueChange={(value) =>
                                  setKharchaForm({
                                    ...kharchaForm,
                                    categoryId: value,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseCategories.map((category) => (
                                    <SelectItem
                                      key={category.id}
                                      value={category.id}
                                    >
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
                    )} */}
                  </div>
                </div>

                <TabsContent
                  value="labors"
                  className="space-y-4"
                  data-report-tab="labors"
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Payment Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total Earned</TableHead>
                        <TableHead>Total Paid</TableHead>
                        <TableHead>Kharcha</TableHead>
                        <TableHead>Net Payable</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="text-center text-muted-foreground"
                          >
                            Loading labor profiles...
                          </TableCell>
                        </TableRow>
                      ) : filteredProfiles.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="text-center text-muted-foreground"
                          >
                            No labors yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProfiles.map((labor) => {
                          const summary = getLaborSummary(labor.id);
                          const totalPaid = paidByLabor[labor.id] ?? 0;
                          const adjustedNetPayable =
                            summary.netPayable - totalPaid;
                          return (
                            <TableRow key={labor.id}>
                              <TableCell>{labor.name}</TableCell>
                              <TableCell>
                                {labor.category?.name || "-"}
                              </TableCell>
                              <TableCell>
                                {labor.paymentType?.name || "-"}
                              </TableCell>
                              <TableCell>{labor.status}</TableCell>
                              <TableCell>
                                {formatCurrency(summary.totalEarnings)}
                              </TableCell>
                              <TableCell>{formatCurrency(totalPaid)}</TableCell>
                              <TableCell>
                                {formatCurrency(summary.totalAdvances)}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={
                                    adjustedNetPayable > 0
                                      ? "text-green-600"
                                      : ""
                                  }
                                >
                                  {formatCurrency(adjustedNetPayable)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openLedgerScreen(labor.id)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openPayDialog(labor)}
                                  >
                                    <Banknote className="h-4 w-4" />
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
                                    Fire
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

                <TabsContent
                  value="work"
                  className="space-y-4"
                  data-report-tab="work"
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Labor</TableHead>
                        <TableHead>Article</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Total</TableHead>
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
                      ) : filteredWorkEntries.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground"
                          >
                            No work entries yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredWorkEntries.map((work) => (
                          <TableRow key={work.id}>
                            <TableCell>{formatDate(work.startDate)}</TableCell>
                            <TableCell>{work.laborName}</TableCell>
                            <TableCell>{work.articleName}</TableCell>
                            <TableCell>{Number(work.quantity)}</TableCell>
                            <TableCell>
                              {formatCurrency(Number(work.rate))}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(Number(work.total))}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                {/* <TabsContent
                  value="labor-paid-today"
                  className="space-y-4"
                  data-report-tab="labor-paid-today"
                >
                  <div className="flex items-center justify-between"></div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Labor</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-muted-foreground"
                          >
                            Loading labor payments...
                          </TableCell>
                        </TableRow>
                      ) : filteredPaidTodayEntries.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-muted-foreground"
                          >
                            No labor payments today
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPaidTodayEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{formatDate(entry.date)}</TableCell>
                            <TableCell>{entry.labor?.name || "-"}</TableCell>
                            <TableCell>
                              {formatCurrency(Number(entry.amount))}
                            </TableCell>
                            <TableCell>{entry.description || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent
                  value="kharcha"
                  className="space-y-4"
                  data-report-tab="kharcha"
                >
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
                      ) : filteredAdvanceEntries.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-muted-foreground"
                          >
                            No kharcha entries yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAdvanceEntries.map((kharcha) => (
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
                </TabsContent> */}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={payDialog}
        onOpenChange={(open) => {
          setPayDialog(open);
          if (!open) setPayingLaborId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Pay Labor -{" "}
              {allProfiles.find((item) => item.id === payingLaborId)?.name ||
                "-"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLaborPaySubmit} className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={payForm.date}
                onChange={(e) =>
                  setPayForm({ ...payForm, date: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Payment Type</Label>
              <Select
                value={payForm.mode}
                onValueChange={(value) =>
                  setPayForm({
                    ...payForm,
                    mode: value as "CASH" | "KHARCHA_ADVANCE",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="KHARCHA_ADVANCE">
                    Kharcha (Advance)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={payForm.amount}
                onChange={(e) =>
                  setPayForm({ ...payForm, amount: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={payForm.description}
                onChange={(e) =>
                  setPayForm({ ...payForm, description: e.target.value })
                }
                placeholder="Optional note"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPayDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Payment</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
