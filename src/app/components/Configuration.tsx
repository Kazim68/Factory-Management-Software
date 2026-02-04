import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { generateId } from '../lib/utils';
import { Article, LaborCategory, ExpenseCategory } from '../types';
import { toast } from 'sonner';

export function Configuration() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [laborCategories, setLaborCategories] = useState<LaborCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);

  const [articleDialog, setArticleDialog] = useState(false);
  const [laborDialog, setLaborDialog] = useState(false);
  const [expenseDialog, setExpenseDialog] = useState(false);

  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editingLaborId, setEditingLaborId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [articleForm, setArticleForm] = useState({ name: '', defaultRate: '' });
  const [laborForm, setLaborForm] = useState({ name: '', paymentType: 'per_pair' as any });
  const [expenseForm, setExpenseForm] = useState({ name: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setArticles(storage.get<Article>(STORAGE_KEYS.ARTICLES));
    setLaborCategories(storage.get<LaborCategory>(STORAGE_KEYS.LABOR_CATEGORIES));
    setExpenseCategories(storage.get<ExpenseCategory>(STORAGE_KEYS.EXPENSE_CATEGORIES));
  };

  // Articles
  const handleArticleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const article: Article = {
      id: editingArticleId || generateId(),
      name: articleForm.name,
      defaultRate: articleForm.defaultRate ? parseFloat(articleForm.defaultRate) : undefined,
      createdAt: editingArticleId ? articles.find(a => a.id === editingArticleId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };

    if (editingArticleId) {
      storage.update(STORAGE_KEYS.ARTICLES, editingArticleId, article);
      toast.success('Article updated');
    } else {
      storage.add(STORAGE_KEYS.ARTICLES, article);
      toast.success('Article added');
    }

    loadData();
    setArticleForm({ name: '', defaultRate: '' });
    setEditingArticleId(null);
    setArticleDialog(false);
  };

  const editArticle = (article: Article) => {
    setEditingArticleId(article.id);
    setArticleForm({ name: article.name, defaultRate: article.defaultRate?.toString() || '' });
    setArticleDialog(true);
  };

  const deleteArticle = (id: string) => {
    if (confirm('Are you sure?')) {
      storage.delete(STORAGE_KEYS.ARTICLES, id);
      toast.success('Article deleted');
      loadData();
    }
  };

  // Labor Categories
  const handleLaborSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const category: LaborCategory = {
      id: editingLaborId || generateId(),
      name: laborForm.name,
      paymentType: laborForm.paymentType,
      createdAt: editingLaborId ? laborCategories.find(l => l.id === editingLaborId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };

    if (editingLaborId) {
      storage.update(STORAGE_KEYS.LABOR_CATEGORIES, editingLaborId, category);
      toast.success('Labor category updated');
    } else {
      storage.add(STORAGE_KEYS.LABOR_CATEGORIES, category);
      toast.success('Labor category added');
    }

    loadData();
    setLaborForm({ name: '', paymentType: 'per_pair' });
    setEditingLaborId(null);
    setLaborDialog(false);
  };

  const editLabor = (category: LaborCategory) => {
    setEditingLaborId(category.id);
    setLaborForm({ name: category.name, paymentType: category.paymentType });
    setLaborDialog(true);
  };

  const deleteLabor = (id: string) => {
    if (confirm('Are you sure?')) {
      storage.delete(STORAGE_KEYS.LABOR_CATEGORIES, id);
      toast.success('Labor category deleted');
      loadData();
    }
  };

  // Expense Categories
  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const category: ExpenseCategory = {
      id: editingExpenseId || generateId(),
      name: expenseForm.name,
      createdAt: editingExpenseId ? expenseCategories.find(e => e.id === editingExpenseId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };

    if (editingExpenseId) {
      storage.update(STORAGE_KEYS.EXPENSE_CATEGORIES, editingExpenseId, category);
      toast.success('Expense category updated');
    } else {
      storage.add(STORAGE_KEYS.EXPENSE_CATEGORIES, category);
      toast.success('Expense category added');
    }

    loadData();
    setExpenseForm({ name: '' });
    setEditingExpenseId(null);
    setExpenseDialog(false);
  };

  const editExpense = (category: ExpenseCategory) => {
    setEditingExpenseId(category.id);
    setExpenseForm({ name: category.name });
    setExpenseDialog(true);
  };

  const deleteExpense = (id: string) => {
    if (confirm('Are you sure?')) {
      storage.delete(STORAGE_KEYS.EXPENSE_CATEGORIES, id);
      toast.success('Expense category deleted');
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>System Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="articles">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="articles">Articles</TabsTrigger>
              <TabsTrigger value="labor">Labor Categories</TabsTrigger>
              <TabsTrigger value="expenses">Expense Categories</TabsTrigger>
            </TabsList>

            {/* Articles Tab */}
            <TabsContent value="articles" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={articleDialog} onOpenChange={setArticleDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Article
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingArticleId ? 'Edit' : 'Add'} Article</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleArticleSubmit} className="space-y-4">
                      <div>
                        <Label>Article Name</Label>
                        <Input
                          value={articleForm.name}
                          onChange={(e) => setArticleForm({ ...articleForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Default Rate (optional)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={articleForm.defaultRate}
                          onChange={(e) => setArticleForm({ ...articleForm, defaultRate: e.target.value })}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setArticleDialog(false)}>
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
                    <TableHead>Default Rate</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No articles yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    articles.map((article) => (
                      <TableRow key={article.id}>
                        <TableCell>{article.name}</TableCell>
                        <TableCell>{article.defaultRate || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => editArticle(article)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteArticle(article.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Labor Categories Tab */}
            <TabsContent value="labor" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={laborDialog} onOpenChange={setLaborDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Labor Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingLaborId ? 'Edit' : 'Add'} Labor Category</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleLaborSubmit} className="space-y-4">
                      <div>
                        <Label>Category Name</Label>
                        <Input
                          value={laborForm.name}
                          onChange={(e) => setLaborForm({ ...laborForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Payment Type</Label>
                        <Select value={laborForm.paymentType} onValueChange={(value: any) => setLaborForm({ ...laborForm, paymentType: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="per_dozen">Per Dozen</SelectItem>
                            <SelectItem value="per_pair">Per Pair</SelectItem>
                            <SelectItem value="per_upper">Per Upper</SelectItem>
                            <SelectItem value="monthly_salary">Monthly Salary</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
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
                    <TableHead>Payment Type</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {laborCategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No labor categories yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    laborCategories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>{category.name}</TableCell>
                        <TableCell className="capitalize">{category.paymentType.replace('_', ' ')}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => editLabor(category)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteLabor(category.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Expense Categories Tab */}
            <TabsContent value="expenses" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Expense Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingExpenseId ? 'Edit' : 'Add'} Expense Category</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleExpenseSubmit} className="space-y-4">
                      <div>
                        <Label>Category Name</Label>
                        <Input
                          value={expenseForm.name}
                          onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setExpenseDialog(false)}>
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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseCategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        No expense categories yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenseCategories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>{category.name}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => editExpense(category)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteExpense(category.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
