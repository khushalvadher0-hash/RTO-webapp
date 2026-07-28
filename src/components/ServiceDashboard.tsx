import React, { useEffect, useMemo, useState } from "react";
import { getSession } from "@/lib/auth";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getServiceClientsAll,
  getServiceStats,
  getServiceDistributionSummary,
} from "@/lib/services";
import {
  serviceLabel,
  type ServiceType,
  type RegistryRecord,
  getRecordServices,
  getRecordServiceAmount,
  getRecordPendingAmount,
  getRecordPaymentStatus,
  getRecordServiceDetails,
  hasLegacyAccounting,
} from "@/lib/records";
import { RecordTable } from "@/components/RecordTable";
import { ClientDetailWorkspace } from "./ClientDetailWorkspace";
import { AddClientWizardDialog } from "./AddClientWizardDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import {
  Users,
  TrendingUp,
  Package,
  AlertCircle,
  DollarSign,
  ArrowRight,
  Download,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  Eye,
} from "lucide-react";
import { generateServicePDF } from "@/lib/pdfServiceHelper";

interface ServiceDashboardProps {
  serviceType: ServiceType;
  title?: string;
  description?: string;
}

function aggregateServiceRecords(recs: RegistryRecord[], serviceType: ServiceType) {
  const clientGroups: { [clientId: string]: RegistryRecord[] } = {};
  for (const r of recs) {
    if (!clientGroups[r.id]) {
      clientGroups[r.id] = [];
    }
    clientGroups[r.id].push(r);
  }

  const aggregatedRecords: any[] = [];
  let index = 1;

  let uniqueVehicles = new Set<string>();

  // Status counts for services
  let serviceActiveCount = 0;
  let serviceCompletedCount = 0;
  let servicePendingCount = 0;
  let serviceOnHoldCount = 0;

  for (const clientId in clientGroups) {
    const group = clientGroups[clientId];
    const first = group[0];

    const vehicleNumbers = Array.from(new Set(group.map((r) => r.mvNo).filter((v) => v && v !== "—")));
    vehicleNumbers.forEach((v) => uniqueVehicles.add(v));

    const servicesList = group.flatMap((r) => r.services || []);

    for (const s of servicesList) {
      // Count service statuses
      const status = s.status || "Pending";
      if (status === "Completed") {
        serviceCompletedCount++;
      } else if (
        status === "In Progress" ||
        status === "Documents Collected" ||
        status === "Verification" ||
        status === "Submitted" ||
        status === "Approved" ||
        status === "Active"
      ) {
        serviceActiveCount++;
      } else if (status === "On Hold") {
        serviceOnHoldCount++;
      } else {
        servicePendingCount++;
      }
    }

    // Determine aggregated status
    let aggStatus = "Pending";
    const statuses = servicesList.map((s) => s.status || "Pending");
    if (statuses.every((s) => s === "Completed")) {
      aggStatus = "Completed";
    } else if (
      statuses.some((s) =>
        [
          "In Progress",
          "Active",
          "Submitted",
          "Approved",
          "Verification",
          "Documents Collected",
        ].includes(s),
      )
    ) {
      aggStatus = "In Progress";
    } else if (statuses.some((s) => s === "On Hold")) {
      aggStatus = "On Hold";
    }

    // Determine earliest due date
    const dueDates = servicesList.map((s) => s.dueDate).filter(Boolean);
    const earliestDueDate =
      dueDates.length > 0
        ? dueDates.reduce((earliest, current) => {
            return new Date(current) < new Date(earliest) ? current : earliest;
          })
        : "";

    aggregatedRecords.push({
      ...first,
      srNo: index++,
      mvNo: vehicleNumbers.join(", "),
      vehicleCount: vehicleNumbers.length,
      serviceCount: servicesList.length,
      status: aggStatus,
      serviceDueDate: earliestDueDate,
      services: servicesList,
      aggregatedVehicles: vehicleNumbers,
    });
  }

  // Compute service-specific aggregates
  let serviceTotal = 0;
  let receivedTotal = 0;
  for (const r of recs) {
    const details = getRecordServiceDetails(r);
    const matching = details.find((s) => s.serviceType === serviceType);
    if (matching) {
      serviceTotal += matching.price ?? 0;
      receivedTotal += matching.amountReceived ?? 0;
    }
  }

  return {
    aggregatedRecords,
    stats: {
      total: Object.keys(clientGroups).length, // unique clients
      active: serviceActiveCount,
      completed: serviceCompletedCount,
      pending: servicePendingCount,
      onHold: serviceOnHoldCount,
      vehicleCount: uniqueVehicles.size,
      serviceCount: recs.length,
    },
    serviceTotal,
    receivedTotal,
    pendingTotal: Math.max(0, serviceTotal - receivedTotal),
  };
}

