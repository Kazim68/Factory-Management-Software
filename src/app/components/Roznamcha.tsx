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
import { SearchableSelect } from "./ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Filter, Plus } from "lucide-react";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getCurrentDate,
} from "../lib/utils";
import {
  chequeApi,
  expenseApi,
  laborApi,
  partyApi,
  purchaseApi,
  reportsApi,
} from "../lib/api";
import { useClientPagination } from "../hooks/useClientPagination";
import {
  exportTableToExcel,
  exportTableToPdf,
  type ReportExportPayload,
} from "../lib/report";
import { auth } from "../lib/auth";
import type {
  ApiCheque,
  ApiExpenseModule,
  ApiExpenseEntry,
  ApiLaborLedger,
  ApiRoznamchaSummaryReport,
  ApiLaborProfile,
  ApiParty,
  ApiSupplierPendingDue,
} from "../types/api";
import { TablePagination } from "./ui/table-pagination";
import { toast } from "sonner";

const isSupplierLinkedModule = (module: string) =>
  module === "SUPPLIER_PAYMENT" ||
  module === "CHEMICAL" ||
  module === "REXINE" ||
  module === "MATERIAL";

export function Roznamcha() {
  type RoznamchaModule = ApiExpenseModule | "BILL" | "SUPPLIER_PAYMENT";
  type EntryViewFilter =
    | "ALL"
    | "IN_ONLY"
    | "OUT_ONLY"
    | "LABOR_ONLY"
    | "PARTY_ONLY";
  type RoznamchaFormState = {
    date: string;
    module: RoznamchaModule;
    direction: "IN" | "OUT";
    paymentType: "CASH" | "KHATA" | "CHEQUE";
    partyId: string;
    chequeId: string;
    chequeDate: string;
    chequeNumber: string;
    chequeSource: "CUSTOMER" | "OWN";
    laborId: string;
    quantity: string;
    rate: string;
    amount: string;
    description: string;
  };

  const buildFreshFormData = (
    direction: "IN" | "OUT" = "OUT",
  ): RoznamchaFormState => {
    const today = getCurrentDate();
    return {
      date: today,
      module: "MISC",
      direction,
      paymentType: "CASH",
      partyId: "none",
      chequeId: "",
      chequeDate: today,
      chequeNumber: "",
      chequeSource: "CUSTOMER",
      laborId: "",
      quantity: "",
      rate: "",
      amount: "",
      description: "",
    };
  };

  const [entries, setEntries] = useState<ApiExpenseEntry[]>([]);
  const [parties, setParties] = useState<ApiParty[]>([]);
  const [labors, setLabors] = useState<ApiLaborProfile[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [availableCheques, setAvailableCheques] = useState<ApiCheque[]>([]);
  const [isLoadingCheques, setIsLoadingCheques] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ApiExpenseEntry | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [entryFilter, setEntryFilter] = useState<EntryViewFilter>("ALL");
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
  const [roznamchaReportSearch, setRoznamchaReportSearch] = useState("");
  const [roznamchaReport, setRoznamchaReport] =
    useState<ApiRoznamchaSummaryReport | null>(null);
  const [isLoadingRoznamchaReport, setIsLoadingRoznamchaReport] =
    useState(false);
  const [lockedDirection, setLockedDirection] = useState<"IN" | "OUT" | null>(
    null,
  );
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window === "undefined") return "entries";
    return localStorage.getItem("roznamcha.activeSection") || "entries";
  });

  const [formData, setFormData] = useState<RoznamchaFormState>(() =>
    buildFreshFormData(),
  );

  const customerParties = parties.filter((party) => party.type === "CUSTOMER");
  const supplierParties = parties.filter((party) => party.type === "SUPPLIER");
  const getPartyIdForModule = (
    module: RoznamchaModule,
    currentPartyId: string,
  ) => {
    if (module === "BILL") {
      return customerParties.some((party) => party.id === currentPartyId)
        ? currentPartyId
        : "none";
    }

    if (isSupplierLinkedModule(module)) {
      return supplierParties.some((party) => party.id === currentPartyId)
        ? currentPartyId
        : "none";
    }

    return currentPartyId;
  };

  const [filterDate, setFilterDate] = useState(getCurrentDate());
  const sessionUser = auth.getSessionUser();
  const computedPurchaseAmount =
    Number(formData.quantity || 0) * Number(formData.rate || 0);
  const selectedSupplierPendingDue = supplierPendingDues.find(
    (row) => row.partyId === formData.partyId,
  );
  const selectedSupplierRemainingDue = Number(
    selectedSupplierPendingDue?.remainingDue ?? 0,
  );
  const exceedsSupplierDue =
    formData.module === "SUPPLIER_PAYMENT" &&
    !!selectedSupplierPendingDue &&
    Number(formData.amount || 0) > selectedSupplierRemainingDue;
  const isSupplierChequePayment =
    formData.module === "SUPPLIER_PAYMENT" &&
    formData.paymentType === "CHEQUE" &&
    formData.direction === "OUT";
  const isSupplierCustomerCheque =
    isSupplierChequePayment && formData.chequeSource === "CUSTOMER";
  const isSupplierOwnCheque =
    isSupplierChequePayment && formData.chequeSource === "OWN";
  const selectedAvailableCheque = availableCheques.find(
    (cheque) => cheque.id === formData.chequeId,
  );
  const shouldLoadAvailableCheques =
    !editingEntry &&
    isDialogOpen &&
    (formData.module === "MISC" || isSupplierCustomerCheque) &&
    formData.paymentType === "CHEQUE" &&
    formData.direction === "OUT";
  const isChequeOutMode =
    ((formData.module === "MISC" && formData.direction === "OUT") ||
      isSupplierCustomerCheque) &&
    formData.paymentType === "CHEQUE";

  const isRecordInFlow = lockedDirection === "IN" && !editingEntry;
  const isRecordOutFlow = lockedDirection === "OUT" && !editingEntry;

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

  const createLaborRoznamchaEntry = async (laborAmount: number) => {
    const basePayload = {
      date: formData.date,
      laborId: formData.laborId,
      module: "LABOR" as const,
      paymentType: formData.paymentType,
      amount: laborAmount,
      description: formData.description,
      actorUsername: sessionUser?.username,
      actorRole: sessionUser?.role,
    };

    if (formData.paymentType === "KHATA") {
      await expenseApi.createExpense({
        ...basePayload,
        moduleData: {
          laborId: formData.laborId,
          date: formData.date,
          amount: laborAmount,
          reason: formData.description,
        },
      });
      return;
    }

    await expenseApi.createExpense(basePayload);
  };

  const buildExpenseAuditMeta = (entry: ApiExpenseEntry) => ({
    itemLabel: formData.description || getPartyLaborLabel(entry),
    previousValues: {
      amount: entry.amount,
      description: entry.description,
      paymentType: entry.paymentType,
      module: entry.module,
      date: entry.date,
    },
  });

  const replaceExpenseWithLaborEntry = async (
    entry: ApiExpenseEntry,
    laborAmount: number,
  ) => {
    await expenseApi.deleteExpense(entry.id, buildExpenseAuditMeta(entry));
    await createLaborRoznamchaEntry(laborAmount);
  };

  const buildRoznamchaPayload = (
    report: ApiRoznamchaSummaryReport,
  ): ReportExportPayload => {
    const formatModuleLabel = (value: string) =>
      value
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
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
          ...moduleColumns.map(formatModuleLabel),
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
        generatedAt: formatDateTime(new Date()),
        filters: [
          `Period: ${report.period}`,
          `Range: ${formatDate(report.range.start)} - ${formatDate(report.range.end)}`,
        ],
      },
    };
  };

  const toUiPaymentType = (
    entry: Pick<ApiExpenseEntry, "paymentType" | "laborAdvanceId">,
  ): "CASH" | "KHATA" | "CHEQUE" => {
    const normalized = String(entry.paymentType ?? "CASH").toUpperCase();
    if (normalized === "CHEQUE") return "CHEQUE";
    if (normalized !== "CASH" || entry.laborAdvanceId) return "KHATA";
    return "CASH";
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
    if (!shouldLoadAvailableCheques) {
      setAvailableCheques([]);
      setIsLoadingCheques(false);
      return;
    }

    let active = true;
    setIsLoadingCheques(true);
    chequeApi
      .listAvailableCheques()
      .then((cheques) => {
        if (!active) return;
        setAvailableCheques(cheques);
        const stillValid = cheques.some((row) => row.id === formData.chequeId);
        if (!stillValid) {
          setFormData((prev) => ({ ...prev, chequeId: "" }));
        }
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          toast.error("Failed to load available cheques.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingCheques(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    shouldLoadAvailableCheques,
    formData.chequeId,
  ]);

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
    if (isSupplierCustomerCheque && selectedAvailableCheque) return;

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
    isSupplierCustomerCheque,
    selectedAvailableCheque,
  ]);

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
        if (formData.module === "LABOR") {
          if (!Number.isFinite(amount) || amount <= 0) {
            toast.error("Enter a valid amount.");
            return;
          }
          if (!formData.laborId) {
            toast.error("Select a labor.");
            return;
          }

          if (editingEntry.laborAdvanceId) {
            if (formData.paymentType === "KHATA") {
              await laborApi.updateAdvance(editingEntry.laborAdvanceId, {
                laborId: formData.laborId,
                date: formData.date,
                amount,
                reason: formData.description,
                paymentType: "KHATA",
              });
            } else {
              await replaceExpenseWithLaborEntry(editingEntry, amount);
            }
          } else if (formData.paymentType === "KHATA") {
            await replaceExpenseWithLaborEntry(editingEntry, amount);
          } else {
            await expenseApi.updateExpense(
              editingEntry.id,
              {
                date: formData.date,
                laborId: formData.laborId,
                module: "LABOR",
                paymentType: "CASH",
                amount,
                description: formData.description,
              },
              buildExpenseAuditMeta(editingEntry),
            );
          }
        } else {
          await expenseApi.updateExpense(
            editingEntry.id,
            {
              date: formData.date,
              partyId:
                formData.partyId === "none" ? undefined : formData.partyId,
              laborId:
                formData.module === "LABOR" ? formData.laborId : undefined,
              module:
                formData.module === "BILL" ||
                formData.module === "SUPPLIER_PAYMENT"
                  ? "MISC"
                  : formData.module,
              paymentType: formData.paymentType,
              amount,
              description: formData.description,
            },
            buildExpenseAuditMeta(editingEntry),
          );
        }
        toast.success("Expense updated");
      } else if (formData.module === "BILL") {
        if (!formData.partyId || formData.partyId === "none") {
          toast.error("Select a customer.");
          return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
          toast.error("Enter a valid amount.");
          return;
        }

        await partyApi.createPayment(formData.partyId, {
          amount,
          date: formData.date,
          method: formData.paymentType,
          direction: "RECEIVE",
          chequeDate:
            formData.paymentType === "CHEQUE"
              ? formData.chequeDate || formData.date
              : undefined,
          chequeNumber:
            formData.paymentType === "CHEQUE"
              ? formData.chequeNumber || undefined
              : undefined,
          description: formData.description || undefined,
        });
        toast.success("Customer payment recorded");
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
          method: formData.paymentType,
          direction: "PAY",
          description: formData.description || undefined,
          chequeDate:
            formData.paymentType === "CHEQUE"
              ? formData.chequeDate || formData.date
              : undefined,
          chequeId:
            isSupplierCustomerCheque
              ? formData.chequeId || undefined
              : undefined,
          chequeNumber:
            isSupplierOwnCheque ? formData.chequeNumber || undefined : undefined,
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
          toast.error("Select a labor.");
          return;
        }
        await createLaborRoznamchaEntry(amount);
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
          chequeId:
            formData.paymentType === "CHEQUE" && formData.direction === "OUT"
              ? formData.chequeId || undefined
              : undefined,
          actorUsername: sessionUser?.username,
          actorRole: sessionUser?.role,
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
    setFormData(buildFreshFormData());
    setSelectedLaborSummary(null);
    setEditingEntry(null);
    setLockedDirection(null);
  };

  const startEdit = (entry: ApiExpenseEntry) => {
    setLockedDirection(null);
    setEditingEntry(entry);
    const isCustomerReceipt =
      entry.sourceSystem === "BILL_PAYMENT_RECEIVED" ||
      (entry.sourceSystem === "PARTY_PAYMENT_RECEIVED" &&
        entry.party?.type === "CUSTOMER");
    const isLaborEntry =
      entry.module === "LABOR" || !!entry.laborId || !!entry.laborAdvanceId;
    setFormData({
      date: entry.date.slice(0, 10),
      module: isCustomerReceipt ? "BILL" : isLaborEntry ? "LABOR" : "MISC",
      direction: Number(entry.amount) < 0 ? "IN" : "OUT",
      paymentType: toUiPaymentType(entry),
      partyId: entry.partyId || "none",
      chequeId: "",
      chequeDate: entry.date.slice(0, 10),
      chequeNumber: "",
      chequeSource: "CUSTOMER",
      laborId: entry.laborId || entry.laborAdvance?.laborId || "",
      quantity: "",
      rate: "",
      amount: String(Math.abs(Number(entry.amount ?? 0))),
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

  const getPartyLaborLabel = (entry: ApiExpenseEntry) => {
    const sourceSystem = String(entry.sourceSystem ?? "").toUpperCase();
    if (
      (sourceSystem === "B_MALL_SALE" || sourceSystem === "C_MALL_SALE") &&
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

  const getReferenceLabel = (entry: ApiExpenseEntry) => {
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

  const getInOut = (amount: number) => (amount < 0 ? "In" : "Out");
  const getPaymentTypeLabel = (entry: ApiExpenseEntry) =>
    String(entry.paymentType ?? "CASH").toUpperCase() === "CHEQUE"
      ? "Cheque"
      : String(entry.paymentType ?? "CASH").toUpperCase() === "CASH"
        ? "Cash"
        : "Khata";

  const formatTime = (entry: ApiExpenseEntry) => {
    const value = entry.createdAt || entry.date;
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActorLabel = (entry: ApiExpenseEntry) => {
    const sourceSystem = String(entry.sourceSystem ?? "");
    const taggedActor = sourceSystem.match(
      /^ROZNAMCHA_MANUAL(?:\|([^|]+)\|([^|]+))?$/,
    );

    if (taggedActor?.[1] && taggedActor?.[2]) {
      return `${taggedActor[1]} (${taggedActor[2]})`;
    }

    if (entry.source === "MANUAL" || typeof entry.source === "undefined") {
      if (sessionUser?.username && sessionUser?.role) {
        return `${sessionUser.username} (${sessionUser.role})`;
      }
      return "Manual Entry";
    }

    return "System";
  };

  const openCreateDialog = (direction: "IN" | "OUT") => {
    setFormData(buildFreshFormData(direction));
    setSelectedLaborSummary(null);
    setEditingEntry(null);
    setLockedDirection(direction);
    setIsDialogOpen(true);
  };

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
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
      }),
    [entries, entryFilter, searchQuery],
  );

  const reportBuckets = useMemo(
    () => roznamchaReport?.buckets ?? [],
    [roznamchaReport],
  );
  const laborOptions = useMemo(
    () =>
      labors
        .map((labor) => ({
          value: labor.id,
          label: labor.name,
          description: labor.department || undefined,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [labors],
  );

  const filteredReportBuckets = useMemo(() => {
    const query = roznamchaReportSearch.trim().toLowerCase();
    if (!query) return reportBuckets;

    return reportBuckets.filter((bucket) => {
      const moduleLabels = Object.entries(bucket.moduleBreakdown ?? {})
        .map(([module, amount]) => `${module} ${amount}`)
        .join(" ");

      return [
        bucket.key,
        String(bucket.totalInflow ?? ""),
        String(bucket.totalOutflow ?? ""),
        String(bucket.netCashFlow ?? ""),
        String(bucket.entryCount ?? ""),
        moduleLabels,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [reportBuckets, roznamchaReportSearch]);

  const {
    currentPage: reportPage,
    setCurrentPage: setReportPage,
    pageSize: reportPageSize,
    setPageSize: setReportPageSize,
    totalPages: reportTotalPages,
    totalItems: reportTotalItems,
    startItem: reportStartItem,
    endItem: reportEndItem,
    paginatedItems: paginatedReportBuckets,
    goToPreviousPage: goToPreviousReportPage,
    goToNextPage: goToNextReportPage,
  } = useClientPagination(filteredReportBuckets);

  const {
    currentPage: entriesPage,
    setCurrentPage: setEntriesPage,
    pageSize: entriesPageSize,
    setPageSize: setEntriesPageSize,
    totalPages: entriesTotalPages,
    totalItems: entriesTotalItems,
    startItem: entriesStartItem,
    endItem: entriesEndItem,
    paginatedItems: paginatedEntries,
    goToPreviousPage: goToPreviousEntriesPage,
    goToNextPage: goToNextEntriesPage,
  } = useClientPagination(filteredEntries);

  const customerChequeOptions = useMemo(
    () => [
      { value: "none", label: "Select cheque" },
      ...availableCheques.map((cheque) => ({
        value: cheque.id,
        label: `${cheque.sourceParty?.name || "Own"} - ${formatCurrency(Number(cheque.amount ?? 0))}${cheque.chequeNumber ? ` - ${cheque.chequeNumber}` : ""}`,
      })),
    ],
    [availableCheques],
  );

  const clearEntryFilters = () => {
    setFilterDate(getCurrentDate());
    setSearchQuery("");
    setEntryFilter("ALL");
  };

  const clearReportFilters = () => {
    setRoznamchaReportPeriod("daily");
    setRoznamchaReportStart("");
    setRoznamchaReportEnd(getCurrentDate());
    setRoznamchaReportSearch("");
  };

  const customerPartyOptions = useMemo(
    () => customerParties.map((party) => ({ value: party.id, label: party.name })),
    [customerParties],
  );

  const supplierPartyOptions = useMemo(() => {
    const pendingByPartyId = new Map(
      supplierPendingDues.map((row) => [
        row.partyId,
        Number(row.remainingDue ?? 0),
      ]),
    );

    return supplierParties.map((party) => {
      const remainingDue = pendingByPartyId.get(party.id);
      return {
        value: party.id,
        label: party.name,
        description:
          typeof remainingDue === "number"
            ? `Remaining ${formatCurrency(remainingDue)}`
            : "No pending due",
      };
    });
  }, [supplierParties, supplierPendingDues]);

  const generalPartyOptions = useMemo(
    () => [
      { value: "none", label: "No party" },
      ...parties.map((party) => ({
        value: party.id,
        label: party.name,
        description: party.type === "CUSTOMER" ? "Customer" : "Supplier",
      })),
    ],
    [parties],
  );

  const activePartyOptions = useMemo(() => {
    if (formData.module === "BILL") return customerPartyOptions;
    if (isSupplierLinkedModule(formData.module)) return supplierPartyOptions;
    return generalPartyOptions;
  }, [
    customerPartyOptions,
    formData.module,
    generalPartyOptions,
    supplierPartyOptions,
  ]);

  const partyFieldLabel =
    formData.module === "BILL"
      ? "Customer"
      : isSupplierLinkedModule(formData.module)
        ? "Supplier"
        : "Party";

  const partyFieldPlaceholder =
    formData.module === "BILL"
      ? "Select customer"
      : isSupplierLinkedModule(formData.module)
        ? "Select supplier"
        : "Select party";

  const partyFieldSearchPlaceholder =
    formData.module === "BILL"
      ? "Search customer..."
      : isSupplierLinkedModule(formData.module)
        ? "Search supplier..."
        : "Search party...";

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
                <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
                  <div className="min-w-[240px] flex-1 md:max-w-[320px]">
                    <Label className="mb-1 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                      Search
                    </Label>
                    <Input
                      value={roznamchaReportSearch}
                      onChange={(e) =>
                        setRoznamchaReportSearch(e.target.value)
                      }
                      placeholder="Search period, totals, entries..."
                    />
                  </div>
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
                    type="button"
                    variant="ghost"
                    onClick={clearReportFilters}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Reset Filters
                  </Button>
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
                      {filteredReportBuckets.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center text-muted-foreground"
                          >
                            {reportBuckets.length === 0
                              ? "No report data found."
                              : "No report rows match the current filters."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedReportBuckets.map((bucket) => (
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
                  <TablePagination
                    currentPage={reportPage}
                    totalPages={reportTotalPages}
                    totalItems={reportTotalItems}
                    startItem={reportStartItem}
                    endItem={reportEndItem}
                    pageSize={reportPageSize}
                    setPageSize={setReportPageSize}
                    goToPreviousPage={goToPreviousReportPage}
                    goToNextPage={goToNextReportPage}
                    setCurrentPage={setReportPage}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries" className="space-y-0">
          <Card>
            <CardHeader>
              <div className="flex items-end justify-between gap-4">
                <div className="flex flex-1 flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearEntryFilters}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Reset Filters
                  </Button>
                </div>
                <Dialog
                  open={isDialogOpen}
                  onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                  }}
                >
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
                              setFormData({
                                ...formData,
                                date: e.target.value,
                                chequeDate:
                                  formData.chequeDate === formData.date
                                    ? e.target.value
                                    : formData.chequeDate,
                              })
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
                              setFormData((prev) => {
                                const nextPartyId = getPartyIdForModule(
                                  nextModule,
                                  prev.partyId,
                                );
                                if (isRecordInFlow) {
                                  return {
                                    ...prev,
                                    module: nextModule,
                                    direction: "IN",
                                    paymentType: "CASH",
                                    partyId: nextPartyId,
                                    chequeId: "",
                                    chequeDate: prev.date,
                                    chequeNumber: "",
                                    chequeSource: "CUSTOMER",
                                  };
                                }

                                return {
                                  ...prev,
                                  module: nextModule,
                                  direction:
                                    nextModule === "BILL"
                                      ? "IN"
                                      : nextModule === "SUPPLIER_PAYMENT"
                                        ? "OUT"
                                        : prev.direction,
                                  paymentType:
                                    nextModule === "MISC"
                                      ? "CASH"
                                      : nextModule === "BILL"
                                        ? "CASH"
                                        : nextModule === "SUPPLIER_PAYMENT"
                                          ? "CASH"
                                          : prev.paymentType,
                                  chequeId:
                                    nextModule === "MISC" ? prev.chequeId : "",
                                  chequeDate: prev.date,
                                  chequeNumber: "",
                                  chequeSource: "CUSTOMER",
                                  partyId: nextPartyId,
                                  amount:
                                    nextModule === "SUPPLIER_PAYMENT"
                                      ? ""
                                      : prev.amount,
                                };
                              });
                            }}
                            disabled={!!editingEntry?.laborAdvanceId}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MISC">Misc</SelectItem>
                              {!isRecordOutFlow && (
                                <SelectItem value="BILL">Customer</SelectItem>
                              )}
                              {!isRecordInFlow && (
                                <>
                                  <SelectItem value="SUPPLIER_PAYMENT">
                                    Parties (Suppliers)
                                  </SelectItem>
                                  {!isRecordOutFlow && (
                                    <>
                                      <SelectItem value="CHEMICAL">
                                        Chemical
                                      </SelectItem>
                                      <SelectItem value="REXINE">
                                        Rexine
                                      </SelectItem>
                                      <SelectItem value="MATERIAL">
                                        Material
                                      </SelectItem>
                                    </>
                                  )}
                                  <SelectItem
                                    value="LABOR"
                                    disabled={
                                      !!editingEntry &&
                                      !editingEntry.laborAdvanceId
                                    }
                                  >
                                    Labor
                                  </SelectItem>
                                </>
                              )}
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
                              !!lockedDirection ||
                              formData.module === "BILL" ||
                              formData.module === "LABOR"
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
                            onValueChange={(
                              value: "CASH" | "KHATA" | "CHEQUE",
                            ) =>
                              setFormData({
                                ...formData,
                                paymentType: value,
                                chequeId:
                                  value === "CHEQUE" ? formData.chequeId : "",
                                chequeDate:
                                  value === "CHEQUE"
                                    ? formData.chequeDate || formData.date
                                    : formData.date,
                                chequeNumber:
                                  value === "CHEQUE"
                                    ? formData.chequeNumber
                                    : "",
                                chequeSource:
                                  value === "CHEQUE"
                                    ? formData.chequeSource
                                    : "CUSTOMER",
                              })
                            }
                            disabled={
                              isRecordInFlow
                                ? formData.module === "MISC"
                                : isRecordOutFlow &&
                                  formData.module === "MISC"
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CASH">Cash</SelectItem>
                              {!isRecordInFlow &&
                                formData.module === "LABOR" && (
                                  <SelectItem value="KHATA">Khata</SelectItem>
                                )}
                              {((!isRecordInFlow &&
                                formData.module === "SUPPLIER_PAYMENT") ||
                                formData.module === "BILL") && (
                                <SelectItem value="CHEQUE">Cheque</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {formData.module === "BILL" &&
                        formData.paymentType === "CHEQUE" && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Cheque Number</Label>
                              <Input
                                value={formData.chequeNumber}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    chequeNumber: e.target.value,
                                  })
                                }
                                placeholder="Optional cheque number"
                              />
                            </div>
                            <div>
                              <Label>Cheque Cash Date</Label>
                              <Input
                                type="date"
                                value={formData.chequeDate}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    chequeDate: e.target.value,
                                  })
                                }
                                required
                              />
                            </div>
                          </div>
                        )}

                      {!isRecordInFlow && isSupplierChequePayment && (
                        <div className="space-y-3">
                          <div>
                            <Label>Cheque Source</Label>
                            <Select
                              value={formData.chequeSource}
                              onValueChange={(value: "CUSTOMER" | "OWN") =>
                                setFormData({
                                  ...formData,
                                  chequeSource: value,
                                  chequeId: value === "CUSTOMER" ? formData.chequeId : "",
                                  chequeDate:
                                    value === "OWN"
                                      ? formData.chequeDate || formData.date
                                      : formData.chequeDate,
                                  chequeNumber:
                                    value === "OWN" ? formData.chequeNumber : "",
                                  amount:
                                    value === "OWN"
                                      ? selectedSupplierPendingDue
                                        ? String(
                                            Number(
                                              selectedSupplierPendingDue.remainingDue ??
                                                0,
                                            ),
                                          )
                                        : formData.amount
                                      : formData.amount,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CUSTOMER">
                                  Customer Cheque
                                </SelectItem>
                                <SelectItem value="OWN">Own Cheque</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {isSupplierCustomerCheque && (
                            <div className="space-y-2">
                              <Label>Select Cheque</Label>
                              <SearchableSelect
                                value={formData.chequeId || "none"}
                                onValueChange={(value) => {
                                  const nextChequeId =
                                    value === "none" ? "" : value;
                                  const nextCheque = availableCheques.find(
                                    (row) => row.id === nextChequeId,
                                  );
                                  setFormData({
                                    ...formData,
                                    chequeId: nextChequeId,
                                    amount: nextCheque
                                      ? String(Number(nextCheque.amount ?? 0))
                                      : "",
                                  });
                                }}
                                options={customerChequeOptions}
                                disabled={isLoadingCheques}
                                placeholder={
                                  isLoadingCheques
                                    ? "Loading available cheques..."
                                    : "Select cheque"
                                }
                                searchPlaceholder="Search cheque..."
                                emptyMessage="No cheques found."
                              />
                              {selectedAvailableCheque && (
                                <div className="rounded border p-3 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      From
                                    </span>
                                    <span>
                                      {selectedAvailableCheque.sourceParty?.name ||
                                        "Own / Unlinked"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Cheque Date
                                    </span>
                                    <span>
                                      {formatDate(selectedAvailableCheque.date)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Cheque Amount
                                    </span>
                                    <span>
                                      {formatCurrency(
                                        Number(
                                          selectedAvailableCheque.amount ?? 0,
                                        ),
                                      )}
                                    </span>
                                  </div>
                                  {selectedAvailableCheque.chequeNumber && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        Cheque Number
                                      </span>
                                      <span>
                                        {selectedAvailableCheque.chequeNumber}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {isSupplierOwnCheque && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Cheque Number</Label>
                                <Input
                                  value={formData.chequeNumber}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      chequeNumber: e.target.value,
                                    })
                                  }
                                  placeholder="Optional cheque number"
                                />
                              </div>
                              <div>
                                <Label>Cheque Cash Date</Label>
                                <Input
                                  type="date"
                                  value={formData.chequeDate}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      chequeDate: e.target.value,
                                    })
                                  }
                                  required
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {formData.module === "BILL" ||
                      formData.module === "SUPPLIER_PAYMENT" ||
                      formData.module === "CHEMICAL" ||
                      formData.module === "MATERIAL" ||
                      formData.module === "REXINE" ? (
                        <div>
                          <Label>{partyFieldLabel}</Label>
                          <SearchableSelect
                            key={`party-${formData.module}`}
                            value={formData.partyId}
                            onValueChange={(value) =>
                              setFormData({
                                ...formData,
                                partyId: value,
                              })
                            }
                            options={activePartyOptions}
                            placeholder={partyFieldPlaceholder}
                            searchPlaceholder={partyFieldSearchPlaceholder}
                            emptyMessage="No matching parties found."
                            disabled={activePartyOptions.length === 0}
                          />
                        </div>
                      ) : null}

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
                              No pending due for this supplier yet.
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
                        <div>
                          <Label>Labor</Label>
                          <SearchableSelect
                            value={formData.laborId}
                            onValueChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                laborId: value,
                              }))
                            }
                            options={laborOptions}
                            placeholder={
                              laborOptions.length === 0
                                ? "No labor profiles found"
                                : "Select labor"
                            }
                            searchPlaceholder="Search labor..."
                            emptyMessage="No labor found."
                            disabled={laborOptions.length === 0}
                          />
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
                            formData.module === "MATERIAL" ||
                            isChequeOutMode
                          }
                        />
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
                            (formData.module === "LABOR" &&
                              !formData.laborId) ||
                            (formData.module === "SUPPLIER_PAYMENT" &&
                              exceedsSupplierDue) ||
                            (formData.module === "SUPPLIER_PAYMENT" &&
                              formData.paymentType === "CHEQUE" &&
                              formData.direction === "OUT" &&
                              ((isSupplierCustomerCheque &&
                                !formData.chequeId) ||
                                (isSupplierOwnCheque &&
                                  !formData.chequeDate))) ||
                            (formData.module === "BILL" &&
                              formData.paymentType === "CHEQUE" &&
                              !formData.chequeDate)
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
                  <Button
                    className="mt-3"
                    variant="outline"
                    onClick={() => openCreateDialog("IN")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Record In
                  </Button>
                </div>
                <div className="rounded border p-4">
                  <p className="text-sm text-muted-foreground">
                    Cash Out Today
                  </p>
                  <p className="text-2xl text-red-600">
                    {formatCurrency(cashOutToday)}
                  </p>
                  <Button
                    className="mt-3"
                    onClick={() => openCreateDialog("OUT")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Record Out
                  </Button>
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
                    <TableHead>By User</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground"
                      >
                        Loading expenses...
                      </TableCell>
                    </TableRow>
                  ) : filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground"
                      >
                        No expenses recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatTime(entry)}</TableCell>
                        <TableCell>{getReferenceLabel(entry)}</TableCell>
                        <TableCell>{getPartyLaborLabel(entry)}</TableCell>
                        <TableCell>{getPaymentTypeLabel(entry)}</TableCell>
                        <TableCell>{getInOut(Number(entry.amount))}</TableCell>
                        <TableCell>
                          {formatCurrency(Math.abs(Number(entry.amount)))}
                        </TableCell>
                        <TableCell>{getActorLabel(entry)}</TableCell>
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
              <TablePagination
                currentPage={entriesPage}
                totalPages={entriesTotalPages}
                totalItems={entriesTotalItems}
                startItem={entriesStartItem}
                endItem={entriesEndItem}
                pageSize={entriesPageSize}
                setPageSize={setEntriesPageSize}
                goToPreviousPage={goToPreviousEntriesPage}
                goToNextPage={goToNextEntriesPage}
                setCurrentPage={setEntriesPage}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
