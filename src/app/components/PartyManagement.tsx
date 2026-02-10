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
import { Plus, Eye } from "lucide-react";
import { formatCurrency, formatDate } from "../lib/utils";
import { partyApi } from "../lib/api";
import type { ApiParty, ApiPartyLedgerEntry, ApiPartyType } from "../types/api";
import { toast } from "sonner";

type UiParty = {
  id: string;
  name: string;
  type: "customer" | "supplier" | "both";
  openingBalance: number;
  currentBalance: number;
  createdAt: string;
};

export function PartyManagement() {
  const [parties, setParties] = useState<UiParty[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingPartyId, setViewingPartyId] = useState<string | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentPartyId, setPaymentPartyId] = useState<string | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<ApiPartyLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    type: 'customer' as 'customer' | 'supplier' | 'both',
    openingBalance: '',
  });

  const [paymentData, setPaymentData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    description: '',
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

  const computeBalance = (
    party: ApiParty,
    entries: ApiPartyLedgerEntry[]
  ) => {
    let balance = Number(party.openingBalance ?? 0);
    for (const entry of entries) {
      const isCash =
        typeof entry.cash !== "undefined" ||
        entry.reference?.toLowerCase().includes("cash") ||
        entry.description?.toLowerCase().includes("cash");
      if (!isCash) {
        balance += Number(entry.credit ?? 0) - Number(entry.debit ?? 0);
      }
    }
    return balance;
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const apiParties = await partyApi.listParties();
      const ledgers = await Promise.all(
        apiParties.map((party) =>
          partyApi.getLedger(party.id).catch(() => [])
        )
      );

      const mapped = apiParties.map((party, index) => ({
        id: party.id,
        name: party.name,
        type: mapPartyType(party.type),
        openingBalance: Number(party.openingBalance ?? 0),
        currentBalance: computeBalance(party, ledgers[index]),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const openingBalance = formData.openingBalance
      ? parseFloat(formData.openingBalance)
      : 0;

    try {
      if (editingId) {
        await partyApi.updateParty(editingId, {
          name: formData.name.trim(),
          type: toApiPartyType(formData.type),
          openingBalance,
        });
        toast.success("Party updated");
      } else {
        await partyApi.createParty({
          name: formData.name.trim(),
          type: toApiPartyType(formData.type),
          openingBalance,
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
      name: '',
      type: 'customer',
      openingBalance: '',
    });
    setEditingId(null);
  };

  const handleEdit = (party: UiParty) => {
    setEditingId(party.id);
    setFormData({
      name: party.name,
      type: party.type,
      openingBalance: party.openingBalance.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (partyId: string) => {
    if (!confirm("Are you sure you want to delete this party?")) return;
    try {
      await partyApi.deleteParty(partyId);
      toast.success("Party deleted");
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete party.");
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const party = parties.find(p => p.id === paymentPartyId);
    if (!party) return;

    const amount = parseFloat(paymentData.amount);
    if (!Number.isFinite(amount)) {
      toast.error("Enter a valid amount.");
      return;
    }

    try {
      await partyApi.createPayment(party.id, {
        date: paymentData.date,
        amount,
        method: "CREDIT",
        description: paymentData.description || undefined,
      });
      toast.success("Payment recorded");
      setPaymentData({
        date: new Date().toISOString().split("T")[0],
        amount: "",
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

  const ledgerWithOpening = useMemo(() => {
    if (!viewingPartyId) return [];
    const party = parties.find((p) => p.id === viewingPartyId);
    if (!party) return ledgerEntries;

    const entriesAsc = [...ledgerEntries].sort(
      (a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
        return aCreated - bCreated;
      }
    );
    let runningBalance = Number(party.openingBalance ?? 0);
    const withRunning = entriesAsc.map((entry) => {
      const isCash =
        typeof entry.cash !== "undefined" ||
        entry.reference?.toLowerCase().includes("cash") ||
        entry.description?.toLowerCase().includes("cash");
      const cashAmount =
        typeof entry.cash !== "undefined"
          ? Number(entry.cash)
          : isCash
            ? Number(entry.debit ?? entry.credit ?? 0)
            : 0;
      if (!isCash) {
        runningBalance += Number(entry.credit ?? 0) - Number(entry.debit ?? 0);
      }
      return { ...entry, runningBalance, isCash, cash: cashAmount };
    });
    return withRunning.reverse();
  }, [ledgerEntries, parties, viewingPartyId]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Party Management</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Party
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit" : "Add"} Party</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Party Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter party name"
                      required
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={formData.type} onValueChange={(value: 'customer' | 'supplier' | 'both') => setFormData({ ...formData, type: value })}>
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
                  <div>
                    <Label>Opening Balance</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.openingBalance}
                      onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
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
                <TableHead>Opening Balance</TableHead>
                <TableHead>Current Balance</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Loading parties...
                  </TableCell>
                </TableRow>
              ) : parties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No parties yet
                  </TableCell>
                </TableRow>
              ) : (
                parties.map((party) => (
                  <TableRow key={party.id}>
                    <TableCell>{party.name}</TableCell>
                    <TableCell className="capitalize">{party.type}</TableCell>
                    <TableCell>{formatCurrency(party.openingBalance)}</TableCell>
                    <TableCell>
                      <span className={party.currentBalance > 0 ? 'text-red-600' : party.currentBalance < 0 ? 'text-green-600' : ''}>
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
                        {party.currentBalance > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPaymentPartyId(party.id);
                              setIsPaymentDialogOpen(true);
                            }}
                          >
                            Pay
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(party)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(party.id)}
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
        </CardContent>
      </Card>

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
                onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={paymentData.description}
                onChange={(e) => setPaymentData({ ...paymentData, description: e.target.value })}
                placeholder="Payment description..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Record Payment</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ledger View Dialog */}
      <Dialog open={viewingPartyId !== null} onOpenChange={() => setViewingPartyId(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Party Ledger - {parties.find(p => p.id === viewingPartyId)?.name}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Debit</TableHead>
                <TableHead>Credit</TableHead>
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
                        : Number(entry.debit) > 0
                          ? formatCurrency(Number(entry.debit))
                          : "-"}
                    </TableCell>
                    <TableCell>
                      {entry.isCash
                        ? "-"
                        : Number(entry.credit) > 0
                          ? formatCurrency(Number(entry.credit))
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
                            ? "text-red-600"
                            : Number(entry.runningBalance) < 0
                              ? "text-green-600"
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
