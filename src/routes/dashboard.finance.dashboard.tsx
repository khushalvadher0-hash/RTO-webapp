// src/routes/dashboard.finance.dashboard.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  subscribeAndSyncFinance,
  type FinanceRecord,
} from "@/lib/financeService";
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  HelpCircle,
  ArrowRight,
  TrendingDown,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/pdfGenerator";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/dashboard/finance/dashboard")({
  component: FinanceDashboard,
});

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6"];

function FinanceDashboard() {
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAndSyncFinance((list) => {
      setRecords(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Compute KPIs
  const kpis = useMemo(() => {
    let totalReceivable = 0;
    let totalReceived = 0;
    let outstandingAmount = 0;
    let overdueCollections = 0;
    let collectionsToday = 0;
    let collectionsThisMonth = 0;
    let approvalPendingCount = 0;

    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentYearMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    records.forEach((r) => {
      totalReceivable += r.invoiceAmount || 0;
      totalReceived += r.receivedAmount || 0;
      outstandingAmount += r.balanceAmount || 0;

      if (r.askBhaylubha) {
        approvalPendingCount++;
      }

      if (r.paymentStatus !== "Paid") {
        if (r.collectionDate) {
          const colDate = new Date(r.collectionDate);
          colDate.setHours(0, 0, 0, 0);

          if (colDate.getTime() < today.getTime()) {
            overdueCollections += r.balanceAmount || 0;
          }
          if (r.collectionDate === todayStr) {
            collectionsToday += r.balanceAmount || 0;
          }
          if (r.collectionDate.startsWith(currentYearMonth)) {
            collectionsThisMonth += r.balanceAmount || 0;
          }
        }
      }
    });

    return {
      totalReceivable,
      totalReceived,
      outstandingAmount,
      overdueCollections,
      collectionsToday,
      collectionsThisMonth,
      approvalPendingCount,
    };
  }, [records]);

  // Upcoming collections widget data
  const upcomingCollections = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return records
      .filter((r) => r.paymentStatus !== "Paid" && r.collectionDate)
      .map((r) => {
        const colDate = new Date(r.collectionDate);
        colDate.setHours(0, 0, 0, 0);
        let color: "red" | "orange" | "green" = "green";
        if (r.collectionDate === todayStr) {
          color = "orange";
        } else if (colDate.getTime() < today.getTime()) {
          color = "red";
        }
        return {
          id: r.id,
          date: r.collectionDate,
          client: r.clientName,
          amount: r.balanceAmount,
          color,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);
  }, [records]);

  // Top Defaulters (highest outstanding balance)
  const topDefaulters = useMemo(() => {
    const map: Record<string, { name: string; outstanding: number }> = {};
    records.forEach((r) => {
      if (!map[r.clientId]) {
        map[r.clientId] = { name: r.clientName, outstanding: 0 };
      }
      map[r.clientId].outstanding += r.balanceAmount;
    });

    return Object.values(map)
      .filter((c) => c.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5);
  }, [records]);

  // Top Paying Clients (highest total received)
  const topPayingClients = useMemo(() => {
    const map: Record<string, { name: string; received: number }> = {};
    records.forEach((r) => {
      if (!map[r.clientId]) {
        map[r.clientId] = { name: r.clientName, received: 0 };
      }
      map[r.clientId].received += r.receivedAmount;
    });

    return Object.values(map)
      .filter((c) => c.received > 0)
      .sort((a, b) => b.received - a.received)
      .slice(0, 5);
  }, [records]);

  // Chart data: Pending vs Paid status breakdown
  const statusPieData = useMemo(() => {
    let pending = 0;
    let partial = 0;
    let paid = 0;

    records.forEach((r) => {
      if (r.paymentStatus === "Paid") paid++;
      else if (r.paymentStatus === "Partially Paid") partial++;
      else pending++;
    });

    return [
      { name: "Paid", value: paid },
      { name: "Partially Paid", value: partial },
      { name: "Pending", value: pending },
    ];
  }, [records]);

  // Chart data: Monthly Recovery trend
  const monthlyRecoveryData = useMemo(() => {
    const monthsMap: Record<string, { month: string; invoiced: number; recovered: number }> = {};

    records.forEach((r) => {
      const date = new Date(r.createdAt);
      if (isNaN(date.getTime())) return;
      const monthStr = date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      if (!monthsMap[monthStr]) {
        monthsMap[monthStr] = { month: monthStr, invoiced: 0, recovered: 0 };
      }
      monthsMap[monthStr].invoiced += r.invoiceAmount;
      monthsMap[monthStr].recovered += r.receivedAmount;
    });

    return Object.values(monthsMap).slice(-6); // Last 6 months
  }, [records]);

  // Chart data: Collection Trend
  const trendData = useMemo(() => {
    const trendMap: Record<string, number> = {};
    records.forEach((r) => {
      if (r.paymentStatus === "Paid" || r.paymentStatus === "Partially Paid") {
        const dateStr = r.updatedAt ? r.updatedAt.slice(0, 10) : r.createdAt.slice(0, 10);
        trendMap[dateStr] = (trendMap[dateStr] || 0) + r.receivedAmount;
      }
    });

    return Object.entries(trendMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10); // Last 10 days of payments
  }, [records]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Finance Dashboard
        </h2>
        <p className="text-muted-foreground text-sm">
          Real-time payment tracking, collections pipeline, and financial performance metrics.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Card className="shadow-sm border border-slate-100 hover:shadow-md transition duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Receivable
            </CardTitle>
            <DollarSign className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{formatCurrency(kpis.totalReceivable)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Accumulated gross invoice values</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-slate-100 hover:shadow-md transition duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Received
            </CardTitle>
            <CheckCircle className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600">{formatCurrency(kpis.totalReceived)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Total revenue collected so far</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-slate-100 hover:shadow-md transition duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Outstanding Amount
            </CardTitle>
            <Clock className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-600">{formatCurrency(kpis.outstandingAmount)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Pending payments in pipeline</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-slate-100 hover:shadow-md transition duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Overdue Collections
            </CardTitle>
            <AlertCircle className="size-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-600">{formatCurrency(kpis.overdueCollections)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Balances past scheduled collection date</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border border-slate-100 hover:shadow-md transition duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
              Collections Today
            </CardTitle>
            <TrendingUp className="size-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(kpis.collectionsToday)}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-slate-100 hover:shadow-md transition duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
              Collections This Month
            </CardTitle>
            <TrendingUp className="size-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(kpis.collectionsThisMonth)}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-slate-100 hover:shadow-md transition duration-200 bg-amber-50/55 border-amber-100">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs font-bold text-amber-800 uppercase">
              Bhaylubha Approval Pending
            </CardTitle>
            <HelpCircle className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-700">{kpis.approvalPendingCount} Records</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts & Widgets section */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Upcoming Collections widget */}
        <Card className="md:col-span-1 shadow-sm border border-slate-100">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-gray-800 uppercase tracking-wide">
              Upcoming Collections
            </CardTitle>
            <CardDescription className="text-xs">Chronological collection schedule</CardDescription>
          </CardHeader>
          <CardContent className="px-2">
            {upcomingCollections.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground">
                No upcoming collections scheduled.
              </div>
            ) : (
              <div className="divide-y max-h-[380px] overflow-y-auto px-4">
                {upcomingCollections.map((u) => (
                  <div key={u.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-gray-800 truncate max-w-[140px]">{u.client}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(u.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-gray-700">₹{u.amount.toLocaleString("en-IN")}</p>
                      <span
                        className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          u.color === "red"
                            ? "bg-rose-100 text-rose-800"
                            : u.color === "orange"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {u.color === "red" ? "Overdue" : u.color === "orange" ? "Today" : "Upcoming"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collection Trend Line Chart */}
        <Card className="md:col-span-2 shadow-sm border border-slate-100">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-gray-800 uppercase tracking-wide">
              Collection Trend
            </CardTitle>
            <CardDescription className="text-xs">Recent daily payment volumes received</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip formatter={(v: any) => [`₹${v.toLocaleString("en-IN")}`, "Collected"]} />
                <Line type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Pending vs Paid pie */}
        <Card className="shadow-sm border border-slate-100">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-gray-800 uppercase tracking-wide">
              Pending vs Paid Invoices
            </CardTitle>
            <CardDescription className="text-xs">Invoice status distribution</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip />
                <ChartLegend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Recovery Bar Chart */}
        <Card className="shadow-sm border border-slate-100">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-gray-800 uppercase tracking-wide">
              Monthly Recovery Rate
            </CardTitle>
            <CardDescription className="text-xs">Gross Invoiced vs Recovered amounts</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRecoveryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip />
                <ChartLegend />
                <Bar dataKey="invoiced" name="Invoiced" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recovered" name="Recovered" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top paying / Defaulters side by side lists */}
        <Card className="shadow-sm border border-slate-100">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-gray-800 uppercase tracking-wide">
              Top paying / Defaulter clients
            </CardTitle>
            <CardDescription className="text-xs">Financial performance ranking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[300px] overflow-y-auto text-xs">
            <div>
              <h5 className="font-bold text-[10px] uppercase text-rose-600 border-b pb-1 mb-2">
                Top Defaulters
              </h5>
              {topDefaulters.length === 0 ? (
                <p className="text-[10px] text-muted-foreground py-2">No outstanding debtors.</p>
              ) : (
                <div className="space-y-1.5">
                  {topDefaulters.map((d, i) => (
                    <div key={i} className="flex justify-between items-center py-1">
                      <span className="font-medium text-gray-800 truncate max-w-[150px]">{d.name}</span>
                      <span className="font-mono font-bold text-rose-600">₹{d.outstanding.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h5 className="font-bold text-[10px] uppercase text-emerald-600 border-b pb-1 mb-2">
                Top Paying Clients
              </h5>
              {topPayingClients.length === 0 ? (
                <p className="text-[10px] text-muted-foreground py-2">No payment entries received.</p>
              ) : (
                <div className="space-y-1.5">
                  {topPayingClients.map((d, i) => (
                    <div key={i} className="flex justify-between items-center py-1">
                      <span className="font-medium text-gray-800 truncate max-w-[150px]">{d.name}</span>
                      <span className="font-mono font-bold text-emerald-600">₹{d.received.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
