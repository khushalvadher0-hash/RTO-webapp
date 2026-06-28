// src/routes/dashboard.finance.calendar.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  subscribeAndSyncFinance,
  type FinanceRecord,
} from "@/lib/financeService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/pdfGenerator";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info } from "lucide-react";

export const Route = createFileRoute("/dashboard/finance/calendar")({
  component: CollectionCalendarPage,
});

function CollectionCalendarPage() {
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Month navigation state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayCollections, setSelectedDayCollections] = useState<FinanceRecord[] | null>(null);
  const [selectedDayString, setSelectedDayString] = useState("");

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAndSyncFinance((list) => {
      setRecords(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Helper calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const calendarDays = useMemo(() => {
    // First day of current month
    const firstDay = new Date(year, month, 1);
    // Index of the first day (0 = Sunday, 1 = Monday, etc)
    const startOffset = firstDay.getDay();

    // Days in current month
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Previous month total days
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    const daysList: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    // Fill offset with previous month days
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      daysList.push({
        date: new Date(year, month - 1, d),
        isCurrentMonth: false,
        key: `prev-${d}`,
      });
    }

    // Fill current month days
    for (let d = 1; d <= totalDays; d++) {
      daysList.push({
        date: new Date(year, month, d),
        isCurrentMonth: true,
        key: `curr-${d}`,
      });
    }

    // Fill remaining cells for standard 6-row layout (42 cells)
    const remaining = 42 - daysList.length;
    for (let d = 1; d <= remaining; d++) {
      daysList.push({
        date: new Date(year, month + 1, d),
        isCurrentMonth: false,
        key: `next-${d}`,
      });
    }

    return daysList;
  }, [year, month]);

  // Group records by collectionDate string
  const groupedRecords = useMemo(() => {
    const map: Record<string, FinanceRecord[]> = {};
    records.forEach((r) => {
      if (r.collectionDate) {
        if (!map[r.collectionDate]) map[r.collectionDate] = [];
        map[r.collectionDate].push(r);
      }
    });
    return map;
  }, [records]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getRecordColorType = (r: FinanceRecord): "green" | "orange" | "red" | "blue" => {
    if (r.paymentStatus === "Paid") return "blue";

    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (r.collectionDate === todayStr) return "orange";

    const colDate = new Date(r.collectionDate);
    colDate.setHours(0, 0, 0, 0);

    if (colDate.getTime() < today.getTime()) return "red";
    return "green";
  };

  const getColorClass = (type: "green" | "orange" | "red" | "blue") => {
    switch (type) {
      case "blue":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "orange":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "red":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }
  };

  const handleDayClick = (dateStr: string) => {
    const dayCollections = groupedRecords[dateStr] || [];
    if (dayCollections.length > 0) {
      setSelectedDayCollections(dayCollections);
      setSelectedDayString(dateStr);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Collection Calendar
          </h2>
          <p className="text-muted-foreground text-sm">
            Visual scheduler tracking upcoming, today, overdue, and paid collections.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevMonth}>
            <ChevronLeft className="size-4 mr-1" /> Prev
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextMonth}>
            Next <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* Calendar Legend */}
        <Card className="md:col-span-1 shadow-sm border border-slate-100 h-fit">
          <CardHeader>
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Calendar Legend
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="size-3.5 rounded bg-emerald-100 border border-emerald-200" />
              <span className="font-medium text-gray-700">Scheduled (Upcoming)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3.5 rounded bg-amber-100 border border-amber-200" />
              <span className="font-medium text-gray-700">Due Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3.5 rounded bg-rose-100 border border-rose-200" />
              <span className="font-medium text-gray-700">Overdue Collection</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3.5 rounded bg-blue-100 border border-blue-200" />
              <span className="font-medium text-gray-700">Paid Invoice</span>
            </div>

            <div className="border-t pt-3 mt-3 text-[10px] text-muted-foreground">
              <p className="flex items-center gap-1 font-semibold text-slate-500 mb-1">
                <Info className="size-3.5" /> Quick tip
              </p>
              Click any calendar cell containing collections to open the details modal.
            </div>
          </CardContent>
        </Card>

        {/* Main Grid Calendar */}
        <Card className="md:col-span-3 shadow-sm border border-slate-100">
          <CardHeader className="bg-slate-50 border-b py-3 px-6">
            <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <CalendarIcon className="size-5 text-primary" /> {monthName}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-7 border-collapse text-xs">
                {/* Days of week header */}
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="p-3 text-center font-bold text-gray-500 border-b border-r last:border-r-0 bg-slate-50/70"
                  >
                    {day}
                  </div>
                ))}

                {/* Calendar Cells */}
                {calendarDays.map((cell) => {
                  const localDateStr = cell.date.toISOString().slice(0, 10);
                  const dayCollections = groupedRecords[localDateStr] || [];
                  const isToday = cell.date.toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={cell.key}
                      onClick={() => handleDayClick(localDateStr)}
                      className={`min-h-[100px] p-2 border-b border-r last:border-r-0 flex flex-col justify-between hover:bg-slate-50/60 transition cursor-pointer select-none ${
                        !cell.isCurrentMonth ? "bg-slate-50/30 text-gray-400" : "bg-white text-gray-900"
                      } ${isToday ? "bg-blue-50/20 font-semibold ring-1 ring-inset ring-primary/20" : ""}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`size-5 rounded-full grid place-items-center text-[10px] ${
                          isToday ? "bg-primary text-primary-foreground font-bold" : ""
                        }`}>
                          {cell.date.getDate()}
                        </span>

                        {dayCollections.length > 0 && (
                          <span className="text-[9px] bg-slate-100 px-1 rounded-full text-slate-600 font-bold">
                            {dayCollections.length} due
                          </span>
                        )}
                      </div>

                      {/* Display small tags for collections */}
                      <div className="mt-2 space-y-1 overflow-y-auto max-h-[60px] scrollbar-thin">
                        {dayCollections.slice(0, 3).map((r) => {
                          const type = getRecordColorType(r);
                          return (
                            <div
                              key={r.id}
                              className={`px-1.5 py-0.5 rounded text-[9px] truncate font-medium border ${getColorClass(
                                type,
                              )}`}
                              title={`${r.clientName} - ₹${r.balanceAmount.toLocaleString("en-IN")}`}
                            >
                              ₹{(r.balanceAmount || r.invoiceAmount).toLocaleString("en-IN")} {r.clientName}
                            </div>
                          );
                        })}
                        {dayCollections.length > 3 && (
                          <div className="text-[8px] text-muted-foreground font-bold text-center">
                            + {dayCollections.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Day Details Modal */}
      {selectedDayCollections && (
        <Dialog
          open={!!selectedDayCollections}
          onOpenChange={(open) => !open && setSelectedDayCollections(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-gray-800">
                Scheduled for {formatDate(selectedDayString)}
              </DialogTitle>
              <CardDescription>
                Detailed collections due on this date
              </CardDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 mt-2">
              {selectedDayCollections.map((r) => {
                const type = getRecordColorType(r);
                return (
                  <div
                    key={r.id}
                    className={`p-3 rounded-lg border flex flex-col gap-1 text-xs ${getColorClass(
                      type,
                    )}`}
                  >
                    <div className="flex justify-between items-start font-bold">
                      <span className="text-gray-900 truncate max-w-[200px]">{r.clientName}</span>
                      <span className="font-mono">₹{(r.balanceAmount || r.invoiceAmount).toLocaleString("en-IN")} Due</span>
                    </div>
                    <div className="text-[10px] text-gray-600 space-y-0.5 mt-1">
                      <p><strong>Invoice Number:</strong> {r.invoiceNumber}</p>
                      <p><strong>Assigned Employee:</strong> {r.assignedEmployee || "System"}</p>
                      <p>
                        <strong>Status:</strong>{" "}
                        <span className="font-bold capitalize">{r.paymentStatus}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedDayCollections(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
