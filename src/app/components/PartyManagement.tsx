import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useClientPagination } from "../hooks/useClientPagination";
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
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { TablePagination } from "./ui/table-pagination";
import { Filter, Plus, Eye, Printer } from "lucide-react";
import {
  exportTableToPdf,
  type ReportExportPayload,
} from "../lib/report";
import { printBillInvoice } from "../lib/bill-print";
import { getPresetDateRange } from "../lib/time-presets";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getCurrentDate,
  toPakistanBoundaryDate,
} from "../lib/utils";
import { billApi, chequeApi, partyApi, purchaseApi } from "../lib/api";
import { SupplierCombinedPurchase } from "./SupplierPurchaseSection";
import type {
  ApiBill,
  ApiCheque,
  ApiChemicalPurchase,
  ApiMaterialPurchase,
  ApiPartyLedgerEntry,
  ApiPaymentMethod,
  ApiRexinePurchase,
} from "../types/api";
import { toast } from "sonner";

type UiParty = {
  id: string;
  name: string;
  type: "customer" | "supplier";
  currentBalance: number;
  createdAt: string;
};

type LedgerEntryFilter = "ALL" | "PAYABLE" | "RECEIVABLE" | "CASH";
type CustomerBillsFilterPreset =
  | "ALL"
  | "TODAY"
  | "THIS_WEEK"
  | "THIS_MONTH"
  | "CUSTOM";
type ProfileViewTab = "ledger" | "bills" | "purchases";

type SupplierProfilePurchaseRecord = {
  id: string;
  date: string;
  type: "CHEMICAL" | "REXINE" | "MATERIAL";
  itemName: string;
  quantityLabel: string;
  rateLabel: string;
  totalAmount: number;
  paymentType: ApiPaymentMethod;
  description: string;
};

const getLedgerReferenceLabel = (
  entry: Pick<ApiPartyLedgerEntry, "reference" | "description">,
) => {
  const parts = [entry.reference?.trim(), entry.description?.trim()].filter(
    Boolean,
  ) as string[];
  return parts.length > 0 ? parts.join(" - ") : "-";
};

const CUSTOMER_BILLS_FILTER_OPTIONS: Array<{
  value: CustomerBillsFilterPreset;
  label: string;
}> = [
  { value: "ALL", label: "All Dates" },
  { value: "TODAY", label: "Today" },
  { value: "THIS_WEEK", label: "This Week" },
  { value: "THIS_MONTH", label: "This Month" },
  { value: "CUSTOM", label: "Custom Date" },
];

const getCustomerBillsFilterLabel = (preset: CustomerBillsFilterPreset) =>
  CUSTOMER_BILLS_FILTER_OPTIONS.find((option) => option.value === preset)
    ?.label ?? preset;

const getCustomerBillsPresetRange = (
  preset: CustomerBillsFilterPreset,
  now: Date,
) => {
  if (preset === "TODAY") {
    return getPresetDateRange("DAILY", now);
  }

  if (preset === "THIS_WEEK") {
    return getPresetDateRange("WEEKLY", now);
  }

  if (preset === "THIS_MONTH") {
    return getPresetDateRange("THIS_MONTH", now);
  }

  return null;
};

const sortBillsDescending = (bills: ApiBill[]) =>
  [...bills].sort((left, right) => {
    const byDate =
      new Date(right.date).getTime() - new Date(left.date).getTime();
    if (byDate !== 0) return byDate;
    return String(right.billNumber).localeCompare(String(left.billNumber));
  });

const sortSupplierPurchasesDescending = (
  purchases: SupplierProfilePurchaseRecord[],
) =>
  [...purchases].sort((left, right) => {
    const byDate =
      new Date(right.date).getTime() - new Date(left.date).getTime();
    if (byDate !== 0) return byDate;
    return String(right.id).localeCompare(String(left.id));
  });

const toPurchaseTypeLabel = (
  value: SupplierProfilePurchaseRecord["type"],
) =>
  value
    .toLowerCase()
    .replace(
      /(^|_)([a-z])/g,
      (_, prefix: string, letter: string) =>
        `${prefix === "_" ? " " : ""}${letter.toUpperCase()}`,
    );

const formatSupplierPurchasePaymentLabel = (value: ApiPaymentMethod) => {
  const normalized = String(value ?? "KHATA").toUpperCase();
  if (normalized === "KHATA" || normalized === "CREDIT") return "Khata";
  if (normalized === "CHEQUE") return "Cheque";
  if (normalized === "BANK") return "Bank";
  return "Cash";
};

const mapChemicalPurchaseToProfileRecord = (
  entry: ApiChemicalPurchase,
): SupplierProfilePurchaseRecord => ({
  id: entry.id,
  date: entry.date,
  type: "CHEMICAL",
  itemName: "Raw Material",
  quantityLabel: `${Number(entry.quantityKg)} kg`,
  rateLabel: `${formatCurrency(Number(entry.ratePerKg ?? 0))}/kg`,
  totalAmount: Number(entry.totalAmount ?? 0),
  paymentType: entry.paymentType,
  description: entry.expenses?.[0]?.description || "",
});

const mapRexinePurchaseToProfileRecord = (
  entry: ApiRexinePurchase,
): SupplierProfilePurchaseRecord => ({
  id: entry.id,
  date: entry.date,
  type: "REXINE",
  itemName: "Raw Material",
  quantityLabel: `${Number(entry.quantityMeter)} meter`,
  rateLabel: `${formatCurrency(Number(entry.ratePerMeter ?? 0))}/meter`,
  totalAmount: Number(entry.totalAmount ?? 0),
  paymentType: entry.paymentType,
  description: entry.expenses?.[0]?.description || "",
});

const mapMaterialPurchaseToProfileRecord = (
  entry: ApiMaterialPurchase,
): SupplierProfilePurchaseRecord => {
  const unitLabel = entry.unit?.symbol || entry.unit?.name || "unit";
  return {
    id: entry.id,
    date: entry.date,
    type: "MATERIAL",
    itemName: entry.article?.name || "-",
    quantityLabel: `${Number(entry.quantity)} ${unitLabel}`,
    rateLabel: `${formatCurrency(Number(entry.pricePerUnit ?? 0))}/${unitLabel}`,
    totalAmount: Number(entry.totalAmount ?? 0),
    paymentType: entry.paymentType,
    description: entry.expenses?.[0]?.description || "",
  };
};

