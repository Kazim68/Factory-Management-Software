import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { formatCurrency, getCurrentDate } from "../lib/utils";
import { billApi, expenseApi, laborApi, partyApi, purchaseApi } from "../lib/api";
import { DollarSign, Users, TrendingUp, TrendingDown, Package } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ApiBill,
  ApiChemicalPurchase,
  ApiExpenseEntry,
  ApiLaborLedger,
  ApiLaborProfile,
  ApiMaterialPurchase,
  ApiParty,
  ApiRexinePurchase,
} from "../types/api";

type FilterType = "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";

type LoadedData = {
  bills: ApiBill[];
  expenses: ApiExpenseEntry[];
  parties: ApiParty[];
  chemicals: ApiChemicalPurchase[];
  rexine: ApiRexinePurchase[];
  materials: ApiMaterialPurchase[];
  labors: ApiLaborProfile[];
  laborLedgers: ApiLaborLedger[];
  ledgers: { receivable: number; payable: number }[];
};

const toISODate = (date: Date) => date.toISOString().slice(0, 10);

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getPresetRange = (filter: Exclude<FilterType, "CUSTOM">) => {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);

  if (filter === "WEEKLY") start.setDate(end.getDate() - 6);
  if (filter === "MONTHLY") start.setMonth(end.getMonth() - 1);
  if (filter === "YEARLY") start.setFullYear(end.getFullYear() - 1);

  return { start: toISODate(start), end: toISODate(end) };
};

