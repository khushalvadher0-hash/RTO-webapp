import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Trash2,
  Plus,
  Link2,
  Search,
  LayoutGrid,
  List,
  Pencil,
  CheckCircle2,
  Eye,
  Paperclip,
  Send,
  MessageSquare,
  Car,
  Calendar as CalIcon,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Users,
  Download,
  Printer,
  GripVertical,
  CheckCircle,
  X,
  Copy,
} from "lucide-react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, onSnapshot, doc, query, where, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { getSession } from "@/lib/auth";
import {
  STAFF_USERS,
  staffLabel,
  subscribeToRecords,
  type Bucket,
  type RegistryRecord,
} from "@/lib/records";
import { subscribeAllVehicles } from "@/lib/hierarchy";
import { subscribeToAllClients } from "@/lib/allClients";
import {
  subscribeToTasks,
  createManualTask,
  setTaskDone,
  softDeleteTask,
  updateTask,
  addComment,
  addAttachment,
  toggleSubtask,
  addSubtask,
  reassignTask,
  markTaskAsRead,
  removeTask,
  updateSubtasks,
  isTaskAssignedToUser,
  taskMatchesClient,
  duplicateTask,
  PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  subscribeToTemplates,
  DEFAULT_TEMPLATES_SPEC,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type AssociationType,
  type TaskAttachment,
  type TaskTemplate,
  type TaskSubtask,
} from "@/lib/tasks";
import { generateTaskPDF, printWindow } from "@/lib/pdfGenerator";
import { cn } from "@/lib/utils";
import { DeleteTaskDialog } from "@/components/DeleteTaskDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/tasks")({ component: TasksPage });

type SortMode = "latest" | "oldest" | "priority" | "due";

const PRIORITY_RANK: Record<TaskPriority, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

// Predefined templates are now loaded from Firestore database collection

const priorityBadgeClass = (p: TaskPriority) =>
  ({
    Urgent: "bg-red-100 text-red-700 border-red-200",
    High: "bg-orange-100 text-orange-700 border-orange-200",
    Medium: "bg-blue-100 text-blue-700 border-blue-200",
    Low: "bg-slate-100 text-slate-600 border-slate-200",
  })[p];

const statusBadgeClass = (s: TaskStatus) =>
  ({
    Assigned: "bg-orange-100 text-orange-700 border-orange-200",
    Read: "bg-cyan-100 text-cyan-700 border-cyan-200",
    "In Progress": "bg-indigo-100 text-indigo-700 border-indigo-200",
    Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    "On Hold": "bg-zinc-100 text-zinc-700 border-zinc-200",
  })[s];

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function isOverdue(t: Task) {
  return !!t.dueDate && !t.done && new Date(t.dueDate).getTime() < Date.now();
}

function getStatusCounts(tasks: Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    Assigned: 0,
    Read: 0,
    "In Progress": 0,
    Completed: 0,
    "On Hold": 0,
  };
  for (const task of tasks) {
    if (counts[task.status] !== undefined) {
      counts[task.status]++;
    }
  }
  return counts;
}

