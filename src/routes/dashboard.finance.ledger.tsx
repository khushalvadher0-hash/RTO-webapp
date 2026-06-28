// src/routes/dashboard.finance.ledger.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  subscribeLedgerEntries,
  recordLedgerEntry,
  type LedgerEntry,
} from "@/lib/financeService";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { BookOpen, Plus, Filter, Wallet } from "lucide-react";

export const Route = createFileRoute("/dashboard/finance/ledger")({
  component: AccountsLedgerPage,
});

function AccountsLedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAccount, setFilterAccount] = useState("all");

  // Adjustment Modal state
  const [showAdj, setShowAdj] = useState(false);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjType, setAdjType] = useState<"Debit" | "Credit">("Debit");
  const [adjAccount, setAdjAccount] = useState("ICICI Bank");
  const [adjRemarks, setAdjRemarks] = useState("");
  const [savingAdj, setSavingAdj] = useState(false);

  const session = getSession();
  const userRole = session?.role || "employee";
  const username = session?.name || session?.username || "unknown";
  const isStaff = userRole === "employee" || userRole === "viewer";

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeLedgerEntries((list) => {
      setEntries(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const accounts = [
    "Cash Account",
    "ICICI Bank",
    "HDFC Bank",
    "Axis Bank",
    "SBI",
    "Other",
  ];

  // Group and compute balances for each account
  const accountBalances = useMemo(() => {
    const map: Record<string, number> = {
      "Cash Account": 0,
      "ICICI Bank": 0,
      "HDFC Bank": 0,
      "Axis Bank": 0,
      "SBI": 0,
      "Other": 0,
    };

    // Sort ascending to build running balances properly
    const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    sorted.forEach((e) => {
      const amt = e.amount || 0;
      if (e.type === "Debit") {
        map[e.account] = (map[e.account] || 0) + amt;
      } else {
        map[e.account] = (map[e.account] || 0) - amt;
      }
    });

    return map;
  }, [entries]);

  // Compute total ledger balance (sum of all bank/cash assets)
  const totalBalance = useMemo(() => {
    return Object.values(accountBalances).reduce((sum, val) => sum + val, 0);
  }, [accountBalances]);

  // Filtered and sorted list for display
  const displayEntries = useMemo(() => {
    // If filter is specific, we re-calculate the running balance specifically for that account's history!
    let list = [...entries];
    if (filterAccount !== "all") {
      list = list.filter((e) => e.account === filterAccount);
    }

    // Sort ascending to calculate running balance, then reverse for display
    const sorted = list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    let running = 0;
    const computed = sorted.map((e) => {
      if (e.type === "Debit") {
        running += e.amount;
      } else {
        running -= e.amount;
      }
      return { ...e, balance: running };
    });

    return computed.reverse(); // Newest first
  }, [entries, filterAccount]);

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStaff) {
      return toast.error("Access Denied: Staff cannot add ledger adjustments.");
    }
    const amt = Number(adjAmount);
    if (!adjAmount || isNaN(amt) || amt <= 0) {
      return toast.error("Please enter a valid amount");
    }

    setSavingAdj(true);
    try {
      await recordLedgerEntry({
        timestamp: new Date().toISOString(),
        type: adjType,
        amount: amt,
        account: adjAccount,
        referenceId: "MANUAL-ADJ",
        remarks: `${adjRemarks || "Manual Adjustment"} (by ${username})`,
      });
      toast.success("Ledger entry created!");
      setAdjAmount("");
      setAdjRemarks("");
      setShowAdj(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add ledger entry");
    } finally {
      setSavingAdj(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Accounts Ledger
          </h2>
          <p className="text-muted-foreground text-sm">
            Maintain double-entry debit, credit, and running balance sheets for cash & banking vaults.
          </p>
        </div>

        {!isStaff && (
          <Button onClick={() => setShowAdj(true)} className="flex items-center gap-1.5 self-start">
            <Plus className="size-4" /> Adjustment Entry
          </Button>
        )}
      </div>

      {/* Account Balances Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <Card className="shadow-sm border border-slate-100 bg-indigo-50/50 border-indigo-100 col-span-2">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Total Vault Value</p>
              <h3 className="text-xl font-black text-indigo-950 mt-1">{formatCurrency(totalBalance)}</h3>
            </div>
            <Wallet className="size-8 text-indigo-500" />
          </CardContent>
        </Card>

        {accounts.map((acc) => (
          <Card key={acc} className="shadow-sm border border-slate-100">
            <CardContent className="p-3">
              <p className="text-[9px] font-semibold text-muted-foreground truncate uppercase">{acc}</p>
              <h4 className="text-sm font-bold text-gray-800 mt-0.5">
                ₹{accountBalances[acc].toLocaleString("en-IN")}
              </h4>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 text-xs w-full md:w-auto">
          <span className="font-bold text-gray-500 uppercase flex items-center gap-1.5 mr-2">
            <Filter className="size-3.5" /> Selected Ledger:
          </span>
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="py-1.5 px-3 border rounded-md bg-white text-gray-700 font-semibold"
          >
            <option value="all">All Vaults Consolidated</option>
            {accounts.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <Card className="shadow-sm border border-slate-100">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground text-sm">
              No ledger entries recorded for this account.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-slate-50 uppercase text-[9px] font-bold text-muted-foreground">
                    <th className="p-3">Transaction Date</th>
                    <th className="p-3">Account Vault</th>
                    <th className="p-3">Reference / Remarks</th>
                    <th className="p-3 text-right">Debit (Inbound)</th>
                    <th className="p-3 text-right">Credit (Outbound)</th>
                    <th className="p-3 text-right">Running Vault Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-700">
                  {displayEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono">{formatDate(e.timestamp)}</td>
                      <td className="p-3 font-semibold text-slate-700">{e.account}</td>
                      <td className="p-3 text-slate-600">{e.remarks}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">
                        {e.type === "Debit" ? `+₹${e.amount.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-rose-600">
                        {e.type === "Credit" ? `-₹${e.amount.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-gray-900 bg-slate-50/50">
                        ₹{e.balance.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjustment Modal */}
      {showAdj && (
        <Dialog open={showAdj} onOpenChange={setShowAdj}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-gray-800">
                New Vault Adjustment Entry
              </DialogTitle>
              <CardDescription>
                Direct manual ledger corrections.
              </CardDescription>
            </DialogHeader>

            <form onSubmit={handleCreateAdjustment} className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-gray-500">Transaction Type</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="adjType"
                      value="Debit"
                      checked={adjType === "Debit"}
                      onChange={() => setAdjType("Debit")}
                      className="size-4 text-emerald-600"
                    />
                    <span>Debit (Add / Receive Money)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="adjType"
                      value="Credit"
                      checked={adjType === "Credit"}
                      onChange={() => setAdjType("Credit")}
                      className="size-4 text-rose-600"
                    />
                    <span>Credit (Pay / Deduct Money)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-gray-500">Target Vault Account</Label>
                <select
                  value={adjAccount}
                  onChange={(e) => setAdjAccount(e.target.value)}
                  className="w-full text-xs border rounded-md p-2 bg-white"
                >
                  {accounts.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-gray-500">Adjustment Amount (₹) *</Label>
                <Input
                  type="number"
                  placeholder="e.g. 10000"
                  required
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  className="bg-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-gray-500">Remarks / Reason *</Label>
                <Input
                  placeholder="e.g. Seed Balance, cash reconciliation"
                  required
                  value={adjRemarks}
                  onChange={(e) => setAdjRemarks(e.target.value)}
                  className="bg-white text-xs"
                />
              </div>

              <DialogFooter className="pt-2 border-t mt-4">
                <Button variant="outline" type="button" onClick={() => setShowAdj(false)} disabled={savingAdj}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingAdj}>
                  {savingAdj ? "Saving..." : "Record Entry"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
