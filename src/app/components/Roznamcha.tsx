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
import { Card, CardContent, CardHeader } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Plus } from "lucide-react";
import { formatCurrency, getCurrentDate } from "../lib/utils";
import {
  billApi,
  expenseApi,
  laborApi,
  partyApi,
  purchaseApi,
  reportsApi,
} from "../lib/api";
import {
  exportTableToExcel,
  exportTableToPdf,
  type ReportExportPayload,
} from "../lib/report";
import type {
  ApiBill,
  ApiExpenseEntry,
  ApiLaborLedger,
  ApiRoznamchaSummaryReport,
  ApiExpenseModule,
  ApiLaborProfile,
  ApiParty,
  ApiSupplierPendingDue,
} from "../types/api";
import { toast } from "sonner";

export function Roznamcha() {
  type RoznamchaModule = ApiExpenseModule | "BILL" | "SUPPLIER_PAYMENT";
  type EntryViewFilter =
    | "ALL"
    | "IN_ONLY"
    | "OUT_ONLY"
    | "LABOR_ONLY"
    | "PARTY_ONLY";

  const [entries, setEntries] = useState<ApiExpenseEntry[]>([]);
  const [parties, setParties] = useState<ApiParty[]>([]);
  const [labors, setLabors] = useState<ApiLaborProfile[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [billOptions, setBillOptions] = useState<ApiBill[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ApiExpenseEntry | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [entryFilter, setEntryFilter] = useState<EntryViewFilter>("ALL");
  const [laborSearch, setLaborSearch] = useState("");
  const [showLaborSuggestions, setShowLaborSuggestions] = useState(false);
  const [selectedLaborSummary, setSelectedLaborSummary] = useState<{
    totalEarnings: number;
    totalKharcha: number;
    totalPaid: number;
    netPayable: number;
    pendingPayable: number;
  } | null>(null);
  const [isLoadingLaborSummary, setIsLoadingLaborSummary] = useState(false);
  const [supplierPendingDues, setSupplierPendingDues] = useState<
    ApiSupplierPendingDue[]
  >([]);
  const [isLoadingSupplierPendingDues, setIsLoadingSupplierPendingDues] =
    useState(false);
  const [roznamchaReportPeriod, setRoznamchaReportPeriod] = useState<
    "daily" | "weekly" | "monthly"
  >("daily");
  const [roznamchaReportStart, setRoznamchaReportStart] = useState("");
  const [roznamchaReportEnd, setRoznamchaReportEnd] =
    useState(getCurrentDate());
  const [roznamchaReport, setRoznamchaReport] =
    useState<ApiRoznamchaSummaryReport | null>(null);
  const [isLoadingRoznamchaReport, setIsLoadingRoznamchaReport] =
    useState(false);
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window === "undefined") return "entries";
    return localStorage.getItem("roznamcha.activeSection") || "entries";
  });

  const [formData, setFormData] = useState({
    date: getCurrentDate(),
    module: "MISC" as RoznamchaModule,
    direction: "OUT" as "IN" | "OUT",
    paymentType: "CASH" as "CASH" | "KHATA",
    partyId: "none",
    billId: "",
    laborId: "",
    quantity: "",
    rate: "",
    amount: "",
    description: "",
  });

  const filteredLaborOptions = labors
    .filter((labor) =>
      labor.name.toLowerCase().includes(laborSearch.trim().toLowerCase()),
    )
    .slice(0, 8);

  const [filterDate, setFilterDate] = useState(getCurrentDate());
  const computedPurchaseAmount =
    Number(formData.quantity || 0) * Number(formData.rate || 0);
  const selectedBill = billOptions.find((bill) => bill.id === formData.billId);
  const selectedBillRemaining = Number(selectedBill?.remaining ?? 0);
  const selectedSupplierPendingDue = supplierPendingDues.find(
    (row) => row.partyId === formData.partyId,
  );
  const selectedSupplierRemainingDue = Number(
    selectedSupplierPendingDue?.remainingDue ?? 0,
  );
  const exceedsBillAmount =
    formData.module === "BILL" &&
    !!selectedBill &&
    Number(formData.amount || 0) > selectedBillRemaining;
  const exceedsSupplierDue =
    formData.module === "SUPPLIER_PAYMENT" &&
    !!selectedSupplierPendingDue &&
    Number(formData.amount || 0) > selectedSupplierRemainingDue;

  const loadData = async (dateFilter: string) => {
    setIsLoading(true);
    try {
      const start = dateFilter;
      const end = dateFilter;
      const [expenseEntries, partyData, laborData] = await Promise.all([
        expenseApi.listExpenses({ start, end }),
        partyApi.listParties(),
        laborApi.listProfiles(),
      ]);
      setEntries(expenseEntries);
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

  useEffect(() => {
    let active = true;
    setIsLoadingRoznamchaReport(true);

    const timer = window.setTimeout(() => {
      reportsApi
        .getRoznamchaSummary({
          period: roznamchaReportPeriod,
          start: roznamchaReportStart || undefined,
          end: roznamchaReportEnd || undefined,
        })
        .then((report) => {
          if (active) {
            setRoznamchaReport(report);
          }
        })
        .catch((error) => {
          console.error(error);
          if (active) {
            toast.error("Failed to load Roznamcha report.");
          }
        })
        .finally(() => {
          if (active) {
            setIsLoadingRoznamchaReport(false);
          }
        });
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [roznamchaReportPeriod, roznamchaReportStart, roznamchaReportEnd]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("roznamcha.activeSection", activeSection);
  }, [activeSection]);

  const buildRoznamchaPayload = (
    report: ApiRoznamchaSummaryReport,
  ): ReportExportPayload => {
    const moduleColumns = Array.from(
      new Set(
        report.buckets.flatMap((bucket) =>
          Object.keys(bucket.moduleBreakdown || {}),
        ),
      ),
    ).sort();

    return {
      title: `Roznamcha ${report.period} summary`,
      table: {
        columns: [
          "Period",
          "Total Inflow",
          "Total Outflow",
          "Net Cash Flow",
          "Entries",
          ...moduleColumns,
        ],
        rows: report.buckets.map((bucket) => [
          bucket.key,
          bucket.totalInflow.toFixed(2),
          bucket.totalOutflow.toFixed(2),
          bucket.netCashFlow.toFixed(2),
          String(bucket.entryCount),
          ...moduleColumns.map((module) =>
            Number(bucket.moduleBreakdown?.[module] ?? 0).toFixed(2),
          ),
        ]),
      },
      metadata: {
        generatedAt: new Date().toLocaleString(),
        filters: [
          `Period: ${report.period}`,
          `Range: ${new Date(report.range.start).toLocaleDateString()} - ${new Date(report.range.end).toLocaleDateString()}`,
        ],
      },
    };
  };

  const exportRoznamchaReport = (type: "excel" | "pdf") => {
    if (!roznamchaReport) {
      toast.error("Load a report first.");
      return;
    }
    const payload = buildRoznamchaPayload(roznamchaReport);
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

  useEffect(() => {
    if (
      !isDialogOpen ||
      formData.module !== "BILL" ||
      !formData.partyId ||
      formData.partyId === "none"
    ) {
      setBillOptions([]);
      return;
    }

    let active = true;
    setIsLoadingBills(true);
    billApi
      .listBills()
      .then((bills) => {
        if (!active) return;
        const filtered = bills.filter(
          (bill) =>
            bill.partyId === formData.partyId &&
            Number(bill.remaining ?? 0) > 0,
        );
        setBillOptions(filtered);
        const first = filtered[0];
        if (first) {
          setFormData((prev) => ({
            ...prev,
            billId: first.id,
            amount: String(Number(first.remaining ?? 0)),
          }));
        } else {
          setFormData((prev) => ({ ...prev, billId: "", amount: "" }));
        }
      })
      .catch((error) => {
        console.error(error);
        if (active) toast.error("Failed to load bills for selected party.");
      })
      .finally(() => {
        if (active) setIsLoadingBills(false);
      });

    return () => {
      active = false;
    };
  }, [isDialogOpen, formData.module, formData.partyId]);

  useEffect(() => {
    if (!isDialogOpen || formData.module !== "SUPPLIER_PAYMENT") {
      setSupplierPendingDues([]);
      return;
    }

    let active = true;
    setIsLoadingSupplierPendingDues(true);
    partyApi
      .listSupplierPendingDues({
        asOf: formData.date || undefined,
      })
      .then((result) => {
        if (!active) return;
        const pending = result.pending ?? [];
        setSupplierPendingDues(pending);

        const selectedStillValid = pending.some(
          (row) => row.partyId === formData.partyId,
        );

        if (pending.length === 0) {
          setFormData((prev) => ({
            ...prev,
            partyId: "none",
            amount: "",
          }));
          return;
        }

        if (!selectedStillValid) {
          setFormData((prev) => ({
            ...prev,
            partyId: pending[0].partyId,
            amount: String(Number(pending[0].remainingDue ?? 0)),
          }));
        }
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          toast.error("Failed to load pending supplier dues.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingSupplierPendingDues(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isDialogOpen, formData.module, formData.date]);

  useEffect(() => {
    if (formData.module !== "SUPPLIER_PAYMENT") return;
    if (!selectedSupplierPendingDue) return;
    if (editingEntry) return;

    setFormData((prev) => {
      if (prev.module !== "SUPPLIER_PAYMENT") return prev;
      return {
        ...prev,
        amount: String(Number(selectedSupplierPendingDue.remainingDue ?? 0)),
      };
    });
  }, [
    formData.module,
    formData.partyId,
    selectedSupplierPendingDue,
    editingEntry,
  ]);

  useEffect(() => {
    if (!isDialogOpen) {
      setLaborSearch("");
      setShowLaborSuggestions(false);
      return;
    }
    const selectedLabor = labors.find((labor) => labor.id === formData.laborId);
    setLaborSearch(selectedLabor?.name ?? "");
  }, [isDialogOpen, formData.laborId, labors]);

  useEffect(() => {
    if (!isDialogOpen || formData.module !== "LABOR" || !formData.laborId) {
      setSelectedLaborSummary(null);
      return;
    }

    let active = true;
    setIsLoadingLaborSummary(true);
    Promise.all([
      laborApi.getLedger(formData.laborId),
      expenseApi.listExpenses({ module: "LABOR" }),
    ])
      .then(([ledger, laborExpenses]: [ApiLaborLedger, ApiExpenseEntry[]]) => {
        if (!active) return;
        const totalPaid = laborExpenses
          .filter(
            (entry) =>
              entry.laborId === formData.laborId && !entry.laborAdvanceId,
          )
          .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
        const netPayable = Number(ledger.netPayable ?? 0);
        const pendingPayable = Math.max(netPayable - totalPaid, 0);
        setSelectedLaborSummary({
          totalEarnings: Number(ledger.totalEarnings ?? 0),
          totalKharcha: Number(ledger.totalAdvances ?? 0),
          totalPaid,
          netPayable,
          pendingPayable,
        });
        if (!editingEntry) {
          setFormData((prev) => ({
            ...prev,
            amount: String(Number(pendingPayable.toFixed(2))),
          }));
        }
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          setSelectedLaborSummary(null);
          toast.error("Failed to load labor payable summary.");
        }
      })
      .finally(() => {
        if (active) setIsLoadingLaborSummary(false);
      });

    return () => {
      active = false;
    };
  }, [isDialogOpen, formData.module, formData.laborId, editingEntry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isPurchaseModule =
      formData.module === "CHEMICAL" ||
      formData.module === "REXINE" ||
      formData.module === "MATERIAL";

    const amount = parseFloat(formData.amount || "0");
    const quantity = parseFloat(formData.quantity || "0");
    const rate = parseFloat(formData.rate || "0");

    try {
      if (editingEntry) {
        if (editingEntry.laborAdvanceId) {
          await laborApi.updateAdvance(editingEntry.laborAdvanceId, {
            laborId: formData.laborId,
            date: formData.date,
            amount,
            reason: formData.description,
          });
        } else {
          await expenseApi.updateExpense(
            editingEntry.id,
            {
              date: formData.date,
              partyId:
                formData.partyId === "none" ? undefined : formData.partyId,
              laborId:
                formData.module === "LABOR" ? formData.laborId : undefined,
              module: formData.module === "BILL" ? "MISC" : formData.module,
              paymentType: formData.paymentType,
              amount,
              description: formData.description,
            },
            {
              itemLabel:
                formData.description || getPartyLaborLabel(editingEntry),
              previousValues: {
                amount: editingEntry.amount,
                description: editingEntry.description,
                paymentType: editingEntry.paymentType,
                module: editingEntry.module,
                date: editingEntry.date,
              },
            },
          );
        }
        toast.success("Expense updated");
      } else if (formData.module === "BILL") {
        if (!formData.partyId || formData.partyId === "none") {
          toast.error("Select a party.");
          return;
        }
        if (!formData.billId) {
          toast.error("Select a bill.");
          return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
          toast.error("Enter a valid amount.");
          return;
        }
        if (selectedBill && amount > Number(selectedBill.remaining ?? 0)) {
          toast.error("Amount exceeds bill remaining.");
          return;
        }
        await billApi.receivePayment(formData.billId, {
          amount,
          date: formData.date,
          method: "CASH",
          description: formData.description || undefined,
        });
        toast.success("Bill payment recorded");
      } else if (formData.module === "SUPPLIER_PAYMENT") {
        if (!formData.partyId || formData.partyId === "none") {
          toast.error("Select a supplier party.");
          return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
          toast.error("Enter a valid amount.");
          return;
        }
        if (
          selectedSupplierPendingDue &&
          amount > Number(selectedSupplierPendingDue.remainingDue ?? 0)
        ) {
          toast.error("Amount exceeds pending supplier due.");
          return;
        }

        await partyApi.createPayment(formData.partyId, {
          date: formData.date,
          amount,
          method: "KHATA",
          direction: "PAY",
          description: formData.description || undefined,
        });
        toast.success("Supplier payment recorded");
      } else if (isPurchaseModule) {
        if (
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          !Number.isFinite(rate) ||
          rate <= 0
        ) {
          toast.error("Enter valid quantity and rate.");
          return;
        }
        const totalAmount = Number((quantity * rate).toFixed(2));
        const purchasePayload = {
          date: formData.date,
          partyId: formData.partyId === "none" ? undefined : formData.partyId,
          totalAmount,
          paymentType: formData.paymentType,
          description: formData.description,
        };

        if (formData.module === "CHEMICAL") {
          await purchaseApi.createChemical({
            ...purchasePayload,
            quantityKg: quantity,
            ratePerKg: rate,
          });
        } else if (formData.module === "REXINE") {
          await purchaseApi.createRexine({
            ...purchasePayload,
            quantityMeter: quantity,
            ratePerMeter: rate,
          });
        } else {
          await purchaseApi.createMaterial({
            ...purchasePayload,
            quantity,
            pricePerUnit: rate,
          });
        }
        toast.success("Purchase recorded");
      } else if (formData.module === "LABOR") {
        if (!Number.isFinite(amount) || amount <= 0) {
          toast.error("Enter a valid amount.");
          return;
        }
        if (!formData.laborId) {
          toast.error("Select a labor from suggestions.");
          return;
        }
        await expenseApi.createExpense({
          date: formData.date,
          laborId: formData.laborId,
          module: formData.module,
          paymentType: formData.paymentType,
          amount,
          description: formData.description,
        });
        toast.success("Expense recorded");
      } else {
        if (!Number.isFinite(amount) || amount <= 0) {
          toast.error("Enter a valid amount.");
          return;
        }
        await expenseApi.createExpense({
          date: formData.date,
          partyId: formData.partyId === "none" ? undefined : formData.partyId,
          module: formData.module,
          paymentType: formData.paymentType,
          amount: formData.direction === "IN" ? -amount : amount,
          description: formData.description,
        });
        toast.success("Entry recorded");
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
      direction: "OUT",
      paymentType: "CASH",
      partyId: "none",
      billId: "",
      laborId: "",
      quantity: "",
      rate: "",
      amount: "",
      description: "",
    });
    setLaborSearch("");
    setShowLaborSuggestions(false);
    setSelectedLaborSummary(null);
    setEditingEntry(null);
  };

  const startEdit = (entry: ApiExpenseEntry) => {
    setEditingEntry(entry);
    setFormData({
      date: entry.date.slice(0, 10),
      module: entry.module,
      direction: Number(entry.amount) < 0 ? "IN" : "OUT",
      paymentType:
        String(entry.paymentType ?? "CASH").toUpperCase() === "CASH"
          ? "CASH"
          : "KHATA",
      partyId: entry.partyId || "none",
      billId: "",
      laborId: entry.laborId || entry.laborAdvance?.laborId || "",
      quantity: "",
      rate: "",
      amount: String(entry.amount),
      description: entry.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (entry: ApiExpenseEntry) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await expenseApi.deleteExpense(entry.id, {
        itemLabel: entry.description || getPartyLaborLabel(entry),
        previousValues: {
          amount: entry.amount,
          description: entry.description,
          paymentType: entry.paymentType,
          module: entry.module,
          date: entry.date,
        },
      });
      toast.success("Expense deleted");
      await loadData(filterDate);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete expense.");
    }
  };

  const cashOutToday = entries.reduce((sum, entry) => {
    const amount = Number(entry.amount ?? 0);
    return amount >= 0 ? sum + amount : sum;
  }, 0);

  const cashInToday = entries.reduce((sum, entry) => {
    const amount = Number(entry.amount ?? 0);
    return amount < 0 ? sum + Math.abs(amount) : sum;
  }, 0);

  const getPartyLaborLabel = (entry: ApiExpenseEntry) =>
    entry.party?.name ||
    entry.labor?.name ||
    entry.laborAdvance?.labor?.name ||
    "-";

  const getReferenceLabel = (entry: ApiExpenseEntry) => {
    if (entry.sourceSystem === "BILL_PAYMENT_RECEIVED") return "Bill";
    if (entry.sourceSystem === "PARTY_PAYMENT_RECEIVED") return "Party";
    if (entry.sourceSystem === "PARTY_PAYMENT_PAID") return "Party";
    if (entry.sourceSystem === "LABOR_ADVANCE") return "Labor";
    if (entry.sourceSystem === "CHEMICAL_PURCHASE") return "Chemical";
    if (entry.sourceSystem === "REXINE_PURCHASE") return "Rexine";
    if (entry.sourceSystem === "MATERIAL_PURCHASE") return "Material";

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

  const getInOut = (amount: number) => (amount < 0 ? "In" : "Out");
  const getPaymentTypeLabel = (entry: ApiExpenseEntry) =>
    String(entry.paymentType ?? "CASH").toUpperCase() === "CASH"
      ? "Cash"
      : "Khata";

  const formatTime = (entry: ApiExpenseEntry) => {
    const value = entry.createdAt || entry.date;
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredEntries = entries.filter((entry) => {
    const amount = Number(entry.amount ?? 0);
    const isLaborEntry =
      entry.module === "LABOR" || !!entry.laborId || !!entry.laborAdvanceId;
    const isPartyEntry = !!entry.partyId;

    const matchesFilter =
      entryFilter === "ALL" ||
      (entryFilter === "IN_ONLY" && amount < 0) ||
      (entryFilter === "OUT_ONLY" && amount >= 0) ||
      (entryFilter === "LABOR_ONLY" && isLaborEntry) ||
      (entryFilter === "PARTY_ONLY" && isPartyEntry);

    if (!matchesFilter) return false;

    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    const searchable = [
      getReferenceLabel(entry),
      getPartyLaborLabel(entry),
      entry.description || "",
      getPaymentTypeLabel(entry),
      getInOut(amount),
      String(Math.abs(amount)),
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  });

  return (
    <div className="space-y-6">
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <TabsList className="grid w-full max-w-[360px] grid-cols-2">
            <TabsTrigger value="entries">Roznamcha Entries</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="reports" className="space-y-0">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3>Roznamcha Reports</h3>
                  <p className="text-sm text-muted-foreground">
                    Daily, weekly, and monthly summary updates automatically.
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label className="mb-1 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                      Period
                    </Label>
                    <Select
                      value={roznamchaReportPeriod}
                      onValueChange={(value) =>
                        setRoznamchaReportPeriod(
                          value as "daily" | "weekly" | "monthly",
                        )
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                      Start
                    </Label>
                    <Input
                      type="date"
                      value={roznamchaReportStart}
                      onChange={(e) => setRoznamchaReportStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                      End
                    </Label>
                    <Input
                      type="date"
                      value={roznamchaReportEnd}
                      onChange={(e) => setRoznamchaReportEnd(e.target.value)}
                    />
                  </div>
                  {isLoadingRoznamchaReport && (
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => exportRoznamchaReport("excel")}
                    disabled={
                      !roznamchaReport || roznamchaReport.buckets.length === 0
                    }
                  >
                    Excel
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => exportRoznamchaReport("pdf")}
                    disabled={
                      !roznamchaReport || roznamchaReport.buckets.length === 0
                    }
                  >
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {roznamchaReport && (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">
                        Total Inflow
                      </p>
                      <p className="text-lg text-green-600">
                        {formatCurrency(roznamchaReport.totals.totalInflow)}
                      </p>
                    </div>
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">
                        Total Outflow
                      </p>
                      <p className="text-lg text-red-600">
                        {formatCurrency(roznamchaReport.totals.totalOutflow)}
                      </p>
                    </div>
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">
                        Net Cash Flow
                      </p>
                      <p className="text-lg">
                        {formatCurrency(roznamchaReport.totals.netCashFlow)}
                      </p>
                    </div>
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">
                        Entry Count
                      </p>
                      <p className="text-lg">
                        {roznamchaReport.totals.entryCount}
                      </p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Inflow</TableHead>
                        <TableHead>Outflow</TableHead>
                        <TableHead>Net</TableHead>
                        <TableHead>Entries</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roznamchaReport.buckets.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center text-muted-foreground"
                          >
                            No report data found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        roznamchaReport.buckets.map((bucket) => (
                          <TableRow key={bucket.key}>
                            <TableCell>{bucket.key}</TableCell>
                            <TableCell>
                              {formatCurrency(bucket.totalInflow)}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(bucket.totalOutflow)}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(bucket.netCashFlow)}
                            </TableCell>
                            <TableCell>{bucket.entryCount}</TableCell>
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
              <div className="flex items-end justify-between gap-4">
                <div className="flex flex-1 flex-wrap items-end gap-3">
                  <div className="min-w-[210px]">
                    <Label
                      htmlFor="roznamcha-date"
                      className="mb-1.5 inline-block px-0.5 text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      Date
                    </Label>
                    <Input
                      id="roznamcha-date"
                      type="date"
                      value={filterDate}
                      onChange={(e) =>
                        setFilterDate(e.target.value || getCurrentDate())
                      }
                      className="h-10 w-[190px] pr-2 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:ml-1 [&::-webkit-calendar-picker-indicator]:p-0 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:h-4"
                    />
                  </div>
                  <div className="min-w-[260px] flex-1 md:max-w-[380px]">
                    <Label
                      htmlFor="roznamcha-search"
                      className="mb-1.5 inline-block px-0.5 text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      Search
                    </Label>
                    <Input
                      id="roznamcha-search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search reference, party, labor, amount..."
                      className="h-10"
                    />
                  </div>
                  <div className="min-w-[220px]">
                    <Label className="mb-1.5 inline-block px-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                      Filter
                    </Label>
                    <Select
                      value={entryFilter}
                      onValueChange={(value) =>
                        setEntryFilter(value as EntryViewFilter)
                      }
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Entries</SelectItem>
                        <SelectItem value="IN_ONLY">Only In</SelectItem>
                        <SelectItem value="OUT_ONLY">Only Out</SelectItem>
                        <SelectItem value="LABOR_ONLY">Only Labor</SelectItem>
                        <SelectItem value="PARTY_ONLY">Only Party</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Dialog
                  open={isDialogOpen}
                  onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button className="h-10 self-end">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Entry
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingEntry ? "Edit Entry" : "Record Entry"}
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
                          <Label>Module</Label>
                          <Select
                            value={formData.module}
                            onValueChange={(value) => {
                              const nextModule = value as RoznamchaModule;
                              setFormData({
                                ...formData,
                                module: nextModule,
                                direction:
                                  nextModule === "BILL"
                                    ? "IN"
                                    : nextModule === "SUPPLIER_PAYMENT"
                                      ? "OUT"
                                      : formData.direction,
                                paymentType:
                                  nextModule === "BILL"
                                    ? "CASH"
                                    : nextModule === "SUPPLIER_PAYMENT"
                                      ? "KHATA"
                                      : formData.paymentType,
                                billId:
                                  nextModule === "BILL" ? "" : formData.billId,
                                partyId:
                                  nextModule === "SUPPLIER_PAYMENT"
                                    ? "none"
                                    : formData.partyId,
                                amount:
                                  nextModule === "SUPPLIER_PAYMENT"
                                    ? ""
                                    : formData.amount,
                              });
                            }}
                            disabled={!!editingEntry?.laborAdvanceId}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MISC">Misc</SelectItem>
                              <SelectItem value="BILL">Bill</SelectItem>
                              <SelectItem value="SUPPLIER_PAYMENT">
                                Parties (Suppliers)
                              </SelectItem>
                              <SelectItem value="CHEMICAL">Chemical</SelectItem>
                              <SelectItem value="REXINE">Rexine</SelectItem>
                              <SelectItem value="MATERIAL">Material</SelectItem>
                              <SelectItem
                                value="LABOR"
                                disabled={
                                  !!editingEntry && !editingEntry.laborAdvanceId
                                }
                              >
                                Labor
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>In/Out</Label>
                          <Select
                            value={formData.direction}
                            onValueChange={(value: "IN" | "OUT") =>
                              setFormData({ ...formData, direction: value })
                            }
                            disabled={
                              formData.module === "BILL" ||
                              formData.module === "CHEMICAL" ||
                              formData.module === "MATERIAL" ||
                              formData.module === "REXINE" ||
                              formData.module === "LABOR" ||
                              formData.module === "SUPPLIER_PAYMENT"
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OUT">Out</SelectItem>
                              <SelectItem value="IN">In</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Payment Type</Label>
                          <Select
                            value={formData.paymentType}
                            onValueChange={(value: "CASH" | "KHATA") =>
                              setFormData({ ...formData, paymentType: value })
                            }
                            disabled={
                              formData.module === "BILL" ||
                              formData.module === "SUPPLIER_PAYMENT"
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CASH">Cash</SelectItem>
                              <SelectItem value="KHATA">Khata</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {formData.module === "BILL" ||
                      formData.module === "SUPPLIER_PAYMENT" ||
                      formData.module === "CHEMICAL" ||
                      formData.module === "MATERIAL" ||
                      formData.module === "REXINE" ? (
                        <div>
                          <Label>Party</Label>
                          <Select
                            value={formData.partyId}
                            onValueChange={(value) =>
                              setFormData({
                                ...formData,
                                partyId: value,
                                billId:
                                  formData.module === "BILL"
                                    ? ""
                                    : formData.billId,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select party" />
                            </SelectTrigger>
                            <SelectContent>
                              {formData.module !== "BILL" &&
                                formData.module !== "SUPPLIER_PAYMENT" && (
                                  <SelectItem value="none">No party</SelectItem>
                                )}
                              {formData.module === "SUPPLIER_PAYMENT"
                                ? supplierPendingDues.map((row) => (
                                    <SelectItem
                                      key={row.partyId}
                                      value={row.partyId}
                                    >
                                      {row.partyName}
                                    </SelectItem>
                                  ))
                                : parties.map((party) => (
                                    <SelectItem key={party.id} value={party.id}>
                                      {party.name}
                                    </SelectItem>
                                  ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      {formData.module === "BILL" && (
                        <div className="space-y-2">
                          <Label>Bill</Label>
                          <Select
                            value={formData.billId}
                            onValueChange={(value) => {
                              const bill = billOptions.find(
                                (item) => item.id === value,
                              );
                              setFormData({
                                ...formData,
                                billId: value,
                                amount: bill
                                  ? String(Number(bill.remaining ?? 0))
                                  : formData.amount,
                                direction: "IN",
                                paymentType: "CASH",
                              });
                            }}
                            disabled={
                              isLoadingBills || billOptions.length === 0
                            }
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  isLoadingBills
                                    ? "Loading bills..."
                                    : billOptions.length === 0
                                      ? "No pending bills"
                                      : "Select bill"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {billOptions.map((bill) => (
                                <SelectItem key={bill.id} value={bill.id}>
                                  {bill.billNumber}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedBill && (
                            <div className="rounded border p-3 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Bill No
                                </span>
                                <span>{selectedBill.billNumber}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Remaining
                                </span>
                                <span>
                                  {formatCurrency(
                                    Number(selectedBill.remaining ?? 0),
                                  )}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {formData.module === "SUPPLIER_PAYMENT" && (
                        <div className="space-y-2">
                          {isLoadingSupplierPendingDues ? (
                            <p className="text-sm text-muted-foreground">
                              Loading pending suppliers...
                            </p>
                          ) : supplierPendingDues.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No suppliers with pending dues.
                            </p>
                          ) : selectedSupplierPendingDue ? (
                            <div className="rounded border p-3 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Supplier
                                </span>
                                <span>
                                  {selectedSupplierPendingDue.partyName}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Remaining Due
                                </span>
                                <span>
                                  {formatCurrency(
                                    Number(
                                      selectedSupplierPendingDue.remainingDue ??
                                        0,
                                    ),
                                  )}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Select a supplier to view pending due.
                            </p>
                          )}
                        </div>
                      )}

                      {(formData.module === "CHEMICAL" ||
                        formData.module === "REXINE" ||
                        formData.module === "MATERIAL") && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>
                              {formData.module === "CHEMICAL"
                                ? "Quantity (Kg)"
                                : formData.module === "REXINE"
                                  ? "Quantity (Meter)"
                                  : "Quantity"}
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.quantity}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  quantity: e.target.value,
                                })
                              }
                              required={!editingEntry}
                            />
                          </div>
                          <div>
                            <Label>
                              {formData.module === "CHEMICAL"
                                ? "Rate / Kg"
                                : formData.module === "REXINE"
                                  ? "Rate / Meter"
                                  : "Price / Unit"}
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.rate}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  rate: e.target.value,
                                })
                              }
                              required={!editingEntry}
                            />
                          </div>
                        </div>
                      )}

                      {formData.module === "LABOR" && (
                        <div className="relative">
                          <Label>Labor</Label>
                          <Input
                            value={laborSearch}
                            onChange={(e) => {
                              const value = e.target.value;
                              setLaborSearch(value);
                              const exact = labors.find(
                                (labor) =>
                                  labor.name.toLowerCase() ===
                                  value.trim().toLowerCase(),
                              );
                              setFormData({
                                ...formData,
                                laborId: exact?.id ?? "",
                              });
                              setShowLaborSuggestions(true);
                            }}
                            onFocus={() => setShowLaborSuggestions(true)}
                            onBlur={() => {
                              setTimeout(() => {
                                setShowLaborSuggestions(false);
                                const exact = labors.find(
                                  (labor) =>
                                    labor.name.toLowerCase() ===
                                    laborSearch.trim().toLowerCase(),
                                );
                                if (!exact) {
                                  setFormData((prev) => ({
                                    ...prev,
                                    laborId: "",
                                  }));
                                }
                              }, 120);
                            }}
                            placeholder="Type labor name..."
                          />
                          {showLaborSuggestions && laborSearch.trim() && (
                            <div className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background p-1 shadow-md">
                              {filteredLaborOptions.length === 0 ? (
                                <div className="px-2 py-2 text-xs text-muted-foreground">
                                  No labor found
                                </div>
                              ) : (
                                filteredLaborOptions.map((labor) => (
                                  <button
                                    type="button"
                                    key={labor.id}
                                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      setFormData({
                                        ...formData,
                                        laborId: labor.id,
                                      });
                                      setLaborSearch(labor.name);
                                      setShowLaborSuggestions(false);
                                    }}
                                  >
                                    {labor.name}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {formData.module === "LABOR" && formData.laborId && (
                        <div className="rounded border p-3 text-sm">
                          {isLoadingLaborSummary ? (
                            <p className="text-muted-foreground">
                              Loading labor summary...
                            </p>
                          ) : selectedLaborSummary ? (
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Net Payable
                                </span>
                                <span>
                                  {formatCurrency(
                                    selectedLaborSummary.netPayable,
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Already Paid
                                </span>
                                <span>
                                  {formatCurrency(
                                    selectedLaborSummary.totalPaid,
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Pending to Pay
                                </span>
                                <span>
                                  {formatCurrency(
                                    selectedLaborSummary.pendingPayable,
                                  )}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-muted-foreground">
                              No summary available.
                            </p>
                          )}
                        </div>
                      )}

                      <div>
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={
                            formData.module === "CHEMICAL" ||
                            formData.module === "REXINE" ||
                            formData.module === "MATERIAL"
                              ? String(
                                  Number.isFinite(computedPurchaseAmount)
                                    ? computedPurchaseAmount
                                    : 0,
                                )
                              : formData.amount
                          }
                          onChange={(e) =>
                            setFormData({ ...formData, amount: e.target.value })
                          }
                          required={
                            !(
                              formData.module === "CHEMICAL" ||
                              formData.module === "REXINE" ||
                              formData.module === "MATERIAL"
                            )
                          }
                          disabled={
                            formData.module === "CHEMICAL" ||
                            formData.module === "REXINE" ||
                            formData.module === "MATERIAL"
                          }
                        />
                        {formData.module === "BILL" && exceedsBillAmount && (
                          <p className="mt-1 text-xs text-red-600">
                            Amount cannot exceed{" "}
                            {formatCurrency(selectedBillRemaining)} for this
                            bill.
                          </p>
                        )}
                        {formData.module === "SUPPLIER_PAYMENT" &&
                          exceedsSupplierDue && (
                            <p className="mt-1 text-xs text-red-600">
                              Amount cannot exceed{" "}
                              {formatCurrency(selectedSupplierRemainingDue)} for
                              this supplier.
                            </p>
                          )}
                      </div>

                      <div>
                        <Label>Description</Label>
                        <Input
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              description: e.target.value,
                            })
                          }
                          placeholder="Enter description..."
                          required
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={
                            (formData.module === "BILL" && exceedsBillAmount) ||
                            (formData.module === "SUPPLIER_PAYMENT" &&
                              exceedsSupplierDue)
                          }
                        >
                          {editingEntry ? "Update Entry" : "Record Entry"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <div className="rounded border p-4">
                  <p className="text-sm text-muted-foreground">Cash In Today</p>
                  <p className="text-2xl text-green-600">
                    {formatCurrency(cashInToday)}
                  </p>
                </div>
                <div className="rounded border p-4">
                  <p className="text-sm text-muted-foreground">
                    Cash Out Today
                  </p>
                  <p className="text-2xl text-red-600">
                    {formatCurrency(cashOutToday)}
                  </p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Party/Labor</TableHead>
                    <TableHead>Payment Type</TableHead>
                    <TableHead>In/Out</TableHead>
                    <TableHead>Amount</TableHead>
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
                        Loading expenses...
                      </TableCell>
                    </TableRow>
                  ) : filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground"
                      >
                        No expenses recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatTime(entry)}</TableCell>
                        <TableCell>{getReferenceLabel(entry)}</TableCell>
                        <TableCell>{getPartyLaborLabel(entry)}</TableCell>
                        <TableCell>{getPaymentTypeLabel(entry)}</TableCell>
                        <TableCell>{getInOut(Number(entry.amount))}</TableCell>
                        <TableCell>
                          {formatCurrency(Math.abs(Number(entry.amount)))}
                        </TableCell>
                        <TableCell>
                          {entry.source === "MANUAL" ||
                          typeof entry.source === "undefined" ? (
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
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              System
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
