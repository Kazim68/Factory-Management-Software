import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { formatCurrency, getCurrentDate } from "../lib/utils";
import { billApi, expenseApi, laborApi, partyApi, purchaseApi } from "../lib/api";
import { DollarSign, Users, TrendingUp, TrendingDown, Package } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type DateFilter = "weekly" | "monthly" | "yearly" | "custom";

const toStartOfDay = (value: string) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toEndOfDay = (value: string) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const subtractDays = (value: Date, days: number) => {
  const date = new Date(value);
  date.setDate(date.getDate() - days);
  return date;
};

const toInputDate = (value: Date) => value.toISOString().slice(0, 10);

export function Dashboard() {
  const [rawData, setRawData] = useState<{
    bills: Awaited<ReturnType<typeof billApi.listBills>>;
    expenses: Awaited<ReturnType<typeof expenseApi.listExpenses>>;
    parties: Awaited<ReturnType<typeof partyApi.listParties>>;
    chemicals: Awaited<ReturnType<typeof purchaseApi.listChemicals>>;
    rexine: Awaited<ReturnType<typeof purchaseApi.listRexine>>;
    materials: Awaited<ReturnType<typeof purchaseApi.listMaterials>>;
    labors: Awaited<ReturnType<typeof laborApi.listProfiles>>;
  } | null>(null);

  const [dateFilter, setDateFilter] = useState<DateFilter>("monthly");
  const [customStart, setCustomStart] = useState(() => toInputDate(subtractDays(new Date(), 29)));
  const [customEnd, setCustomEnd] = useState(() => getCurrentDate());

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

        setRawData({
          bills,
          expenses,
          parties,
          chemicals,
          rexine,
          materials,
          labors,
        });
      } catch (error) {
        console.error(error);
      }
    };

    loadStats();
  }, []);

  const selectedRange = useMemo(() => {
    const now = new Date();
    const end = toEndOfDay(toInputDate(now));

    if (dateFilter === "weekly") {
      return { start: toStartOfDay(toInputDate(subtractDays(now, 6))), end };
    }

    if (dateFilter === "monthly") {
      return { start: toStartOfDay(toInputDate(subtractDays(now, 29))), end };
    }

    if (dateFilter === "yearly") {
      return { start: toStartOfDay(toInputDate(subtractDays(now, 364))), end };
    }

    const safeStart = customStart || getCurrentDate();
    const safeEnd = customEnd || getCurrentDate();
    const start = toStartOfDay(safeStart <= safeEnd ? safeStart : safeEnd);
    const customRangeEnd = toEndOfDay(safeEnd >= safeStart ? safeEnd : safeStart);
    return { start, end: customRangeEnd };
  }, [dateFilter, customStart, customEnd]);

  const stats = useMemo(() => {
    if (!rawData) {
      return {
        totalParties: 0,
        totalBills: 0,
        totalRevenue: 0,
        totalExpenses: 0,
        totalReceivables: 0,
        totalPayables: 0,
        laborPendingPayable: 0,
        laborPaid: 0,
        laborCost: 0,
        materialPaid: 0,
        materialPendingPayable: 0,
        materialCost: 0,
        profitLossTrend: [] as Array<{ label: string; profitLoss: number }>,
      };
    }

    const inRange = (value: string | Date) => {
      const date = new Date(value);
      return date >= selectedRange.start && date <= selectedRange.end;
    };

    const bills = rawData.bills.filter((bill) => inRange(bill.date));
    const expenses = rawData.expenses.filter((entry) => inRange(entry.date));
    const chemicals = rawData.chemicals.filter((item) => inRange(item.date));
    const rexine = rawData.rexine.filter((item) => inRange(item.date));
    const materials = rawData.materials.filter((item) => inRange(item.date));

    const totalRevenue = bills.reduce((sum, bill) => sum + Number(bill.total), 0);

    const miscExpenses = expenses.reduce((sum, entry) => {
      const amount = Number(entry.amount);
      return entry.module === "MISC" && amount > 0 ? sum + amount : sum;
    }, 0);

    const laborCost = expenses
      .filter((entry) => entry.module === "LABOR")
      .reduce((sum, entry) => sum + Math.max(Number(entry.amount ?? 0), 0), 0);

    const laborPaid = expenses
      .filter((entry) => entry.module === "LABOR" && entry.laborId && !entry.laborAdvanceId)
      .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);

    const totalPayables = rawData.parties.reduce((sum, party) => {
      const openingBalance = Number(party.openingBalance ?? 0);
      return openingBalance < 0 ? sum + Math.abs(openingBalance) : sum;
    }, 0);

    const totalReceivables = rawData.parties.reduce((sum, party) => {
      const openingBalance = Number(party.openingBalance ?? 0);
      return openingBalance > 0 ? sum + openingBalance : sum;
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

    const laborPendingPayable = Math.max(laborCost - laborPaid, 0);

    const grouped = new Map<string, { revenue: number; expenses: number }>();

    const getLabel = (dateValue: string | Date) => {
      const date = new Date(dateValue);
      if (dateFilter === "weekly") {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      }
      if (dateFilter === "yearly") {
        return date.toLocaleDateString([], { month: "short" });
      }
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    bills.forEach((bill) => {
      const key = getLabel(bill.date);
      const bucket = grouped.get(key) ?? { revenue: 0, expenses: 0 };
      bucket.revenue += Number(bill.total ?? 0);
      grouped.set(key, bucket);
    });

    expenses.forEach((entry) => {
      const key = getLabel(entry.date);
      const bucket = grouped.get(key) ?? { revenue: 0, expenses: 0 };
      const amount = Number(entry.amount ?? 0);
      if (amount > 0) {
        bucket.expenses += amount;
      }
      grouped.set(key, bucket);
    });

    const profitLossTrend = Array.from(grouped.entries()).map(([label, row]) => ({
      label,
      profitLoss: row.revenue - row.expenses,
    }));

    return {
      totalParties: rawData.parties.length,
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
      profitLossTrend,
    };
  }, [rawData, selectedRange.start, selectedRange.end, dateFilter]);

  const netProfit =
    stats.totalRevenue - stats.totalExpenses - stats.laborCost - stats.materialCost;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2">Dashboard Overview</h2>
        <p className="text-muted-foreground">
          Summary of your factory operations and financials
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-2">
              <Button variant={dateFilter === "weekly" ? "default" : "outline"} onClick={() => setDateFilter("weekly")}>Weekly</Button>
              <Button variant={dateFilter === "monthly" ? "default" : "outline"} onClick={() => setDateFilter("monthly")}>Monthly</Button>
              <Button variant={dateFilter === "yearly" ? "default" : "outline"} onClick={() => setDateFilter("yearly")}>Yearly</Button>
              <Button variant={dateFilter === "custom" ? "default" : "outline"} onClick={() => setDateFilter("custom")}>Custom Range</Button>
            </div>
            {dateFilter === "custom" && (
              <>
                <div>
                  <Label className="mb-1 inline-block">Start</Label>
                  <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1 inline-block">End</Label>
                  <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm">Total Revenue</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl">{formatCurrency(stats.totalRevenue)}</div><p className="text-xs text-muted-foreground">From {stats.totalBills} bills</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm">Net Profit</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className={`text-2xl ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(netProfit)}</div><p className="text-xs text-muted-foreground">Revenue - Expenses</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm">Receivables</CardTitle><TrendingUp className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-2xl text-green-600">{formatCurrency(stats.totalReceivables)}</div><p className="text-xs text-muted-foreground">Amount to receive</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm">Payables</CardTitle><TrendingDown className="h-4 w-4 text-red-600" /></CardHeader><CardContent><div className="text-2xl text-red-600">{formatCurrency(stats.totalPayables)}</div><p className="text-xs text-muted-foreground">Parties + Labor pending ({formatCurrency(stats.laborPendingPayable)} labor)</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm">Total Parties</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl">{stats.totalParties}</div><p className="text-xs text-muted-foreground">Customers & Suppliers</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm">Labor Costs</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl">{formatCurrency(stats.laborCost)}</div><p className="text-xs text-muted-foreground">Paid {formatCurrency(stats.laborPaid)} • Pending {formatCurrency(stats.laborPendingPayable)}</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm">Material Costs</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl">{formatCurrency(stats.materialCost)}</div><p className="text-xs text-muted-foreground">Paid {formatCurrency(stats.materialPaid)} • Pending {formatCurrency(stats.materialPendingPayable)}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Expense Breakdown</CardTitle></CardHeader><CardContent><div className="space-y-3"><div className="flex justify-between"><span>Misc Expenses</span><span className="font-medium">{formatCurrency(stats.totalExpenses)}</span></div><div className="flex justify-between"><span>Labor Costs</span><span className="font-medium">{formatCurrency(stats.laborCost)}</span></div><div className="flex justify-between"><span>Material Costs</span><span className="font-medium">{formatCurrency(stats.materialCost)}</span></div><div className="border-t pt-3 flex justify-between"><span>Total Expenses</span><span className="font-medium">{formatCurrency(stats.totalExpenses + stats.laborCost + stats.materialCost)}</span></div></div></CardContent></Card>

        <Card><CardHeader><CardTitle>Financial Summary</CardTitle></CardHeader><CardContent><div className="space-y-3"><div className="flex justify-between"><span>Total Revenue</span><span className="font-medium text-green-600">{formatCurrency(stats.totalRevenue)}</span></div><div className="flex justify-between"><span>Total Expenses</span><span className="font-medium text-red-600">{formatCurrency(stats.totalExpenses + stats.laborCost + stats.materialCost)}</span></div><div className="border-t pt-3 flex justify-between"><span>Net Profit/Loss</span><span className={`font-medium ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(netProfit)}</span></div></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profit / Loss Graph</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.profitLossTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                <Bar dataKey="profitLoss" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