export function PartyManagement({
  partyType,
}: {
  partyType: "customer" | "supplier";
}) {
  const [parties, setParties] = useState<UiParty[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingPartyId, setViewingPartyId] = useState<string | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentPartyId, setPaymentPartyId] = useState<string | null>(null);
  const [paymentBills, setPaymentBills] = useState<ApiBill[]>([]);
  const [availableCheques, setAvailableCheques] = useState<ApiCheque[]>([]);
  const [isLoadingPaymentBills, setIsLoadingPaymentBills] = useState(false);
  const [isLoadingCheques, setIsLoadingCheques] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<ApiPartyLedgerEntry[]>([]);
  const [customerBills, setCustomerBills] = useState<ApiBill[]>([]);
  const [isLoadingCustomerBills, setIsLoadingCustomerBills] = useState(false);
  const [supplierPurchases, setSupplierPurchases] = useState<
    SupplierProfilePurchaseRecord[]
  >([]);
  const [isLoadingSupplierPurchases, setIsLoadingSupplierPurchases] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [partyDialogType, setPartyDialogType] = useState<
    "customer" | "supplier"
  >(partyType);
  const [partySearchQuery, setPartySearchQuery] = useState("");
  const [partyBalanceFilter, setPartyBalanceFilter] = useState<
    "ALL" | "POSITIVE" | "NEGATIVE" | "ZERO"
  >("ALL");
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState("");
  const [ledgerEntryFilter, setLedgerEntryFilter] =
    useState<LedgerEntryFilter>("ALL");
  const [ledgerDateFrom, setLedgerDateFrom] = useState("");
  const [ledgerDateTo, setLedgerDateTo] = useState("");
  const [profileViewTab, setProfileViewTab] = useState<ProfileViewTab>("ledger");
  const [customerBillsSearchQuery, setCustomerBillsSearchQuery] = useState("");
  const [customerBillsFilterPreset, setCustomerBillsFilterPreset] =
    useState<CustomerBillsFilterPreset>("ALL");
  const [customerBillsDateFrom, setCustomerBillsDateFrom] = useState("");
  const [customerBillsDateTo, setCustomerBillsDateTo] = useState("");
  const [supplierPurchasesSearchQuery, setSupplierPurchasesSearchQuery] =
    useState("");
  const [supplierPurchasesFilterPreset, setSupplierPurchasesFilterPreset] =
    useState<CustomerBillsFilterPreset>("ALL");
  const [supplierPurchasesDateFrom, setSupplierPurchasesDateFrom] =
    useState("");
  const [supplierPurchasesDateTo, setSupplierPurchasesDateTo] = useState("");

  const [formData, setFormData] = useState({
    name: "",
  });

  const [paymentData, setPaymentData] = useState({
    date: getCurrentDate(),
    amount: "",
    method: "KHATA" as ApiPaymentMethod,
    chequeId: "",
    billId: "",
    description: "",
  });

  const mapPartyType = (type: string): UiParty["type"] =>
    String(type).toUpperCase() === "SUPPLIER" ? "supplier" : "customer";

  const computeBalance = (entries: ApiPartyLedgerEntry[]) => {
    let balance = 0;
    for (const entry of entries) {
      const isCash =
        typeof entry.cash !== "undefined" ||
        entry.reference?.toLowerCase().includes("cash") ||
        entry.description?.toLowerCase().includes("cash");
      if (!isCash) {
        balance += Number(entry.receivable ?? 0) - Number(entry.payable ?? 0);
      }
    }
    return balance;
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const apiParties = await partyApi.listParties({
        type: partyType === "supplier" ? "SUPPLIER" : "CUSTOMER",
      });
      const ledgers = await Promise.all(
        apiParties.map((party) => partyApi.getLedger(party.id).catch(() => [])),
      );

      const mapped = apiParties.map((party, index) => ({
        id: party.id,
        name: party.name,
        type: mapPartyType(party.type),
        currentBalance: computeBalance(ledgers[index]),
        createdAt: party.createdAt,
      }));

      setParties(mapped);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load parties.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomerBills = async (partyId: string) => {
    setIsLoadingCustomerBills(true);
    try {
      const allBills = await billApi.listBills();
      setCustomerBills(
        sortBillsDescending(
          allBills.filter((bill) => bill.partyId === partyId),
        ),
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to load customer bills.");
    } finally {
      setIsLoadingCustomerBills(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [partyType]);

  useEffect(() => {
    if (!viewingPartyId) {
      setLedgerEntries([]);
      return;
    }

    let active = true;
    partyApi
      .getLedger(viewingPartyId)
      .then((entries) => {
        if (active) {
          setLedgerEntries(entries);
        }
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          toast.error("Failed to load party ledger.");
        }
      });

    return () => {
      active = false;
    };
  }, [viewingPartyId]);

  useEffect(() => {
    if (!viewingPartyId) {
      setCustomerBills([]);
      setIsLoadingCustomerBills(false);
      return;
    }

    const party = parties.find((item) => item.id === viewingPartyId);
    if (party?.type !== "customer") {
      setCustomerBills([]);
      setIsLoadingCustomerBills(false);
      return;
    }

    let active = true;
    setIsLoadingCustomerBills(true);
    billApi
      .listBills()
      .then((allBills) => {
        if (!active) return;
        setCustomerBills(
          sortBillsDescending(
            allBills.filter((bill) => bill.partyId === viewingPartyId),
          ),
        );
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          toast.error("Failed to load customer bills.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingCustomerBills(false);
        }
      });

    return () => {
      active = false;
    };
  }, [parties, viewingPartyId]);

  useEffect(() => {
    if (!viewingPartyId) {
      setSupplierPurchases([]);
      setIsLoadingSupplierPurchases(false);
      return;
    }

    const party = parties.find((item) => item.id === viewingPartyId);
    if (party?.type !== "supplier") {
      setSupplierPurchases([]);
      setIsLoadingSupplierPurchases(false);
      return;
    }

    let active = true;
    setIsLoadingSupplierPurchases(true);
    Promise.all([
      purchaseApi.listChemicals(),
      purchaseApi.listRexine(),
      purchaseApi.listMaterials(),
    ])
      .then(([chemicalPurchases, rexinePurchases, materialPurchases]) => {
        if (!active) return;

        const filteredPurchases = sortSupplierPurchasesDescending([
          ...chemicalPurchases
            .filter((entry) => entry.partyId === viewingPartyId)
            .map((entry) => mapChemicalPurchaseToProfileRecord(entry)),
          ...rexinePurchases
            .filter((entry) => entry.partyId === viewingPartyId)
            .map((entry) => mapRexinePurchaseToProfileRecord(entry)),
          ...materialPurchases
            .filter((entry) => entry.partyId === viewingPartyId)
            .map((entry) => mapMaterialPurchaseToProfileRecord(entry)),
        ]);

        setSupplierPurchases(filteredPurchases);
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          toast.error("Failed to load supplier purchases.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingSupplierPurchases(false);
        }
      });

    return () => {
      active = false;
    };
  }, [parties, viewingPartyId]);

  useEffect(() => {
    setLedgerSearchQuery("");
    setLedgerEntryFilter("ALL");
    setLedgerDateFrom("");
    setLedgerDateTo("");
    setProfileViewTab("ledger");
    setCustomerBillsSearchQuery("");
    setCustomerBillsFilterPreset("ALL");
    setCustomerBillsDateFrom("");
    setCustomerBillsDateTo("");
    setSupplierPurchasesSearchQuery("");
    setSupplierPurchasesFilterPreset("ALL");
    setSupplierPurchasesDateFrom("");
    setSupplierPurchasesDateTo("");
  }, [viewingPartyId]);

  useEffect(() => {
    if (!isPaymentDialogOpen || !paymentPartyId) {
      setPaymentBills([]);
      setAvailableCheques([]);
      setPaymentData((prev) => ({ ...prev, billId: "", chequeId: "" }));
      return;
    }

    const party = parties.find((p) => p.id === paymentPartyId);
    const isReceive = (party?.currentBalance ?? 0) > 0;
    if (!isReceive) {
      setPaymentBills([]);
      setPaymentData((prev) => ({ ...prev, billId: "" }));
      return;
    }

    let active = true;
    setIsLoadingPaymentBills(true);
    billApi
      .listBills()
      .then((allBills) => {
        if (!active) return;
        const filtered = allBills.filter(
          (bill) =>
            bill.partyId === paymentPartyId && Number(bill.remaining ?? 0) > 0,
        );
        setPaymentBills(filtered);
        const defaultRemaining = Number(filtered[0]?.remaining ?? 0);
        setPaymentData((prev) => ({
          ...prev,
          billId: filtered[0]?.id ?? "",
          amount: filtered[0] ? String(defaultRemaining) : prev.amount,
        }));
      })
      .catch((error) => {
        console.error(error);
        if (active) toast.error("Failed to load bills for this party.");
      })
      .finally(() => {
        if (active) setIsLoadingPaymentBills(false);
      });

    return () => {
      active = false;
    };
  }, [isPaymentDialogOpen, paymentPartyId, parties]);

  useEffect(() => {
    if (!isPaymentDialogOpen || !paymentPartyId) {
      setAvailableCheques([]);
      return;
    }

    const party = parties.find((p) => p.id === paymentPartyId);
    const isReceive = (party?.currentBalance ?? 0) > 0;
    const shouldLoadCheques = !isReceive && paymentData.method === "CHEQUE";
    if (!shouldLoadCheques) {
      setAvailableCheques([]);
      setPaymentData((prev) => ({ ...prev, chequeId: "" }));
      return;
    }

    let active = true;
    setIsLoadingCheques(true);
    chequeApi
      .listAvailableCheques()
      .then((cheques) => {
        if (!active) return;
        setAvailableCheques(cheques);
        const matched = cheques.find(
          (item) => Number(item.amount) === Number(paymentData.amount || 0),
        );
        const fallback = cheques[0];
        const selected = matched ?? fallback;
        setPaymentData((prev) => ({
          ...prev,
          chequeId: selected?.id ?? "",
          amount: selected ? String(Number(selected.amount)) : prev.amount,
        }));
      })
      .catch((error) => {
        console.error(error);
        if (active) toast.error("Failed to load available cheques.");
      })
      .finally(() => {
        if (active) setIsLoadingCheques(false);
      });

    return () => {
      active = false;
    };
  }, [isPaymentDialogOpen, paymentPartyId, parties, paymentData.method]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextType = partyDialogType === "supplier" ? "SUPPLIER" : "CUSTOMER";

    try {
      if (editingId) {
        await partyApi.updateParty(editingId, {
          name: formData.name.trim(),
          type: nextType,
        });
        toast.success("Party updated");
      } else {
        await partyApi.createParty({
          name: formData.name.trim(),
          type: nextType,
        });
        toast.success("Party added");
      }
      await loadData();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save party.");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
    });
    setEditingId(null);
  };

  const handleEdit = (party: UiParty) => {
    setEditingId(party.id);
    setPartyDialogType(party.type);
    setFormData({
      name: party.name,
    });
    setIsDialogOpen(true);
  };

  const openAddPartyDialog = (type: "customer" | "supplier") => {
    setEditingId(null);
    setPartyDialogType(type);
    setFormData({ name: "" });
    setIsDialogOpen(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const party = parties.find((p) => p.id === paymentPartyId);
    if (!party) return;

    const amount = parseFloat(paymentData.amount);
    if (!Number.isFinite(amount)) {
      toast.error("Enter a valid amount.");
      return;
    }

    try {
      const direction = party.currentBalance > 0 ? "RECEIVE" : "PAY";
      const method = paymentData.method;
      if (direction === "RECEIVE" && !paymentData.billId) {
        toast.error("Select a bill to receive payment against.");
        return;
      }
      if (
        direction === "RECEIVE" &&
        selectedPaymentBill &&
        amount > Number(selectedPaymentBill.remaining ?? 0)
      ) {
        return;
      }
      if (direction === "PAY" && method === "CHEQUE" && !paymentData.chequeId) {
        toast.error("Select an available cheque.");
        return;
      }
      await partyApi.createPayment(party.id, {
        date: paymentData.date,
        amount,
        method,
        direction,
        billId: direction === "RECEIVE" ? paymentData.billId : undefined,
        chequeId:
          direction === "PAY" && method === "CHEQUE"
            ? paymentData.chequeId
            : undefined,
        description: paymentData.description || undefined,
      });
      toast.success("Payment recorded");
      const refreshedPartyId = party.id;
      setPaymentData({
        date: getCurrentDate(),
        amount: "",
        method: "KHATA",
        chequeId: "",
        billId: "",
        description: "",
      });
      setIsPaymentDialogOpen(false);
      setPaymentPartyId(null);
      await loadData();
      if (viewingPartyId === refreshedPartyId && party.type === "customer") {
        await loadCustomerBills(refreshedPartyId);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to record payment.");
    }
  };

  const selectedPaymentBill = paymentBills.find(
    (bill) => bill.id === paymentData.billId,
  );
  const selectedPaymentCheque = availableCheques.find(
    (cheque) => cheque.id === paymentData.chequeId,
  );
  const isReceivePayment =
    (parties.find((p) => p.id === paymentPartyId)?.currentBalance ?? 0) > 0;
  const selectedBillRemaining = Number(selectedPaymentBill?.remaining ?? 0);
  const enteredPaymentAmount = Number(paymentData.amount || 0);
  const exceedsBillAmount =
    isReceivePayment &&
    !!selectedPaymentBill &&
    Number.isFinite(enteredPaymentAmount) &&
    enteredPaymentAmount > selectedBillRemaining;
  const chequeAmountMismatch =
    !isReceivePayment &&
    paymentData.method === "CHEQUE" &&
    !!selectedPaymentCheque &&
    Number.isFinite(enteredPaymentAmount) &&
    Math.abs(enteredPaymentAmount - Number(selectedPaymentCheque.amount ?? 0)) >
      0.0001;

  const ledgerWithOpening = useMemo(() => {
    if (!viewingPartyId) return [];
    const party = parties.find((p) => p.id === viewingPartyId);
    if (!party) return ledgerEntries;

    const entriesAsc = [...ledgerEntries].sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      const aCreated = a.createdAt
        ? new Date(a.createdAt).getTime()
        : new Date(a.date).getTime();
      const bCreated = b.createdAt
        ? new Date(b.createdAt).getTime()
        : new Date(b.date).getTime();
      return aCreated - bCreated;
    });
    let runningBalance = 0;
    const withRunning = entriesAsc.map((entry) => {
      const isCash =
        typeof entry.cash !== "undefined" ||
        entry.reference?.toLowerCase().includes("cash") ||
        entry.description?.toLowerCase().includes("cash");
      const cashAmount =
        typeof entry.cash !== "undefined"
          ? Number(entry.cash)
          : isCash
            ? Number(entry.payable ?? entry.receivable ?? 0)
            : 0;
      if (!isCash) {
        runningBalance += Number(entry.balance ?? 0);
      }
      return { ...entry, runningBalance, isCash, cash: cashAmount };
    });
    return withRunning.reverse();
  }, [ledgerEntries, parties, viewingPartyId]);

  const viewingParty = useMemo(
    () => parties.find((party) => party.id === viewingPartyId) ?? null,
    [parties, viewingPartyId],
  );

  const filteredLedgerEntries = useMemo(() => {
    const query = ledgerSearchQuery.trim().toLowerCase();
    const fromTs = ledgerDateFrom
      ? new Date(`${ledgerDateFrom}T00:00:00`).getTime()
      : null;
    const toTs = ledgerDateTo
      ? new Date(`${ledgerDateTo}T23:59:59.999`).getTime()
      : null;

    return ledgerWithOpening.filter((entry) => {
      const entryTs = new Date(entry.date).getTime();
      if (fromTs !== null && (!Number.isFinite(entryTs) || entryTs < fromTs)) {
        return false;
      }
      if (toTs !== null && (!Number.isFinite(entryTs) || entryTs > toTs)) {
        return false;
      }

      if (ledgerEntryFilter === "PAYABLE") {
        if (entry.isCash || Number(entry.payable ?? 0) <= 0) return false;
      } else if (ledgerEntryFilter === "RECEIVABLE") {
        if (entry.isCash || Number(entry.receivable ?? 0) <= 0) return false;
      } else if (ledgerEntryFilter === "CASH") {
        if (!entry.isCash) return false;
      }

      if (!query) return true;

      const haystack = [
        getLedgerReferenceLabel(entry),
        entry.date,
        String(entry.payable ?? ""),
        String(entry.receivable ?? ""),
        String(entry.cash ?? ""),
        String(entry.runningBalance ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [
    ledgerDateFrom,
    ledgerDateTo,
    ledgerEntryFilter,
    ledgerSearchQuery,
    ledgerWithOpening,
  ]);

  const filteredCustomerBills = useMemo(() => {
    const query = customerBillsSearchQuery.trim().toLowerCase();

    let fromTs: number | null = null;
    let toTs: number | null = null;

    if (customerBillsFilterPreset === "CUSTOM") {
      fromTs = customerBillsDateFrom
        ? toPakistanBoundaryDate(customerBillsDateFrom, "start").getTime()
        : null;
      toTs = customerBillsDateTo
        ? toPakistanBoundaryDate(customerBillsDateTo, "end").getTime()
        : null;
    } else if (customerBillsFilterPreset !== "ALL") {
      const range = getCustomerBillsPresetRange(
        customerBillsFilterPreset,
        new Date(),
      );
      fromTs = range?.from.getTime() ?? null;
      toTs = range?.to.getTime() ?? null;
    }

    return customerBills.filter((bill) => {
      const billTs = new Date(bill.date).getTime();
      if (fromTs !== null && (!Number.isFinite(billTs) || billTs < fromTs)) {
        return false;
      }
      if (toTs !== null && (!Number.isFinite(billTs) || billTs > toTs)) {
        return false;
      }

      if (!query) return true;

      return [
        bill.billNumber,
        bill.date,
        bill.paymentStatus,
        String(bill.total ?? ""),
        String(bill.totalPaid ?? ""),
        String(bill.remaining ?? ""),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    customerBills,
    customerBillsDateFrom,
    customerBillsDateTo,
      customerBillsFilterPreset,
      customerBillsSearchQuery,
    ]);

  const filteredSupplierPurchases = useMemo(() => {
    const query = supplierPurchasesSearchQuery.trim().toLowerCase();

    let fromTs: number | null = null;
    let toTs: number | null = null;

    if (supplierPurchasesFilterPreset === "CUSTOM") {
      fromTs = supplierPurchasesDateFrom
        ? toPakistanBoundaryDate(supplierPurchasesDateFrom, "start").getTime()
        : null;
      toTs = supplierPurchasesDateTo
        ? toPakistanBoundaryDate(supplierPurchasesDateTo, "end").getTime()
        : null;
    } else if (supplierPurchasesFilterPreset !== "ALL") {
      const range = getCustomerBillsPresetRange(
        supplierPurchasesFilterPreset,
        new Date(),
      );
      fromTs = range?.from.getTime() ?? null;
      toTs = range?.to.getTime() ?? null;
    }

    return supplierPurchases.filter((purchase) => {
      const purchaseTs = new Date(purchase.date).getTime();
      if (
        fromTs !== null &&
        (!Number.isFinite(purchaseTs) || purchaseTs < fromTs)
      ) {
        return false;
      }
      if (
        toTs !== null &&
        (!Number.isFinite(purchaseTs) || purchaseTs > toTs)
      ) {
        return false;
      }

      if (!query) return true;

      return [
        purchase.date,
        toPurchaseTypeLabel(purchase.type),
        purchase.itemName,
        purchase.quantityLabel,
        purchase.rateLabel,
        String(purchase.totalAmount),
        formatSupplierPurchasePaymentLabel(purchase.paymentType),
        purchase.description,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    supplierPurchases,
    supplierPurchasesDateFrom,
    supplierPurchasesDateTo,
    supplierPurchasesFilterPreset,
    supplierPurchasesSearchQuery,
  ]);

  const filteredParties = useMemo(() => {
    const query = partySearchQuery.trim().toLowerCase();

    return parties.filter((party) => {
      const balance = Number(party.currentBalance ?? 0);
      const isZero = Math.abs(balance) < 0.0001;

      if (partyBalanceFilter === "POSITIVE" && balance <= 0) return false;
      if (partyBalanceFilter === "NEGATIVE" && balance >= 0) return false;
      if (partyBalanceFilter === "ZERO" && !isZero) return false;

      if (!query) return true;

      return [party.name, String(balance)].join(" ").toLowerCase().includes(query);
    });
  }, [parties, partyBalanceFilter, partySearchQuery]);

  const {
    currentPage: customerPage,
    setCurrentPage: setCustomerPage,
    pageSize: customerPageSize,
    setPageSize: setCustomerPageSize,
    totalPages: customerTotalPages,
    totalItems: customerTotalItems,
    startItem: customerStartItem,
    endItem: customerEndItem,
    paginatedItems: paginatedParties,
    goToPreviousPage: goToPreviousCustomerPage,
    goToNextPage: goToNextCustomerPage,
  } = useClientPagination(filteredParties);

  const {
    currentPage: ledgerPage,
    setCurrentPage: setLedgerPage,
    pageSize: ledgerPageSize,
    setPageSize: setLedgerPageSize,
    totalPages: ledgerTotalPages,
    totalItems: ledgerTotalItems,
    startItem: ledgerStartItem,
    endItem: ledgerEndItem,
    paginatedItems: paginatedLedgerEntries,
    goToPreviousPage: goToPreviousLedgerPage,
    goToNextPage: goToNextLedgerPage,
  } = useClientPagination(filteredLedgerEntries);

  const {
    currentPage: customerBillsPage,
    setCurrentPage: setCustomerBillsPage,
    pageSize: customerBillsPageSize,
    setPageSize: setCustomerBillsPageSize,
    totalPages: customerBillsTotalPages,
    totalItems: customerBillsTotalItems,
    startItem: customerBillsStartItem,
    endItem: customerBillsEndItem,
    paginatedItems: paginatedCustomerBills,
    goToPreviousPage: goToPreviousCustomerBillsPage,
    goToNextPage: goToNextCustomerBillsPage,
  } = useClientPagination(filteredCustomerBills);

  const {
    currentPage: supplierPurchasesPage,
    setCurrentPage: setSupplierPurchasesPage,
    pageSize: supplierPurchasesPageSize,
    setPageSize: setSupplierPurchasesPageSize,
    totalPages: supplierPurchasesTotalPages,
    totalItems: supplierPurchasesTotalItems,
    startItem: supplierPurchasesStartItem,
    endItem: supplierPurchasesEndItem,
    paginatedItems: paginatedSupplierPurchases,
    goToPreviousPage: goToPreviousSupplierPurchasesPage,
    goToNextPage: goToNextSupplierPurchasesPage,
  } = useClientPagination(filteredSupplierPurchases);

  useEffect(() => {
    setLedgerPage(1);
  }, [
    ledgerDateFrom,
    ledgerDateTo,
    ledgerEntryFilter,
    ledgerSearchQuery,
    setLedgerPage,
    viewingPartyId,
  ]);

  useEffect(() => {
    setCustomerBillsPage(1);
  }, [
    customerBillsDateFrom,
    customerBillsDateTo,
    customerBillsFilterPreset,
    customerBillsSearchQuery,
    setCustomerBillsPage,
    viewingPartyId,
  ]);

  useEffect(() => {
    setSupplierPurchasesPage(1);
  }, [
    supplierPurchasesDateFrom,
    supplierPurchasesDateTo,
    supplierPurchasesFilterPreset,
    supplierPurchasesSearchQuery,
    setSupplierPurchasesPage,
    viewingPartyId,
  ]);

  const paymentBillOptions = useMemo(
    () =>
      paymentBills.map((bill) => ({
        value: bill.id,
        label: bill.billNumber,
        description: `Remaining ${formatCurrency(Number(bill.remaining ?? 0))}`,
      })),
    [paymentBills],
  );

  const paymentChequeOptions = useMemo(
    () =>
      availableCheques.map((cheque) => ({
        value: cheque.id,
        label: `${cheque.chequeNumber || "No #"} - ${formatCurrency(Number(cheque.amount ?? 0))}`,
        description: cheque.sourceParty?.name || "Own cheque",
      })),
    [availableCheques],
  );

  const clearPartyFilters = () => {
    setPartySearchQuery("");
    setPartyBalanceFilter("ALL");
  };

  const clearLedgerFilters = () => {
    setLedgerSearchQuery("");
    setLedgerEntryFilter("ALL");
    setLedgerDateFrom("");
    setLedgerDateTo("");
  };

  const clearCustomerBillFilters = () => {
    setCustomerBillsSearchQuery("");
    setCustomerBillsFilterPreset("ALL");
    setCustomerBillsDateFrom("");
    setCustomerBillsDateTo("");
  };

  const clearSupplierPurchaseFilters = () => {
    setSupplierPurchasesSearchQuery("");
    setSupplierPurchasesFilterPreset("ALL");
    setSupplierPurchasesDateFrom("");
    setSupplierPurchasesDateTo("");
  };

  const ledgerPrintPayload = useMemo<ReportExportPayload | null>(() => {
    if (!viewingParty) return null;

    const activeFilters = [
      ledgerSearchQuery.trim()
        ? `Search: ${ledgerSearchQuery.trim()}`
        : undefined,
      ledgerEntryFilter !== "ALL"
        ? `Type: ${ledgerEntryFilter.toLowerCase()}`
        : undefined,
      ledgerDateFrom ? `From: ${formatDate(ledgerDateFrom)}` : undefined,
      ledgerDateTo ? `To: ${formatDate(ledgerDateTo)}` : undefined,
    ].filter(Boolean) as string[];

    return {
      title: `${viewingParty.type === "supplier" ? "Supplier" : "Customer"} Ledger - ${viewingParty.name}`,
      table: {
        columns: [
          "Date",
          "Reference",
          "Payable",
          "Receivable",
          "Cash",
          "Balance",
        ],
        rows: filteredLedgerEntries.map((entry) => [
          formatDate(entry.date),
          getLedgerReferenceLabel(entry),
          entry.isCash
            ? "-"
            : Number(entry.payable ?? 0) > 0
              ? formatCurrency(Number(entry.payable ?? 0))
              : "-",
          entry.isCash
            ? "-"
            : Number(entry.receivable ?? 0) > 0
              ? formatCurrency(Number(entry.receivable ?? 0))
              : "-",
          entry.isCash
            ? formatCurrency(Number(entry.cash ?? 0))
            : "-",
          formatCurrency(Number(entry.runningBalance ?? 0)),
        ]),
      },
      metadata: {
        generatedAt: formatDateTime(new Date()),
        filters:
          activeFilters.length > 0 ? activeFilters : ["All ledger entries"],
      },
    };
  }, [
    filteredLedgerEntries,
    ledgerDateFrom,
    ledgerDateTo,
    ledgerEntryFilter,
    ledgerSearchQuery,
    viewingParty,
  ]);

  const customerBillsPrintPayload = useMemo<ReportExportPayload | null>(() => {
    if (!viewingParty || viewingParty.type !== "customer") return null;

    const activeFilters = [
      customerBillsSearchQuery.trim()
        ? `Search: ${customerBillsSearchQuery.trim()}`
        : undefined,
      customerBillsFilterPreset !== "ALL"
        ? `Date: ${getCustomerBillsFilterLabel(customerBillsFilterPreset)}`
        : undefined,
      customerBillsFilterPreset === "CUSTOM" && customerBillsDateFrom
        ? `From: ${formatDate(customerBillsDateFrom)}`
        : undefined,
      customerBillsFilterPreset === "CUSTOM" && customerBillsDateTo
        ? `To: ${formatDate(customerBillsDateTo)}`
        : undefined,
    ].filter(Boolean) as string[];

    return {
      title: `Customer Bills - ${viewingParty.name}`,
      table: {
        columns: ["Date", "Bill No", "Status", "Total", "Paid", "Remaining"],
        rows: filteredCustomerBills.map((bill) => [
          formatDate(bill.date),
          bill.billNumber,
          bill.paymentStatus.replaceAll("_", " "),
          formatCurrency(Number(bill.total ?? 0)),
          formatCurrency(Number(bill.totalPaid ?? 0)),
          formatCurrency(Number(bill.remaining ?? 0)),
        ]),
      },
      metadata: {
        generatedAt: formatDateTime(new Date()),
        filters: activeFilters.length > 0 ? activeFilters : ["All bills"],
      },
    };
  }, [
    customerBillsDateFrom,
    customerBillsDateTo,
    customerBillsFilterPreset,
    customerBillsSearchQuery,
    filteredCustomerBills,
      viewingParty,
    ]);

  const supplierPurchasesPrintPayload = useMemo<ReportExportPayload | null>(
    () => {
      if (!viewingParty || viewingParty.type !== "supplier") return null;

      const activeFilters = [
        supplierPurchasesSearchQuery.trim()
          ? `Search: ${supplierPurchasesSearchQuery.trim()}`
          : undefined,
        supplierPurchasesFilterPreset !== "ALL"
          ? `Date: ${getCustomerBillsFilterLabel(supplierPurchasesFilterPreset)}`
          : undefined,
        supplierPurchasesFilterPreset === "CUSTOM" && supplierPurchasesDateFrom
          ? `From: ${formatDate(supplierPurchasesDateFrom)}`
          : undefined,
        supplierPurchasesFilterPreset === "CUSTOM" && supplierPurchasesDateTo
          ? `To: ${formatDate(supplierPurchasesDateTo)}`
          : undefined,
      ].filter(Boolean) as string[];

      return {
        title: `Purchase Bills - ${viewingParty.name}`,
        table: {
          columns: ["Date", "Type", "Item", "Quantity", "Rate", "Total", "Payment"],
          rows: filteredSupplierPurchases.map((purchase) => [
            formatDate(purchase.date),
            toPurchaseTypeLabel(purchase.type),
            purchase.itemName,
            purchase.quantityLabel,
            purchase.rateLabel,
            formatCurrency(Number(purchase.totalAmount ?? 0)),
            formatSupplierPurchasePaymentLabel(purchase.paymentType),
          ]),
        },
        metadata: {
          generatedAt: formatDateTime(new Date()),
          filters:
            activeFilters.length > 0 ? activeFilters : ["All purchases"],
        },
      };
    },
    [
      filteredSupplierPurchases,
      supplierPurchasesDateFrom,
      supplierPurchasesDateTo,
      supplierPurchasesFilterPreset,
      supplierPurchasesSearchQuery,
      viewingParty,
    ],
  );

  const handlePrintLedger = () => {
    if (!ledgerPrintPayload || filteredLedgerEntries.length === 0) {
      toast.error("No ledger rows available to print.");
      return;
    }

    const printed = exportTableToPdf(ledgerPrintPayload);
    if (!printed) {
      toast.error("Unable to open print preview.");
    }
  };

  const handlePrintCustomerBills = () => {
    if (!customerBillsPrintPayload || filteredCustomerBills.length === 0) {
      toast.error("No bills available to print.");
      return;
    }

    const printed = exportTableToPdf(customerBillsPrintPayload);
    if (!printed) {
      toast.error("Unable to open bills print preview.");
    }
  };

  const handlePrintSupplierPurchases = () => {
    if (
      !supplierPurchasesPrintPayload ||
      filteredSupplierPurchases.length === 0
    ) {
      toast.error("No purchases available to print.");
      return;
    }

    const printed = exportTableToPdf(supplierPurchasesPrintPayload);
    if (!printed) {
      toast.error("Unable to open purchases print preview.");
    }
  };

  const handlePrintSingleBill = (bill: ApiBill) => {
    const printed = printBillInvoice(bill);
    if (!printed) {
      toast.error("Unable to open bill print preview.");
    }
  };

  const isViewingCustomer = viewingParty?.type === "customer";
  const isViewingSupplier = viewingParty?.type === "supplier";

  const ledgerView = (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
        <div className="min-w-[240px] flex-1 md:max-w-[360px]">
          <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
            Search
          </Label>
          <Input
            value={ledgerSearchQuery}
            onChange={(event) => setLedgerSearchQuery(event.target.value)}
            placeholder="Search reference or note..."
          />
        </div>
        <div className="min-w-[180px]">
          <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
            Entry Type
          </Label>
          <Select
            value={ledgerEntryFilter}
            onValueChange={(value) =>
              setLedgerEntryFilter(value as LedgerEntryFilter)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Entries</SelectItem>
              <SelectItem value="PAYABLE">Payable</SelectItem>
              <SelectItem value="RECEIVABLE">Receivable</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[170px]">
          <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
            From
          </Label>
          <Input
            type="date"
            value={ledgerDateFrom}
            onChange={(event) => setLedgerDateFrom(event.target.value)}
          />
        </div>
        <div className="min-w-[170px]">
          <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
            To
          </Label>
          <Input
            type="date"
            value={ledgerDateTo}
            onChange={(event) => setLedgerDateTo(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearLedgerFilters}
        >
          <Filter className="mr-2 h-4 w-4" />
          Reset Filters
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePrintLedger}
          disabled={filteredLedgerEntries.length === 0}
        >
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Payable</TableHead>
              <TableHead>Receivable</TableHead>
              <TableHead>Cash</TableHead>
              <TableHead>Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLedgerEntries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  {ledgerWithOpening.length === 0
                    ? "No ledger entries yet."
                    : "No ledger entries match the current filters."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedLedgerEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.date)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <span>{entry.reference || "-"}</span>
                      {entry.description ? (
                        <p className="text-xs text-muted-foreground">
                          {entry.description}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {entry.isCash
                      ? "-"
                      : Number(entry.payable) > 0
                        ? formatCurrency(Number(entry.payable))
                        : "-"}
                  </TableCell>
                  <TableCell>
                    {entry.isCash
                      ? "-"
                      : Number(entry.receivable) > 0
                        ? formatCurrency(Number(entry.receivable))
                        : "-"}
                  </TableCell>
                  <TableCell>
                    {entry.isCash
                      ? formatCurrency(Number(entry.cash ?? 0))
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        Number(entry.runningBalance) > 0
                          ? "text-green-600"
                          : Number(entry.runningBalance) < 0
                            ? "text-red-600"
                            : ""
                      }
                    >
                      {formatCurrency(Number(entry.runningBalance ?? 0))}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        currentPage={ledgerPage}
        totalPages={ledgerTotalPages}
        totalItems={ledgerTotalItems}
        startItem={ledgerStartItem}
        endItem={ledgerEndItem}
        pageSize={ledgerPageSize}
        setPageSize={setLedgerPageSize}
        goToPreviousPage={goToPreviousLedgerPage}
        goToNextPage={goToNextLedgerPage}
        setCurrentPage={setLedgerPage}
      />
    </>
  );

  const customerBillsView = (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
        <div className="min-w-[240px] flex-1 md:max-w-[360px]">
          <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
            Search
          </Label>
          <Input
            value={customerBillsSearchQuery}
            onChange={(event) =>
              setCustomerBillsSearchQuery(event.target.value)
            }
            placeholder="Search bill number or status..."
          />
        </div>
        <div className="min-w-[220px]">
          <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
            Date Filter
          </Label>
          <Select
            value={customerBillsFilterPreset}
            onValueChange={(value) =>
              setCustomerBillsFilterPreset(value as CustomerBillsFilterPreset)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_BILLS_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {customerBillsFilterPreset === "CUSTOM" && (
          <>
            <div className="min-w-[170px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                From
              </Label>
              <Input
                type="date"
                value={customerBillsDateFrom}
                onChange={(event) => setCustomerBillsDateFrom(event.target.value)}
              />
            </div>
            <div className="min-w-[170px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                To
              </Label>
              <Input
                type="date"
                value={customerBillsDateTo}
                onChange={(event) => setCustomerBillsDateTo(event.target.value)}
              />
            </div>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearCustomerBillFilters}
        >
          <Filter className="mr-2 h-4 w-4" />
          Reset Filters
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePrintCustomerBills}
          disabled={filteredCustomerBills.length === 0}
        >
          <Printer className="mr-2 h-4 w-4" />
          Print List
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Bill No</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingCustomerBills ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Loading bills...
                </TableCell>
              </TableRow>
            ) : filteredCustomerBills.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  {customerBills.length === 0
                    ? "No bills found for this customer."
                    : "No bills match the current filters."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedCustomerBills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell>{formatDate(bill.date)}</TableCell>
                  <TableCell>{bill.billNumber}</TableCell>
                  <TableCell>{bill.paymentStatus.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    {formatCurrency(Number(bill.total ?? 0))}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(Number(bill.totalPaid ?? 0))}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(Number(bill.remaining ?? 0))}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handlePrintSingleBill(bill)}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print Bill
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        currentPage={customerBillsPage}
        totalPages={customerBillsTotalPages}
        totalItems={customerBillsTotalItems}
        startItem={customerBillsStartItem}
        endItem={customerBillsEndItem}
        pageSize={customerBillsPageSize}
        setPageSize={setCustomerBillsPageSize}
        goToPreviousPage={goToPreviousCustomerBillsPage}
        goToNextPage={goToNextCustomerBillsPage}
        setCurrentPage={setCustomerBillsPage}
      />
    </>
  );

  const supplierPurchasesView = (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
        <div className="min-w-[240px] flex-1 md:max-w-[360px]">
          <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
            Search
          </Label>
          <Input
            value={supplierPurchasesSearchQuery}
            onChange={(event) =>
              setSupplierPurchasesSearchQuery(event.target.value)
            }
            placeholder="Search purchase type or item..."
          />
        </div>
        <div className="min-w-[220px]">
          <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
            Date Filter
          </Label>
          <Select
            value={supplierPurchasesFilterPreset}
            onValueChange={(value) =>
              setSupplierPurchasesFilterPreset(
                value as CustomerBillsFilterPreset,
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_BILLS_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {supplierPurchasesFilterPreset === "CUSTOM" && (
          <>
            <div className="min-w-[170px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                From
              </Label>
              <Input
                type="date"
                value={supplierPurchasesDateFrom}
                onChange={(event) =>
                  setSupplierPurchasesDateFrom(event.target.value)
                }
              />
            </div>
            <div className="min-w-[170px]">
              <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                To
              </Label>
              <Input
                type="date"
                value={supplierPurchasesDateTo}
                onChange={(event) =>
                  setSupplierPurchasesDateTo(event.target.value)
                }
              />
            </div>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearSupplierPurchaseFilters}
        >
          <Filter className="mr-2 h-4 w-4" />
          Reset Filters
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePrintSupplierPurchases}
          disabled={filteredSupplierPurchases.length === 0}
        >
          <Printer className="mr-2 h-4 w-4" />
          Print List
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingSupplierPurchases ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Loading purchases...
                </TableCell>
              </TableRow>
            ) : filteredSupplierPurchases.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  {supplierPurchases.length === 0
                    ? "No purchases found for this supplier."
                    : "No purchases match the current filters."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedSupplierPurchases.map((purchase) => (
                <TableRow key={`${purchase.type}-${purchase.id}`}>
                  <TableCell>{formatDate(purchase.date)}</TableCell>
                  <TableCell>{toPurchaseTypeLabel(purchase.type)}</TableCell>
                  <TableCell>{purchase.itemName}</TableCell>
                  <TableCell>{purchase.quantityLabel}</TableCell>
                  <TableCell>{purchase.rateLabel}</TableCell>
                  <TableCell>
                    {formatCurrency(Number(purchase.totalAmount ?? 0))}
                  </TableCell>
                  <TableCell>
                    {formatSupplierPurchasePaymentLabel(purchase.paymentType)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        currentPage={supplierPurchasesPage}
        totalPages={supplierPurchasesTotalPages}
        totalItems={supplierPurchasesTotalItems}
        startItem={supplierPurchasesStartItem}
        endItem={supplierPurchasesEndItem}
        pageSize={supplierPurchasesPageSize}
        setPageSize={setSupplierPurchasesPageSize}
        goToPreviousPage={goToPreviousSupplierPurchasesPage}
        goToNextPage={goToNextSupplierPurchasesPage}
        setCurrentPage={setSupplierPurchasesPage}
      />
    </>
  );

  return (
    <div className="space-y-6">
      {partyType === "customer" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Party (Customers)</CardTitle>
              <Button onClick={() => openAddPartyDialog("customer")}>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
              <div className="min-w-[240px] flex-1 md:max-w-[360px]">
                <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                  Search
                </Label>
                <Input
                  value={partySearchQuery}
                  onChange={(event) => setPartySearchQuery(event.target.value)}
                  placeholder="Search customer name..."
                />
              </div>
              <div className="min-w-[200px]">
                <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                  Balance
                </Label>
                <Select
                  value={partyBalanceFilter}
                  onValueChange={(value) =>
                    setPartyBalanceFilter(value as typeof partyBalanceFilter)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Balances</SelectItem>
                    <SelectItem value="POSITIVE">Positive Balance</SelectItem>
                    <SelectItem value="NEGATIVE">Negative Balance</SelectItem>
                    <SelectItem value="ZERO">Zero Balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearPartyFilters}
              >
                <Filter className="mr-2 h-4 w-4" />
                Reset Filters
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Current Balance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      Loading parties...
                    </TableCell>
                  </TableRow>
                ) : filteredParties.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      {parties.length === 0
                        ? "No parties yet"
                        : "No customers match the current filters."}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedParties.map((party) => (
                    <TableRow key={party.id}>
                      <TableCell>{party.name}</TableCell>
                      <TableCell>
                        <span
                          className={
                            party.currentBalance > 0
                              ? "text-green-600"
                              : party.currentBalance < 0
                                ? "text-red-600"
                                : ""
                          }
                        >
                          {formatCurrency(party.currentBalance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewingPartyId(party.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(party)}
                          >
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              currentPage={customerPage}
              totalPages={customerTotalPages}
              totalItems={customerTotalItems}
              startItem={customerStartItem}
              endItem={customerEndItem}
              pageSize={customerPageSize}
              setPageSize={setCustomerPageSize}
              goToPreviousPage={goToPreviousCustomerPage}
              goToNextPage={goToNextCustomerPage}
              setCurrentPage={setCustomerPage}
            />
          </CardContent>
        </Card>
      )}

      {partyType === "supplier" && (
        <SupplierCombinedPurchase
          suppliers={parties.map((party) => ({
            id: party.id,
            name: party.name,
            currentBalance: party.currentBalance,
          }))}
          isLoadingSuppliers={isLoading}
          onAddSupplier={() => openAddPartyDialog("supplier")}
          onEditSupplier={(supplierId: string) => {
            const supplier = parties.find((party) => party.id === supplierId);
            if (!supplier) return;
            handleEdit(supplier);
          }}
          onViewSupplierLedger={(supplierId: string) =>
            setViewingPartyId(supplierId)
          }
        />
      )}

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
              {editingId ? "Edit" : "Add"}{" "}
              {partyDialogType === "customer" ? "Customer" : "Supplier"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Party Name</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter party name"
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
              <Button type="submit">
                {editingId ? "Update" : "Add"} Party
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={paymentData.date}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, date: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select
                value={paymentData.method}
                onValueChange={(value) =>
                  setPaymentData((prev) => ({
                    ...prev,
                    method: value as ApiPaymentMethod,
                    chequeId: value === "CHEQUE" ? prev.chequeId : "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="KHATA">Khata</SelectItem>
                  {!isReceivePayment && (
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {isReceivePayment && (
              <div className="space-y-3">
                <div>
                  <Label>Bill</Label>
                  <SearchableSelect
                    value={paymentData.billId}
                    onValueChange={(value) => {
                      const bill = paymentBills.find(
                        (item) => item.id === value,
                      );
                      setPaymentData({
                        ...paymentData,
                        billId: value,
                        amount: bill
                          ? String(Number(bill.remaining ?? 0))
                          : paymentData.amount,
                      });
                    }}
                    options={paymentBillOptions}
                    disabled={isLoadingPaymentBills || paymentBills.length === 0}
                    placeholder={
                      isLoadingPaymentBills
                        ? "Loading bills..."
                        : paymentBills.length === 0
                          ? "No pending bills"
                          : "Select bill"
                    }
                    searchPlaceholder="Search bill..."
                    emptyMessage="No pending bills."
                  />
                </div>
                {selectedPaymentBill && (
                  <div className="rounded border p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bill No</span>
                      <span>{selectedPaymentBill.billNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span>{formatDate(selectedPaymentBill.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Grand Total</span>
                      <span>
                        {formatCurrency(Number(selectedPaymentBill.total ?? 0))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid</span>
                      <span>
                        {formatCurrency(
                          Number(selectedPaymentBill.totalPaid ?? 0),
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className="text-muted-foreground">Remaining</span>
                      <span>
                        {formatCurrency(
                          Number(selectedPaymentBill.remaining ?? 0),
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!isReceivePayment && paymentData.method === "CHEQUE" && (
              <div className="space-y-3">
                <div>
                  <Label>Select Cheque</Label>
                  <SearchableSelect
                    value={paymentData.chequeId}
                    onValueChange={(value) => {
                      const cheque = availableCheques.find(
                        (item) => item.id === value,
                      );
                      setPaymentData((prev) => ({
                        ...prev,
                        chequeId: value,
                        amount: cheque
                          ? String(Number(cheque.amount))
                          : prev.amount,
                      }));
                    }}
                    options={paymentChequeOptions}
                    disabled={isLoadingCheques || availableCheques.length === 0}
                    placeholder={
                      isLoadingCheques
                        ? "Loading cheques..."
                        : availableCheques.length === 0
                          ? "No available cheques"
                          : "Select cheque"
                    }
                    searchPlaceholder="Search cheque..."
                    emptyMessage="No available cheques."
                  />
                </div>
                {selectedPaymentCheque && (
                  <div className="rounded border p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cheque #</span>
                      <span>{selectedPaymentCheque.chequeNumber || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span>{formatDate(selectedPaymentCheque.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Source Party
                      </span>
                      <span>
                        {selectedPaymentCheque.sourceParty?.name || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className="text-muted-foreground">Amount</span>
                      <span>
                        {formatCurrency(
                          Number(selectedPaymentCheque.amount ?? 0),
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={paymentData.amount}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, amount: e.target.value })
                }
                readOnly={!isReceivePayment && paymentData.method === "CHEQUE"}
                required
              />
              {exceedsBillAmount && (
                <p className="mt-1 text-xs text-red-600">
                  Amount cannot exceed {formatCurrency(selectedBillRemaining)}{" "}
                  for this bill.
                </p>
              )}
              {chequeAmountMismatch && (
                <p className="mt-1 text-xs text-red-600">
                  Amount must match selected cheque value.
                </p>
              )}
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={paymentData.description}
                onChange={(e) =>
                  setPaymentData({
                    ...paymentData,
                    description: e.target.value,
                  })
                }
                placeholder="Payment description..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPaymentDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  exceedsBillAmount ||
                  chequeAmountMismatch ||
                  (!isReceivePayment &&
                    paymentData.method === "CHEQUE" &&
                    !paymentData.chequeId)
                }
              >
                Record Payment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ledger View Dialog */}
      <Dialog
        open={viewingPartyId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewingPartyId(null);
          }
        }}
      >
        <DialogContent className="flex h-[82vh] w-[72vw] max-w-[1500px] flex-col overflow-hidden sm:max-w-[1500px]">
          <DialogHeader>
            <DialogTitle>
              {isViewingCustomer ? "Customer Profile" : "Supplier Profile"} -{" "}
              {viewingParty?.name}
            </DialogTitle>
          </DialogHeader>
          {isViewingCustomer || isViewingSupplier ? (
            <Tabs
              value={profileViewTab}
              onValueChange={(value) =>
                setProfileViewTab(value as ProfileViewTab)
              }
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="mb-4">
                <TabsList className="grid w-full max-w-[280px] grid-cols-2">
                  <TabsTrigger value="ledger">Ledger</TabsTrigger>
                  <TabsTrigger value={isViewingCustomer ? "bills" : "purchases"}>
                    {isViewingCustomer ? "Bills" : "Purchase Bills"}
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="ledger" className="flex min-h-0 flex-1 flex-col">
                {ledgerView}
              </TabsContent>
              {isViewingCustomer ? (
                <TabsContent
                  value="bills"
                  className="flex min-h-0 flex-1 flex-col"
                >
                  {customerBillsView}
                </TabsContent>
              ) : (
                <TabsContent
                  value="purchases"
                  className="flex min-h-0 flex-1 flex-col"
                >
                  {supplierPurchasesView}
                </TabsContent>
              )}
            </Tabs>
          ) : (
            ledgerView
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
