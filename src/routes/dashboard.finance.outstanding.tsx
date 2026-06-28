// src/routes/dashboard.finance.outstanding.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  subscribeAndSyncFinance,
  type FinanceRecord,
} from "@/lib/financeService";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/pdfGenerator";
import { Search, AlertCircle, User, Filter } from "lucide-react";

export const Route = createFileRoute("/dashboard/finance/outstanding")({
  component: OutstandingPaymentsPage,
});

function OutstandingPaymentsPage() {
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPeriod, setFilterPeriod] = useState<"all" | "today" | "week" | "month" | "overdue">("all");
  const [filterEmployee, setFilterEmployee] = useState("all");

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAndSyncFinance((list) => {
      setRecords(list.filter((r) => r.balanceAmount > 0)); // Only show outstanding
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Get list of unique employees for filtering
  const employees = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.assignedEmployee) set.add(r.assignedEmployee);
    });
    return Array.from(set);
  }, [records]);

  // Apply filters
  const filteredRecords = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    // Week boundaries
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Month boundaries
    const currentYearMonth = today.toISOString().slice(0, 7); // "YYYY-MM"

    return records.filter((r) => {
      // 1. Search term
      const matchesSearch =
        r.clientName.toLowerCase().includes(search.toLowerCase()) ||
        r.invoiceNumber.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      // 2. Employee filter
      if (filterEmployee !== "all" && r.assignedEmployee !== filterEmployee) return false;

      // 3. Period filter
      if (!r.collectionDate) return filterPeriod === "all";

      const colDate = new Date(r.collectionDate);
      colDate.setHours(0, 0, 0, 0);

      switch (filterPeriod) {
        case "today":
          return r.collectionDate === todayStr;
        case "week":
          return colDate >= startOfWeek && colDate <= endOfWeek;
        case "month":
          return r.collectionDate.startsWith(currentYearMonth);
        case "overdue":
          return colDate.getTime() < today.getTime();
        default:
          return true;
      }
    });
  }, [records, search, filterPeriod, filterEmployee]);

  const getDaysOverdueBadge = (days: number | undefined) => {
    if (!days || days <= 0) return <span className="text-gray-400">—</span>;
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 flex items-center gap-1 w-max">
        <AlertCircle className="size-3" /> {days} Days Overdue
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Outstanding Payments
        </h2>
        <p className="text-muted-foreground text-sm">
          Monitor invoices with outstanding balances, overdue collection status, and assigned employees.
        </p>
      </div>

      {/* Filter panel */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
        <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
          <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5 mr-2">
            <Filter className="size-3.5" /> Filter by Date:
          </span>
          <button
            onClick={() => setFilterPeriod("all")}
            className={`px-3 py-1 rounded-md text-xs font-semibold border transition ${
              filterPeriod === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white text-gray-600 border-gray-200 hover:bg-slate-50"
            }`}
          >
            All Outstanding
          </button>
          <button
            onClick={() => setFilterPeriod("today")}
            className={`px-3 py-1 rounded-md text-xs font-semibold border transition ${
              filterPeriod === "today"
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-slate-50"
            }`}
          >
            Due Today
          </button>
          <button
            onClick={() => setFilterPeriod("week")}
            className={`px-3 py-1 rounded-md text-xs font-semibold border transition ${
              filterPeriod === "week"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-slate-50"
            }`}
          >
            Due This Week
          </button>
          <button
            onClick={() => setFilterPeriod("month")}
            className={`px-3 py-1 rounded-md text-xs font-semibold border transition ${
              filterPeriod === "month"
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-slate-50"
            }`}
          >
            Due This Month
          </button>
          <button
            onClick={() => setFilterPeriod("overdue")}
            className={`px-3 py-1 rounded-md text-xs font-semibold border transition ${
              filterPeriod === "overdue"
                ? "bg-rose-600 text-white border-rose-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-slate-50"
            }`}
          >
            Overdue
          </button>
        </div>

        <div className="flex gap-3 w-full md:w-auto items-center">
          <div className="relative flex-1 md:w-48">
            <User className="absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-md bg-white text-gray-700"
            >
              <option value="all">All Employees</option>
              {employees.map((emp) => (
                <option key={emp} value={emp}>
                  {emp}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 md:w-56">
            <Search className="absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search Client/Inv..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 py-1.5 h-8 text-xs bg-white"
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <Card className="shadow-sm border border-slate-100">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground text-sm">
              No outstanding records found matching search filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-slate-50 uppercase text-[9px] font-bold text-muted-foreground">
                    <th className="p-3">Client</th>
                    <th className="p-3">Invoice Number</th>
                    <th className="p-3 text-right">Invoice Amount</th>
                    <th className="p-3 text-right">Received</th>
                    <th className="p-3 text-right">Outstanding Balance</th>
                    <th className="p-3">Collection Date</th>
                    <th className="p-3">Days Overdue</th>
                    <th className="p-3">Assigned Employee</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-700">
                  {filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-semibold text-gray-900">{r.clientName}</td>
                      <td className="p-3 font-mono">{r.invoiceNumber}</td>
                      <td className="p-3 text-right font-mono">₹{r.invoiceAmount.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right font-mono text-emerald-600">₹{r.receivedAmount.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-600">₹{r.balanceAmount.toLocaleString("en-IN")}</td>
                      <td className="p-3 font-mono">{formatDate(r.collectionDate)}</td>
                      <td className="p-3">{getDaysOverdueBadge(r.daysOverdue)}</td>
                      <td className="p-3 text-slate-600">{r.assignedEmployee || "—"}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          r.paymentStatus === "Partially Paid"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-orange-100 text-orange-800"
                        }`}>
                          {r.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
