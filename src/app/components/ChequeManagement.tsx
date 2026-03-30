import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
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
import { Badge } from "./ui/badge";
import { Pencil, CheckCircle2 } from "lucide-react";
import { chequeApi } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/utils";
import type { ApiCheque } from "../types/api";
import { toast } from "sonner";

export function ChequeManagement() {
  const [cheques, setCheques] = useState<ApiCheque[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingCheque, setEditingCheque] = useState<ApiCheque | null>(null);
  const [editData, setEditData] = useState({
    date: "",
    amount: "",
  });

  const loadCheques = async () => {
    setIsLoading(true);
    try {
      const data = await chequeApi.listCheques();
      setCheques(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load cheques.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCheques();
  }, []);

  const openEdit = (cheque: ApiCheque) => {
    setEditingCheque(cheque);
    setEditData({
      date: cheque.date.slice(0, 10),
      amount: String(Number(cheque.amount ?? 0)),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCheque) return;

    const amount = Math.abs(Number(editData.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid cheque amount.");
      return;
    }

    try {
      await chequeApi.updateCheque(editingCheque.id, {
        date: editData.date,
        amount,
      });
      toast.success("Cheque updated");
      setEditingCheque(null);
      await loadCheques();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update cheque.");
    }
  };

  const markCashed = async (cheque: ApiCheque) => {
    if (!confirm("Mark this cheque as cashed?")) return;
    try {
      await chequeApi.cashCheque(cheque.id);
      toast.success("Cheque marked as cashed");
      await loadCheques();
    } catch (error) {
      console.error(error);
      toast.error("Failed to mark cheque as cashed.");
    }
  };

  const statusBadge = (status: ApiCheque["status"]) => {
    if (status === "AVAILABLE") {
      return <Badge className="bg-green-100 text-green-700">Available</Badge>;
    }
    if (status === "USED") {
      return <Badge className="bg-blue-100 text-blue-700">Used</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-700">Cashed</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cheques</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Source Party</TableHead>
                <TableHead>Used For</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    Loading cheques...
                  </TableCell>
                </TableRow>
              ) : cheques.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No cheques found
                  </TableCell>
                </TableRow>
              ) : (
                cheques.map((cheque) => (
                  <TableRow key={cheque.id}>
                    <TableCell>{formatDate(cheque.date)}</TableCell>
                    <TableCell>
                      {formatCurrency(Number(cheque.amount ?? 0))}
                    </TableCell>
                    <TableCell>{cheque.sourceParty?.name || "-"}</TableCell>
                    <TableCell>{cheque.usedParty?.name || "-"}</TableCell>
                    <TableCell>{statusBadge(cheque.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {cheque.status === "AVAILABLE" && (
                          <>
                            <Button
                              size="icon"
                              variant="outline"
                              title="Edit"
                              onClick={() => openEdit(cheque)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              title="Mark Cashed"
                              onClick={() => markCashed(cheque)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={editingCheque !== null}
        onOpenChange={() => setEditingCheque(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Cheque</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={editData.date}
                onChange={(e) =>
                  setEditData({ ...editData, date: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={editData.amount}
                onChange={(e) =>
                  setEditData({ ...editData, amount: e.target.value })
                }
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingCheque(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
