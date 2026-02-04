import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Pencil, Trash2, Eye, Wallet } from 'lucide-react';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { generateId, formatCurrency, formatDate, getCurrentDate } from '../lib/utils';
import { Labor, LaborCategory, LaborWork, LaborKharcha, Article } from '../types';
import { toast } from 'sonner';

export function LaborManagement() {
  const [labors, setLabors] = useState<Labor[]>([]);
  const [categories, setCategories] = useState<LaborCategory[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [workEntries, setWorkEntries] = useState<LaborWork[]>([]);
  const [kharchaEntries, setKharchaEntries] = useState<LaborKharcha[]>([]);

  const [laborDialog, setLaborDialog] = useState(false);
  const [workDialog, setWorkDialog] = useState(false);
  const [kharchaDialog, setKharchaDialog] = useState(false);
  const [ledgerDialog, setLedgerDialog] = useState(false);

  const [editingLaborId, setEditingLaborId] = useState<string | null>(null);
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [viewingLaborId, setViewingLaborId] = useState<string | null>(null);

  const [laborForm, setLaborForm] = useState({
    name: '',
    categoryId: '',
    monthlyRate: '',
  });

  const [workForm, setWorkForm] = useState({
    laborId: '',
    date: getCurrentDate(),
    articleId: '',
    quantity: '',
    rate: '',
  });

  const [kharchaForm, setKharchaForm] = useState({
    laborId: '',
    date: getCurrentDate(),
    amount: '',
    reason: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLabors(storage.get<Labor>(STORAGE_KEYS.LABORS));
    setCategories(storage.get<LaborCategory>(STORAGE_KEYS.LABOR_CATEGORIES));
    setArticles(storage.get<Article>(STORAGE_KEYS.ARTICLES));
    setWorkEntries(storage.get<LaborWork>(STORAGE_KEYS.LABOR_WORK));
    setKharchaEntries(storage.get<LaborKharcha>(STORAGE_KEYS.LABOR_KHARCHA));
  };

  // Labor Management
  const handleLaborSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const category = categories.find(c => c.id === laborForm.categoryId);
    if (!category) {
      toast.error('Please select a category');
      return;
    }

    const labor: Labor = {
      id: editingLaborId || generateId(),
      name: laborForm.name,
      categoryId: laborForm.categoryId,
      category: category.name,
      paymentType: category.paymentType,
      monthlyRate: laborForm.monthlyRate ? parseFloat(laborForm.monthlyRate) : undefined,
      articleRates: editingLaborId ? labors.find(l => l.id === editingLaborId)?.articleRates || {} : {},
      createdAt: editingLaborId ? labors.find(l => l.id === editingLaborId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };

    if (editingLaborId) {
      storage.update(STORAGE_KEYS.LABORS, editingLaborId, labor);
      toast.success('Labor updated');
    } else {
      storage.add(STORAGE_KEYS.LABORS, labor);
      toast.success('Labor added');
    }

    loadData();
    setLaborForm({ name: '', categoryId: '', monthlyRate: '' });
    setEditingLaborId(null);
    setLaborDialog(false);
  };

  // Work Entry
  const handleWorkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const labor = labors.find(l => l.id === workForm.laborId);
    const article = articles.find(a => a.id === workForm.articleId);
    
    if (!labor || !article) {
      toast.error('Please select labor and article');
      return;
    }

    const quantity = parseFloat(workForm.quantity);
    const rate = parseFloat(workForm.rate);
    const total = quantity * rate;

    const work: LaborWork = {
      id: editingWorkId || generateId(),
      laborId: workForm.laborId,
      laborName: labor.name,
      date: workForm.date,
      articleId: workForm.articleId,
      articleName: article.name,
      quantity,
      rate,
      total,
      createdAt: editingWorkId ? workEntries.find(w => w.id === editingWorkId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };

    if (editingWorkId) {
      storage.update(STORAGE_KEYS.LABOR_WORK, editingWorkId, work);
      toast.success('Work entry updated');
    } else {
      storage.add(STORAGE_KEYS.LABOR_WORK, work);
      toast.success('Work entry added');
    }

    loadData();
    setWorkForm({ laborId: '', date: getCurrentDate(), articleId: '', quantity: '', rate: '' });
    setEditingWorkId(null);
    setWorkDialog(false);
  };

  // Kharcha Entry
  const handleKharchaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const labor = labors.find(l => l.id === kharchaForm.laborId);
    
    if (!labor) {
      toast.error('Please select labor');
      return;
    }

    const kharcha: LaborKharcha = {
      id: generateId(),
      laborId: kharchaForm.laborId,
      laborName: labor.name,
      date: kharchaForm.date,
      amount: parseFloat(kharchaForm.amount),
      reason: kharchaForm.reason,
      createdAt: new Date().toISOString(),
    };

    storage.add(STORAGE_KEYS.LABOR_KHARCHA, kharcha);
    toast.success('Kharcha recorded');

    loadData();
    setKharchaForm({ laborId: '', date: getCurrentDate(), amount: '', reason: '' });
    setKharchaDialog(false);
  };

  const getLaborSummary = (laborId: string) => {
    const works = workEntries.filter(w => w.laborId === laborId);
    const kharchas = kharchaEntries.filter(k => k.laborId === laborId);
    
    const totalEarned = works.reduce((sum, w) => sum + w.total, 0);
    const totalKharcha = kharchas.reduce((sum, k) => sum + k.amount, 0);
    const netPayable = totalEarned - totalKharcha;

    return { totalEarned, totalKharcha, netPayable, works, kharchas };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Labor Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="labors">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="labors">Labor Profiles</TabsTrigger>
              <TabsTrigger value="work">Work Entries</TabsTrigger>
              <TabsTrigger value="kharcha">Kharcha (Advances)</TabsTrigger>
            </TabsList>

            {/* Labor Profiles */}
            <TabsContent value="labors" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={laborDialog} onOpenChange={setLaborDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Labor
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingLaborId ? 'Edit' : 'Add'} Labor</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleLaborSubmit} className="space-y-4">
                      <div>
                        <Label>Labor Name</Label>
                        <Input
                          value={laborForm.name}
                          onChange={(e) => setLaborForm({ ...laborForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Category</Label>
                        <Select value={laborForm.categoryId} onValueChange={(value) => setLaborForm({ ...laborForm, categoryId: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {laborForm.categoryId && categories.find(c => c.id === laborForm.categoryId)?.paymentType === 'monthly_salary' && (
                        <div>
                          <Label>Monthly Salary</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={laborForm.monthlyRate}
                            onChange={(e) => setLaborForm({ ...laborForm, monthlyRate: e.target.value })}
                          />
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setLaborDialog(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Payment Type</TableHead>
                    <TableHead>Total Earned</TableHead>
                    <TableHead>Kharcha</TableHead>
                    <TableHead>Net Payable</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No labors yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    labors.map((labor) => {
                      const summary = getLaborSummary(labor.id);
                      return (
                        <TableRow key={labor.id}>
                          <TableCell>{labor.name}</TableCell>
                          <TableCell>{labor.category}</TableCell>
                          <TableCell className="capitalize">{labor.paymentType.replace('_', ' ')}</TableCell>
                          <TableCell>{formatCurrency(summary.totalEarned)}</TableCell>
                          <TableCell>{formatCurrency(summary.totalKharcha)}</TableCell>
                          <TableCell>
                            <span className={summary.netPayable > 0 ? 'text-green-600' : ''}>
                              {formatCurrency(summary.netPayable)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setViewingLaborId(labor.id);
                                  setLedgerDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingLaborId(labor.id);
                                  setLaborForm({
                                    name: labor.name,
                                    categoryId: labor.categoryId,
                                    monthlyRate: labor.monthlyRate?.toString() || '',
                                  });
                                  setLaborDialog(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Work Entries */}
            <TabsContent value="work" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={workDialog} onOpenChange={setWorkDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Work Entry
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Work Entry</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleWorkSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Date</Label>
                          <Input
                            type="date"
                            value={workForm.date}
                            onChange={(e) => setWorkForm({ ...workForm, date: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label>Labor</Label>
                          <Select value={workForm.laborId} onValueChange={(value) => setWorkForm({ ...workForm, laborId: value })}>
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
                        <div>
                          <Label>Article</Label>
                          <Select value={workForm.articleId} onValueChange={(value) => setWorkForm({ ...workForm, articleId: value })}>
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
                        </div>
                        <div>
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            step="1"
                            value={workForm.quantity}
                            onChange={(e) => setWorkForm({ ...workForm, quantity: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label>Rate</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={workForm.rate}
                            onChange={(e) => setWorkForm({ ...workForm, rate: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      {workForm.quantity && workForm.rate && (
                        <div className="p-3 bg-muted rounded">
                          <p>Total: {formatCurrency(parseFloat(workForm.quantity) * parseFloat(workForm.rate))}</p>
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setWorkDialog(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">Add Work</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Labor</TableHead>
                    <TableHead>Article</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No work entries yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    workEntries.map((work) => (
                      <TableRow key={work.id}>
                        <TableCell>{formatDate(work.date)}</TableCell>
                        <TableCell>{work.laborName}</TableCell>
                        <TableCell>{work.articleName}</TableCell>
                        <TableCell>{work.quantity}</TableCell>
                        <TableCell>{formatCurrency(work.rate)}</TableCell>
                        <TableCell>{formatCurrency(work.total)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Kharcha */}
            <TabsContent value="kharcha" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={kharchaDialog} onOpenChange={setKharchaDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Wallet className="mr-2 h-4 w-4" />
                      Add Kharcha
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Record Kharcha (Advance)</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleKharchaSubmit} className="space-y-4">
                      <div>
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={kharchaForm.date}
                          onChange={(e) => setKharchaForm({ ...kharchaForm, date: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Labor</Label>
                        <Select value={kharchaForm.laborId} onValueChange={(value) => setKharchaForm({ ...kharchaForm, laborId: value })}>
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
                      <div>
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={kharchaForm.amount}
                          onChange={(e) => setKharchaForm({ ...kharchaForm, amount: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Reason</Label>
                        <Input
                          value={kharchaForm.reason}
                          onChange={(e) => setKharchaForm({ ...kharchaForm, reason: e.target.value })}
                          placeholder="Reason for advance..."
                          required
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setKharchaDialog(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">Record Kharcha</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Labor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kharchaEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No kharcha entries yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    kharchaEntries.map((kharcha) => (
                      <TableRow key={kharcha.id}>
                        <TableCell>{formatDate(kharcha.date)}</TableCell>
                        <TableCell>{kharcha.laborName}</TableCell>
                        <TableCell>{formatCurrency(kharcha.amount)}</TableCell>
                        <TableCell>{kharcha.reason}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Labor Ledger Dialog */}
      <Dialog open={ledgerDialog} onOpenChange={setLedgerDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Labor Ledger - {labors.find(l => l.id === viewingLaborId)?.name}</DialogTitle>
          </DialogHeader>
          {viewingLaborId && (() => {
            const summary = getLaborSummary(viewingLaborId);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Total Earned</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl">{formatCurrency(summary.totalEarned)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Total Kharcha</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl">{formatCurrency(summary.totalKharcha)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Net Payable</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl text-green-600">{formatCurrency(summary.netPayable)}</p>
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <h3 className="mb-2">Work History</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Article</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.works.map((work) => (
                        <TableRow key={work.id}>
                          <TableCell>{formatDate(work.date)}</TableCell>
                          <TableCell>{work.articleName}</TableCell>
                          <TableCell>{work.quantity}</TableCell>
                          <TableCell>{formatCurrency(work.rate)}</TableCell>
                          <TableCell>{formatCurrency(work.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <h3 className="mb-2">Kharcha History</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.kharchas.map((kharcha) => (
                        <TableRow key={kharcha.id}>
                          <TableCell>{formatDate(kharcha.date)}</TableCell>
                          <TableCell>{formatCurrency(kharcha.amount)}</TableCell>
                          <TableCell>{kharcha.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
