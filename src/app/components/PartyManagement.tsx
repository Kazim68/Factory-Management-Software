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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Plus, Eye } from "lucide-react";
import { formatCurrency, formatDate } from "../lib/utils";
import { billApi, chequeApi, partyApi } from "../lib/api";
import { SupplierCombinedPurchase } from "./SupplierPurchaseSection";
import type {
  ApiBill,
  ApiCheque,
  ApiPartyLedgerEntry,
  ApiPaymentMethod,
} from "../types/api";
import { toast } from "sonner";

type UiParty = {
  id: string;
  name: string;
  type: "customer" | "supplier";
  currentBalance: number;
  createdAt: string;
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
  const [isLoading, setIsLoading] = useState(false);
  const [partyDialogType, setPartyDialogType] = useState<
    "customer" | "supplier"
  >(partyType);

  const [formData, setFormData] = useState({
    name: "",
  });

  const [paymentData, setPaymentData] = useState({
    date: new Date().toISOString().split("T")[0],
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
                ) : parties.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      No parties yet
                    </TableCell>
                  </TableRow>
                ) : (
                  parties.map((party) => (
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
