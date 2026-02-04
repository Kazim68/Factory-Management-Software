import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Plus, Minus, Printer } from 'lucide-react';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { generateId, formatCurrency, formatDate, getCurrentDate } from '../lib/utils';
import { Bill, BillItem, Party, Article } from '../types';
import { toast } from 'sonner';

export function BillManagement() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    date: getCurrentDate(),
    partyId: '',
    paymentType: 'cash' as 'cash' | 'credit',
  });

  const [items, setItems] = useState<BillItem[]>([
    { articleId: '', articleName: '', quantity: 0, price: 0, total: 0 },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setBills(storage.get<Bill>(STORAGE_KEYS.BILLS));
    setParties(storage.get<Party>(STORAGE_KEYS.PARTIES));
    setArticles(storage.get<Article>(STORAGE_KEYS.ARTICLES));
  };

  const addItem = () => {
    setItems([...items, { articleId: '', articleName: '', quantity: 0, price: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'articleId') {
      const article = articles.find(a => a.id === value);
      if (article) {
        newItems[index].articleName = article.name;
        if (article.defaultRate) {
          newItems[index].price = article.defaultRate;
        }
      }
    }

    if (field === 'quantity' || field === 'price') {
      newItems[index].total = newItems[index].quantity * newItems[index].price;
    }

    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const party = parties.find(p => p.id === formData.partyId);
    if (!party) {
      toast.error('Please select a party');
      return;
    }

    const validItems = items.filter(item => item.articleId && item.quantity > 0 && item.price > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item');
      return;
    }

    const grandTotal = validItems.reduce((sum, item) => sum + item.total, 0);
    const billNumber = `BILL-${Date.now()}`;

    const bill: Bill = {
      id: generateId(),
      billNumber,
      date: formData.date,
      partyId: formData.partyId,
      partyName: party.name,
      items: validItems,
      grandTotal,
      paymentType: formData.paymentType,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    storage.add(STORAGE_KEYS.BILLS, bill);

    // Update party balance if credit
    if (formData.paymentType === 'credit') {
      const updatedParty = { ...party, currentBalance: party.currentBalance - grandTotal };
      storage.update(STORAGE_KEYS.PARTIES, party.id, updatedParty);
    }

    toast.success('Bill created successfully');
    loadData();
    resetForm();
    setIsDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({
      date: getCurrentDate(),
      partyId: '',
      paymentType: 'cash',
    });
    setItems([{ articleId: '', articleName: '', quantity: 0, price: 0, total: 0 }]);
  };

  const printBill = (bill: Bill) => {
    // Create a simple print window
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill ${bill.billNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .info { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total { text-align: right; font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>SALES BILL</h1>
            <p>Bill No: ${bill.billNumber}</p>
          </div>
          <div class="info">
            <p><strong>Date:</strong> ${formatDate(bill.date)}</p>
            <p><strong>Party:</strong> ${bill.partyName}</p>
            <p><strong>Payment Type:</strong> ${bill.paymentType.toUpperCase()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${bill.items.map(item => `
                <tr>
                  <td>${item.articleName}</td>
                  <td>${item.quantity}</td>
                  <td>${formatCurrency(item.price)}</td>
                  <td>${formatCurrency(item.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total">
            <p>Grand Total: ${formatCurrency(bill.grandTotal)}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Bill Management</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Bill
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Bill</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
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
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Bill Items</Label>
                      <Button type="button" size="sm" onClick={addItem}>
                        <Plus className="h-4 w-4 mr-1" /> Add Row
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Article</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Select 
                                value={item.articleId} 
                                onValueChange={(value) => updateItem(index, 'articleId', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select article" />
                                </SelectTrigger>
                                <SelectContent>
                                  {articles.map((article) => (
                                    <SelectItem key={article.id} value={article.id}>
                                      {article.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity || ''}
                                onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.price || ''}
                                onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                              />
                            </TableCell>
                            <TableCell>{formatCurrency(item.total)}</TableCell>
                            <TableCell>
                              {items.length > 1 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeItem(index)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-muted rounded">
                    <span className="text-lg">Grand Total:</span>
                    <span className="text-2xl">{formatCurrency(grandTotal)}</span>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Bill</Button>
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
                <TableHead>Bill No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Grand Total</TableHead>
                <TableHead>Payment Type</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No bills yet
                  </TableCell>
                </TableRow>
              ) : (
                bills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell>{bill.billNumber}</TableCell>
                    <TableCell>{formatDate(bill.date)}</TableCell>
                    <TableCell>{bill.partyName}</TableCell>
                    <TableCell>{bill.items.length} item(s)</TableCell>
                    <TableCell>{formatCurrency(bill.grandTotal)}</TableCell>
                    <TableCell>
                      <span className={bill.paymentType === 'cash' ? 'text-green-600' : 'text-orange-600'}>
                        {bill.paymentType.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => printBill(bill)}
                      >
                        <Printer className="h-4 w-4" />
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
