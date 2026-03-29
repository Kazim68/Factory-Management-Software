
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { formatCurrency } from "../lib/utils";
import { billApi, expenseApi, laborApi, partyApi, purchaseApi } from "../lib/api";
import { DollarSign, Users, FileText, TrendingUp, TrendingDown, Package } from "lucide-react";

export function Dashboard() {
  const [stats, setStats] = useState({
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
  });

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
          parties.map((party) =>
            partyApi.getLedger(party.id).catch(() => [])
          )
        );

        const totalRevenue = bills.reduce(
          (sum, bill) => sum + Number(bill.total),
          0
        );
        // Only misc outflows here. Labor and material are added separately.
        const miscExpenses = expenses.reduce((sum, entry) => {
          const amount = Number(entry.amount);
          return entry.module === "MISC" && amount > 0 ? sum + amount : sum;
        }, 0);

        const balances = parties.map((party, index) => {
          const ledger = ledgers[index];
          const delta = ledger.reduce(
            (sum, entry) =>
              sum + Number(entry.receivable ?? 0) - Number(entry.payable ?? 0),
            0
          );
          return delta;
        });

        const totalReceivables = balances
          .filter((balance) => balance > 0)
          .reduce((sum, balance) => sum + balance, 0);
        const partyPayables = balances
          .filter((balance) => balance < 0)
          .reduce((sum, balance) => sum + Math.abs(balance), 0);

        const laborLedgers = await Promise.all(
          labors.map((labor) =>
            laborApi.getLedger(labor.id).catch(() => ({
              totalEarnings: 0,
              totalAdvances: 0,
              netPayable: 0,
              workEntries: [],
              advances: [],
            }))
          )
        );

        const laborCost = laborLedgers.reduce(
          (sum, ledger) => sum + Number(ledger.totalEarnings),
          0
        );

        const paidByLabor = expenses
          .filter((entry) => entry.module === "LABOR" && entry.laborId && !entry.laborAdvanceId)
          .reduce<Record<string, number>>((acc, entry) => {
            if (!entry.laborId) return acc;
            acc[entry.laborId] = (acc[entry.laborId] ?? 0) + Number(entry.amount ?? 0);
            return acc;
          }, {});
        const laborPaid = Object.values(paidByLabor).reduce((sum, value) => sum + value, 0);

        const laborPendingPayable = laborLedgers.reduce((sum, ledger, index) => {
          const laborId = labors[index]?.id;
          if (!laborId) return sum;
          const pending = Number(ledger.netPayable ?? 0) - (paidByLabor[laborId] ?? 0);
          return sum + Math.max(pending, 0);
        }, 0);

        const totalPayables = partyPayables + laborPendingPayable;

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

        setStats({
          totalParties: parties.length,
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
        });
      } catch (error) {
        console.error(error);
      }
    };

    loadStats();
  }, []);

  const netProfit =
    stats.totalRevenue - stats.totalExpenses - stats.laborCost - stats.materialCost;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="mb-2">Dashboard Overview</h2>
          <p className="text-muted-foreground">Summary of your factory operations and financials</p>
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
            <div className={`text-2xl ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
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
            <p className="text-xs text-muted-foreground">
              Parties + Labor pending ({formatCurrency(stats.laborPendingPayable)} labor)
            </p>
          </CardContent>
        </Card>
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
