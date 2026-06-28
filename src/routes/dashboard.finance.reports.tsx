// src/routes/dashboard.finance.reports.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  subscribeAndSyncFinance,
  subscribePaymentHistory,
  type FinanceRecord,
  type PaymentHistoryItem,
} from "@/lib/financeService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { FileText, Download, TrendingUp, BarChart3, Filter } from "lucide-react";

export const Route = createFileRoute("/dashboard/finance/reports")({
  component: FinanceReportsPage,
});

type ReportType =
  | "collection"
  | "outstanding"
  | "recovery"
  | "method"
  | "employee"
  | "monthly";

function FinanceReportsPage() {
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter params
  const [reportType, setReportType] = useState<ReportType>("collection");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setLoading(true);
    const unsubFinance = subscribeAndSyncFinance((list) => {
      setRecords(list);
    });
    const unsubPayments = subscribePaymentHistory((list) => {
      setPayments(list);
    });
    setLoading(false);
    return () => {
      unsubFinance();
      unsubPayments();
    };
  }, []);

  // Compute report data depending on type and date range
  const reportData = useMemo(() => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    switch (reportType) {
      case "collection": {
        // Payment receipts within dates
        const filtered = payments.filter((p) => {
          const d = new Date(p.receivedAt);
          return d >= start && d <= end;
        });
        return {
          headers: ["Date", "Invoice ID", "Amount", "Method", "Account", "Collected By", "Remarks"],
          rows: filtered.map((p) => [
            formatDate(p.receivedAt),
            p.invoiceId,
            `₹${p.amount.toLocaleString("en-IN")}`,
            p.method,
            p.accountName,
            p.receivedBy,
            p.remarks || "—",
          ]),
          raw: filtered,
          title: "Collection Report",
        };
      }
      case "outstanding": {
        // Unpaid items with collection dates
        const filtered = records.filter((r) => r.balanceAmount > 0);
        return {
          headers: ["Client", "Invoice Number", "Invoice Amount", "Collected", "Outstanding", "Due Date", "Employee"],
          rows: filtered.map((r) => [
            r.clientName,
            r.invoiceNumber,
            `₹${r.invoiceAmount.toLocaleString("en-IN")}`,
            `₹${r.receivedAmount.toLocaleString("en-IN")}`,
            `₹${r.balanceAmount.toLocaleString("en-IN")}`,
            formatDate(r.collectionDate),
            r.assignedEmployee || "—",
          ]),
          raw: filtered,
          title: "Outstanding Balances Report",
        };
      }
      case "recovery": {
        // Group invoiced vs recovered by client
        const clientsMap: Record<string, { name: string; invoiced: number; collected: number }> = {};
        records.forEach((r) => {
          if (!clientsMap[r.clientId]) {
            clientsMap[r.clientId] = { name: r.clientName, invoiced: 0, collected: 0 };
          }
          clientsMap[r.clientId].invoiced += r.invoiceAmount;
          clientsMap[r.clientId].collected += r.receivedAmount;
        });

        const rows = Object.values(clientsMap).map((c) => {
          const rate = c.invoiced > 0 ? ((c.collected / c.invoiced) * 100).toFixed(1) : "0";
          return [
            c.name,
            `₹${c.invoiced.toLocaleString("en-IN")}`,
            `₹${c.collected.toLocaleString("en-IN")}`,
            `₹${(c.invoiced - c.collected).toLocaleString("en-IN")}`,
            `${rate}%`,
          ];
        });

        return {
          headers: ["Client", "Total Invoiced", "Total Recovered", "Outstanding", "Recovery Rate"],
          rows,
          raw: Object.values(clientsMap),
          title: "Recovery Performance Report",
        };
      }
      case "method": {
        // Group received amounts by payment method
        const methodsMap: Record<string, number> = {
          Cash: 0,
          UPI: 0,
          "Bank Transfer": 0,
          Cheque: 0,
          Online: 0,
        };
        payments.forEach((p) => {
          const d = new Date(p.receivedAt);
          if (d >= start && d <= end) {
            methodsMap[p.method] = (methodsMap[p.method] || 0) + p.amount;
          }
        });

        const total = Object.values(methodsMap).reduce((s, v) => s + v, 0);

        const rows = Object.entries(methodsMap).map(([m, amt]) => {
          const pct = total > 0 ? ((amt / total) * 100).toFixed(1) : "0";
          return [m, `₹${amt.toLocaleString("en-IN")}`, `${pct}%`];
        });

        return {
          headers: ["Payment Method", "Total Collected", "Percentage Share"],
          rows,
          raw: methodsMap,
          title: "Payment Methods Analysis",
        };
      }
      case "employee": {
        // Group collections by assigned employee
        const employeeMap: Record<string, { collected: number; count: number }> = {};
        records.forEach((r) => {
          const emp = r.assignedEmployee || "Unassigned";
          if (!employeeMap[emp]) {
            employeeMap[emp] = { collected: 0, count: 0 };
          }
          employeeMap[emp].collected += r.receivedAmount;
          if (r.receivedAmount > 0) employeeMap[emp].count++;
        });

        const rows = Object.entries(employeeMap).map(([emp, stats]) => [
          emp,
          `${stats.count} Invoices`,
          `₹${stats.collected.toLocaleString("en-IN")}`,
        ]);

        return {
          headers: ["Employee", "Collections Made", "Total Amount Recovered"],
          rows,
          raw: employeeMap,
          title: "Employee Collections Report",
        };
      }
      case "monthly": {
        // Monthly breakdown
        const monthlyMap: Record<string, { invoiced: number; collected: number; outstanding: number }> = {};
        records.forEach((r) => {
          const d = new Date(r.createdAt);
          if (isNaN(d.getTime())) return;
          const monthKey = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
          if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = { invoiced: 0, collected: 0, outstanding: 0 };
          }
          monthlyMap[monthKey].invoiced += r.invoiceAmount;
          monthlyMap[monthKey].collected += r.receivedAmount;
          monthlyMap[monthKey].outstanding += r.balanceAmount;
        });

        const rows = Object.entries(monthlyMap).map(([m, stats]) => [
          m,
          `₹${stats.invoiced.toLocaleString("en-IN")}`,
          `₹${stats.collected.toLocaleString("en-IN")}`,
          `₹${stats.outstanding.toLocaleString("en-IN")}`,
        ]);

        return {
          headers: ["Month", "Total Invoiced", "Total Collected", "Remaining Balance"],
          rows,
          raw: monthlyMap,
          title: "Monthly Finance Statement",
        };
      }
    }
  }, [reportType, startDate, endDate, records, payments]);

  // Export functions
  const handleExportCSV = () => {
    const csvContent = [
      reportData.headers.join(","),
      ...reportData.rows.map((row) =>
        row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${reportData.title.replace(/\s+/g, "_")}_${startDate}_to_${endDate}.csv`);
    link.click();
    toast.success("CSV report downloaded!");
  };

  const handleExportExcel = () => {
    // Generate simple tab-separated content which opens beautifully in Excel
    const tsvContent = [
      reportData.headers.join("\t"),
      ...reportData.rows.map((row) => row.join("\t")),
    ].join("\n");

    const blob = new Blob([tsvContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${reportData.title.replace(/\s+/g, "_")}_${startDate}_to_${endDate}.xls`);
    link.click();
    toast.success("Excel report downloaded!");
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("SHREE SAINATH CONSULTANCY", 15, 15);
      doc.setFontSize(12);
      doc.text(reportData.title.toUpperCase(), 15, 22);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Period: ${startDate} to ${endDate} | Generated: ${new Date().toLocaleString("en-IN")}`, 15, 28);

      let y = 35;
      const colWidths = [30, 40, 30, 30, 30, 30];

      // Print table headers
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      let x = 15;
      reportData.headers.forEach((h, i) => {
        doc.text(h, x, y);
        x += colWidths[i] || 30;
      });

      doc.line(15, y + 2, 195, y + 2);
      y += 8;

      doc.setFont("helvetica", "normal");
      reportData.rows.slice(0, 35).forEach((row) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        x = 15;
        row.forEach((cell, idx) => {
          doc.text(String(cell).slice(0, 20), x, y);
          x += colWidths[idx] || 30;
        });
        y += 6;
      });

      doc.save(`${reportData.title.replace(/\s+/g, "_")}_${startDate}_to_${endDate}.pdf`);
      toast.success("PDF report downloaded!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF report");
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Finance Reports
        </h2>
        <p className="text-muted-foreground text-sm">
          Run collections metrics, recovery balances, employee performance indices, and vault statements.
        </p>
      </div>

      {/* Filter Options */}
      <div className="grid gap-4 md:grid-cols-4 items-end bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase text-gray-500">Report Category</Label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="w-full text-xs border rounded-md p-2 bg-white text-gray-700 font-semibold"
          >
            <option value="collection">Collection Report</option>
            <option value="outstanding">Outstanding Report</option>
            <option value="recovery">Recovery Report</option>
            <option value="method">Payment Method Report</option>
            <option value="employee">Employee Collection Report</option>
            <option value="monthly">Monthly Finance Report</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase text-gray-500">Start Date</Label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-xs border rounded-md p-1.5 bg-white text-gray-700"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase text-gray-500">End Date</Label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full text-xs border rounded-md p-1.5 bg-white text-gray-700"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleExportPDF} variant="outline" size="sm" className="flex-1 flex items-center justify-center gap-1">
            <FileText className="size-4 text-rose-600" /> PDF
          </Button>
          <Button onClick={handleExportExcel} variant="outline" size="sm" className="flex-1 flex items-center justify-center gap-1">
            <Download className="size-4 text-emerald-600" /> Excel
          </Button>
          <Button onClick={handleExportCSV} variant="outline" size="sm" className="flex-1 flex items-center justify-center gap-1">
            <Download className="size-4 text-blue-600" /> CSV
          </Button>
        </div>
      </div>

      {/* Preview Grid Table */}
      <Card className="shadow-sm border border-slate-100">
        <CardHeader className="bg-slate-50 border-b py-3 px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-gray-800 uppercase tracking-wide">
              {reportData.title} Preview
            </CardTitle>
            <CardDescription className="text-xs">
              Review records matching criteria before exporting
            </CardDescription>
          </div>
          <span className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
            {reportData.rows.length} records found
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {reportData.rows.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground text-sm">
              No matching records for chosen period.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[450px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-slate-50/70 uppercase text-[9px] font-bold text-muted-foreground sticky top-0 bg-white">
                    {reportData.headers.map((h, i) => (
                      <th key={i} className="p-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-700">
                  {reportData.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition">
                      {row.map((cell, idx) => (
                        <td key={idx} className="p-3">
                          {cell}
                        </td>
                      ))}
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
