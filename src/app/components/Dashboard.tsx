import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  formatCurrency,
  formatDateTime,
  getCurrentDate,
  getDateKey,
  getMonthKey,
  getYearKey,
  toPakistanBoundaryDate,
} from "../lib/utils";
import {
  billApi,
  expenseApi,
  laborApi,
  partyApi,
  purchaseApi,
} from "../lib/api";
import {
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Package,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DateFilter = "daily" | "weekly" | "monthly" | "yearly" | "custom";

type DashboardData = {
  bills: Awaited<ReturnType<typeof billApi.listBills>>;
  expenses: Awaited<ReturnType<typeof expenseApi.listExpenses>>;
  parties: Awaited<ReturnType<typeof partyApi.listParties>>;
  chemicals: Awaited<ReturnType<typeof purchaseApi.listChemicals>>;
  rexine: Awaited<ReturnType<typeof purchaseApi.listRexine>>;
  materials: Awaited<ReturnType<typeof purchaseApi.listMaterials>>;
  labors: Awaited<ReturnType<typeof laborApi.listProfiles>>;
};

const EMPTY_STATS = {
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

const parseDateValue = (value: string | Date) => {
  if (value instanceof Date) {
    return new Date(value);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return toPakistanBoundaryDate(value, "start");
  }

  return new Date(value);
};

const toLocalDateKey = (value: string | Date) => {
  return getDateKey(value);
};

const toStartOfDay = (value: string | Date) => {
  return toPakistanBoundaryDate(value, "start");
};

const toEndOfDay = (value: string | Date) => {
  return toPakistanBoundaryDate(value, "end");
};

const subtractDays = (value: Date, days: number) => {
  const date = new Date(value);
  date.setDate(date.getDate() - days);
  return date;
};

const toMonthKey = (value: Date) =>
  getMonthKey(value);

const toYearKey = (value: Date) => getYearKey(value);

export function Dashboard() {
  const [rawData, setRawData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dateFilter, setDateFilter] = useState<DateFilter>("monthly");
  const [customStart, setCustomStart] = useState(() =>
    toLocalDateKey(subtractDays(new Date(), 29)),
  );
  const [customEnd, setCustomEnd] = useState(() => getCurrentDate());

  const clearFilters = () => {
    setDateFilter("monthly");
    setCustomStart(toLocalDateKey(subtractDays(new Date(), 29)));
    setCustomEnd(getCurrentDate());
  };

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
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

        if (!active) return;

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
        if (!active) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Dashboard data could not be loaded.",
        );
        console.error(error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadStats();

    return () => {
      active = false;
    };
  }, []);

  const referenceDate = useMemo(() => {
    if (!rawData) {
      return new Date();
    }

    const latestTimestamp = [
      ...rawData.bills.map((item) => item.date),
      ...rawData.expenses.map((item) => item.date),
      ...rawData.chemicals.map((item) => item.date),
      ...rawData.rexine.map((item) => item.date),
      ...rawData.materials.map((item) => item.date),
    ].reduce<number | null>((latest, value) => {
      const timestamp = parseDateValue(value).getTime();
      if (Number.isNaN(timestamp)) {
        return latest;
      }
      return latest == null || timestamp > latest ? timestamp : latest;
    }, null);

    return latestTimestamp == null ? new Date() : new Date(latestTimestamp);
  }, [rawData]);

  const selectedRange = useMemo(() => {
    const anchorDate = referenceDate;
    const anchorDateKey = toLocalDateKey(anchorDate);
    const anchorEnd = toEndOfDay(anchorDateKey);

    if (dateFilter === "daily") {
      return { start: toStartOfDay(anchorDateKey), end: anchorEnd };
    }

    if (dateFilter === "weekly") {
      return {
        start: toStartOfDay(toLocalDateKey(subtractDays(anchorDate, 6))),
        end: anchorEnd,
      };
    }

    if (dateFilter === "monthly") {
      const monthsToShow = 12;
      const firstMonth = new Date(
        anchorDate.getFullYear(),
        anchorDate.getMonth() - (monthsToShow - 1),
        1,
      );
      return { start: toStartOfDay(firstMonth), end: anchorEnd };
    }

    if (dateFilter === "yearly") {
      const yearsToShow = 5;
      const firstYear = new Date(
        anchorDate.getFullYear() - (yearsToShow - 1),
        0,
        1,
      );
      return { start: toStartOfDay(firstYear), end: anchorEnd };
    }

    const safeStart = customStart || toLocalDateKey(new Date());
    const safeEnd = customEnd || toLocalDateKey(new Date());
    const start = toStartOfDay(safeStart <= safeEnd ? safeStart : safeEnd);
    const customRangeEnd = toEndOfDay(
      safeEnd >= safeStart ? safeEnd : safeStart,
    );
    return { start, end: customRangeEnd };
  }, [dateFilter, customStart, customEnd, referenceDate]);

  const computeStats = () => {
    if (!rawData) {
      return EMPTY_STATS;
    }

    const inRange = (value: string | Date) => {
      const date = parseDateValue(value);
      return date >= selectedRange.start && date <= selectedRange.end;
    };

    const bills = rawData.bills.filter((bill) => inRange(bill.date));
    const expenses = rawData.expenses.filter((entry) => inRange(entry.date));
    const chemicals = rawData.chemicals.filter((item) => inRange(item.date));
    const rexine = rawData.rexine.filter((item) => inRange(item.date));
    const materials = rawData.materials.filter((item) => inRange(item.date));

    const getExpenseCategory = (entry: (typeof expenses)[number]) => {
      const sourceSystem = String(entry.sourceSystem ?? "").toUpperCase();
      if (sourceSystem === "PARTY_PAYMENT_PAID") return "SUPPLIER_PAYMENT";
      if (
        sourceSystem === "PARTY_PAYMENT_RECEIVED" ||
        sourceSystem === "BILL_PAYMENT_RECEIVED"
      )
        return "CUSTOMER_PAYMENT";
      return entry.module;
    };

    const isMallSaleEntry = (entry: (typeof expenses)[number]) => {
      const sourceSystem = String(entry.sourceSystem ?? "").toUpperCase();
      return sourceSystem === "B_MALL_SALE" || sourceSystem === "C_MALL_SALE";
    };

    const mallSaleRevenue = expenses.reduce((sum, entry) => {
      if (!isMallSaleEntry(entry)) return sum;
      const amount = Number(entry.amount ?? 0);
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);

    const totalRevenue =
      bills.reduce((sum, bill) => sum + Number(bill.total), 0) +
      mallSaleRevenue;

    const miscExpenses = expenses.reduce((sum, entry) => {
      const amount = Number(entry.amount);
      return getExpenseCategory(entry) === "MISC" && amount > 0
        ? sum + amount
        : sum;
    }, 0);

    const laborCost = expenses
      .filter((entry) => entry.module === "LABOR")
      .reduce((sum, entry) => sum + Math.max(Number(entry.amount ?? 0), 0), 0);

    const laborPaid = expenses
      .filter(
        (entry) =>
          entry.module === "LABOR" && entry.laborId && !entry.laborAdvanceId,
      )
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

    const materialPaid = [...chemicals, ...rexine, ...materials]
      .filter(
        (item) => String(item.paymentType ?? "CASH").toUpperCase() === "CASH",
      )
      .reduce((sum, item) => sum + Number(item.totalAmount), 0);

    const materialPendingPayable = Math.max(materialCost - materialPaid, 0);
    const laborPendingPayable = Math.max(laborCost - laborPaid, 0);

    type TrendBucket = { label: string; revenue: number; expenses: number };
    const trendBuckets = new Map<string, TrendBucket>();

    const buildDailyBuckets = () => {
      const cursor = new Date(selectedRange.start);
      while (cursor <= selectedRange.end) {
        const key = toLocalDateKey(cursor);
        const label =
          dateFilter === "weekly"
            ? formatDateTime(cursor, "en-GB", { weekday: "short" })
            : formatDateTime(cursor, "en-GB", {
                month: "short",
                day: "numeric",
              });
        trendBuckets.set(key, { label, revenue: 0, expenses: 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
    };

    const buildMonthlyBuckets = () => {
      const cursor = new Date(
        selectedRange.start.getFullYear(),
        selectedRange.start.getMonth(),
        1,
      );
      while (cursor <= selectedRange.end) {
        const key = toMonthKey(cursor);
        trendBuckets.set(key, {
          label: formatDateTime(cursor, "en-GB", {
            month: "short",
            year: "numeric",
          }),
          revenue: 0,
          expenses: 0,
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    };

    const buildYearlyBuckets = () => {
      for (
        let year = selectedRange.start.getFullYear();
        year <= selectedRange.end.getFullYear();
        year += 1
      ) {
        const key = toYearKey(new Date(year, 0, 1));
        trendBuckets.set(key, { label: key, revenue: 0, expenses: 0 });
      }
    };

    if (dateFilter === "monthly") buildMonthlyBuckets();
    else if (dateFilter === "yearly") buildYearlyBuckets();
    else buildDailyBuckets();

    const addToBucket = (
      value: Date,
      amount: number,
      target: "revenue" | "expenses",
    ) => {
      const key =
        dateFilter === "monthly"
          ? toMonthKey(value)
          : dateFilter === "yearly"
            ? toYearKey(value)
            : toLocalDateKey(value);

      const bucket = trendBuckets.get(key);
      if (bucket) bucket[target] += amount;
    };

    bills.forEach((bill) => {
      addToBucket(parseDateValue(bill.date), Number(bill.total ?? 0), "revenue");
    });

    expenses.filter(isMallSaleEntry).forEach((entry) => {
      const amount = Number(entry.amount ?? 0);
      if (amount < 0) {
        addToBucket(parseDateValue(entry.date), Math.abs(amount), "revenue");
      }
    });

    expenses
      .filter((entry) => getExpenseCategory(entry) === "MISC")
      .forEach((entry) => {
        const amount = Number(entry.amount ?? 0);
        if (amount > 0) {
          addToBucket(parseDateValue(entry.date), amount, "expenses");
        }
      });

    expenses
      .filter((entry) => entry.module === "LABOR")
      .forEach((entry) => {
        const amount = Math.max(Number(entry.amount ?? 0), 0);
        if (amount > 0) {
          addToBucket(parseDateValue(entry.date), amount, "expenses");
        }
      });

    [...chemicals, ...rexine, ...materials].forEach((item) => {
      const amount = Number(item.totalAmount ?? 0);
      if (amount > 0) {
        addToBucket(parseDateValue(item.date), amount, "expenses");
      }
    });

    let runningProfitLoss = 0;
    const profitLossTrend = Array.from(trendBuckets.values()).map((bucket) => {
      runningProfitLoss += bucket.revenue - bucket.expenses;
      return {
        label: bucket.label,
        profitLoss: runningProfitLoss,
      };
    });

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
  };

  const stats = computeStats();

  const netProfit =
    stats.totalRevenue -
    stats.totalExpenses -
    stats.laborCost -
    stats.materialCost;

  if (isLoading && !rawData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Loading dashboard data...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loadError && !rawData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-red-600">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border border-dashed bg-muted/30 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px]">
                <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                  Period
                </Label>
                <Select
                  value={dateFilter}
                  onValueChange={(value) => setDateFilter(value as DateFilter)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {dateFilter === "custom" && (
                <>
                  <div>
                    <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                      Start
                    </Label>
                    <Input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                      End
                    </Label>
                    <Input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                </>
              )}
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={clearFilters}
              >
                <Filter className="mr-2 h-4 w-4" />
                Reset Filters
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              From {stats.totalBills} bills
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}
            >
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
            <div className="text-2xl text-green-600">
              {formatCurrency(stats.totalReceivables)}
            </div>
            <p className="text-xs text-muted-foreground">Amount to receive</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Payables</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600">
              {formatCurrency(stats.totalPayables)}
            </div>
            <p className="text-xs text-muted-foreground">
              Parties + Labor pending (
              {formatCurrency(stats.laborPendingPayable)} labor)
            </p>
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
            <p className="text-xs text-muted-foreground">
              Customers & Suppliers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Labor Costs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{formatCurrency(stats.laborCost)}</div>
            <p className="text-xs text-muted-foreground">
              Paid {formatCurrency(stats.laborPaid)} • Pending{" "}
              {formatCurrency(stats.laborPendingPayable)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Material Costs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{formatCurrency(stats.materialCost)}</div>
            <p className="text-xs text-muted-foreground">
              Paid {formatCurrency(stats.materialPaid)} • Pending{" "}
              {formatCurrency(stats.materialPendingPayable)}
            </p>
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
                <span>Misc Expenses</span>
                <span className="font-medium">
                  {formatCurrency(stats.totalExpenses)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Labor Costs</span>
                <span className="font-medium">
                  {formatCurrency(stats.laborCost)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Material Costs</span>
                <span className="font-medium">
                  {formatCurrency(stats.materialCost)}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span>Total Expenses</span>
                <span className="font-medium">
                  {formatCurrency(
                    stats.totalExpenses + stats.laborCost + stats.materialCost,
                  )}
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
                <span className="font-medium text-green-600">
                  {formatCurrency(stats.totalRevenue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Expenses</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(
                    stats.totalExpenses + stats.laborCost + stats.materialCost,
                  )}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span>Net Profit/Loss</span>
                <span
                  className={`font-medium ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatCurrency(netProfit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profit / Loss Graph</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.profitLossTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis domain={["dataMin", "dataMax"]} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(Number(value))}
                  labelFormatter={(label: string) => label}
                />
                <Line
                  type="linear"
                  dataKey="profitLoss"
                  name="Profit / Loss"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
