import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { formatCurrency } from '../lib/utils';
import {
  Party,
  Bill,
  RoznamchaEntry,
  ChemicalTransaction,
  RexineTransaction,
  MaterialTransaction,
  LaborWork,
  LaborKharcha,
} from '../types';
import { DollarSign, Users, FileText, TrendingUp, TrendingDown, Package } from 'lucide-react';

export function Dashboard() {
  const [stats, setStats] = useState({
    totalParties: 0,
    totalBills: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    totalReceivables: 0,
    totalPayables: 0,
    laborCost: 0,
    materialCost: 0,
  });

  useEffect(() => {
    calculateStats();
  }, []);

  const calculateStats = () => {
    const parties = storage.get<Party>(STORAGE_KEYS.PARTIES);
    const bills = storage.get<Bill>(STORAGE_KEYS.BILLS);
    const roznamcha = storage.get<RoznamchaEntry>(STORAGE_KEYS.ROZNAMCHA);
    const chemicals = storage.get<ChemicalTransaction>(STORAGE_KEYS.CHEMICALS);
    const rexine = storage.get<RexineTransaction>(STORAGE_KEYS.REXINE);
    const materials = storage.get<MaterialTransaction>(STORAGE_KEYS.MATERIALS);
    const laborWork = storage.get<LaborWork>(STORAGE_KEYS.LABOR_WORK);
    const laborKharcha = storage.get<LaborKharcha>(STORAGE_KEYS.LABOR_KHARCHA);

    // Calculate revenue from bills
    const totalRevenue = bills.reduce((sum, bill) => sum + bill.grandTotal, 0);

    // Calculate total expenses from roznamcha
    const totalExpenses = roznamcha.reduce((sum, entry) => sum + entry.amount, 0);

    // Calculate receivables (positive balances)
    const totalReceivables = parties
      .filter(p => p.currentBalance > 0)
      .reduce((sum, p) => sum + p.currentBalance, 0);

    // Calculate payables (negative balances)
    const totalPayables = parties
      .filter(p => p.currentBalance < 0)
      .reduce((sum, p) => sum + Math.abs(p.currentBalance), 0);

    // Labor costs
    const laborCost = laborWork.reduce((sum, work) => sum + work.total, 0);

    // Material costs
    const materialCost =
      chemicals.reduce((sum, c) => sum + c.total, 0) +
      rexine.reduce((sum, r) => sum + r.total, 0) +
      materials.reduce((sum, m) => sum + m.total, 0);

    setStats({
      totalParties: parties.length,
      totalBills: bills.length,
      totalRevenue,
      totalExpenses,
      totalReceivables,
      totalPayables,
      laborCost,
      materialCost,
    });
  };

  const netProfit = stats.totalRevenue - stats.totalExpenses - stats.laborCost - stats.materialCost;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2">Dashboard Overview</h2>
        <p className="text-muted-foreground">
          Summary of your factory operations and financials
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">From {stats.totalBills} bills</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(netProfit)}
            </div>
            <p className="text-xs text-muted-foreground">Revenue - Expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Receivables</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600">{formatCurrency(stats.totalReceivables)}</div>
            <p className="text-xs text-muted-foreground">Amount to receive</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Payables</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600">{formatCurrency(stats.totalPayables)}</div>
            <p className="text-xs text-muted-foreground">Amount to pay</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Parties</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.totalParties}</div>
            <p className="text-xs text-muted-foreground">Customers & Suppliers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Labor Costs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{formatCurrency(stats.laborCost)}</div>
            <p className="text-xs text-muted-foreground">Total labor expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Material Costs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{formatCurrency(stats.materialCost)}</div>
            <p className="text-xs text-muted-foreground">Chemical + Rexine + Materials</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Daily Expenses (Roznamcha)</span>
                <span className="font-medium">{formatCurrency(stats.totalExpenses)}</span>
              </div>
              <div className="flex justify-between">
                <span>Labor Costs</span>
                <span className="font-medium">{formatCurrency(stats.laborCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Material Costs</span>
                <span className="font-medium">{formatCurrency(stats.materialCost)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span>Total Expenses</span>
                <span className="font-medium">
                  {formatCurrency(stats.totalExpenses + stats.laborCost + stats.materialCost)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Total Revenue</span>
                <span className="font-medium text-green-600">{formatCurrency(stats.totalRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Expenses</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(stats.totalExpenses + stats.laborCost + stats.materialCost)}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span>Net Profit/Loss</span>
                <span className={`font-medium ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(netProfit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