export function Dashboard() {
  const [filterType, setFilterType] = useState<FilterType>("MONTHLY");
  const [customRange, setCustomRange] = useState(() => {
    const monthly = getPresetRange("MONTHLY");
    return { start: monthly.start, end: getCurrentDate() };
  });
  const [data, setData] = useState<LoadedData | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [bills, expenses, parties, chemicals, rexine, materials, labors] =
          await Promise.all([
            billApi.listBills(),
            expenseApi.listExpenses(),
            partyApi.listParties(),
            purchaseApi.listChemicals(),
            purchaseApi.listRexine(),
            purchaseApi.listMaterials(),
            laborApi.listProfiles({ status: "ALL" }),
          ]);

        const ledgers = await Promise.all(
          parties.map((party) => partyApi.getLedger(party.id).catch(() => [])),
        );

        const ledgerTotals = ledgers.map((ledger) =>
          ledger.reduce(
            (sum, entry) => ({
              receivable: sum.receivable + Number(entry.receivable ?? 0),
              payable: sum.payable + Number(entry.payable ?? 0),
            }),
            { receivable: 0, payable: 0 },
          ),
        );

        const laborLedgers = await Promise.all(
          labors.map((labor) =>
            laborApi.getLedger(labor.id).catch(() => ({
              totalEarnings: 0,
              totalAdvances: 0,
              netPayable: 0,
              workEntries: [],
              advances: [],
            })),
          ),
        );

        setData({
          bills,
          expenses,
          parties,
          chemicals,
          rexine,
          materials,
          labors,
          laborLedgers,
          ledgers: ledgerTotals,
        });
      } catch (error) {
        console.error(error);
      }
    };

    loadStats();
  }, []);

  const activeRange = useMemo(() => {
    if (filterType === "CUSTOM") {
      return {
        start: customRange.start || getPresetRange("MONTHLY").start,
        end: customRange.end || getCurrentDate(),
      };
    }
    return getPresetRange(filterType);
  }, [customRange.end, customRange.start, filterType]);

  const inRange = (value?: string | null) => {
    const target = parseDate(value);
    const start = parseDate(activeRange.start);
    const end = parseDate(activeRange.end);
    if (!target || !start || !end) return false;
    return target >= start && target <= end;
  };

  const filtered = useMemo(() => {
    if (!data) return null;

    const bills = data.bills.filter((bill) => inRange(bill.date || bill.createdAt));
    const expenses = data.expenses.filter((entry) => inRange(entry.date || entry.createdAt));
    const chemicals = data.chemicals.filter((item) => inRange(item.date || item.createdAt));
    const rexine = data.rexine.filter((item) => inRange(item.date || item.createdAt));
    const materials = data.materials.filter((item) => inRange(item.date || item.createdAt));

    const totalRevenue = bills.reduce((sum, bill) => sum + Number(bill.total), 0);

    const miscExpenses = expenses.reduce((sum, entry) => {
      const amount = Number(entry.amount);
      return entry.module === "MISC" && amount > 0 ? sum + amount : sum;
    }, 0);

    const totalReceivables = data.ledgers
      .map((ledger) => ledger.receivable - ledger.payable)
      .filter((balance) => balance > 0)
      .reduce((sum, balance) => sum + balance, 0);

    const partyPayables = data.ledgers
      .map((ledger) => ledger.receivable - ledger.payable)
      .filter((balance) => balance < 0)
      .reduce((sum, balance) => sum + Math.abs(balance), 0);

    const laborCost = data.laborLedgers.reduce(
      (sum, ledger) => sum + Number(ledger.totalEarnings),
      0,
    );

    const paidByLabor = expenses
      .filter((entry) => entry.module === "LABOR" && entry.laborId && !entry.laborAdvanceId)
      .reduce<Record<string, number>>((acc, entry) => {
        if (!entry.laborId) return acc;
        acc[entry.laborId] = (acc[entry.laborId] ?? 0) + Number(entry.amount ?? 0);
        return acc;
      }, {});

    const laborPaid = Object.values(paidByLabor).reduce((sum, value) => sum + value, 0);

    const laborPendingPayable = data.laborLedgers.reduce((sum, ledger, index) => {
      const laborId = data.labors[index]?.id;
      if (!laborId) return sum;
      const pending = Number(ledger.netPayable ?? 0) - (paidByLabor[laborId] ?? 0);
      return sum + Math.max(pending, 0);
    }, 0);

    const materialCost =
      chemicals.reduce((sum, item) => sum + Number(item.totalAmount), 0) +
      rexine.reduce((sum, item) => sum + Number(item.totalAmount), 0) +
      materials.reduce((sum, item) => sum + Number(item.totalAmount), 0);

    const materialPaid =
      chemicals
        .filter((item) => String(item.paymentType ?? "CASH").toUpperCase() === "CASH")
        .reduce((sum, item) => sum + Number(item.totalAmount), 0) +
      rexine
        .filter((item) => String(item.paymentType ?? "CASH").toUpperCase() === "CASH")
        .reduce((sum, item) => sum + Number(item.totalAmount), 0) +
      materials
        .filter((item) => String(item.paymentType ?? "CASH").toUpperCase() === "CASH")
        .reduce((sum, item) => sum + Number(item.totalAmount), 0);

    const materialPendingPayable = Math.max(materialCost - materialPaid, 0);

    const totalPayables = partyPayables + laborPendingPayable;
    const totalExpenses = miscExpenses + laborCost + materialCost;
    const netProfit = totalRevenue - totalExpenses;

    return {
      totalParties: data.parties.length,
      totalBills: bills.length,
      totalRevenue,
      totalExpenses: miscExpenses,
      totalReceivables,
      totalPayables,
      laborPendingPayable,
      laborPaid,
      laborCost,
      materialPaid,
      materialPendingPayable,
      materialCost,
      netProfit,
    };
  }, [data, activeRange.end, activeRange.start]);

  const profitLossData = useMemo(() => {
    if (!data) return [] as Array<{ label: string; profit: number }>;

    const bucketMap = new Map<string, { revenue: number; expenses: number }>();
    const labelFor = (value: string | null | undefined) => {
      const date = parseDate(value);
      if (!date) return null;
      if (!inRange(toISODate(date))) return null;

      if (filterType === "WEEKLY") return toISODate(date).slice(5);
      if (filterType === "MONTHLY" || filterType === "CUSTOM") return toISODate(date);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    };

    const addRevenue = (label: string, value: number) => {
      const current = bucketMap.get(label) ?? { revenue: 0, expenses: 0 };
      current.revenue += value;
      bucketMap.set(label, current);
    };

    const addExpense = (label: string, value: number) => {
      const current = bucketMap.get(label) ?? { revenue: 0, expenses: 0 };
      current.expenses += value;
      bucketMap.set(label, current);
    };

    data.bills.forEach((bill) => {
      const label = labelFor(bill.date || bill.createdAt);
      if (label) addRevenue(label, Number(bill.total ?? 0));
    });

    data.expenses.forEach((expense) => {
      const label = labelFor(expense.date || expense.createdAt);
      if (label) addExpense(label, Math.max(Number(expense.amount ?? 0), 0));
    });

    data.chemicals.forEach((purchase) => {
      const label = labelFor(purchase.date || purchase.createdAt);
      if (label) addExpense(label, Number(purchase.totalAmount ?? 0));
    });
    data.rexine.forEach((purchase) => {
      const label = labelFor(purchase.date || purchase.createdAt);
      if (label) addExpense(label, Number(purchase.totalAmount ?? 0));
    });
    data.materials.forEach((purchase) => {
      const label = labelFor(purchase.date || purchase.createdAt);
      if (label) addExpense(label, Number(purchase.totalAmount ?? 0));
    });

    return [...bucketMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, totals]) => ({ label, profit: totals.revenue - totals.expenses }));
  }, [data, filterType, activeRange.start, activeRange.end]);

  if (!filtered) {
    return <div className="text-sm text-muted-foreground">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="mb-2">Dashboard Overview</h2>
          <p className="text-muted-foreground">Summary of your factory operations and financials</p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Button variant={filterType === "WEEKLY" ? "default" : "outline"} onClick={() => setFilterType("WEEKLY")}>Weekly</Button>
          <Button variant={filterType === "MONTHLY" ? "default" : "outline"} onClick={() => setFilterType("MONTHLY")}>Monthly</Button>
          <Button variant={filterType === "YEARLY" ? "default" : "outline"} onClick={() => setFilterType("YEARLY")}>Yearly</Button>
          <Button variant={filterType === "CUSTOM" ? "default" : "outline"} onClick={() => setFilterType("CUSTOM")}>Custom Range</Button>
          {filterType === "CUSTOM" && (
            <>
              <Input type="date" value={customRange.start} onChange={(e) => setCustomRange((prev) => ({ ...prev, start: e.target.value }))} className="w-[160px]" />
              <Input type="date" value={customRange.end} onChange={(e) => setCustomRange((prev) => ({ ...prev, end: e.target.value }))} className="w-[160px]" />
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm">Total Revenue</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl">{formatCurrency(filtered.totalRevenue)}</div><p className="text-xs text-muted-foreground">From {filtered.totalBills} bills</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm">Net Profit</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className={`text-2xl ${filtered.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(filtered.netProfit)}</div><p className="text-xs text-muted-foreground">Revenue - Expenses</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm">Receivables</CardTitle><TrendingUp className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-2xl text-green-600">{formatCurrency(filtered.totalReceivables)}</div><p className="text-xs text-muted-foreground">Amount to receive</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm">Payables</CardTitle><TrendingDown className="h-4 w-4 text-red-600" /></CardHeader><CardContent><div className="text-2xl text-red-600">{formatCurrency(filtered.totalPayables)}</div><p className="text-xs text-muted-foreground">Parties + Labor pending ({formatCurrency(filtered.laborPendingPayable)} labor)</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profit / Loss Graph</CardTitle>
        </CardHeader>
        <CardContent>
          {profitLossData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chart data for selected range.</p>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={profitLossData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="profit" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm">Total Parties</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl">{filtered.totalParties}</div><p className="text-xs text-muted-foreground">Customers & Suppliers</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm">Labor Costs</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl">{formatCurrency(filtered.laborCost)}</div><p className="text-xs text-muted-foreground">Paid {formatCurrency(filtered.laborPaid)} • Pending {formatCurrency(filtered.laborPendingPayable)}</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm">Material Costs</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl">{formatCurrency(filtered.materialCost)}</div><p className="text-xs text-muted-foreground">Paid {formatCurrency(filtered.materialPaid)} • Pending {formatCurrency(filtered.materialPendingPayable)}</p></CardContent></Card>
      </div>
    </div>
  );
}
