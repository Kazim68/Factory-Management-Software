import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { generateId, formatCurrency, formatDate, getCurrentDate } from '../lib/utils';
import { RoznamchaEntry, ExpenseCategory, Party, Labor } from '../types';
import { toast } from 'sonner';

export function Roznamcha() {
  const [entries, setEntries] = useState<RoznamchaEntry[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [labors, setLabors] = useState<Labor[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    date: getCurrentDate(),
    expenseType: '',
    partyId: '',
    laborId: '',
    amount: '',
    description: '',
  });

  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setEntries(storage.get<RoznamchaEntry>(STORAGE_KEYS.ROZNAMCHA));
    setCategories(storage.get<ExpenseCategory>(STORAGE_KEYS.EXPENSE_CATEGORIES));
    setParties(storage.get<Party>(STORAGE_KEYS.PARTIES));
    setLabors(storage.get<Labor>(STORAGE_KEYS.LABORS));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let partyName = '';
    let laborName = '';

    if (formData.partyId) {
      const party = parties.find(p => p.id === formData.partyId);
      partyName = party?.name || '';
    }

    if (formData.laborId) {
      const labor = labors.find(l => l.id === formData.laborId);
      laborName = labor?.name || '';
    }

    const entry: RoznamchaEntry = {
      id: generateId(),
      date: formData.date,
      expenseType: formData.expenseType,
      partyId: formData.partyId || undefined,
      partyName: partyName || undefined,
      laborId: formData.laborId || undefined,
      laborName: laborName || undefined,
      amount: parseFloat(formData.amount),
      description: formData.description,
      createdAt: new Date().toISOString(),
    };

    storage.add(STORAGE_KEYS.ROZNAMCHA, entry);
    toast.success('Expense recorded');

    loadData();
    resetForm();
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      storage.delete(STORAGE_KEYS.ROZNAMCHA, id);
      toast.success('Entry deleted');
      loadData();
    }
  };

  const resetForm = () => {
    setFormData({
      date: getCurrentDate(),
      expenseType: '',
      partyId: '',
      laborId: '',
      amount: '',
      description: '',
    });
  };

  const filteredEntries = filterDate 
    ? entries.filter(e => e.date === filterDate)
    : entries;

  const totalExpenses = filteredEntries.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Roznamcha (Daily Expenses)</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Daily Expense</DialogTitle>
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
                      <Label>Expense Type</Label>
                      <Select value={formData.expenseType} onValueChange={(value) => setFormData({ ...formData, expenseType: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {formData.expenseType === 'Chemical' || formData.expenseType === 'Material' || formData.expenseType === 'Rexine' ? (
                    <div>
                      <Label>Party (Optional)</Label>
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
                  ) : null}

                  {formData.expenseType === 'Labor' && (
                    <div>
                      <Label>Labor (Optional)</Label>
                      <Select value={formData.laborId} onValueChange={(value) => setFormData({ ...formData, laborId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select labor" />
                        </SelectTrigger>
                        <SelectContent>
                          {labors.map((labor) => (
                            <SelectItem key={labor.id} value={labor.id}>
                              {labor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter description..."
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Record Expense</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-4">
            <div className="flex-1">
              <Label>Filter by Date</Label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                placeholder="All dates"
              />
            </div>
            {filterDate && (
              <Button variant="outline" onClick={() => setFilterDate('')}>
                Clear Filter
              </Button>
            )}
            <div className="p-4 bg-muted rounded">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl">{formatCurrency(totalExpenses)}</p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Expense Type</TableHead>
                <TableHead>Party/Labor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No expenses recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>{entry.expenseType}</TableCell>
                    <TableCell>{entry.partyName || entry.laborName || '-'}</TableCell>
                    <TableCell>{formatCurrency(entry.amount)}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
