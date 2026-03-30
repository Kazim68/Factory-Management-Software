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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Plus, Eye } from "lucide-react";
import { formatCurrency, formatDate } from "../lib/utils";
import { billApi, chequeApi, partyApi, reportsApi } from "../lib/api";
import {
  exportTableToExcel,
  exportTableToPdf,
  type ReportExportPayload,
} from "../lib/report";
import type {
  ApiBill,
  ApiCheque,
  ApiPartyLedgerEntry,
  ApiPartyMonthlyOutstandingReport,
  ApiPaymentMethod,
  ApiPartyType,
} from "../types/api";
import { toast } from "sonner";

type UiParty = {
  id: string;
  name: string;
  type: "customer" | "supplier" | "both";
  currentBalance: number;
  createdAt: string;
};

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

const monthToDateRange = (month: string) => {
  if (!month) return { start: undefined, end: undefined };
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return { start: undefined, end: undefined };

  const start = `${month}-01`;
  const endDay = new Date(year, monthNumber, 0).getDate();
  const end = `${month}-${String(endDay).padStart(2, "0")}`;
  return { start, end };
};

export function PartyManagement() {
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
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window === "undefined") return "entries";
    return localStorage.getItem("party.activeSection") || "entries";
  });
  const [partyReportStartMonth, setPartyReportStartMonth] =
    useState(getCurrentMonth());
  const [partyReportEndMonth, setPartyReportEndMonth] =
    useState(getCurrentMonth());
  const [partyReport, setPartyReport] =
    useState<ApiPartyMonthlyOutstandingReport | null>(null);
  const [isLoadingPartyReport, setIsLoadingPartyReport] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    type: "customer" as "customer" | "supplier" | "both",
  });

  const [paymentData, setPaymentData] = useState({
    date: new Date().toISOString().split("T")[0],
    amount: "",
    method: "KHATA" as ApiPaymentMethod,
    chequeId: "",
    billId: "",
    description: "",
  });

  const mapPartyType = (type: ApiPartyType): UiParty["type"] => {
    switch (type) {
      case "SUPPLIER":
        return "supplier";
      case "BOTH":
        return "both";
      default:
        return "customer";
    }
  };

  const toApiPartyType = (type: UiParty["type"]): ApiPartyType =>
    type.toUpperCase() as ApiPartyType;

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
      const apiParties = await partyApi.listParties();
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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("party.activeSection", activeSection);
  }, [activeSection]);

  useEffect(() => {
    let active = true;
    const startRange = monthToDateRange(partyReportStartMonth).start;
    const endRange = monthToDateRange(partyReportEndMonth).end;

    setIsLoadingPartyReport(true);
    const timer = window.setTimeout(() => {
      reportsApi
        .getPartyMonthlyOutstanding({
          period: "monthly",
          start: startRange,
          end: endRange,
        })
        .then((report) => {
          if (active) {
            setPartyReport(report);
          }
        })
        .catch((error) => {
          console.error(error);
          if (active) {
            toast.error("Failed to load party report.");
          }
        })
        .finally(() => {
          if (active) {
            setIsLoadingPartyReport(false);
          }
        });
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [partyReportStartMonth, partyReportEndMonth]);

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

    try {
      if (editingId) {
        await partyApi.updateParty(editingId, {
          name: formData.name.trim(),
          type: toApiPartyType(formData.type),
        });
        toast.success("Party updated");
      } else {
        await partyApi.createParty({
          name: formData.name.trim(),
          type: toApiPartyType(formData.type),
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
      type: "customer",
    });
    setEditingId(null);
  };

  const handleEdit = (party: UiParty) => {
    setEditingId(party.id);
    setFormData({
      name: party.name,
      type: party.type,
    });
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
      setPaymentData({
        date: new Date().toISOString().split("T")[0],
        amount: "",
        method: "KHATA",
        chequeId: "",
        billId: "",
        description: "",
      });
      setIsPaymentDialogOpen(false);
      setPaymentPartyId(null);
      await loadData();
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

  const selectedReportBucket = useMemo(() => {
    if (!partyReport || partyReport.buckets.length === 0) return null;
    return (
      partyReport.buckets.find(
        (bucket) => bucket.key === partyReportEndMonth,
      ) || partyReport.buckets[partyReport.buckets.length - 1]
    );
  }, [partyReport, partyReportEndMonth]);

  const buildPartyReportPayload = (
    report: ApiPartyMonthlyOutstandingReport,
  ): ReportExportPayload => ({
    title: "Party monthly outstanding summary",
    table: {
      columns: [
        "Month",
        "Party",
        "Type",
        "Outstanding",
        "Receivable",
        "Payable",
      ],
      rows: report.buckets.flatMap((bucket) =>
        bucket.parties.map((row) => [
          bucket.key,
          row.partyName,
          row.partyType,
          row.outstanding.toFixed(2),
          row.receivable.toFixed(2),
          row.payable.toFixed(2),
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

  const exportPartyReport = (type: "excel" | "pdf") => {
    if (!partyReport || partyReport.buckets.length === 0) {
      toast.error("No report data available for export.");
      return;
    }

    const payload = buildPartyReportPayload(partyReport);
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

  return (
    <div className="space-y-6">
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <TabsList className="grid w-full max-w-[320px] grid-cols-2">
            <TabsTrigger value="entries">Party Entries</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="reports" className="space-y-0">
          <Card>
            <CardHeader>
              <CardTitle>Party Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                    Start Month
                  </Label>
                  <Input
                    type="month"
                    value={partyReportStartMonth}
                    onChange={(e) => setPartyReportStartMonth(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                    End Month
                  </Label>
                  <Input
                    type="month"
                    value={partyReportEndMonth}
                    onChange={(e) => setPartyReportEndMonth(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 flex items-end gap-2">
                  {isLoadingPartyReport && (
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => exportPartyReport("excel")}
                    disabled={!partyReport || partyReport.buckets.length === 0}
                  >
                    Excel
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => exportPartyReport("pdf")}
                    disabled={!partyReport || partyReport.buckets.length === 0}
                  >
                    PDF
                  </Button>
                </div>
              </div>

              {partyReport && (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">
                        Total Receivable
                      </p>
                      <p className="text-lg text-green-600">
                        {formatCurrency(partyReport.totals.totalReceivable)}
                      </p>
                    </div>
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">
                        Total Payable
                      </p>
                      <p className="text-lg text-red-600">
                        {formatCurrency(partyReport.totals.totalPayable)}
                      </p>
                    </div>
                    <div className="rounded border p-3">
                      <p className="text-xs text-muted-foreground">
                        Net Outstanding
                      </p>
                      <p className="text-lg">
                        {formatCurrency(partyReport.totals.totalOutstanding)}
                      </p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead>Receivable</TableHead>
                        <TableHead>Payable</TableHead>
                        <TableHead>Net Outstanding</TableHead>
                        <TableHead>Parties</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partyReport.buckets.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center text-muted-foreground"
                          >
                            No report data found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        partyReport.buckets.map((bucket) => (
                          <TableRow key={bucket.key}>
                            <TableCell>{bucket.key}</TableCell>
                            <TableCell>
                              {formatCurrency(bucket.totalReceivable)}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(bucket.totalPayable)}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(bucket.totalOutstanding)}
                            </TableCell>
                            <TableCell>{bucket.partyCount}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  {selectedReportBucket && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        Outstanding Parties for {selectedReportBucket.key}
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Party</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Receivable</TableHead>
                            <TableHead>Payable</TableHead>
                            <TableHead>Outstanding</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedReportBucket.parties.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center text-muted-foreground"
                              >
                                No outstanding parties for this month.
                              </TableCell>
                            </TableRow>
                          ) : (
                            selectedReportBucket.parties.map((row) => (
                              <TableRow
                                key={`${selectedReportBucket.key}-${row.partyId}`}
                              >
                                <TableCell>{row.partyName}</TableCell>
                                <TableCell>{row.partyType}</TableCell>
                                <TableCell>
                                  {formatCurrency(row.receivable)}
                                </TableCell>
                                <TableCell>
                                  {formatCurrency(row.payable)}
                                </TableCell>
                                <TableCell>
                                  {formatCurrency(row.outstanding)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries" className="space-y-0">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Party Management</CardTitle>
                <Dialog
                  open={isDialogOpen}
                  onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Party
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingId ? "Edit" : "Add"} Party
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
                      <div>
                        <Label>Type</Label>
                        <Select
                          value={formData.type}
                          onValueChange={(
                            value: "customer" | "supplier" | "both",
                          ) => setFormData({ ...formData, type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="supplier">Supplier</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                          </SelectContent>
                        </Select>
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
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Current Balance</TableHead>
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
                        Loading parties...
                      </TableCell>
                    </TableRow>
                  ) : parties.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        No parties yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    parties.map((party) => (
                      <TableRow key={party.id}>
                        <TableCell>{party.name}</TableCell>
                        <TableCell className="capitalize">
                          {party.type}
                        </TableCell>
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
                            {party.currentBalance !== 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPaymentPartyId(party.id);
                                  setPaymentData({
                                    date: new Date()
                                      .toISOString()
                                      .split("T")[0],
                                    amount: "",
                                    method: "KHATA",
                                    chequeId: "",
                                    billId: "",
                                    description: "",
                                  });
                                  setIsPaymentDialogOpen(true);
                                }}
                              >
                                {party.currentBalance > 0 ? "Receive" : "Pay"}
                              </Button>
                            )}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                  <Select
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
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          isLoadingPaymentBills
                            ? "Loading bills..."
                            : paymentBills.length === 0
                              ? "No pending bills"
                              : "Select bill"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentBills.map((bill) => (
                        <SelectItem key={bill.id} value={bill.id}>
                          {bill.billNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select
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
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          isLoadingCheques
                            ? "Loading cheques..."
                            : availableCheques.length === 0
                              ? "No available cheques"
                              : "Select cheque"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCheques.map((cheque) => (
                        <SelectItem key={cheque.id} value={cheque.id}>
                          {`${cheque.chequeNumber || "No #"} - ${formatCurrency(Number(cheque.amount))}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
        onOpenChange={() => setViewingPartyId(null)}
      >
        <DialogContent className="w-[50vw] max-w-[1400px] sm:max-w-[1400px] h-[82vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Party Ledger -{" "}
              {parties.find((p) => p.id === viewingPartyId)?.name}
            </DialogTitle>
          </DialogHeader>
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
              {viewingPartyId &&
                ledgerWithOpening.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>{entry.reference || "-"}</TableCell>
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
                ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
