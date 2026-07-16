import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  TrendingUp,
  AlertCircle,
  Loader2,
  Edit2,
  Target,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingDown,
  Calendar,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getSession } from "@/lib/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  subscribeToTargets,
  updateTargetValue,
  updateCompletedCount,
  createOrInitializeTarget,
  type TargetCategory,
  type TargetMetrics,
} from "@/lib/targets";
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
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/dashboard/targets")({
  component: TargetsPage,
});

const CATEGORIES: TargetCategory[] = [
  "Insurance",
  "Fitness",
  "Gujarat Permit",
  "National Permit",
  "Tax",
  "License New",
  "License Renew",
  "RC Transfer",
  "HP Addition",
  "HP Termination",
];

const CATEGORY_COLORS: Record<TargetCategory, string> = {
  Insurance: "#3b82f6",
  Fitness: "#10b981",
  "Gujarat Permit": "#8b5cf6",
  "National Permit": "#ec4899",
  Tax: "#06b6d4",
  "License New": "#6366f1",
  "License Renew": "#38bdf8",
  "RC Transfer": "#14b8a6",
  "HP Addition": "#f97316",
  "HP Termination": "#ef4444",
};

function TargetsPage() {
  const session = getSession();
  const [targets, setTargets] = useState<TargetMetrics[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetMetrics | null>(null);
  const [error, setError] = useState("");
  const [selectedCat, setSelectedCat] = useState<TargetCategory | "">("");
  const selectedCategoryForModal = selectedCat;

  function setSelectedCategoryForModal(category: TargetCategory | null) {
    if (category) {
      setSelectedCat(category);
    } else {
      setSelectedCat("");
    }
  }

  const isAdmin = session?.role === "admin";

  // Subscribe to real-time collections
  useEffect(() => {
    setIsLoading(true);
    let targetsLoaded = false;
    let servicesLoaded = false;
    let employeesLoaded = false;

    const checkLoaded = () => {
      if (targetsLoaded && servicesLoaded && employeesLoaded) {
        setIsLoading(false);
      }
    };

    const unsubTargets = subscribeToTargets((data) => {
      setTargets(data);
      targetsLoaded = true;
      checkLoaded();
    });

    const unsubServices = onSnapshot(collection(db, "registry_services_v2"), (snap) => {
      setServices(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      servicesLoaded = true;
      checkLoaded();
    });

    const unsubEmployees = onSnapshot(collection(db, "users"), (snap) => {
      setEmployees(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      employeesLoaded = true;
      checkLoaded();
    });

    return () => {
      unsubTargets();
      unsubServices();
      unsubEmployees();
    };
  }, []);

  // Top Card Computations
  const totalTargets = useMemo(() => {
    return targets.reduce((sum, t) => sum + (t.monthlyTarget || t.target || 0), 0);
  }, [targets]);

  const totalAchieved = useMemo(() => {
    return targets.reduce((sum, t) => sum + t.completed, 0);
  }, [targets]);

  const totalRemaining = useMemo(() => {
    return Math.max(0, totalTargets - totalAchieved);
  }, [totalTargets, totalAchieved]);

  const overallAchievementPercent = useMemo(() => {
    return totalTargets > 0 ? Math.round((totalAchieved / totalTargets) * 100) : 0;
  }, [totalTargets, totalAchieved]);

  const completedThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return services.filter((s: any) => {
      if (s.taskStatus !== "Completed" || !s.createdAt) return false;
      const date = new Date(s.createdAt);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).length;
  }, [services]);

  const completedToday = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return services.filter((s: any) => {
      if (s.taskStatus !== "Completed" || !s.createdAt) return false;
      const date = new Date(s.createdAt);
      return (
        date.getDate() === currentDay &&
        date.getMonth() === currentMonth &&
        date.getFullYear() === currentYear
      );
    }).length;
  }, [services]);

  // Employee Performance Table Mappings
  const employeePerformance = useMemo(() => {
    return employees
      .map((emp) => {
        const empServices = services.filter((s: any) => {
          return (
            s.employeeId === emp.employeeId ||
            s.assignedTo === emp.id ||
            s.assignedStaff === emp.fullName ||
            s.assignee === emp.username
          );
        });
        const completed = empServices.filter((s: any) => s.taskStatus === "Completed").length;
        const pending = empServices.filter((s: any) => s.taskStatus !== "Completed").length;
        const total = completed + pending;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
          name: emp.fullName || emp.name || emp.username || "Unknown",
          total,
          completed,
          pending,
          rate,
        };
      })
      .filter((e) => e.total > 0)
      .sort((a, b) => b.completed - a.completed);
  }, [employees, services]);

  // Recharts Computations
  const monthlyData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentYear = new Date().getFullYear();
    return months.map((monthName, index) => {
      const achieved = services.filter((s: any) => {
        if (s.taskStatus !== "Completed" || !s.createdAt) return false;
        const date = new Date(s.createdAt);
        return date.getMonth() === index && date.getFullYear() === currentYear;
      }).length;

      return {
        name: monthName,
        Target: totalTargets / 12 || 10,
        Achieved: achieved,
      };
    });
  }, [services, totalTargets]);

  const pieData = useMemo(() => {
    return targets
      .map((t) => ({
        name: t.category,
        value: t.completed,
      }))
      .filter((d) => d.value > 0);
  }, [targets]);

  const progressChartData = useMemo(() => {
    return targets.map((t) => ({
      name: t.category,
      Progress: t.achievementPercentage,
    }));
  }, [targets]);

  const dailyData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const count = services.filter((s: any) => {
        if (s.taskStatus !== "Completed" || !s.createdAt) return false;
        const sDate = new Date(s.createdAt);
        return (
          sDate.getDate() === d.getDate() &&
          sDate.getMonth() === d.getMonth() &&
          sDate.getFullYear() === d.getFullYear()
        );
      }).length;

      return {
        name: dateStr,
        Completed: count,
      };
    });
  }, [services]);

  const employeeChartData = useMemo(() => {
    return employeePerformance.map((emp) => ({
      name: emp.name,
      Completed: emp.completed,
      Pending: emp.pending,
    }));
  }, [employeePerformance]);

  const handleAddNew = () => {
    setEditingTarget(null);
    setShowForm(true);
    setError("");
  };

  const handleEdit = (target: TargetMetrics) => {
    setEditingTarget(target);
    setShowForm(true);
    setError("");
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTarget(null);
    setError("");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading Target Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Target Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise target configurations, completion rates, and real-time sales performance.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleAddNew} className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90">
            <Plus className="size-4" />
            Configure Target
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Top Cards Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total Targets", value: totalTargets, icon: Target, color: "text-blue-600 bg-blue-50" },
          { label: "Total Achieved", value: totalAchieved, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
          { label: "Remaining", value: totalRemaining, icon: Clock, color: "text-amber-600 bg-amber-50" },
          { label: "Achievement %", value: `${overallAchievementPercent}%`, icon: TrendingUp, color: "text-indigo-600 bg-indigo-50" },
          { label: "This Month", value: completedThisMonth, icon: Calendar, color: "text-cyan-600 bg-cyan-50" },
          { label: "Today's Services", value: completedToday, icon: Zap, color: "text-rose-600 bg-rose-50" },
        ].map((c, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 flex flex-col justify-between shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{c.label}</span>
              <div className={`p-1.5 rounded-lg ${c.color.split(" ")[1]}`}>
                <c.icon className={`size-4 ${c.color.split(" ")[0]}`} />
              </div>
            </div>
            <div className="mt-4">
              <h2 className="text-2xl font-bold tracking-tight">{c.value}</h2>
            </div>
          </div>
        ))}
      </div>

      {/* Table Section */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Service Performance Registry</h3>
          <span className="text-xs text-muted-foreground font-medium">Updated just now</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b bg-slate-100/50 text-[10px] uppercase font-bold text-muted-foreground">
                <th className="p-3">Service Category</th>
                <th className="p-3 text-center">Target</th>
                <th className="p-3 text-center">Completed</th>
                <th className="p-3 text-center">Remaining</th>
                <th className="p-3">Progress</th>
                <th className="p-3 text-center">Status</th>
                {isAdmin && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => {
                const target = targets.find((t) => t.category === cat) || {
                  id: "",
                  category: cat,
                  target: 0,
                  completed: services.filter((s: any) => s.serviceType === cat).length,
                  remaining: 0,
                  achievementPercentage: 0,
                  status: "Inactive",
                };
                const completedVal = target.completed;
                const targetVal = target.target;
                const remainingVal = Math.max(0, targetVal - completedVal);
                const percent = targetVal > 0 ? Math.round((completedVal / targetVal) * 100) : 0;
                
                let statusBadge = "Inactive";
                let statusColor = "bg-gray-100 text-gray-700";
                if (targetVal > 0) {
                  if (percent >= 100) {
                    statusBadge = "Completed";
                    statusColor = "bg-emerald-100 text-emerald-700";
                  } else if (percent >= 50) {
                    statusBadge = "On Track";
                    statusColor = "bg-blue-100 text-blue-700";
                  } else {
                    statusBadge = "Behind Target";
                    statusColor = "bg-rose-100 text-rose-700";
                  }
                }

                return (
                  <tr key={cat} className="border-b hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 font-semibold text-slate-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                      {cat}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">{targetVal || "—"}</td>
                    <td className="p-3 text-center font-mono font-bold text-emerald-600">{completedVal}</td>
                    <td className="p-3 text-center font-mono font-semibold text-amber-600">{targetVal > 0 ? remainingVal : "—"}</td>
                    <td className="p-3 min-w-[150px]">
                      {targetVal > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-2 rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(percent, 100)}%`,
                                backgroundColor: CATEGORY_COLORS[cat],
                              }}
                            />
                          </div>
                          <span className="font-semibold text-slate-600 font-mono w-8">{percent}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">No target configured</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}>
                        {statusBadge}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="p-3 text-right">
                        {target.id ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleEdit(target as TargetMetrics)}
                          >
                            <Edit2 className="size-3.5 text-muted-foreground" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px] text-primary"
                            onClick={() => {
                              setSelectedCategoryForModal(cat);
                              setShowForm(true);
                            }}
                          >
                            Set Target
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid for Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Chart 1: Monthly Targets vs Achievements */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-4">Monthly Achievement Trend</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="Achieved" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Completed Services" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Service Wise Share */}
        <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between">
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Service Completion Share</h4>
          {pieData.length > 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={CATEGORY_COLORS[entry.name as TargetCategory] || "#ccc"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-16 text-xs text-muted-foreground">No completions registered yet.</div>
          )}
        </div>

        {/* Chart 3: Horizontal Progress */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-4">Achievement Progress</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={progressChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9 }} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="Progress" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Daily Completion Trend */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-4">Daily Trend (Last 7 Days)</h4>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Line type="monotone" dataKey="Completed" stroke="#ec4899" strokeWidth={2} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid for Employee Performance */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Employee Chart */}
        <div className="rounded-xl border bg-card p-4 shadow-sm md:col-span-1">
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-4">Employee Output Distribution</h4>
          {employeeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={employeeChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Completed" fill="#10b981" stackId="a" />
                <Bar dataKey="Pending" fill="#f59e0b" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-20 text-xs text-muted-foreground">No active employee assignments.</div>
          )}
        </div>

        {/* Employee Table */}
        <div className="rounded-xl border bg-card shadow-sm md:col-span-2 overflow-hidden flex flex-col justify-between">
          <div className="p-4 border-b bg-slate-50">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Employee Achievements</h4>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b bg-slate-100/50 text-[10px] uppercase font-bold text-muted-foreground">
                  <th className="p-3">Employee Name</th>
                  <th className="p-3 text-center">Total Assigned</th>
                  <th className="p-3 text-center">Completed</th>
                  <th className="p-3 text-center">Pending</th>
                  <th className="p-3 text-right">Completion Rate</th>
                </tr>
              </thead>
              <tbody>
                {employeePerformance.map((emp) => (
                  <tr key={emp.name} className="border-b hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 font-semibold text-slate-800">{emp.name}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-600">{emp.total}</td>
                    <td className="p-3 text-center font-mono font-bold text-emerald-600">{emp.completed}</td>
                    <td className="p-3 text-center font-mono font-semibold text-amber-600">{emp.pending}</td>
                    <td className="p-3 text-right font-mono font-bold text-primary">{emp.rate}%</td>
                  </tr>
                ))}
                {employeePerformance.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">No active tasks assigned to staff.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Configuration Form Dialog */}
      <TargetFormDialog
        open={showForm}
        onOpenChange={handleFormClose}
        editingTarget={editingTarget}
        preselectedCategory={selectedCategoryForModal}
        onSuccess={handleFormClose}
        onError={setError}
      />
    </div>
  );


}

// ─── Target Form Dialog Rebuilt ────────────────────────────────────────────────
interface TargetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTarget: TargetMetrics | null;
  preselectedCategory: TargetCategory | "";
  onSuccess: () => void;
  onError: (error: string) => void;
}

function TargetFormDialog({
  open,
  onOpenChange,
  editingTarget,
  preselectedCategory,
  onSuccess,
  onError,
}: TargetFormDialogProps) {
  const session = getSession();
  const [selectedCategory, setSelectedCategory] = useState<TargetCategory | "">("");
  const [monthlyTarget, setMonthlyTarget] = useState("");
  const [quarterlyTarget, setQuarterlyTarget] = useState("");
  const [yearlyTarget, setYearlyTarget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [color, setColor] = useState("");
  const [status, setStatus] = useState("Active");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (editingTarget) {
      setSelectedCategory(editingTarget.category);
      setMonthlyTarget(String(editingTarget.monthlyTarget || editingTarget.target || ""));
      setQuarterlyTarget(String(editingTarget.quarterlyTarget || ""));
      setYearlyTarget(String(editingTarget.yearlyTarget || ""));
      setStartDate(editingTarget.startDate || "");
      setEndDate(editingTarget.endDate || "");
      setColor(editingTarget.color || CATEGORY_COLORS[editingTarget.category] || "");
      setStatus(editingTarget.status || "Active");
    } else {
      setSelectedCategory(preselectedCategory);
      setMonthlyTarget("");
      setQuarterlyTarget("");
      setYearlyTarget("");
      setStartDate("");
      setEndDate("");
      setColor(preselectedCategory ? CATEGORY_COLORS[preselectedCategory] : "");
      setStatus("Active");
    }
    setLocalError("");
  }, [editingTarget, preselectedCategory, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");

    if (!selectedCategory) {
      setLocalError("Please select a category");
      return;
    }

    const mTarget = parseInt(monthlyTarget, 10);
    if (isNaN(mTarget) || mTarget <= 0) {
      setLocalError("Please enter a valid monthly target");
      return;
    }

    if (!session) {
      setLocalError("Not authenticated");
      return;
    }

    setIsSubmitting(true);

    try {
      const extraData: any = {
        monthlyTarget: mTarget,
        quarterlyTarget: quarterlyTarget ? parseInt(quarterlyTarget, 10) : undefined,
        yearlyTarget: yearlyTarget ? parseInt(yearlyTarget, 10) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        color: color || undefined,
        status: status || undefined,
      };

      if (editingTarget) {
        await updateTargetValue(editingTarget.id, mTarget, session.username, extraData);
      } else {
        await createOrInitializeTarget(selectedCategory as TargetCategory, mTarget, session.username, extraData);
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save target";
      setLocalError(message);
      onError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingTarget ? "Configure Target Record" : "Set New Service Target"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {localError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{localError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-1">
              <Label htmlFor="category" className="text-[11px] font-semibold text-slate-700">Category *</Label>
              <Select
                value={selectedCategory}
                onValueChange={(val) => {
                  setSelectedCategory(val as TargetCategory);
                  setColor(CATEGORY_COLORS[val as TargetCategory] || "");
                }}
                disabled={!!editingTarget}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select service..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label htmlFor="status" className="text-[11px] font-semibold text-slate-700">Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Monthly Target */}
            <div className="space-y-1">
              <Label htmlFor="monthly" className="text-[11px] font-semibold text-slate-700">Monthly Target *</Label>
              <Input
                id="monthly"
                type="number"
                min="1"
                value={monthlyTarget}
                onChange={(e) => setMonthlyTarget(e.target.value)}
                placeholder="e.g. 50"
                disabled={isSubmitting}
              />
            </div>

            {/* Quarterly Target */}
            <div className="space-y-1">
              <Label htmlFor="quarterly" className="text-[11px] font-semibold text-slate-700">Quarterly Target</Label>
              <Input
                id="quarterly"
                type="number"
                min="1"
                value={quarterlyTarget}
                onChange={(e) => setQuarterlyTarget(e.target.value)}
                placeholder="e.g. 150"
                disabled={isSubmitting}
              />
            </div>

            {/* Yearly Target */}
            <div className="space-y-1">
              <Label htmlFor="yearly" className="text-[11px] font-semibold text-slate-700">Yearly Target</Label>
              <Input
                id="yearly"
                type="number"
                min="1"
                value={yearlyTarget}
                onChange={(e) => setYearlyTarget(e.target.value)}
                placeholder="e.g. 600"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-1">
              <Label htmlFor="start" className="text-[11px] font-semibold text-slate-700">Start Date</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <Label htmlFor="end" className="text-[11px] font-semibold text-slate-700">End Date</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Color Customization */}
          <div className="space-y-1">
            <Label htmlFor="color" className="text-[11px] font-semibold text-slate-700">Chart Color hex</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="color"
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3b82f6"
                disabled={isSubmitting}
                className="font-mono w-32"
              />
              <input
                type="color"
                value={color || "#3b82f6"}
                onChange={(e) => setColor(e.target.value)}
                disabled={isSubmitting}
                className="w-8 h-8 rounded border p-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="h-9">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 h-9">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : editingTarget ? (
                "Update Configuration"
              ) : (
                "Create Target"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
