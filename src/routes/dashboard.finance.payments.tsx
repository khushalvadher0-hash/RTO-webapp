// src/routes/dashboard.finance.payments.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  subscribePaymentHistory,
  type PaymentHistoryItem,
} from "@/lib/financeService";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/pdfGenerator";
import { Search, Filter, Receipt } from "lucide-react";

export const Route = createFileRoute("/dashboard/finance/payments")({
  component: PaymentEntriesPage,
});

function PaymentEntriesPage() {
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");

  useEffect(() => {
    setLoading(true);
    const unsub = subscribePaymentHistory((list) => {
      setPayments(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const methods = ["Cash", "UPI", "Bank Transfer", "Cheque", "Online"];
  const accounts = ["Cash Account", "ICICI Bank", "HDFC Bank", "Axis Bank", "SBI", "Other"];

  // Filter payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // 1. Search term (Invoice or remarks or user)
      const term = search.toLowerCase();
      const matchesSearch =
        search === "" ||
        p.invoiceId.toLowerCase().includes(term) ||
        (p as any).invoiceNumber?.toLowerCase().includes(term) ||
        p.receivedBy.toLowerCase().includes(term) ||
        p.remarks.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // 2. Method filter
      if (filterMethod !== "all" && p.method !== filterMethod) return false;

      // 3. Account filter
      if (filterAccount !== "all" && p.accountName !== filterAccount) return false;

      return true;
    });
  }, [payments, search, filterMethod, filterAccount]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Payment Entries
        </h2>
        <p className="text-muted-foreground text-sm">
          View all payment receipts, deposited bank accounts, payment modes, and collectors.
        </p>
      </div>

      {/* Filter panel */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
        <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-gray-500 uppercase flex items-center gap-1.5 mr-2">
              <Filter className="size-3.5" /> Method:
            </span>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="py-1.5 px-3 border rounded-md bg-white text-gray-700 font-semibold"
            >
              <option value="all">All Methods</option>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-gray-500 uppercase flex items-center gap-1.5 mr-2">
              Account:
            </span>
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="py-1.5 px-3 border rounded-md bg-white text-gray-700 font-semibold"
            >
              <option value="all">All Accounts</option>
              {accounts.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice, collector, memo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-white py-1.5 text-xs h-8"
          />
        </div>
      </div>

      {/* Table Card */}
      <Card className="shadow-sm border border-slate-100">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground text-sm">
              No payment entries found matching filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-slate-50 uppercase text-[9px] font-bold text-muted-foreground">
                    <th className="p-3">Receipt ID</th>
                    <th className="p-3">Invoice ID</th>
                    <th className="p-3 text-right">Amount Received</th>
                    <th className="p-3">Payment Method</th>
                    <th className="p-3">Deposited Account</th>
                    <th className="p-3">Collected By</th>
                    <th className="p-3">Transaction Date</th>
                    <th className="p-3">Remarks / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-700">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-semibold text-indigo-600 font-mono">#{p.id?.slice(-6).toUpperCase()}</td>
                      <td className="p-3 font-mono">{p.invoiceId || "—"}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">₹{p.amount.toLocaleString("en-IN")}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-800">
                          {p.method}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-700">{p.accountName}</td>
                      <td className="p-3 font-medium text-slate-700">{p.receivedBy}</td>
                      <td className="p-3 font-mono text-slate-500">{formatDate(p.receivedAt)}</td>
                      <td className="p-3 text-muted-foreground italic truncate max-w-[200px]" title={p.remarks || ""}>
                        {p.remarks || "—"}
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