export function ServiceDashboard({ serviceType, title, description }: ServiceDashboardProps) {
  const [records, setRecords] = useState<RegistryRecord[]>([]);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    pending: 0,
    onHold: 0,
    vehicleCount: 0,
    serviceCount: 0,
  });
  const [totalServiceAmount, setTotalServiceAmount] = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<RegistryRecord | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [diagOutput, setDiagOutput] = useState<string | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  // Subscribe to Firestore tasks & registry_services_v2 to dynamically display Completed Services
  useEffect(() => {
    const session = getSession();
    const isAdmin = session?.role === "admin" || session?.role === "manager";
    const userName = session?.name || session?.username || "";
    const userUid = session?.uid || session?.employeeId || "";

    const handleDocsUpdate = (snap1: any, snap2: any) => {
      const docs1 = snap1 ? snap1.docs.map((d: any) => ({ id: d.id, ...d.data() })) : [];
      const docs2 = snap2 ? snap2.docs.map((d: any) => ({ id: d.id, ...d.data() })) : [];

      const combined = [...docs1, ...docs2];
      const completedList = combined.filter((t: any) => t.status === "Completed" || t.taskStatus === "Completed" || t.done === true);

      // Deduplicate by ID
      const uniqueMap = new Map();
      completedList.forEach((item: any) => uniqueMap.set(item.id, item));
      const uniqueCompleted = Array.from(uniqueMap.values());

      // Permission filtering for Completed Services
      const allowed = uniqueCompleted.filter((t: any) => {
        if (isAdmin) return true;
        const taskAssignee = t.assignedEmployeeName || t.assignee || t.assignedEmployeeId || t.assignedEmployeeUid || "";
        return (
          taskAssignee.toLowerCase() === userName.toLowerCase() ||
          taskAssignee.toLowerCase() === userUid.toLowerCase()
        );
      });

      setCompletedTasks(allowed);
    };

    let snap1Data: any = null;
    let snap2Data: any = null;

    const unsub1 = onSnapshot(collection(db, "registry_tasks"), (snap) => {
      snap1Data = snap;
      handleDocsUpdate(snap1Data, snap2Data);
    });

    const unsub2 = onSnapshot(collection(db, "registry_services_v2"), (snap) => {
      snap2Data = snap;
      handleDocsUpdate(snap1Data, snap2Data);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase().trim();
    return records.filter((r) => {
      const vehiclesList: string[] = (r as any).aggregatedVehicles || [];
      const servicesList: any[] = (r as any).services || [];
      const matchesName = r.name?.toLowerCase().includes(q);
      const matchesMobile = (r.mo || "").toLowerCase().includes(q);
      const matchesVehicle = vehiclesList.some((v) => v.toLowerCase().includes(q));
      const matchesAppId = servicesList.some((s) => (s.applicationId || "").toLowerCase().includes(q));
      const matchesAssignee =
        servicesList.some((s) => (s.assignee || s.assignedEmployeeName || "").toLowerCase().includes(q)) ||
        (r.assignee || "").toLowerCase().includes(q);
      const matchesService = (r.serviceType || "").toLowerCase().includes(q);
      return matchesName || matchesMobile || matchesVehicle || matchesAppId || matchesAssignee || matchesService;
    });
  }, [records, searchQuery]);

  const filteredCompletedTasks = useMemo(() => {
    if (!searchQuery.trim()) return completedTasks;
    const q = searchQuery.toLowerCase().trim();
    return completedTasks.filter((t: any) => {
      const matchTitle = (t.title || "").toLowerCase().includes(q);
      const matchVehicle = (t.vehicleNumber || t.vehicleId || "").toLowerCase().includes(q);
      const matchClient = (t.clientName || "").toLowerCase().includes(q);
      const matchPhone = (t.mobileNumber || t.phone || "").toLowerCase().includes(q);
      const matchAppNo = (t.applicationId || "").toLowerCase().includes(q);
      const matchService = (t.serviceName || t.serviceType || "").toLowerCase().includes(q);
      return matchTitle || matchVehicle || matchClient || matchPhone || matchAppNo || matchService;
    });
  }, [completedTasks, searchQuery]);

  const openWorkflow = (record: RegistryRecord) => {
    setSelectedRecord(record);
    setProfileOpen(true);
  };

  const refreshData = async () => {
    try {
      setLoading(true);
      const [recs] = await Promise.all([getServiceClientsAll(serviceType)]);
      const agg = aggregateServiceRecords(recs, serviceType);

      setRecords(agg.aggregatedRecords);
      setStats(agg.stats);
      setTotalServiceAmount(agg.serviceTotal);
      setTotalReceived(agg.receivedTotal);
      setTotalPending(agg.pendingTotal);
    } catch (error) {
      console.error(`[ServiceDashboard] ERROR loading service data:`, error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [serviceType]);

  const statCards = [
    {
      label: "Total Clients",
      value: stats.total,
      icon: Users,
      color: "bg-blue-500/10 text-blue-500",
      description: `${stats.vehicleCount} vehicles registered`,
    },
    {
      label: "Active Services",
      value: stats.active,
      icon: TrendingUp,
      color: "bg-green-500/10 text-green-500",
      description: `${stats.serviceCount} total services`,
    },
    {
      label: "Completed",
      value: stats.completed,
      icon: Package,
      color: "bg-emerald-500/10 text-emerald-500",
      description: "Successfully processed",
    },
    {
      label: "Pending",
      value: stats.pending,
      icon: AlertCircle,
      color: "bg-amber-500/10 text-amber-500",
      description: "Awaiting action",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title || `${serviceType} Services`}</h2>
          <p className="text-sm text-muted-foreground">
            {description || `Manage and track ${serviceType.toLowerCase()} applications and client records`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateServicePDF(serviceType, { records, stats, totals: { totalServiceAmount, totalReceived, totalPending } }, "user")}
          >
            <Download className="size-4 mr-1.5" />
            Export PDF
          </Button>
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
              <div className={`rounded-lg p-2 ${card.color}`}>
                <card.icon className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Completed Services Module Table (Transferred Automatically from Task Module) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-900">Completed Services</h3>
            <p className="text-xs text-slate-500">
              Real-time completed applications transferred automatically from Task Module
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search Completed Services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>

        <div className="border rounded-2xl bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
              <thead className="bg-slate-50 text-gray-500 uppercase font-bold text-[9px] border-b">
                <tr>
                  <th className="p-3 text-center">SR NO</th>
                  <th className="p-3">APPOINTMENT DATE</th>
                  <th className="p-3">DAYS</th>
                  <th className="p-3">DAYS AFTER APPOINTMENT</th>
                  <th className="p-3">VEHICLE NUMBER</th>
                  <th className="p-3">SERVICE</th>
                  <th className="p-3">CLIENT NAME</th>
                  <th className="p-3">NUMBER</th>
                  <th className="p-3">APPLICATION NUMBER</th>
                  <th className="p-3">REFERENCE</th>
                  <th className="p-3">ASSIGNED EMPLOYEE</th>
                  <th className="p-3">RTO EXPENSE</th>
                  <th className="p-3">STATUS</th>
                  <th className="p-3 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-700 font-medium">
                {filteredCompletedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-slate-400">
                      No completed services found. Complete a task in the Task Module to transfer automatically.
                    </td>
                  </tr>
                ) : (
                  filteredCompletedTasks.map((t: any, idx: number) => {
                    // Days calculation: Appointment Date - Application Issue Date
                    const apptDate = t.appointmentDate ? new Date(t.appointmentDate) : null;
                    const issueDate = t.issueDate || t.createdDate || t.createdAt ? new Date(t.issueDate || t.createdDate || t.createdAt) : null;

                    let daysTaken = "—";
                    if (apptDate && issueDate && !isNaN(apptDate.getTime()) && !isNaN(issueDate.getTime())) {
                      const diffTime = apptDate.getTime() - issueDate.getTime();
                      const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                      daysTaken = `${diffDays} Days`;
                    }

                    // Days After Appointment calculation: Today's Date - Appointment Date
                    let daysAfterAppt = "—";
                    if (apptDate && !isNaN(apptDate.getTime())) {
                      const today = new Date();
                      const diffTime = today.getTime() - apptDate.getTime();
                      const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                      daysAfterAppt = `${diffDays} Days After Appointment`;
                    }

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono font-semibold text-slate-900">
                          {t.appointmentDate ? new Date(t.appointmentDate).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="p-3 font-semibold text-indigo-600">{daysTaken}</td>
                        <td className="p-3 font-semibold text-amber-600">{daysAfterAppt}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">{t.vehicleNumber || t.vehicleId || "—"}</td>
                        <td className="p-3 font-semibold text-slate-800">{t.serviceName || t.serviceType || "—"}</td>
                        <td className="p-3 text-blue-600 font-bold">{t.clientName || "—"}</td>
                        <td className="p-3 font-mono text-slate-500">{t.mobileNumber || t.phone || "—"}</td>
                        <td className="p-3 font-mono font-semibold text-slate-800">{t.applicationId || "—"}</td>
                        <td className="p-3 text-slate-600 whitespace-nowrap" title={t.reference || t.title}>
                          {t.reference || t.title || "—"}
                        </td>
                        <td className="p-3 font-medium text-slate-700">{t.assignedEmployeeName || t.assignee || "Unassigned"}</td>
                        <td className="p-3 font-mono font-bold text-emerald-700">
                          {t.rtoExpense ? `₹${t.rtoExpense}` : "₹0"}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Completed
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (t.recordId || t.clientId) {
                                setSelectedRecord({ id: t.recordId || t.clientId } as any);
                                setProfileOpen(true);
                              }
                            }}
                            title="View Client Workspace"
                          >
                            <Eye className="size-3.5 text-blue-600" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedRecord && (
        <ClientDetailWorkspace
          clientId={selectedRecord.id}
          open={profileOpen}
          onOpenChange={setProfileOpen}
        />
      )}
      <AddClientWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        defaultServiceType={serviceType}
        onSuccess={refreshData}
      />
    </div>
  );
}
