import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { generateId, formatCurrency, formatDate } from '../lib/utils';
import { Party, PartyLedgerEntry, ChemicalTransaction, RexineTransaction, MaterialTransaction, Payment } from '../types';
import { toast } from 'sonner';

export function PartyManagement() {
  const [parties, setParties] = useState<Party[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingPartyId, setViewingPartyId] = useState<string | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentPartyId, setPaymentPartyId] = useState<string | null>(null);

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setParties(storage.get<Party>(STORAGE_KEYS.PARTIES));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const openingBalance = formData.openingBalance ? parseFloat(formData.openingBalance) : 0;
    
    const party: Party = {
      id: editingId || generateId(),
      name: formData.name,
      type: formData.type,
      openingBalance,
      currentBalance: editingId ? parties.find(p => p.id === editingId)?.currentBalance || openingBalance : openingBalance,
      createdAt: editingId ? parties.find(p => p.id === editingId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };

    if (editingId) {
      storage.update(STORAGE_KEYS.PARTIES, editingId, party);
      toast.success('Party updated');
    } else {
      storage.add(STORAGE_KEYS.PARTIES, party);
      toast.success('Party added');
    }

    loadData();
    resetForm();
    setIsDialogOpen(false);
  };

  const handleEdit = (party: Party) => {
    setEditingId(party.id);
    setFormData({
      name: party.name,
      type: party.type,
      openingBalance: party.openingBalance.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this party?')) {
      storage.delete(STORAGE_KEYS.PARTIES, id);
      toast.success('Party deleted');
      loadData();
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

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const party = parties.find(p => p.id === paymentPartyId);
    if (!party) return;

    const amount = parseFloat(paymentData.amount);
    
    // Record payment
    const payment: Payment = {
      id: generateId(),
      date: paymentData.date,
      partyId: party.id,
      partyName: party.name,
      amount,
      description: paymentData.description,
      createdAt: new Date().toISOString(),
    };
    storage.add(STORAGE_KEYS.PAYMENTS, payment);

    // Update party balance
    const updatedParty = { ...party, currentBalance: party.currentBalance - amount };
    storage.update(STORAGE_KEYS.PARTIES, party.id, updatedParty);

    toast.success('Payment recorded');
    setPaymentData({ date: new Date().toISOString().split('T')[0], amount: '', description: '' });
    setIsPaymentDialogOpen(false);
    setPaymentPartyId(null);
    loadData();
  };

  const getLedgerEntries = (partyId: string): PartyLedgerEntry[] => {
    const chemicals = storage.get<ChemicalTransaction>(STORAGE_KEYS.CHEMICALS)
      .filter(c => c.partyId === partyId);
    const rexine = storage.get<RexineTransaction>(STORAGE_KEYS.REXINE)
      .filter(r => r.partyId === partyId);
    const materials = storage.get<MaterialTransaction>(STORAGE_KEYS.MATERIALS)
      .filter(m => m.partyId === partyId);
    const payments = storage.get<Payment>(STORAGE_KEYS.PAYMENTS)
      .filter(p => p.partyId === partyId);

    const entries: PartyLedgerEntry[] = [];

    // Add opening balance
    const party = parties.find(p => p.id === partyId);
    if (party && party.openingBalance !== 0) {
      entries.push({
        id: 'opening',
        date: party.createdAt.split('T')[0],
        partyId,
        reference: 'Opening Balance',
        description: 'Opening Balance',
        debit: party.openingBalance > 0 ? party.openingBalance : 0,
        credit: party.openingBalance < 0 ? Math.abs(party.openingBalance) : 0,
        balance: party.openingBalance,
        type: 'opening',
        createdAt: party.createdAt,
      });
    }

    // Add chemical transactions
    chemicals.forEach(c => {
      entries.push({
        id: `chem-${c.id}`,
        date: c.date,
        partyId,
        reference: `Chemical-${c.id.slice(0, 8)}`,
        description: `Chemical: ${c.weight}kg @ ${c.rate}/kg - ${c.detail}`,
        debit: c.balance,
        credit: 0,
        balance: 0,
        type: 'chemical',
        createdAt: c.createdAt,
      });
    });

    // Add rexine transactions
    rexine.forEach(r => {
      entries.push({
        id: `rex-${r.id}`,
        date: r.date,
        partyId,
        reference: `Rexine-${r.id.slice(0, 8)}`,
        description: `Rexine: ${r.meters}m @ ${r.rate}/m - ${r.detail}`,
        debit: r.balance,
        credit: 0,
        balance: 0,
        type: 'rexine',
        createdAt: r.createdAt,
      });
    });

    // Add material transactions
    materials.forEach(m => {
      entries.push({
        id: `mat-${m.id}`,
        date: m.date,
        partyId,
        reference: `Material-${m.id.slice(0, 8)}`,
        description: `${m.articleName}: ${m.quantity} pairs @ ${m.pricePerPair} - ${m.detail}`,
        debit: m.balance,
        credit: 0,
        balance: 0,
        type: 'material',
        createdAt: m.createdAt,
      });
    });

    // Add payments
    payments.forEach(p => {
      entries.push({
        id: `pay-${p.id}`,
        date: p.date,
        partyId,
        reference: `Payment-${p.id.slice(0, 8)}`,
        description: p.description || 'Payment received',
        debit: 0,
        credit: p.amount,
        balance: 0,
        type: 'payment',
        createdAt: p.createdAt,
      });
    });

    // Sort by date
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = 0;
    entries.forEach(entry => {
      runningBalance += entry.debit - entry.credit;
      entry.balance = runningBalance;
    });

    return entries;
  };

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
                  <DialogTitle>{editingId ? 'Edit' : 'Add'} Party</DialogTitle>
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
                      {editingId ? 'Update' : 'Add'} Party
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
              {parties.length === 0 ? (
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
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(party.id)}
                        >
                          <Trash2 className="h-4 w-4" />
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
                <TableHead>Description</TableHead>
                <TableHead>Debit</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewingPartyId && getLedgerEntries(viewingPartyId).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.date)}</TableCell>
                  <TableCell>{entry.reference}</TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell>{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</TableCell>
                  <TableCell>{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</TableCell>
                  <TableCell>
                    <span className={entry.balance > 0 ? 'text-red-600' : entry.balance < 0 ? 'text-green-600' : ''}>
                      {formatCurrency(entry.balance)}
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
