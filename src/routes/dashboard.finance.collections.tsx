// src/routes/dashboard.finance.collections.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  subscribeAndSyncFinance,
  updateRecordCollectionDate,
  setBhaylubhaRequirement,
  approveRecordBhaylubha,
  recordPaymentEntry,
  type FinanceRecord,
} from "@/lib/financeService";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import {
  Search,
  Calendar,
  CheckCircle,
  HelpCircle,
  Clock,
  Plus,
  Lock,
  MessageSquare,
  Clipboard,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/finance/collections")({
  component: CollectionsPage,
});

function CollectionsPage() {
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modals / Details states
  const [selectedRecord, setSelectedRecord] = useState<FinanceRecord | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<any>("UPI");
  const [payAccount, setPayAccount] = useState<any>("ICICI Bank");
  const [payRemarks, setPayRemarks] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingPayment, setSavingPayment] = useState(false);

  // Approval state
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [approving, setApproving] = useState(false);

  const session = getSession();
  const userRole = session?.role || "employee"; // "admin" | "manager" | "employee" | "viewer"
  const username = session?.name || session?.username || "unknown";

  const isStaff = userRole === "employee" || userRole === "viewer";
  const isManager = userRole === "manager";
  const isAdmin = userRole === "admin";

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAndSyncFinance((list) => {
      setRecords(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const term = search.toLowerCase();
      return (
        r.clientName.toLowerCase().includes(term) ||
        r.invoiceNumber.toLowerCase().includes(term)
      );
    });
  }, [records, search]);

  const handleUpdateDate = async (recordId: string, date: string) => {
    try {
      await updateRecordCollectionDate(recordId, date, username);
      toast.success("Collection date updated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to update date");
    }
  };

  const handleToggleBhaylubhaFlag = async (recordId: string, required: boolean) => {
    if (isStaff) {
      return toast.error("Access Denied: Staff cannot modify finance settings.");
    }
    try {
      await setBhaylubhaRequirement(recordId, required, username);
      toast.success(required ? "Approval required enabled" : "Approval requirement cleared");
    } catch (e: any) {
      toast.error(e.message || "Failed to toggle approval requirement");
    }
  };

  const handleApprove = async () => {
    if (!selectedRecord) return;
    if (!isAdmin) {
      return toast.error("Access Denied: Only Admins can grant approvals.");
    }
    setApproving(true);
    try {
      await approveRecordBhaylubha(selectedRecord.id, username, approvalRemarks);
      toast.success("Bhaylubha approval granted!");
      setApprovalRemarks("");
      setSelectedRecord(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to approve record");
    } finally {
      setApproving(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    if (isStaff) {
      return toast.error("Access Denied: Staff cannot record payments.");
    }

    const amt = Number(payAmount);
    if (!payAmount || isNaN(amt) || amt <= 0) {
      return toast.error("Enter a valid payment amount");
    }

    setSavingPayment(true);
    try {
      await recordPaymentEntry(selectedRecord.id, {
        amount: amt,
        method: payMethod,
        accountName: payAccount,
        remarks: payRemarks,
        receivedBy: username,
        paymentDate: payDate,
      });
      toast.success("Payment recorded successfully!");
      setPayAmount("");
      setPayRemarks("");
      setSelectedRecord(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to record payment");
    } finally {
      setSavingPayment(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Paid":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">Paid</span>;
      case "Partially Paid":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Partially Paid</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800">Pending</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Collections Scheduling
          </h2>
          <p className="text-muted-foreground text-sm">
            Manage planned collections, track approval flags, and record client settlement entries.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search client or invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-white"
          />
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
              No collection records matching filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-slate-50 uppercase text-[9px] font-bold text-muted-foreground">
                    <th className="p-3">Client</th>
                    <th className="p-3">Invoice</th>
                    <th className="p-3 text-right">Invoice Amount</th>
                    <th className="p-3 text-right">Collected</th>
                    <th className="p-3 text-right">Outstanding</th>
                    <th className="p-3">Collection Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Bhaylubha Approval</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-700">
                  {filteredRecords.map((r) => {
                    const isApprovalPending = r.askBhaylubha;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-semibold text-gray-900">{r.clientName}</td>
                        <td className="p-3 font-mono">{r.invoiceNumber}</td>
                        <td className="p-3 text-right font-mono font-medium">₹{r.invoiceAmount.toLocaleString("en-IN")}</td>
                        <td className="p-3 text-right font-mono font-medium text-emerald-600">₹{r.receivedAmount.toLocaleString("en-IN")}</td>
                        <td className="p-3 text-right font-mono font-bold text-rose-600">₹{r.balanceAmount.toLocaleString("en-IN")}</td>
                        <td className="p-3">
                          <input
                            type="date"
                            value={r.collectionDate || ""}
                            onChange={(e) => handleUpdateDate(r.id, e.target.value)}
                            disabled={isStaff}
                            className="bg-white border rounded p-1 text-[11px] font-mono focus:ring-1 focus:ring-primary w-28 disabled:bg-slate-50"
                          />
                        </td>
                        <td className="p-3">{getStatusBadge(r.paymentStatus)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isApprovalPending}
                              onChange={(e) => handleToggleBhaylubhaFlag(r.id, e.target.checked)}
                              disabled={isStaff}
                              className="size-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                            />
                            {isApprovalPending && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                Pending Approval
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedRecord(r)}
                            className="text-indigo-600 hover:text-indigo-900 text-xs px-2 py-1 h-auto"
                          >
                            Manage
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Payment / Manage Modal */}
      {selectedRecord && (
        <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-gray-800">
                Manage Collection — {selectedRecord.invoiceNumber}
              </DialogTitle>
              <CardDescription>
                Client: {selectedRecord.clientName} | Pending: ₹{selectedRecord.balanceAmount.toLocaleString("en-IN")}
              </CardDescription>
            </DialogHeader>

            <div className="grid gap-6 md:grid-cols-2 mt-2">
              {/* Payment Section */}
              <div className="space-y-4 border-r pr-4">
                <h3 className="text-xs font-bold uppercase text-gray-500 border-b pb-1">
                  Record Received Payment
                </h3>

                {isStaff ? (
                  <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md text-slate-500 text-[11px]">
                    <Lock className="size-4" />
                    <span>Staff can view history but cannot record payments.</span>
                  </div>
                ) : selectedRecord.paymentStatus === "Paid" ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-medium">
                    Invoice is fully Paid.
                  </div>
                ) : (
                  <form onSubmit={handleRecordPayment} className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-gray-500">Amount Received (₹) *</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 5000"
                        required
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="bg-white text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-gray-500">Payment Mode</Label>
                      <select
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value as any)}
                        className="w-full text-xs border rounded-md p-2 bg-white"
                      >
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Online">Online</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-gray-500">Deposit Account</Label>
                      <select
                        value={payAccount}
                        onChange={(e) => setPayAccount(e.target.value as any)}
                        className="w-full text-xs border rounded-md p-2 bg-white"
                      >
                        <option value="Cash Account">Cash Account</option>
                        <option value="ICICI Bank">ICICI Bank</option>
                        <option value="HDFC Bank">HDFC Bank</option>
                        <option value="Axis Bank">Axis Bank</option>
                        <option value="SBI">SBI</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-gray-500">Payment Date</Label>
                      <Input
                        type="date"
                        required
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="bg-white text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-gray-500">Remarks</Label>
                      <Input
                        placeholder="Txn ID, memo details..."
                        value={payRemarks}
                        onChange={(e) => setPayRemarks(e.target.value)}
                        className="bg-white text-xs"
                      />
                    </div>

                    <Button type="submit" disabled={savingPayment} className="w-full text-xs py-1 h-auto mt-2">
                      {savingPayment ? "Recording..." : "Add Payment"}
                    </Button>
                  </form>
                )}
              </div>

              {/* Approval Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase text-gray-500 border-b pb-1">
                  Bhaylubha Approval Log
                </h3>

                {selectedRecord.askBhaylubha ? (
                  <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg text-xs space-y-2">
                    <p className="font-semibold text-amber-800 flex items-center gap-1.5">
                      <HelpCircle className="size-4 animate-bounce" /> Bhaylubha Approval Required
                    </p>
                    <p className="text-[10px] text-amber-700">
                      Settlement is locked until approval is granted.
                    </p>

                    {isAdmin ? (
                      <div className="pt-2 space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-gray-500">Approval Remarks</Label>
                        <Input
                          placeholder="Add approval comment..."
                          value={approvalRemarks}
                          onChange={(e) => setApprovalRemarks(e.target.value)}
                          className="bg-white text-xs"
                        />
                        <Button
                          onClick={handleApprove}
                          disabled={approving}
                          className="w-full text-xs bg-amber-600 hover:bg-amber-700 text-white py-1 h-auto"
                        >
                          {approving ? "Approving..." : "Grant Approval"}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-red-600 font-bold bg-red-50 p-1.5 rounded">
                        Only Admins can approve.
                      </p>
                    )}
                  </div>
                ) : selectedRecord.approvedBy ? (
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-emerald-800 flex items-center gap-1">
                      <CheckCircle className="size-4" /> Approval Granted
                    </p>
                    <div className="text-[10px] text-gray-600 space-y-0.5">
                      <p><strong>Approved By:</strong> {selectedRecord.approvedBy}</p>
                      <p><strong>Approved Date:</strong> {formatDate(selectedRecord.approvedAt)}</p>
                      {selectedRecord.approvedRemarks && (
                        <p><strong>Remarks:</strong> {selectedRecord.approvedRemarks}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">
                    No approval required for this collection.
                  </p>
                )}

                {/* Staff specific note-taking tool */}
                {isStaff && (
                  <div className="pt-2 space-y-2 border-t mt-4">
                    <h4 className="text-[10px] font-bold uppercase text-gray-400">Add Collection Note</h4>
                    <textarea
                      placeholder="Type a collection remark or note..."
                      className="w-full border rounded p-2 text-xs h-16 bg-white"
                      value={payRemarks}
                      onChange={(e) => setPayRemarks(e.target.value)}
                    />
                    <Button
                      onClick={async () => {
                        if (!payRemarks.trim()) return toast.error("Write something first");
                        try {
                          await updateRecordCollectionDate(
                            selectedRecord.id,
                            selectedRecord.collectionDate,
                            `${username} (Staff Note: ${payRemarks.trim()})`
                          );
                          toast.success("Note logged successfully!");
                          setPayRemarks("");
                          setSelectedRecord(null);
                        } catch (err: any) {
                          toast.error(err.message || "Failed to log note");
                        }
                      }}
                      className="w-full text-xs h-auto py-1"
                    >
                      Log Note
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4 pt-2 border-t">
              <Button variant="outline" onClick={() => setSelectedRecord(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