function TasksPage() {
  const [session] = useState(() => getSession());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<RegistryRecord[]>([]);
  const [leads, setLeads] = useState<RegistryRecord[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [v2Services, setV2Services] = useState<any[]>([]);

  const isAdmin = session?.role === "admin" || session?.role === "manager";
  const canSeeAllTasks = isAdmin;

  // view and filters
  const [viewTab, setViewTab] = useState<"my" | "all">(() => {
    const sess = getSession();
    const isAd = sess?.role === "admin" || sess?.role === "manager";
    return isAd ? "all" : "my";
  });
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [associationFilter, setAssociationFilter] = useState<string>("all");
  const [dueFilter, setDueFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("latest");

  // dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Add Remark Quick Dialog State
  const [remarkTaskId, setRemarkTaskId] = useState<string | null>(null);
  const [quickRemarkText, setQuickRemarkText] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);

  useEffect(() => {
    const u1 = subscribeToTasks(setTasks);
    const u2 = subscribeToAllClients((items) => {
      const parsedClients = items.filter((c) => c.type === "client").map((c) => ({
        ...c,
        mo: c.mobile || "",
        status: "In Progress",
        mvNo: c.vehicles?.join(", ") || "",
        work: c.allServices?.map((s) => s.work || s.application).join(", ") || "",
      }));
      const parsedLeads = items.filter((c) => c.type === "lead").map((c) => ({
        ...c,
        mo: c.mobile || "",
        status: "In Progress",
        mvNo: c.vehicles?.join(", ") || "",
        work: c.allServices?.map((s) => s.work || s.application).join(", ") || "",
      }));
      setClients(parsedClients as any);
      setLeads(parsedLeads as any);
    });
    const u4 = onSnapshot(collection(db, "registry_vehicles_v2"), (snap) => {
      setVehicles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const u5 = onSnapshot(collection(db, "users"), (snap) => {
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const u6 = onSnapshot(collection(db, "registry_services_v2"), (snap) => {
      const services = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Background auto-healing
      services.forEach((s: any) => {
        const uid = s.assignedEmployeeUid || s.assignedTo || s.employeeId || s.assignee || s.assignedStaff;
        if (uid && uid.length > 15 && !s.assignedEmployeeName) {
          import("@/lib/tasks").then(({ resolveAssigneeIdentity }) => {
            resolveAssigneeIdentity(uid).then((info) => {
              if (info.assignedEmployeeName) {
                updateDoc(doc(db, "registry_services_v2", s.id), {
                  assignee: info.assignedEmployeeUid,
                  assignedTo: info.assignedEmployeeUid,
                  employeeId: info.assignedEmployeeUid,
                  assignedStaff: info.assignedEmployeeUid,
                  assignedEmployeeId: info.assignedEmployeeId,
                  assignedEmployeeUid: info.assignedEmployeeUid,
                  assignedEmployeeName: info.assignedEmployeeName,
                  assignedEmployeeRole: info.assignedEmployeeRole,
                }).catch(console.error);
              }
            });
          });
        }
      });

      setV2Services(services);
    });
    return () => {
      u1();
      u2();
      u4();
      u5();
      u6();
    };
  }, []);

  const allTasks = useMemo(() => {
    // 1. Get manual tasks
    const manualTasks = tasks;

    // 2. Generate task objects dynamically from registry_services_v2 joined with vehicles and clients/leads
    const serviceTasks: Task[] = v2Services.map((s: any) => {
      const vehicle = vehicles.find((v) => v.id === s.vehicleId);
      const vehicleNo = vehicle?.vehicleNumber || "—";
      const clientId = vehicle?.clientId || s.clientId || "";
      const client = clients.find((c) => c.id === clientId) || leads.find((l) => l.id === clientId);
      const clientName = client?.name || s.clientName || "Unknown Client";

      return {
        id: s.id,
        title: s.title || `${s.serviceType || "Service"} - ${vehicleNo}`,
        serviceName: s.serviceType || "",
        description: `Vehicle: ${vehicleNo}. Status: ${s.status || "Pending"}. Remarks: ${s.remarks || "—"}`,
        assignee: s.assignedTo || s.employeeId || s.assignee || "",
        assignedEmployeeId: s.employeeId || s.assignedTo || s.assignedStaff || s.assignee || "",
        assignedEmployeeName: s.assignedEmployeeName || s.assignedStaff || s.assignee || "",
        status: (s.taskStatus || s.status || "Assigned") as TaskStatus,
        priority: (s.priority || "Medium") as TaskPriority,
        done: s.taskStatus === "Completed",
        createdAt: s.createdAt || s.startDate || new Date().toISOString(),
        createdBy: s.createdBy || "System",
        dueDate: s.dueDate || s.startDate || "",
        associationType: (client?.isDeleted ? "lead" : "client") as AssociationType,
        bucket: client?.isDeleted ? "leads" : "clients",
        recordId: clientId,
        clientId: clientId,
        clientName: clientName,
        manual: false,
        progress: s.taskStatus === "Completed" ? 100 : s.taskStatus === "In Progress" ? 50 : 0,
        reminderMinutes: s.reminderMinutes || 0,
        remarks: s.remarks || "",
      };
    });

    return [...manualTasks, ...serviceTasks];
  }, [tasks, v2Services, vehicles, clients, leads]);

  const detailsTask = allTasks.find((t) => t.id === detailsId) ?? null;

  // Separate task lists for tab counting
  const myTasks = useMemo(() => {
    if (!session) return [];
    return allTasks.filter((t) => isTaskAssignedToUser(t, session));
  }, [allTasks, session]);

  // Apply filters based on view tab
  const baseList = useMemo(() => {
    if (viewTab === "my") return myTasks;
    if (viewTab === "all" && canSeeAllTasks) return allTasks;
    return [];
  }, [viewTab, myTasks, allTasks, canSeeAllTasks]);

  // Apply all filters to base list
  const visible = useMemo(() => {
    if (!session) return [];
    let list = baseList;

    console.log("🐛 [DEBUG TASKS] --- Filtering Start ---");
    console.log("🐛 Current User Session:", session);
    console.log("🐛 Current Employee ID (uid):", session.uid, " | employeeId:", session.employeeId);
    console.log("🐛 Current Employee Name:", session.name);
    console.log("🐛 Base List Count:", baseList.length);
    console.log("🐛 All Tasks Count (total in Firestore/state):", tasks.length);
    baseList.forEach((t) => {
      console.log(`  - Task: "${t.title}" | Assignee: "${t.assignee}" | Assigned ID: "${t.assignedEmployeeId}" | Assigned Name: "${t.assignedEmployeeName}"`);
    });

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          (t.assignedEmployeeName || "Former Employee").toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    if (priorityFilter !== "all") list = list.filter((t) => t.priority === priorityFilter);
    if (assigneeFilter !== "all") {
      list = list.filter((t) =>
        t.assignee === assigneeFilter ||
        t.assignedEmployeeId === assigneeFilter ||
        t.assignedEmployeeName === assigneeFilter
      );
    }
    if (associationFilter !== "all")
      list = list.filter((t) => t.associationType === associationFilter);

    if (dueFilter !== "all") {
      const now = Date.now();
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const weekEnd = endOfToday.getTime() + 6 * 86400_000;
      list = list.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate).getTime();
        if (dueFilter === "overdue") return d < now && !t.done;
        if (dueFilter === "today") return d <= endOfToday.getTime() && d >= now - 86400_000;
        if (dueFilter === "week") return d <= weekEnd;
        return true;
      });
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "latest") return +new Date(b.createdAt) - +new Date(a.createdAt);
      if (sort === "oldest") return +new Date(a.createdAt) - +new Date(b.createdAt);
      if (sort === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (sort === "due") {
        const da = a.dueDate ? +new Date(a.dueDate) : Infinity;
        const db = b.dueDate ? +new Date(b.dueDate) : Infinity;
        return da - db;
      }
      return 0;
    });
    console.log("🐛 [DEBUG TASKS] Filtered List Count:", sorted.length);
    console.log("🐛 [DEBUG TASKS] --- Filtering End ---");
    return sorted;
  }, [
    baseList,
    session,
    query,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    associationFilter,
    dueFilter,
    sort,
  ]);

  const stats = useMemo(
    () => {
      const tabTasks = viewTab === "my" ? myTasks : allTasks;
      return {
        my: myTasks.length,
        all: allTasks.length,
        visible: visible.length,
        pending: tabTasks.filter((t) => !t.done).length,
        overdue: tabTasks.filter(isOverdue).length,
        completed: tabTasks.filter((t) => t.done).length,
        statusCounts: getStatusCounts(tabTasks),
      };
    },
    [visible, myTasks, allTasks, viewTab],
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (t: Task) => {
    setEditing(t);
    setFormOpen(true);
  };

  const handleQuickAddRemark = async () => {
    if (!remarkTaskId || !quickRemarkText.trim()) return;
    setSavingRemark(true);
    try {
      await addComment(remarkTaskId, session?.username || "system", quickRemarkText.trim());
      toast.success("Remark added!");
      setQuickRemarkText("");
      setRemarkTaskId(null);
    } catch (err: any) {
      toast.error("Failed to add remark");
    } finally {
      setSavingRemark(false);
    }
  };

  const handleDuplicateTask = async (task: Task) => {
    try {
      await duplicateTask(task.id, session?.username || "system");
      toast.success("Task duplicated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate task");
    }
  };

  const handleQuickChangeStatus = async (task: Task, s: TaskStatus) => {
    try {
      await updateTask(
        task.id,
        { status: s, done: s === "Completed" },
        session?.username || "system",
        `Status → ${s}`,
      );
      if (s === "Completed") {
        await setTaskDone(task.id, true, session?.username || "system");
      }
      toast.success(`Status updated to ${s}`);
    } catch (err: any) {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
          <p className="text-sm text-muted-foreground">
            {stats.visible} shown • {stats.pending} pending • {stats.overdue} overdue •{" "}
            {stats.completed} done
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden bg-slate-50">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className={`rounded-none px-3 h-9 ${viewMode === "table" ? "bg-white border shadow-sm font-semibold text-primary" : ""}`}
              onClick={() => setViewMode("table")}
              title="Table View"
            >
              <List className="size-4 mr-1" /> Table
            </Button>
            <Button
              variant={viewMode === "card" ? "secondary" : "ghost"}
              size="sm"
              className={`rounded-none px-3 h-9 ${viewMode === "card" ? "bg-white border shadow-sm font-semibold text-primary" : ""}`}
              onClick={() => setViewMode("card")}
              title="Card View"
            >
              <LayoutGrid className="size-4 mr-1" /> Cards
            </Button>
          </div>
          {isAdmin && (
            <Button onClick={openCreate}>
              <Plus className="size-4 mr-1" />
              Add task
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as "my" | "all")}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="my">My Tasks ({stats.my})</TabsTrigger>
          <TabsTrigger value="all" disabled={!canSeeAllTasks}>
            All Tasks {canSeeAllTasks && `(${stats.all})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-3">
          {/* Search + filters */}
          <div className="rounded-xl border bg-card p-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search tasks by title, description, assignee…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {TASK_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priority</SelectItem>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff</SelectItem>
                  {employees
                    .filter((e) => e.status === "active" && !e.isDeleted)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.fullName || s.name || s.username}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={associationFilter} onValueChange={setAssociationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Linked to" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All links</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="none">Standalone</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dueFilter} onValueChange={setDueFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Due date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any due date</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Due today</SelectItem>
                  <SelectItem value="week">Due this week</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="priority">Priority (high → low)</SelectItem>
                  <SelectItem value="due">Due date (soonest)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status counts */}
          <div className="rounded-xl border bg-card p-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                  {stats.statusCounts["Assigned"]}
                </Badge>
                <span className="text-muted-foreground">Assigned</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200">
                  {stats.statusCounts["Read"]}
                </Badge>
                <span className="text-muted-foreground">Read</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                  {stats.statusCounts["In Progress"]}
                </Badge>
                <span className="text-muted-foreground">In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  {stats.statusCounts["Completed"]}
                </Badge>
                <span className="text-muted-foreground">Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200">
                  {stats.statusCounts["On Hold"]}
                </Badge>
                <span className="text-muted-foreground">On Hold</span>
              </div>
            </div>
          </div>

          {/* Task Grid Table or Card View */}
          {viewMode === "card" ? (
            <TaskCards
              tasks={visible}
              clients={clients}
              leads={leads}
              vehicles={vehicles}
              isAdmin={!!isAdmin}
              session={session}
              onView={(t) => setDetailsId(t.id)}
              onEdit={openEdit}
              onDelete={(t) => {
                setTaskToDelete(t);
                setDeleteOpen(true);
              }}
              onToggleDone={(t, v) => setTaskDone(t.id, v, session?.username ?? "system")}
              onAddRemark={(t) => setRemarkTaskId(t.id)}
              onChangeStatus={handleQuickChangeStatus}
              onDuplicate={handleDuplicateTask}
            />
          ) : (
            <TaskTable
              tasks={visible}
              clients={clients}
              leads={leads}
              vehicles={vehicles}
              isAdmin={!!isAdmin}
              session={session}
              onView={(t) => setDetailsId(t.id)}
              onEdit={openEdit}
              onDelete={(t) => {
                setTaskToDelete(t);
                setDeleteOpen(true);
              }}
              onToggleDone={(t, v) => setTaskDone(t.id, v, session?.username ?? "system")}
              onAddRemark={(t) => setRemarkTaskId(t.id)}
              onChangeStatus={handleQuickChangeStatus}
              onDuplicate={handleDuplicateTask}
            />
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-3">
          {/* Search + filters */}
          <div className="rounded-xl border bg-card p-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search tasks by title, description, assignee…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {TASK_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priority</SelectItem>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff</SelectItem>
                  {employees
                    .filter((e) => e.status === "active" && !e.isDeleted)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.fullName || s.name || s.username}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={associationFilter} onValueChange={setAssociationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Linked to" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All links</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="none">Standalone</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dueFilter} onValueChange={setDueFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Due date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any due date</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Due today</SelectItem>
                  <SelectItem value="week">Due this week</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="priority">Priority (high → low)</SelectItem>
                  <SelectItem value="due">Due date (soonest)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status counts */}
          <div className="rounded-xl border bg-card p-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                  {stats.statusCounts["Assigned"]}
                </Badge>
                <span className="text-muted-foreground">Assigned</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200">
                  {stats.statusCounts["Read"]}
                </Badge>
                <span className="text-muted-foreground">Read</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                  {stats.statusCounts["In Progress"]}
                </Badge>
                <span className="text-muted-foreground">In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  {stats.statusCounts["Completed"]}
                </Badge>
                <span className="text-muted-foreground">Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200">
                  {stats.statusCounts["On Hold"]}
                </Badge>
                <span className="text-muted-foreground">On Hold</span>
              </div>
            </div>
          </div>

          {/* Task Grid Table or Card View */}
          {viewMode === "card" ? (
            <TaskCards
              tasks={visible}
              clients={clients}
              leads={leads}
              vehicles={vehicles}
              isAdmin={!!isAdmin}
              session={session}
              onView={(t) => setDetailsId(t.id)}
              onEdit={openEdit}
              onDelete={(t) => {
                setTaskToDelete(t);
                setDeleteOpen(true);
              }}
              onToggleDone={(t, v) => setTaskDone(t.id, v, session?.username ?? "system")}
              onAddRemark={(t) => setRemarkTaskId(t.id)}
              onChangeStatus={handleQuickChangeStatus}
              onDuplicate={handleDuplicateTask}
            />
          ) : (
            <TaskTable
              tasks={visible}
              clients={clients}
              leads={leads}
              vehicles={vehicles}
              isAdmin={!!isAdmin}
              session={session}
              onView={(t) => setDetailsId(t.id)}
              onEdit={openEdit}
              onDelete={(t) => {
                setTaskToDelete(t);
                setDeleteOpen(true);
              }}
              onToggleDone={(t, v) => setTaskDone(t.id, v, session?.username ?? "system")}
              onAddRemark={(t) => setRemarkTaskId(t.id)}
              onChangeStatus={handleQuickChangeStatus}
              onDuplicate={handleDuplicateTask}
            />
          )}
        </TabsContent>
      </Tabs>

      <TaskFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        clients={clients}
        leads={leads}
        vehicles={vehicles}
        employees={employees}
        actor={session?.username ?? "system"}
        isAdmin={!!isAdmin}
      />

      {detailsTask && (
        <TaskDetailsSheet
          open={!!detailsId}
          onClose={() => setDetailsId(null)}
          task={detailsTask}
          clients={clients}
          leads={leads}
          vehicles={vehicles}
          employees={employees}
          actor={session?.username ?? "system"}
          isAdmin={!!isAdmin}
          onEdit={openEdit}
        />
      )}

      {taskToDelete && (
        <DeleteTaskDialog
          open={deleteOpen}
          onOpenChange={(v) => {
            if (!v) {
              setDeleteOpen(false);
              setTaskToDelete(null);
            }
          }}
          taskId={taskToDelete.id}
          taskTitle={taskToDelete.title}
          userRole={isAdmin ? "admin" : "staff"}
          username={session?.username ?? "system"}
        />
      )}

      {/* Add Remark Modal */}
      {remarkTaskId && (
        <Dialog open={!!remarkTaskId} onOpenChange={(v) => !v && setRemarkTaskId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Task Remark</DialogTitle>
              <DialogDescription>
                Record operational updates or comments directly on the task timeline.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-2">
              <Label htmlFor="remarkText" className="text-xs uppercase font-bold text-gray-500">
                Remark Text *
              </Label>
              <Textarea
                id="remarkText"
                rows={4}
                required
                placeholder="e.g. Documents collected from client."
                value={quickRemarkText}
                onChange={(e) => setQuickRemarkText(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setRemarkTaskId(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleQuickAddRemark}
                disabled={savingRemark || !quickRemarkText.trim()}
              >
                {savingRemark ? <Loader2 className="size-4 animate-spin" /> : "Save Remark"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function getTaskInfoHelper(t: Task, clients: RegistryRecord[], leads: RegistryRecord[], vehicles: any[]) {
  let clientName = t.clientName || "Standalone";
  const targetId = t.clientId || t.recordId;
  if (targetId) {
    const foundClient = clients.find((c) => c.id === targetId);
    if (foundClient) {
      clientName = foundClient.name;
    } else {
      const foundLead = leads.find((l) => l.id === targetId);
      if (foundLead) {
        clientName = foundLead.name;
      }
    }
  }

  let taskName = t.title || "General Follow Up";
  let service = t.serviceName || "";

  if (
    taskName.startsWith("Client:") ||
    taskName.startsWith("Lead:") ||
    taskName.startsWith("Customer:")
  ) {
    const parts = taskName.split("—");
    if (parts.length > 1) {
      const extracted = parts[parts.length - 1].trim();
      taskName = extracted;
      if (!service) {
        service = extracted;
      }
    } else {
      taskName = "General Follow Up";
    }
  }

  if (!service) {
    service = t.description || "Follow Up";
  }

  // Resolve vehicle details if linked
  let vehicleNum = "";
  if (t.vehicleId) {
    const found = vehicles.find((v) => v.id === t.vehicleId);
    if (found) {
      vehicleNum = found.vehicleNumber || "";
    }
  }

  return { taskName, clientName, service, vehicleNum };
}

// ─── Professional Task Table Component ──────────────────────────────────────
function TaskTable({
  tasks,
  clients,
  leads,
  vehicles,
  isAdmin,
  session,
  onView,
  onEdit,
  onDelete,
  onToggleDone,
  onAddRemark,
  onChangeStatus,
  onDuplicate,
}: {
  tasks: Task[];
  clients: RegistryRecord[];
  leads: RegistryRecord[];
  vehicles: any[];
  isAdmin: boolean;
  session: any;
  onView: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onToggleDone: (t: Task, v: boolean) => void;
  onAddRemark: (t: Task) => void;
  onChangeStatus: (t: Task, s: TaskStatus) => void;
  onDuplicate: (t: Task) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const totalPages = Math.ceil(tasks.length / pageSize);
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tasks.slice(start, start + pageSize);
  }, [tasks, currentPage]);

  const getTaskInfo = (t: Task) => {
    return getTaskInfoHelper(t, clients, leads, vehicles);
  };

  const getSubtasksProgress = (t: Task) => {
    const list = t.subtasks ?? [];
    if (list.length === 0) return null;
    const completed = list.filter((s) => s.completed).length;
    const pct = Math.round((completed / list.length) * 100);
    return `${completed} / ${list.length} (${pct}%)`;
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
        <div className="max-h-[60vh] overflow-y-auto relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-50 text-gray-500 uppercase font-bold text-[9px] border-b z-10">
              <tr>
                <th className="p-3">Task Name</th>
                <th className="p-3">Client Name</th>
                <th className="p-3">Vehicle</th>
                <th className="p-3">Service</th>
                <th className="p-3">Assigned Employee</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Due Date</th>
                <th className="p-3">Status</th>
                <th className="p-3">Progress</th>
                <th className="p-3">Remarks</th>
                <th className="p-3">Last Updated By</th>
                <th className="p-3">Last Updated On</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-700 font-medium">
              {paginatedTasks.map((t) => {
                const info = getTaskInfo(t);
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td
                      className="p-3 font-semibold text-gray-900 max-w-[150px] truncate"
                      title={info.taskName}
                    >
                      {info.taskName}
                    </td>
                    <td
                      className="p-3 max-w-[120px] truncate text-primary font-bold"
                      title={info.clientName}
                    >
                      {info.clientName}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-gray-600">
                      {info.vehicleNum ? (
                        <span className="flex items-center gap-1">
                          <Car className="size-3 text-muted-foreground" /> {info.vehicleNum}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className="p-3 max-w-[100px] truncate text-slate-500 font-semibold"
                      title={info.service}
                    >
                      {info.service}
                    </td>
                    <td className="p-3">{t.assignedEmployeeName || "Former Employee"}</td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold border",
                          priorityBadgeClass(t.priority),
                        )}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="p-3 font-mono">
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="p-3">
                      <select
                        value={t.status}
                        onChange={(e) => onChangeStatus(t, e.target.value as TaskStatus)}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold border bg-transparent cursor-pointer",
                          statusBadgeClass(t.status),
                        )}
                      >
                        {TASK_STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 font-mono text-[10px]">{getSubtasksProgress(t) || "—"}</td>
                    <td
                      className="p-3 max-w-[180px] truncate text-gray-600 italic cursor-help"
                      title={t.remarks || "No Remarks"}
                    >
                      {t.remarks ? (t.remarks.length > 70 ? t.remarks.slice(0, 70) + "..." : t.remarks) : "No Remarks"}
                    </td>
                    <td className="p-3 text-gray-500">
                      {t.lastRemarkBy
                        ? staffLabel(t.lastRemarkBy) || t.lastRemarkBy
                        : staffLabel(t.createdBy) || t.createdBy}
                    </td>
                    <td className="p-3 font-mono text-gray-500">
                      {t.lastRemarkAt
                        ? new Date(t.lastRemarkAt).toLocaleDateString("en-IN")
                        : new Date(t.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(t)}
                          title="View Detail"
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        {(() => {
                          const canEdit = true;
                          return canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(t)}
                              title="Edit Task"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          );
                        })()}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDuplicate(t)}
                          title="Duplicate Task"
                          className="text-emerald-600 hover:bg-emerald-50"
                        >
                          <Copy className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAddRemark(t)}
                          title="Add Remark"
                        >
                          <MessageSquare className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(t)}
                          className="text-red-500 hover:bg-red-50"
                          title="Delete Task"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedTasks.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-6 text-center text-muted-foreground">
                    No tasks match the active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-3 bg-slate-50 border-t flex items-center justify-between text-xs text-muted-foreground select-none">
            <span>
              Page {currentPage} of {totalPages} ({tasks.length} total tasks)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Professional Task Cards Component ──────────────────────────────────────
function TaskCards({
  tasks,
  clients,
  leads,
  vehicles,
  isAdmin,
  session,
  onView,
  onEdit,
  onDelete,
  onToggleDone,
  onAddRemark,
  onChangeStatus,
  onDuplicate,
}: {
  tasks: Task[];
  clients: RegistryRecord[];
  leads: RegistryRecord[];
  vehicles: any[];
  isAdmin: boolean;
  session: any;
  onView: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onToggleDone: (t: Task, v: boolean) => void;
  onAddRemark: (t: Task) => void;
  onChangeStatus: (t: Task, s: TaskStatus) => void;
  onDuplicate: (t: Task) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9; // 3 columns * 3 rows looks best

  const totalPages = Math.ceil(tasks.length / pageSize);
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tasks.slice(start, start + pageSize);
  }, [tasks, currentPage]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedTasks.map((t) => {
          const info = getTaskInfoHelper(t, clients, leads, vehicles);
          const latestRemark = t.remarks || "No Remarks";
          const displayRemark = latestRemark.length > 70 ? latestRemark.slice(0, 70) + "..." : latestRemark;
          
          return (
            <div key={t.id} className="border rounded-xl bg-white p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-3 min-h-[220px]">
              <div className="space-y-2">
                {/* Header status and priority badges */}
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", priorityBadgeClass(t.priority))}>
                    {t.priority}
                  </span>
                  <select
                    value={t.status}
                    onChange={(e) => onChangeStatus(t, e.target.value as TaskStatus)}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold border bg-transparent cursor-pointer",
                      statusBadgeClass(t.status),
                    )}
                  >
                    {TASK_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Task Name */}
                <h4 className="font-semibold text-gray-900 text-sm truncate" title={info.taskName}>
                  {info.taskName}
                </h4>

                {/* Details list */}
                <div className="text-xs space-y-1 text-gray-600">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client:</span>
                    <span className="font-bold text-primary max-w-[150px] truncate" title={info.clientName}>{info.clientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service:</span>
                    <span className="font-semibold truncate max-w-[150px]" title={info.service}>{info.service}</span>
                  </div>
                  {info.vehicleNum && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vehicle:</span>
                      <span className="font-mono text-[10px]">{info.vehicleNum}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assignee:</span>
                    <span>{t.assignedEmployeeName || "Former Employee"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date:</span>
                    <span className="font-mono">{t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-IN") : "—"}</span>
                  </div>
                </div>

                {/* Remarks section */}
                <div className="border-t pt-2 mt-2">
                  <div className="text-[10px] uppercase font-bold text-gray-400">Remarks</div>
                  <p className="text-xs text-gray-600 italic mt-0.5 cursor-help" title={latestRemark}>
                    {displayRemark}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="border-t pt-2 flex items-center justify-between gap-1 mt-auto">
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onView(t)} title="View Detail">
                    <Eye className="size-3.5" />
                  </Button>
                  {(() => {
                    const canEdit = true;
                    return canEdit && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onEdit(t)} title="Edit Task">
                        <Pencil className="size-3.5" />
                      </Button>
                    );
                  })()}
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50" onClick={() => onDuplicate(t)} title="Duplicate Task">
                    <Copy className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onAddRemark(t)} title="Add Remark">
                    <MessageSquare className="size-3.5" />
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50" onClick={() => onDelete(t)} title="Delete Task">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {paginatedTasks.length === 0 && (
        <div className="p-6 text-center text-muted-foreground border rounded-xl bg-white shadow-sm">
          No tasks match the active filters.
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between text-xs text-muted-foreground select-none">
          <span>
            Page {currentPage} of {totalPages} ({tasks.length} total tasks)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Task Form Dialog ────────────────────────────────────────────────────────
function TaskFormDialog({
  open,
  onClose,
  editing,
  clients,
  leads,
  vehicles,
  employees,
  actor,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  editing: Task | null;
  clients: RegistryRecord[];
  leads: RegistryRecord[];
  vehicles: any[];
  employees: any[];
  actor: string;
  isAdmin: boolean;
}) {
  const [title, setTitle] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState("");
  const [assignedEmployeeName, setAssignedEmployeeName] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [status, setStatus] = useState<TaskStatus>("Assigned");
  const [associationType, setAssociationType] = useState<AssociationType>("client");
  const [recordId, setRecordId] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [recordSearch, setRecordSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [dueDate, setDueDate] = useState<string>("");
  const [dueTime, setDueTime] = useState<string>("");
  const [reminderMinutes, setReminderMinutes] = useState<string>("0");
  const [saving, setSaving] = useState(false);
  const [remarks, setRemarks] = useState("");

  // Subtasks and Templates
  const [checklist, setChecklist] = useState<TaskSubtask[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState("");
  const [dbTemplates, setDbTemplates] = useState<TaskTemplate[]>([]);

  useEffect(() => {
    if (!open) return;
    const unsub = subscribeToTemplates((data) => {
      setDbTemplates(data);
    });
    return unsub;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setServiceName(editing.serviceName ?? "");
      setDescription(editing.description ?? "");
      setRemarks(editing.remarks ?? "");
      const activeEmployees = employees.filter((e) => e.status === "active" && !e.isDeleted);
      const matchedEmp = activeEmployees.find(e =>
        e.id === editing.assignee ||
        e.employeeId === editing.assignee ||
        e.username === editing.assignee ||
        e.fullName === editing.assignee
      );
      setAssignee(matchedEmp?.id || editing.assignee || "");
      setAssignedEmployeeId(matchedEmp?.employeeId || editing.assignedEmployeeId || matchedEmp?.id || "");
      setAssignedEmployeeName(matchedEmp?.fullName || matchedEmp?.name || matchedEmp?.username || editing.assignedEmployeeName || "");
      setPriority(editing.priority);
      setStatus(editing.status);
      setAssociationType(editing.associationType);
      setRecordId(editing.recordId ?? "");
      setVehicleId(editing.vehicleId ?? "");
      const existingName = editing.clientName ||
        (editing.associationType === "client" ? clients : leads).find(c => c.id === editing.recordId)?.name || "";
      setRecordSearch(existingName);
      if (editing.dueDate) {
        const d = new Date(editing.dueDate);
        setDueDate(d.toISOString().slice(0, 10));
        setDueTime(d.toTimeString().slice(0, 5));
      } else {
        setDueDate("");
        setDueTime("");
      }
      setReminderMinutes(String(editing.reminderMinutes ?? 0));
      setChecklist(editing.subtasks ?? []);
    } else {
      setTitle("");
      setServiceName("");
      setDescription("");
      setRemarks("");
      const activeEmployees = employees.filter((e) => e.status === "active" && !e.isDeleted);
      const defaultEmp = activeEmployees.find((e) => e.role === "admin" || e.username === "admin") || activeEmployees[0];
      setAssignee(defaultEmp?.id || "");
      setAssignedEmployeeId(defaultEmp?.employeeId || defaultEmp?.id || "");
      setAssignedEmployeeName(defaultEmp?.fullName || defaultEmp?.name || defaultEmp?.username || "");
      setPriority("Medium");
      setStatus("Assigned");
      setAssociationType("client");
      setRecordId("");
      setVehicleId("");
      setRecordSearch("");
      setDueDate("");
      setDueTime("");
      setReminderMinutes("0");
      setChecklist([]);
    }
  }, [open, editing, employees, clients, leads]);

  const templatesList = useMemo(() => {
    if (dbTemplates.length > 0) return dbTemplates;
    return DEFAULT_TEMPLATES_SPEC.map((s, i) => ({
      id: `fallback-spec-${i}`,
      templateName: s.templateName,
      serviceType: s.serviceType,
      subtasks: s.subtasks,
      isDefault: true,
      createdBy: "system",
      createdAt: new Date().toISOString()
    })) as TaskTemplate[];
  }, [dbTemplates]);

  // Handle service templates lookup
  const handleServiceSelect = (val: string) => {
    setServiceName(val);
    if (!title.trim()) {
      setTitle(`${val} Processing`);
    }
    const selectedTpl = templatesList.find((t) => t.templateName === val);
    if (selectedTpl && selectedTpl.subtasks) {
      const generated: TaskSubtask[] = selectedTpl.subtasks.map((sub) => ({
        id: crypto.randomUUID(),
        title: sub,
        completed: false,
      }));
      setChecklist(generated);
    }
  };

  const clientVehicles = useMemo(() => {
    if (!recordId) return [];
    return vehicles.filter((v) => v.clientId === recordId);
  }, [recordId, vehicles]);

  const recordOptions = useMemo(() => {
    const src = associationType === "client" ? clients : associationType === "lead" ? leads : [];
    const q = recordSearch.toLowerCase().trim();
    if (!q) return src.slice(0, 30);
    return src
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.mvNo.toLowerCase().includes(q) ||
          r.work.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [associationType, clients, leads, recordSearch]);

  const addManualSubtask = () => {
    if (!newSubtaskInput.trim()) return;
    const item: TaskSubtask = {
      id: crypto.randomUUID(),
      title: newSubtaskInput.trim(),
      completed: false,
    };
    setChecklist([...checklist, item]);
    setNewSubtaskInput("");
  };

  const removeSubtaskItem = (index: number) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!title.trim() || !assignee) return;
    if (associationType === "none" || !recordId) {
      toast.error("Connecting a Client or Lead is required.");
      return;
    }
    setSaving(true);
    try {
      const dueIso = dueDate
        ? new Date(`${dueDate}T${dueTime || "09:00"}:00`).toISOString()
        : undefined;
      const bucket: Bucket | undefined =
        associationType === "client" ? "clients" : associationType === "lead" ? "leads" : undefined;
      const rec = recordId || undefined;
      const activeClientName = (associationType === "client" ? clients : associationType === "lead" ? leads : [])
        .find(c => c.id === rec)?.name || "";

      if (editing) {
        await updateTask(
          editing.id,
          {
            title: title.trim(),
            serviceName: serviceName.trim(),
            description,
            assignee,
            priority,
            status,
            done: status === "Completed",
            dueDate: dueIso,
            reminderMinutes: Number(reminderMinutes) || 0,
            associationType,
            bucket,
            recordId: rec,
            vehicleId: vehicleId || undefined,
            assignedEmployeeId,
            assignedEmployeeName,
            clientName: activeClientName,
            serviceType: serviceName.trim(),
            remarks: remarks.trim(),
          },
          actor,
          "Task edited",
        );
      } else {
        await createManualTask({
          title: title.trim(),
          serviceName: serviceName.trim(),
          description,
          assignee,
          priority,
          status,
          dueDate: dueIso,
          reminderMinutes: Number(reminderMinutes) || 0,
          associationType,
          bucket,
          recordId: rec,
          vehicleId: vehicleId || undefined,
          createdBy: actor,
          subtasks: checklist,
          assignedEmployeeId,
          assignedEmployeeName,
          clientId: rec,
          clientName: activeClientName,
          serviceType: serviceName.trim(),
          remarks: remarks.trim(),
        });
      }
      onClose();
    } catch (error) {
      console.error("❌ Task operation failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to ${editing ? "update" : "create"} task:\n\n${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit task" : "Create new task"}</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "Assign work to a staff member and link it to a client or lead."
              : "Update this task's details."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Predefined Task Selector Dropdown */}
          <div className="grid gap-1.5">
            <Label>Predefined Task (Pre-populates Checklist)</Label>
            <Select value={serviceName} onValueChange={handleServiceSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choose predefined task..." />
              </SelectTrigger>
              <SelectContent>
                {templatesList.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.templateName}>
                    {tpl.templateName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Task title *</Label>
            <Input
              required
              placeholder="Enter task name (e.g. Insurance Renewal Processing)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Details of the job…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Remarks</Label>
            <Textarea
              placeholder="Remarks or latest status updates..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-3">
            <div className="grid gap-1.5">
              <Label>Link connection *</Label>
              <Select
                value={associationType}
                onValueChange={(v) => {
                  setAssociationType(v as AssociationType);
                  setRecordId("");
                  setRecordSearch("");
                  setVehicleId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Link to Client</SelectItem>
                  <SelectItem value="lead">Link to Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5 relative">
              <Label>Search & select {associationType} *</Label>
              <div className="relative">
                <Input
                  placeholder="Type to search registry…"
                  value={recordSearch}
                  onChange={(e) => {
                    setRecordSearch(e.target.value);
                    setShowDropdown(true);
                    if (recordId) {
                      setRecordId("");
                      setVehicleId("");
                    }
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => {
                    setTimeout(() => setShowDropdown(false), 200);
                  }}
                  className="pr-8"
                />
                {recordSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecordSearch("");
                      setRecordId("");
                      setVehicleId("");
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 size-4 flex items-center justify-center rounded-full hover:bg-slate-100 transition"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {showDropdown && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl divide-y divide-slate-50">
                  {recordOptions.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={() => {
                        setRecordId(o.id);
                        setRecordSearch(o.name);
                        setVehicleId("");
                        setShowDropdown(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-50 transition flex flex-col gap-0.5 ${
                        recordId === o.id ? "bg-slate-50 font-semibold" : "text-gray-700"
                      }`}
                    >
                      <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                        {o.name}
                        {recordId === o.id && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-green-100 text-green-800">
                            Selected
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {o.mvNo ? `🚘 ${o.mvNo}` : ""} {o.work ? `• ⚙️ ${o.work}` : ""}
                      </span>
                    </button>
                  ))}
                  {recordOptions.length === 0 && (
                    <div className="p-3 text-center text-xs text-muted-foreground italic">
                      No matching {associationType}s found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Vehicle Dropdown */}
          {associationType === "client" && recordId && (
            <div className="grid gap-1.5 border-t pt-3">
              <Label>Link Vehicle (Optional)</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select linked vehicle..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Vehicle Linked</SelectItem>
                  {clientVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.vehicleNumber} {v.makeModel ? `— ${v.makeModel}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Checklist configurator preview / edit */}
          <div className="p-3 bg-slate-50 border rounded-lg space-y-2.5">
            <span className="text-[10px] uppercase font-bold text-gray-500 block">
              Configure Subtask Checklist
            </span>

            {/* Quick append input */}
            <div className="flex gap-2">
              <Input
                placeholder="Add custom subtask item..."
                value={newSubtaskInput}
                onChange={(e) => setNewSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addManualSubtask();
                  }
                }}
              />
              <Button type="button" size="sm" onClick={addManualSubtask}>
                Add
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-600 max-h-40 overflow-y-auto pr-1">
              {checklist.map((st, i) => (
                <div
                  key={st.id || i}
                  className="flex items-center justify-between gap-2 bg-white p-1.5 rounded border"
                >
                  <span className="truncate">
                    {i + 1}. {st.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSubtaskItem(i)}
                    className="text-red-500 hover:text-red-800"
                  >
                    <Trash2 className="size-3 shrink-0" />
                  </button>
                </div>
              ))}
              {checklist.length === 0 && (
                <span className="text-xs text-muted-foreground italic col-span-2">
                  No checklist items configured
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-3">
            <div className="grid gap-1.5">
              <Label>Assignee *</Label>
              <Select value={assignee} onValueChange={(val) => {
                setAssignee(val);
                const activeEmployees = employees.filter((e) => e.status === "active" && !e.isDeleted);
                const emp = activeEmployees.find(e => e.id === val);
                if (emp) {
                  setAssignedEmployeeId(emp.employeeId || emp.id || "");
                  setAssignedEmployeeName(emp.fullName || emp.name || emp.username || "");
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter((e) => e.status === "active" && !e.isDeleted)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.fullName || s.name || s.username}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {editing && (
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-3">
            <div className="grid gap-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Due time</Label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Reminder</Label>
              <Select value={reminderMinutes} onValueChange={setReminderMinutes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No reminder</SelectItem>
                  <SelectItem value="15">15 minutes before</SelectItem>
                  <SelectItem value="30">30 minutes before</SelectItem>
                  <SelectItem value="60">1 hour before</SelectItem>
                  <SelectItem value="1440">1 day before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-3 mt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : editing ? (
              "Save Changes"
            ) : (
              "Create Task"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task Details Sheet ──────────────────────────────────────────────────────
function TaskDetailsSheet({
  open,
  onClose,
  task: initialTask,
  clients,
  leads,
  vehicles,
  employees,
  actor,
  isAdmin,
  onEdit,
}: {
  open: boolean;
  onClose: () => void;
  task: Task;
  clients: RegistryRecord[];
  leads: RegistryRecord[];
  vehicles: any[];
  employees: any[];
  actor: string;
  isAdmin: boolean;
  onEdit: (t: Task) => void;
}) {
  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [liveTask, setLiveTask] = useState<Task | null>(null);
  
  const [expectedDate, setExpectedDate] = useState("");
  const [remarkInput, setRemarkInput] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>("Assigned");

  const assignedEmp = useMemo(() => {
    if (!liveTask && !initialTask.assignee) return null;
    const currentAssignee = liveTask?.assignee || initialTask.assignee;
    return employees.find(
      (e) =>
        e.id === currentAssignee ||
        e.uid === currentAssignee ||
        e.employeeId === currentAssignee ||
        e.username === currentAssignee
    );
  }, [liveTask, initialTask.assignee, employees]);

  useEffect(() => {
    if (!open || !initialTask.id) return;
    setLiveTask(null);
    setRemarkInput("");
    
    setSelectedStatus(initialTask.status || "Assigned");
    if (initialTask.dueDate) {
      setExpectedDate(new Date(initialTask.dueDate).toISOString().slice(0, 10));
    } else {
      setExpectedDate("");
    }

    // Subscribe to registry_tasks
    const unsubTasks = onSnapshot(doc(db, "registry_tasks", initialTask.id), (snap) => {
      if (snap.exists()) {
        const t = { id: snap.id, ...snap.data() } as Task;
        setLiveTask(t);
        setSelectedStatus(t.status || "Assigned");
        if (t.dueDate) {
          setExpectedDate(new Date(t.dueDate).toISOString().slice(0, 10));
        } else {
          setExpectedDate("");
        }
      } else {
        // Fallback: Subscribe to registry_services_v2
        const unsubServices = onSnapshot(doc(db, "registry_services_v2", initialTask.id), (sSnap) => {
          if (sSnap.exists()) {
            const s = sSnap.data() as any;
            const vehicle = vehicles.find((v) => v.id === s.vehicleId);
            const vehicleNo = vehicle?.vehicleNumber || "—";
            const clientId = vehicle?.clientId || s.clientId || "";
            const client = clients.find((c) => c.id === clientId) || leads.find((l) => l.id === clientId);
            const clientName = client?.name || s.clientName || "Unknown Client";

            const resolvedTask = {
              id: sSnap.id,
              title: s.title || `${s.serviceType || "Service"} - ${vehicleNo}`,
              serviceName: s.serviceType || "",
              description: s.remarks || s.notes || `Vehicle: ${vehicleNo}. Status: ${s.status || "Pending"}. Remarks: ${s.remarks || "—"}`,
              assignee: s.assignedTo || s.employeeId || s.assignee || "",
              assignedEmployeeId: s.employeeId || s.assignedTo || s.assignedStaff || s.assignee || "",
              assignedEmployeeName: s.assignedEmployeeName || s.assignedStaff || s.assignee || "",
              status: (s.taskStatus || s.status || "Assigned") as TaskStatus,
              priority: (s.priority || "Medium") as TaskPriority,
              done: s.taskStatus === "Completed",
              createdAt: s.createdAt || s.startDate || new Date().toISOString(),
              createdBy: s.createdBy || "System",
              dueDate: s.dueDate || s.startDate || "",
              associationType: (client?.isDeleted ? "lead" : "client") as AssociationType,
              bucket: client?.isDeleted ? "leads" : "clients",
              recordId: clientId,
              clientId: clientId,
              clientName: clientName,
              manual: false,
              progress: s.taskStatus === "Completed" ? 100 : s.taskStatus === "In Progress" ? 50 : 0,
              reminderMinutes: s.reminderMinutes || 0,
              subtasks: s.subtasks || [],
              comments: s.comments || [],
              activity: s.activity || [],
              activityLogs: s.activityLogs || [],
              attachments: s.attachments || [],
            } as Task;

            setLiveTask(resolvedTask);
            setSelectedStatus(resolvedTask.status || "Assigned");
            if (resolvedTask.dueDate) {
              setExpectedDate(new Date(resolvedTask.dueDate).toISOString().slice(0, 10));
            } else {
              setExpectedDate("");
            }
          }
        });
        return () => unsubServices();
      }
    });

    return () => unsubTasks();
  }, [open, initialTask.id, clients, leads, vehicles]);

  const activeTask = liveTask || initialTask;

  const handleSaveProgress = async () => {
    try {
      const updates: any = {
        status: selectedStatus,
        done: selectedStatus === "Completed",
      };
      if (expectedDate) {
        updates.dueDate = new Date(expectedDate).toISOString();
      }
      if (selectedStatus === "Completed") {
        const now = new Date().toISOString();
        updates.completedAt = now;
        updates.completedOn = now;
        updates.completedBy = actor;
      }
      
      if (remarkInput.trim()) {
        await addComment(activeTask.id, actor, remarkInput.trim());
        setRemarkInput("");
      }
      
      await updateTask(activeTask.id, updates, actor, "Progress updated");
      toast.success("Progress saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save progress");
    }
  };

  const handleMarkCompleted = async () => {
    try {
      const now = new Date().toISOString();
      const updates = {
        status: "Completed" as TaskStatus,
        done: true,
        completedAt: now,
        completedOn: now,
        completedBy: actor,
      };
      
      if (remarkInput.trim()) {
        await addComment(activeTask.id, actor, remarkInput.trim());
        setRemarkInput("");
      }
      
      await updateTask(activeTask.id, updates, actor, "Marked task as completed");
      toast.success("Task marked as completed!");
    } catch (err: any) {
      toast.error(err.message || "Failed to mark completed");
    }
  };

  const linked = useMemo(() => {
    if (!activeTask.recordId) return null;
    const src = activeTask.bucket === "leads" ? leads : clients;
    return src.find((r) => r.id === activeTask.recordId) ?? null;
  }, [activeTask, clients, leads]);

  const linkedVehicle = useMemo(() => {
    if (!activeTask.vehicleId) return null;
    return vehicles.find((v) => v.id === activeTask.vehicleId) ?? null;
  }, [activeTask, vehicles]);

  const sortedComments = useMemo(() => {
    return [...(activeTask.comments ?? [])].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [activeTask.comments]);

  const MAX_ATTACH_MB = 10;
  const onFile = (file: File) => {
    if (file.size > MAX_ATTACH_MB * 1024 * 1024) {
      alert(`File exceeds size limit of ${MAX_ATTACH_MB} MB.`);
      return;
    }
    setUploading(true);
    setUploadPct(0);
    const storageKey = `tasks/${activeTask.id}/${crypto.randomUUID()}-${file.name}`;
    const fileRef = ref(storage, storageKey);
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadPct(pct);
      },
      (error) => {
        console.error("Upload failed:", error);
        alert("Upload failed. Please try again.");
        setUploading(false);
      },
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        const attachment: TaskAttachment = {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          storageKey,
          downloadUrl,
          addedAt: new Date().toISOString(),
          addedBy: actor,
        };
        await addAttachment(activeTask.id, attachment);
        setUploading(false);
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-8">{activeTask.title}</SheetTitle>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline" className={cn("border", priorityBadgeClass(activeTask.priority))}>
              {activeTask.priority}
            </Badge>
            <Badge variant="outline" className={cn("border", statusBadgeClass(activeTask.status))}>
              {activeTask.status}
            </Badge>
            {activeTask.recordId && (
              <Badge
                variant="outline"
                className="border bg-primary/10 text-primary border-primary/20"
              >
                <Link2 className="size-3 mr-1" />
                {activeTask.bucket}
              </Badge>
            )}
            {linkedVehicle && (
              <Badge
                variant="outline"
                className="border bg-slate-100 text-slate-700 border-slate-200"
              >
                <Car className="size-3 mr-1" />
                {linkedVehicle.vehicleNumber}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="flex gap-2 mt-4 mb-4">
          <Button variant="outline" size="sm" onClick={() => generateTaskPDF(activeTask)}>
            <Download className="size-4 mr-1" />
            Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={printWindow}>
            <Printer className="size-4 mr-1" />
            Print
          </Button>
        </div>

        <div className="space-y-6">
          {/* Quick status & reassignment */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={activeTask.status}
                onValueChange={(v) => {
                  const s = v as TaskStatus;
                  updateTask(
                    activeTask.id,
                    { status: s, done: s === "Completed" },
                    actor,
                    `Status → ${s}`,
                  );
                  if (s === "Completed") setTaskDone(activeTask.id, true, actor);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(() => {
                const canEdit = true;
                return canEdit && (
                  <Button variant="outline" size="sm" onClick={() => onEdit(activeTask)}>
                    <Pencil className="size-4 mr-1" />
                    Edit
                  </Button>
                );
              })()}
            </div>

            {isAdmin && <ReassignmentSection task={activeTask} actor={actor} />}
          </div>

          {/* Task Information Section */}
          <CollapsibleSection title="Task Information" defaultOpen={true}>
            <div className="space-y-4">
              <div>
                <Label className="text-xs uppercase font-bold text-gray-400">Description</Label>
                <p className="text-sm text-gray-700 bg-slate-50 p-3 rounded-lg border whitespace-pre-wrap mt-1">
                  {activeTask.description?.trim() ? activeTask.description : "No description."}
                </p>
              </div>

              <div>
                <Label className="text-xs uppercase font-bold text-gray-400">Details</Label>
                <dl className="grid grid-cols-2 gap-3 text-sm mt-1 bg-white p-3 rounded-lg border">
                  <Meta label="Assigned to" value={activeTask.assignedEmployeeName || "Former Employee"} />
                  {assignedEmp && (
                    <>
                      <Meta label="Role" value={assignedEmp.role ? (assignedEmp.role.charAt(0).toUpperCase() + assignedEmp.role.slice(1)) : "—"} />
                      <Meta label="Email" value={assignedEmp.email || "—"} />
                    </>
                  )}
                  <Meta label="Created by" value={staffLabel(activeTask.createdBy) || activeTask.createdBy} />
                  <Meta label="Due" value={activeTask.dueDate ? formatDate(activeTask.dueDate) : "—"} />
                  <Meta
                    label="Reminder"
                    value={activeTask.reminderMinutes ? `${activeTask.reminderMinutes} min before` : "None"}
                  />
                  <Meta label="Created" value={new Date(activeTask.createdAt).toLocaleString()} />
                  <Meta label="Type" value={activeTask.manual ? "Manual" : "Auto from record"} />
                  {activeTask.readBy && (
                    <>
                      <Meta label="Read By" value={staffLabel(activeTask.readBy) || activeTask.readBy} />
                      <Meta
                        label="Read On"
                        value={activeTask.readAt ? new Date(activeTask.readAt).toLocaleString() : "—"}
                      />
                    </>
                  )}
                  {activeTask.lastUpdatedBy && activeTask.lastUpdatedAt && (
                    <>
                      <Meta
                        label="Last Updated By"
                        value={staffLabel(activeTask.lastUpdatedBy) || activeTask.lastUpdatedBy}
                      />
                      <Meta
                        label="Last Updated At"
                        value={new Date(activeTask.lastUpdatedAt).toLocaleString()}
                      />
                    </>
                  )}
                </dl>
              </div>

              {activeTask.recordId && (
                <ClientRelationshipPanel clientId={activeTask.recordId} />
              )}
            </div>
          </CollapsibleSection>

          {/* Task Progress Section (No Subtasks) */}
          {(!activeTask.subtasks || activeTask.subtasks.length === 0) && (
            <CollapsibleSection title="Task Progress" defaultOpen={true}>
              <div className="space-y-4">
                {/* Status Selection Buttons */}
                <div>
                  <Label className="text-xs uppercase font-bold text-gray-400 block mb-2">Status Stages</Label>
                  <div className="flex flex-wrap gap-2">
                    {TASK_STATUS_OPTIONS.map((statusOption) => {
                      const isSelected = selectedStatus === statusOption;
                      return (
                        <button
                          key={statusOption}
                          type="button"
                          onClick={() => setSelectedStatus(statusOption)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold border transition",
                            isSelected 
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-white text-gray-600 border-gray-200 hover:bg-slate-50"
                          )}
                        >
                          {statusOption}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Expected Completion Date */}
                <div className="grid gap-1.5">
                  <Label className="text-xs uppercase font-bold text-gray-400">Expected Completion Date</Label>
                  <Input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                  />
                </div>

                {/* Remarks Field */}
                <div className="grid gap-1.5">
                  <Label className="text-xs uppercase font-bold text-gray-400">Add Remark / Update Progress</Label>
                  <Textarea
                    placeholder="Enter latest status update remarks..."
                    value={remarkInput}
                    onChange={(e) => setRemarkInput(e.target.value)}
                  />
                </div>

                {/* Save & Complete Buttons */}
                <div className="flex gap-2 border-t pt-3">
                  <Button type="button" onClick={handleSaveProgress} className="flex-1">
                    Save Progress
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleMarkCompleted} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                    Mark Completed
                  </Button>
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Subtasks Collapsible Section */}
          {activeTask.subtasks && activeTask.subtasks.length > 0 && (
            <CollapsibleSection title="Subtasks checklist" defaultOpen={true}>
              <div className="space-y-4">
                {/* Progress bar character blocks tracker */}
                {(() => {
                  const items = activeTask.subtasks ?? [];
                  const completedCount = items.filter((s) => s.completed).length;
                  const remainingCount = items.length - completedCount;
                  const pct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
                  const blockCount = Math.round(pct / 10);
                  const blockString = "█".repeat(blockCount) + "░".repeat(10 - blockCount);
                  
                  return (
                    <div className="bg-slate-50 p-4 rounded-xl border grid grid-cols-2 gap-4 text-xs font-semibold text-gray-600">
                      <div>
                        <span className="text-muted-foreground uppercase text-[10px] block">Overall Status</span>
                        <span className="text-sm font-bold text-gray-800">{activeTask.status}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground uppercase text-[10px] block">Progress</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">{pct}%</span>
                          <span className="font-mono text-gray-400">{blockString}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground uppercase text-[10px] block">Completed</span>
                        <span className="text-sm font-bold text-emerald-600">{completedCount} / {items.length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground uppercase text-[10px] block">Remaining</span>
                        <span className="text-sm font-bold text-amber-600">{remainingCount}</span>
                      </div>
                    </div>
                  );
                })()}

                <SubtasksSection task={activeTask} actor={actor} isAdmin={isAdmin} />
              </div>
            </CollapsibleSection>
          )}

          {/* Remarks collapsible section */}
          <CollapsibleSection title="Remarks & Note History" defaultOpen={false}>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a note…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && comment.trim()) {
                      addComment(activeTask.id, actor, comment.trim());
                      setComment("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (comment.trim()) {
                      addComment(activeTask.id, actor, comment.trim());
                      setComment("");
                    }
                  }}
                >
                  <Send className="size-4" />
                </Button>
              </div>

              <div className="space-y-3 divide-y divide-dashed">
                {sortedComments.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No remarks yet.</p>
                ) : (
                  sortedComments.map((c, i) => (
                    <div
                      key={c.id}
                      className={cn(
                        "text-sm pt-3 first:pt-0 border-none",
                        i > 0 && "border-t border-gray-100",
                      )}
                    >
                      <p className="font-semibold text-gray-800">{c.text}</p>
                      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                        <span className="font-bold text-primary">
                          {staffLabel(c.author) || c.author}
                        </span>
                        <span>
                          {new Date(c.at).toLocaleDateString("en-IN")} •{" "}
                          {new Date(c.at).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* Attachments collapsible section */}
          <CollapsibleSection title="Attachments" defaultOpen={false}>
            <div className="space-y-3">
              {(activeTask.attachments ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No attachments yet.</p>
              )}
              {(activeTask.attachments ?? []).map((a) => (
                <a
                  key={a.id}
                  href={a.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline border bg-slate-50 p-2.5 rounded-lg"
                >
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-bold text-gray-700">{a.name}</p>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      {Math.round(a.size / 1024)} KB • {a.addedBy ? staffLabel(a.addedBy) : "System"}
                    </span>
                  </div>
                  <ExternalLink className="size-3.5 text-muted-foreground shrink-0" />
                </a>
              ))}

              {uploading && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Uploading… {uploadPct}%
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${uploadPct}%` }}
                    />
                  </div>
                </div>
              )}

              <label
                className={cn(
                  "inline-flex items-center gap-2 text-sm cursor-pointer text-primary border border-dashed rounded-lg p-3 hover:bg-slate-50/50 justify-center w-full mt-1.5",
                  uploading && "opacity-50 pointer-events-none",
                )}
              >
                <Paperclip className="size-4 text-muted-foreground" />
                <span className="text-xs font-bold text-gray-600">Attach file (max {MAX_ATTACH_MB} MB)</span>
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </CollapsibleSection>

          {/* Timeline / Activity Log collapsible section */}
          <CollapsibleSection title="Timeline & Activity Log" defaultOpen={false}>
            <ol className="relative border-l pl-4 space-y-4">
              {(activeTask.activityLogs ?? []).length > 0
                ? (activeTask.activityLogs ?? []).map((log) => (
                    <li key={log.id} className="text-sm relative">
                      <span className="absolute -left-[21px] mt-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
                      <div className="font-semibold text-gray-800 leading-tight">{log.action}</div>
                      {log.field && (log.oldValue !== undefined || log.newValue !== undefined) && (
                        <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                          {log.field}: {log.oldValue || "—"} → {log.newValue || "—"}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 font-bold mt-1">
                        {staffLabel(log.actor) || log.actor} • {new Date(log.timestamp).toLocaleString("en-IN")}
                      </div>
                    </li>
                  ))
                : (activeTask.activity ?? []).map((a) => (
                    <li key={a.id} className="text-sm relative">
                      <span className="absolute -left-[21px] mt-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
                      <div className="text-gray-800 leading-tight">{a.message}</div>
                      <div className="text-[10px] text-gray-400 font-bold mt-1">
                        {staffLabel(a.actor) || a.actor} • {new Date(a.at).toLocaleString("en-IN")}
                      </div>
                    </li>
                  ))}
            </ol>
          </CollapsibleSection>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl bg-white shadow-sm overflow-hidden mb-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 transition border-b"
      >
        <span className="font-semibold text-xs text-gray-500 uppercase tracking-wider">{title}</span>
        <span className="text-gray-400 text-xs transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
      </button>
      {isOpen && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground font-medium">{label}</dt>
      <dd className="text-sm font-semibold text-foreground mt-0.5">{value}</dd>
    </div>
  );
}

function ReassignmentSection({ task, actor }: { task: Task; actor: string }) {
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    return onSnapshot(collection(db, "users"), (snap: any) => {
      setEmployees(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  return (
    <div className="flex items-center gap-2 border bg-slate-50 p-2.5 rounded-lg max-w-sm">
      <Users className="size-4 text-muted-foreground shrink-0" />
      <div className="flex-1 text-xs font-semibold">Assignee</div>
      <Select value={task.assignee} onValueChange={(v) => reassignTask(task.id, v, actor)}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {employees
            .filter((e) => e.status === "active" && !e.isDeleted)
            .map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.fullName || s.name || s.username}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SubtasksSection({ task, actor, isAdmin }: { task: Task; actor: string; isAdmin: boolean }) {
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    return onSnapshot(collection(db, "users"), (snap: any) => {
      setEmployees(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    });
  }, []);



  const calculateProgress = (subs: any[]) => {
    if (!subs.length) return 0;
    const comp = subs.filter((s) => s.completed).length;
    return Math.round((comp / subs.length) * 100);
  };

  const items = useMemo(() => task.subtasks ?? [], [task.subtasks]);
  const completed = items.filter((s) => s.completed).length;
  const pct = calculateProgress(items);

  // Subtask form & remarks modal states
  const [editingSub, setEditingSub] = useState<TaskSubtask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  const [remarkingSub, setRemarkingSub] = useState<TaskSubtask | null>(null);
  const [subRemarkText, setSubRemarkText] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  // Progress Bar Character Blocks helper
  const blockCount = Math.round(pct / 10);
  const blockString = "█".repeat(blockCount) + "░".repeat(10 - blockCount);

  const getProgressColor = (percent: number) => {
    if (percent <= 25) return "text-red-500 bg-red-500";
    if (percent <= 50) return "text-orange-500 bg-orange-500";
    if (percent <= 75) return "text-blue-500 bg-blue-500";
    return "text-green-500 bg-green-500";
  };

  const handleStatusChange = async (sub: TaskSubtask, nextStatus: "Pending" | "In Progress" | "Completed") => {
    const nextCompleted = nextStatus === "Completed";
    const updated = items.map((s) => {
      if (s.id === sub.id) {
        return {
          ...s,
          status: nextStatus,
          completed: nextCompleted,
          completedBy: nextCompleted ? actor : undefined,
          completedOn: nextCompleted ? new Date().toISOString() : undefined,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
          updatedBy: actor,
          updatedAt: new Date().toISOString(),
        };
      }
      return s;
    });
    await updateSubtasks(task.id, updated, actor);
    toast.success(`Subtask status updated to ${nextStatus}!`);
  };

  // Add Subtask
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newSub: TaskSubtask = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      completed: false,
      assignedTo: newAssignedTo || undefined,
      dueDate: newDueDate || undefined,
      createdBy: actor,
      createdAt: new Date().toISOString(),
      remarks: [],
    };

    const updated = [...items, newSub];
    await updateSubtasks(task.id, updated, actor);
    setNewTitle("");
    setNewAssignedTo("");
    setNewDueDate("");
    toast.success("Subtask added successfully!");
  };

  // Toggle Completion
  const handleToggle = async (sub: TaskSubtask) => {
    const updated = items.map((s) => {
      if (s.id === sub.id) {
        const nextCompleted = !s.completed;
        return {
          ...s,
          completed: nextCompleted,
          completedBy: nextCompleted ? actor : undefined,
          completedOn: nextCompleted ? new Date().toISOString() : undefined,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
          updatedBy: actor,
          updatedAt: new Date().toISOString(),
        };
      }
      return s;
    });
    await updateSubtasks(task.id, updated, actor);
    toast.success(sub.completed ? "Subtask reopened" : "Subtask completed!");
  };

  // Edit Subtask Dialog Save
  const handleSaveEdit = async () => {
    if (!editingSub || !editTitle.trim()) return;
    const updated = items.map((s) => {
      if (s.id === editingSub.id) {
        return {
          ...s,
          title: editTitle.trim(),
          assignedTo: editAssignedTo || undefined,
          dueDate: editDueDate || undefined,
          updatedBy: actor,
          updatedAt: new Date().toISOString(),
        };
      }
      return s;
    });
    await updateSubtasks(task.id, updated, actor);
    setEditingSub(null);
    toast.success("Subtask updated successfully!");
  };

  // Delete Subtask
  const handleDelete = async (subId: string) => {
    if (!confirm("Are you sure you want to delete this subtask?")) return;
    const updated = items.filter((s) => s.id !== subId);
    await updateSubtasks(task.id, updated, actor);
    toast.success("Subtask deleted!");
  };

  // Add Subtask Remark
  const handleAddSubRemark = async () => {
    if (!remarkingSub || !subRemarkText.trim()) return;
    const remarkObj = {
      id: crypto.randomUUID(),
      text: subRemarkText.trim(),
      author: actor,
      at: new Date().toISOString(),
    };
    const updated = items.map((s) => {
      if (s.id === remarkingSub.id) {
        return {
          ...s,
          remarks: [...(s.remarks || []), remarkObj],
          updatedBy: actor,
          updatedAt: new Date().toISOString(),
        };
      }
      return s;
    });
    await updateSubtasks(task.id, updated, actor);
    setSubRemarkText("");
    setRemarkingSub(null);
    toast.success("Subtask remark logged!");
  };

  // Move Subtask (Reorder Up/Down)
  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const list = [...items];
    const [moved] = list.splice(index, 1);
    list.splice(targetIndex, 0, moved);

    await updateSubtasks(task.id, list, actor);
  };

  return (
    <Section title="Subtask Workflow Tracker">
      <div className="space-y-4">
        {/* Professional Progress Segment */}
        <div className="bg-slate-50 p-3.5 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Progress Tracker
            </span>
            <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span
                className={cn(
                  "font-mono font-bold text-xs px-2 py-0.5 rounded text-white",
                  getProgressColor(pct).split(" ")[1],
                )}
              >
                {pct}%
              </span>
              <span className="text-xs font-mono text-gray-600 tracking-wider font-semibold">
                {blockString}
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-500 text-right font-medium">
            <strong>{completed}</strong> of <strong>{items.length}</strong> Tasks Completed
          </div>
        </div>

        {/* Subtasks checklist items */}
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
          {items.map((st, index) => {
            const hasRemarks = (st.remarks || []).length > 0;
            return (
              <div
                key={st.id}
                className={cn(
                  "border rounded-xl p-3 bg-white hover:border-slate-300 transition shadow-sm",
                  st.completed && "bg-slate-50/50 border-slate-200",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <Checkbox
                      checked={st.status === "Completed" || st.completed}
                      onCheckedChange={(checked) => handleStatusChange(st, checked ? "Completed" : "Pending")}
                      className="mt-1 size-4.5 rounded cursor-pointer"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p
                        className={cn(
                          "text-xs font-bold text-gray-800 leading-tight truncate",
                          (st.status === "Completed" || st.completed) && "line-through text-muted-foreground",
                        )}
                      >
                        {index + 1}. {st.title}
                      </p>

                      {/* Professional metadata tracker */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-gray-500 font-semibold mt-1 items-center">
                        <span>
                          Assigned:{" "}
                          <strong className="text-gray-700">
                            {st.assignedTo ? staffLabel(st.assignedTo) : "Unassigned"}
                          </strong>
                        </span>
                        {st.dueDate && (
                          <span>
                            Due:{" "}
                            <strong className="text-amber-700">
                              {new Date(st.dueDate).toLocaleDateString("en-IN")}
                            </strong>
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">Status:</span>
                          <select
                            value={st.status || (st.completed ? "Completed" : "Pending")}
                            onChange={(e) => handleStatusChange(st, e.target.value as any)}
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-bold border bg-transparent cursor-pointer",
                              (st.status === "Completed" || st.completed) && "text-emerald-700 bg-emerald-50 border-emerald-200",
                              st.status === "In Progress" && "text-indigo-700 bg-indigo-50 border-indigo-200",
                              (st.status === "Pending" || (!st.status && !st.completed)) && "text-amber-700 bg-amber-50 border-amber-200"
                            )}
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </div>
                      </div>

                      {/* Subtask Remarks History Timeline inside Row */}
                      {hasRemarks && (
                        <div className="bg-slate-50 border rounded-lg p-2 mt-2 space-y-1.5">
                          <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wide">
                            Remarks History
                          </span>
                          <div className="space-y-1.5 divide-y divide-dashed">
                            {(st.remarks || []).map((rem) => (
                              <div
                                key={rem.id}
                                className="text-[10px] text-gray-600 pt-1 first:pt-0 border-none"
                              >
                                <p className="font-medium">{rem.text}</p>
                                <div className="text-[8px] text-gray-400 mt-0.5 flex justify-between font-bold">
                                  <span>{staffLabel(rem.author) || rem.author}</span>
                                  <span>
                                    {new Date(rem.at).toLocaleDateString("en-IN")} •{" "}
                                    {new Date(rem.at).toLocaleTimeString("en-IN", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Operational actions: Edit, Reorder, Add Remark, Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setRemarkingSub(st)}
                      className="text-gray-400 hover:text-primary p-1 rounded hover:bg-slate-100"
                      title="Add Remark"
                    >
                      <MessageSquare className="size-3.5" />
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSub(st);
                            setEditTitle(st.title);
                            setEditAssignedTo(st.assignedTo || "");
                            setEditDueDate(st.dueDate || "");
                          }}
                          className="text-gray-400 hover:text-primary p-1 rounded hover:bg-slate-100"
                          title="Edit Subtask"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMove(index, "up")}
                          className="text-gray-400 hover:text-gray-800 disabled:opacity-30 p-1 rounded hover:bg-slate-100"
                          title="Move Up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={index === items.length - 1}
                          onClick={() => handleMove(index, "down")}
                          className="text-gray-400 hover:text-gray-800 disabled:opacity-30 p-1 rounded hover:bg-slate-100"
                          title="Move Down"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(st.id)}
                          className="text-red-400 hover:text-red-700 p-1 rounded hover:bg-red-50"
                          title="Delete Subtask"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="text-center py-10 border border-dashed rounded-xl bg-slate-50/50 p-4">
              <CheckCircle className="size-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 italic font-medium">
                No subtasks have been created for this task. You can complete this task directly using the Task Progress section below.
              </p>
            </div>
          )}
        </div>

        {/* Add Subtask Form */}
        {isAdmin && (
          <form onSubmit={handleAdd} className="border-t pt-3.5 space-y-2">
            <span className="text-[10px] uppercase font-bold text-gray-500 block">
              Add New Checklist Item
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-3">
                <Input
                  required
                  placeholder="Enter subtask workflow name (e.g. Collect RC Copy)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div>
                <Select value={newAssignedTo} onValueChange={setNewAssignedTo}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Assign Employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {employees
                      .filter((e) => e.status === "active" && !e.isDeleted)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.fullName || s.name || s.username}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input
                  type="date"
                  className="h-9 text-xs"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" className="h-9 gap-1 text-xs">
                <Plus className="size-3.5" /> Add Subtask
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Edit Subtask Modal Dialog */}
      {editingSub && (
        <Dialog open={!!editingSub} onOpenChange={(v) => !v && setEditingSub(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Subtask Settings</DialogTitle>
              <DialogDescription>
                Modify operational details for this checklist process item.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label htmlFor="editSubTitle" className="text-xs uppercase font-bold text-gray-500">
                  Subtask Title *
                </Label>
                <Input
                  id="editSubTitle"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="editSubAssign"
                  className="text-xs uppercase font-bold text-gray-500"
                >
                  Assigned Employee
                </Label>
                <Select value={editAssignedTo} onValueChange={setEditAssignedTo}>
                  <SelectTrigger id="editSubAssign">
                    <SelectValue placeholder="Select staff..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {employees
                      .filter((e) => e.status === "active" && !e.isDeleted)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.fullName || s.name || s.username}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="editSubDue" className="text-xs uppercase font-bold text-gray-500">
                  Due Date
                </Label>
                <Input
                  id="editSubDue"
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setEditingSub(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Subtask Remark Dialog */}
      {remarkingSub && (
        <Dialog open={!!remarkingSub} onOpenChange={(v) => !v && setRemarkingSub(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log Subtask Remark</DialogTitle>
              <DialogDescription>
                Add operational remark history for subtask: <strong>{remarkingSub.title}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-2">
              <Label htmlFor="subRemarkText" className="text-xs uppercase font-bold text-gray-500">
                Remark Text *
              </Label>
              <Textarea
                id="subRemarkText"
                rows={3}
                required
                placeholder="e.g. Hard copy received."
                value={subRemarkText}
                onChange={(e) => setSubRemarkText(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setRemarkingSub(null)}>
                Cancel
              </Button>
              <Button onClick={handleAddSubRemark} disabled={!subRemarkText.trim()}>
                Log Remark
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Section>
  );
}

function ClientRelationshipPanel({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);

    const unsubClient = onSnapshot(doc(db, "registry_clients_v2", clientId), (snap: any) => {
      if (snap.exists()) {
        setClient({ id: snap.id, ...snap.data() });
      }
    });

    const unsubVehicles = onSnapshot(
      query(collection(db, "registry_vehicles_v2"), where("clientId", "==", clientId)),
      (snap: any) => {
        const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        setVehicles(list);
      }
    );

    const unsubServices = onSnapshot(
      collection(db, "registry_services_v2"),
      (snap: any) => {
        const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        setServices(list);
      }
    );

    const unsubInvoices = onSnapshot(
      query(collection(db, "billing_invoices"), where("clientId", "==", clientId)),
      (snap: any) => {
        const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        setInvoices(list);
      }
    );

    const unsubDocs = onSnapshot(
      query(collection(db, "registry_customer_docs"), where("customerId", "==", clientId)),
      (snap: any) => {
        const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        setDocuments(list);
      }
    );

    const unsubActivity = onSnapshot(
      query(collection(db, "client_activity_logs"), where("clientId", "==", clientId)),
      (snap: any) => {
        const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        setActivity(list.sort((a: any, b: any) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()));
      }
    );

    setLoading(false);

    return () => {
      unsubClient();
      unsubVehicles();
      unsubServices();
      unsubInvoices();
      unsubDocs();
      unsubActivity();
    };
  }, [clientId]);

  if (loading) return <div className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/20">Loading client relationships...</div>;
  if (!client) return <div className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/20">No linked client details found.</div>;

  // Filter services that belong to client's vehicles
  const vehicleIds = vehicles.map((v) => v.id);
  const clientServices = services.filter((s) => vehicleIds.includes(s.vehicleId));

  // Calculate outstanding amount
  const outstandingAmount = invoices.reduce((sum, inv) => sum + ((inv.totalAmount || 0) - (inv.totalPaid || 0)), 0);

  return (
    <div className="space-y-4 border-t pt-4">
      <h4 className="text-xs uppercase font-bold text-gray-500 tracking-wide">Client Relationship Profile</h4>
      
      {/* Client Meta */}
      <div className="bg-muted/40 p-3 rounded-lg border text-sm space-y-1.5">
        <div><strong>Name:</strong> {client.name}</div>
        <div><strong>Mobile:</strong> {client.mobile || "—"}</div>
        {client.email && <div><strong>Email:</strong> {client.email}</div>}
        {client.address && <div><strong>Address:</strong> {client.address}</div>}
        {client.companyName && <div><strong>Company:</strong> {client.companyName}</div>}
        {client.gstNumber && <div><strong>GST:</strong> {client.gstNumber}</div>}
        {outstandingAmount > 0 && (
          <div className="text-rose-600 font-semibold mt-1">
            Outstanding Balance: ₹{outstandingAmount.toLocaleString("en-IN")}
          </div>
        )}
      </div>

      {/* Vehicles */}
      {vehicles.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Vehicles ({vehicles.length})</span>
          <div className="grid grid-cols-1 gap-2">
            {vehicles.map((v) => (
              <div key={v.id} className="bg-white border rounded p-2 text-xs">
                <div className="font-semibold text-primary">{v.vehicleNumber} ({v.vehicleType || "Commercial"})</div>
                {v.chassisNumber && <div>Chassis: {v.chassisNumber}</div>}
                {v.engineNumber && <div>Engine: {v.engineNumber}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services */}
      {clientServices.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Active Services ({clientServices.length})</span>
          <div className="grid grid-cols-1 gap-2">
            {clientServices.map((s) => (
              <div key={s.id} className="bg-white border rounded p-2 text-xs flex justify-between items-center">
                <div>
                  <div className="font-semibold">{s.serviceType}</div>
                  <div className="text-muted-foreground">Due: {s.dueDate || "—"}</div>
                </div>
                <Badge variant="outline">{s.taskStatus}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Invoices ({invoices.length})</span>
          <div className="grid grid-cols-1 gap-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="bg-white border rounded p-2 text-xs flex justify-between items-center">
                <div>
                  <div className="font-semibold">{inv.invoiceNumber}</div>
                  <div className="text-muted-foreground">Date: {inv.invoiceDate || "—"}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">₹{inv.totalAmount}</div>
                  <Badge variant="outline" className={inv.status === "Paid" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                    {inv.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Client Documents ({documents.length})</span>
          <div className="grid grid-cols-1 gap-1">
            {documents.map((doc) => (
              <a
                key={doc.id}
                href={doc.downloadURL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-1.5 bg-white border rounded text-xs text-primary hover:underline"
              >
                <Paperclip className="size-3.5" />
                <span className="truncate">{doc.name} ({doc.type})</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {activity.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Recent Activity</span>
          <div className="bg-white border rounded p-2 text-[11px] max-h-36 overflow-y-auto space-y-1">
            {activity.slice(0, 5).map((act) => (
              <div key={act.id} className="border-b last:border-0 pb-1">
                <span className="font-semibold">{act.performedBy}:</span> {act.action} {act.fieldName && `(${act.fieldName})`}
                <div className="text-[10px] text-muted-foreground">{new Date(act.performedAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
