import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { generateId, formatCurrency, formatDate, getCurrentDate } from '../lib/utils';
import { RexineTransaction, Party } from '../types';
import { toast } from 'sonner';

export function RexineManagement() {
  const [transactions, setTransactions] = useState<RexineTransaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: getCurrentDate(),
    partyId: '',
    meters: '',
    rate: '',
    paymentType: 'cash' as 'cash' | 'credit',
    paymentReceived: '',
    detail: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setTransactions(storage.get<RexineTransaction>(STORAGE_KEYS.REXINE));
    setParties(storage.get<Party>(STORAGE_KEYS.PARTIES));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const party = parties.find(p => p.id === formData.partyId);
    if (!party) {
      toast.error('Please select a party');
      return;
    }

    const meters = parseFloat(formData.meters);
    const rate = parseFloat(formData.rate);
    const total = meters * rate;
    const paymentReceived = formData.paymentReceived ? parseFloat(formData.paymentReceived) : (formData.paymentType === 'cash' ? total : 0);
    const balance = total - paymentReceived;

    const transaction: RexineTransaction = {
      id: editingId || generateId(),
      date: formData.date,
      partyId: formData.partyId,
      partyName: party.name,
      meters,
      rate,
      total,
      paymentType: formData.paymentType,
      paymentReceived,
      balance,
      detail: formData.detail,
      createdAt: editingId ? transactions.find(t => t.id === editingId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };

    if (editingId) {
      storage.update(STORAGE_KEYS.REXINE, editingId, transaction);
      toast.success('Rexine transaction updated');
    } else {
      storage.add(STORAGE_KEYS.REXINE, transaction);
      toast.success('Rexine transaction added');
    }

    // Update party balance if credit
    if (formData.paymentType === 'credit') {
      const updatedParty = { ...party, currentBalance: party.currentBalance + balance };
      storage.update(STORAGE_KEYS.PARTIES, party.id, updatedParty);
    }

    loadData();
    resetForm();
    setIsDialogOpen(false);
  };

  const handleEdit = (transaction: RexineTransaction) => {
    setEditingId(transaction.id);
    setFormData({
      date: transaction.date,
      partyId: transaction.partyId,
      meters: transaction.meters.toString(),
      rate: transaction.rate.toString(),
      paymentType: transaction.paymentType,
      paymentReceived: transaction.paymentReceived.toString(),
      detail: transaction.detail,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      storage.delete(STORAGE_KEYS.REXINE, id);
      toast.success('Transaction deleted');
      loadData();
    }
  };

  const resetForm = () => {
    setFormData({
      date: getCurrentDate(),
      partyId: '',
      meters: '',
      rate: '',
      paymentType: 'cash',
      paymentReceived: '',
      detail: '',
    });
    setEditingId(null);
  };

  const handlePayment = (transaction: RexineTransaction) => {
    const payment = prompt('Enter payment amount:');
    if (payment) {
      const amount = parseFloat(payment);
      const updatedTransaction = {
        ...transaction,
        paymentReceived: transaction.paymentReceived + amount,
        balance: transaction.balance - amount,
      };
      storage.update(STORAGE_KEYS.REXINE, transaction.id, updatedTransaction);
      
      // Update party balance
      const party = parties.find(p => p.id === transaction.partyId);
      if (party) {
        const updatedParty = { ...party, currentBalance: party.currentBalance - amount };
        storage.update(STORAGE_KEYS.PARTIES, party.id, updatedParty);
      }
      
      toast.success('Payment recorded');
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Rexine Management</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Rexine Purchase
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Edit' : 'Add'} Rexine Purchase</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Party</Label>
                      <Select value={formData.partyId} onValueChange={(value) => setFormData({ ...formData, partyId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select party" />
                        </SelectTrigger>
                        <SelectContent>
                          {parties.map((party) => (
                            <SelectItem key={party.id} value={party.id}>
                              {party.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Meters</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.meters}
                        onChange={(e) => setFormData({ ...formData, meters: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Rate per meter</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.rate}
                        onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Payment Type</Label>
                      <Select value={formData.paymentType} onValueChange={(value: 'cash' | 'credit') => setFormData({ ...formData, paymentType: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Payment Received</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.paymentReceived}
                        onChange={(e) => setFormData({ ...formData, paymentReceived: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Details</Label>
                    <Input
                      value={formData.detail}
                      onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
                      placeholder="Additional details..."
                    />
                  </div>
                  {formData.meters && formData.rate && (
                    <div className="p-3 bg-muted rounded">
                      <p>Total: {formatCurrency(parseFloat(formData.meters) * parseFloat(formData.rate))}</p>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingId ? 'Update' : 'Add'} Transaction
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
                <TableHead>Date</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Meters</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment Type</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No transactions yet
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{formatDate(transaction.date)}</TableCell>
                    <TableCell>{transaction.partyName}</TableCell>
                    <TableCell>{transaction.meters}</TableCell>
                    <TableCell>{formatCurrency(transaction.rate)}</TableCell>
                    <TableCell>{formatCurrency(transaction.total)}</TableCell>
                    <TableCell>
                      <span className={transaction.paymentType === 'cash' ? 'text-green-600' : 'text-orange-600'}>
                        {transaction.paymentType.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>{formatCurrency(transaction.paymentReceived)}</TableCell>
                    <TableCell>
                      <span className={transaction.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(transaction.balance)}
                      </span>
                    </TableCell>
                    <TableCell>{transaction.detail}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {transaction.balance > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePayment(transaction)}
                          >
                            Pay
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(transaction)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(transaction.id)}
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
    </div>
  );
}
