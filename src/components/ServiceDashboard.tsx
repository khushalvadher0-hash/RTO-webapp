import React, { useEffect, useMemo, useState } from "react";
import { getSession } from "@/lib/auth";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isTaskAssignedToUser } from "@/lib/tasks";
import {
  getServiceClientsAll,
  getServiceStats,
  getServiceDistributionSummary,
} from "@/lib/services";
import {
  subscribeAccountingRecords,
  type AccountingRecord,
} from "@/lib/applications";
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
  FileText,
} from "lucide-react";
import { generateServicePDF } from "@/lib/pdfServiceHelper";
import { ApplicationFullDetailsModal } from "./ApplicationFullDetailsModal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ApplicationTypeBadge } from "./ApplicationTypeBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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

import { SubModuleTabs, type SubModuleType } from "@/components/SubModuleTabs";

export function ServiceDashboard({
  serviceType,
  title,
  description,
}: ServiceDashboardProps) {
  const [activeSubModule, setActiveSubModule] = useState<SubModuleType>("services");
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
  const [appsList, setAppsList] = useState<any[]>([]);
  const [selectedAppModal, setSelectedAppModal] = useState<any>(null);
  const [appModalOpen, setAppModalOpen] = useState(false);

  // RTO Expense popup states
  const [showRtoExpenseModal, setShowRtoExpenseModal] = useState(false);
  const [rtoExpenseValue, setRtoExpenseValue] = useState<number>(0);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ task: any; newStatus: string } | null>(null);

  const handleLicenceStatusChange = (task: any, newStatus: string) => {
    if (newStatus === "FAIL" || newStatus === "RETEST") {
      setPendingStatusChange({ task, newStatus });
      setRtoExpenseValue(task.rtoExpense || 0);
      setShowRtoExpenseModal(true);
    } else {
      updateLicenceStatusAndExpense(task, newStatus, task.rtoExpense || 0);
    }
  };

  const handleSaveRtoExpense = () => {
    if (pendingStatusChange) {
      const { task, newStatus } = pendingStatusChange;
      updateLicenceStatusAndExpense(task, newStatus, rtoExpenseValue);
      setShowRtoExpenseModal(false);
      setPendingStatusChange(null);
    }
  };

  const handleCancelRtoExpense = () => {
    setShowRtoExpenseModal(false);
    setPendingStatusChange(null);
    toast.info("Status change cancelled");
  };

  const updateLicenceStatusAndExpense = async (task: any, status: string, expense: number) => {
    try {
      const coll = task.sourceCollection || "registry_tasks";
      const docRef = doc(db, coll, task.id);
      
      const updateData: any = {
        rtoExpense: Number(expense) || 0,
        updatedAt: new Date().toISOString()
      };

      if (coll === "registry_tasks") {
        updateData.status = status;
      } else {
        updateData.taskStatus = status;
      }

      await setDoc(docRef, updateData, { merge: true });
      toast.success("Licence status updated successfully!");

      const appId = task.applicationDocId || task.applicationId || task.recordId;
      if (appId) {
        const appRef = doc(db, "registry_applications_v1", appId);
        await setDoc(appRef, {
          rtoExpense: Number(expense) || 0,
          status: status,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      }
    } catch (error) {
      console.error("Error updating licence status and expense:", error);
      toast.error("Failed to update status");
    }
  };

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
        return isTaskAssignedToUser(t, session);
      });

      setCompletedTasks(allowed);
    };
    let snap1Data: any = null;
    let snap2Data: any = null;
    let snap3Data: any = null;
    let accMapData: Map<string, AccountingRecord> = new Map();

    const handleDocsUpdateAll = () => {
      const docs1 = snap1Data ? snap1Data.docs.map((d: any) => ({ id: d.id, sourceCollection: "registry_tasks", ...d.data() })) : [];
      const docs2 = snap2Data ? snap2Data.docs.map((d: any) => ({ id: d.id, sourceCollection: "registry_services_v2", ...d.data() })) : [];
      const apps = snap3Data ? snap3Data.docs.map((d: any) => ({ id: d.id, ...d.data() })) : [];
      setAppsList(apps);
      const appsMap = new Map<string, any>(apps.map((a: any) => [a.id, a]));

      const combined = [...docs1, ...docs2];
      const completedList = combined.filter((t: any) => {
        const targetAppId = t.applicationDocId || t.applicationId || t.recordId || t.clientId || t.id.replace("task-app-", "");
        const app = appsMap.get(targetAppId) || apps.find((a: any) => a.id === t.id || a.id === t.recordId || a.id === t.applicationDocId);
        const resolvedSubModule = app?.subModule || (app?.licenseDetails ? "licence" : t.subModule || "services");

        if (resolvedSubModule === "licence") {
          const s = (t.status || t.taskStatus || "").toUpperCase();
          return ["RTO", "PASS", "FAIL", "RETEST", "COMPLETED"].includes(s) || t.done === true;
        }
        return t.status === "Completed" || t.taskStatus === "Completed" || t.done === true;
      });

      // Deduplicate by ID and enrich with Application & Accounting record details
      const uniqueMap = new Map();
      completedList.forEach((item: any) => {
        const targetAppId = item.applicationDocId || item.applicationId || item.recordId || item.clientId || item.id.replace("task-app-", "");
        let app: any = appsMap.get(targetAppId);

        const cleanVeh = item.vehicleNumber || item.vehicleId || "";
        const cleanVehNo = cleanVeh ? cleanVeh.trim().toUpperCase().replace(/[\s-]/g, "") : "";

        if (!app) {
          app = apps.find((a: any) => {
            const aAppId = a.applicationId ? a.applicationId.trim().toUpperCase() : "";
            const tAppId = item.applicationId ? item.applicationId.trim().toUpperCase() : "";
            const aVeh = a.vehicleNumber ? a.vehicleNumber.trim().toUpperCase().replace(/[\s-]/g, "") : "";
            
            return (
              (tAppId && aAppId === tAppId) ||
              a.id === item.id ||
              a.id === item.recordId ||
              a.id === item.applicationDocId ||
              (item.id && item.id.replace("task-app-", "") === a.id) ||
              (cleanVehNo && aVeh === cleanVehNo)
            );
          });
        }

        // Filter out completed tasks if their parent application has been deleted or is missing
        if (!app || app.isDeleted) {
          return;
        }

        const acc = accMapData.get(targetAppId) || accMapData.get(item.applicationId || "") || (app ? accMapData.get(app.id) || accMapData.get(app.applicationId) : null);

        const totalAmt = acc?.totalPayment ?? app?.amount ?? item.amount ?? item.totalAmount ?? 0;
        const advAmt = acc?.advancePayment ?? app?.totalPaid ?? item.totalPaid ?? item.advanceAmount ?? 0;
        const remAmt = acc?.remainingPayment ?? (app ? (typeof app.pendingAmount === "number" ? app.pendingAmount : Math.max(0, totalAmt - advAmt)) : item.pendingAmount ?? Math.max(0, totalAmt - advAmt));
        const rawStatus = acc?.paymentStatus ?? app?.paymentStatus ?? item.paymentStatus ?? (remAmt <= 0 ? "Paid" : advAmt > 0 ? "Partially Paid" : "Pending");
        const pStatus = rawStatus === "Partially Paid" ? "Partial" : rawStatus;

        const v = app?.vehicleDetails || app?.vehicleMaster || app || {};
        const enriched = {
          ...item,
          applicationId: item.applicationId || app?.applicationId || "",
          vehicleNumber: app?.vehicleNumber || item.vehicleNumber || item.vehicleId || "",
          clientName: app?.ownerName || item.clientName || item.ownerName || "",
          mobileNumber: app?.mobileNumber || item.mobileNumber || item.ownerPhone || item.phone || "",
          serviceName: (app?.services && app.services.join(", ")) || item.serviceName || item.serviceType || "",
          reference: app?.reference || app?.applicationId || item.reference || item.title || item.id,
          assignedEmployeeName: app?.assignedEmployeeName || item.assignedEmployeeName || item.assignee || "Unassigned",
          rtoExpense: item.rtoExpense || 0,
          amount: totalAmt,
          totalPaid: advAmt,
          pendingAmount: remAmt,
          paymentStatus: pStatus,
          subModule: app?.subModule || (app?.licenseDetails ? "licence" : item.subModule || "services"),
          applicationType: app?.applicationType || item.applicationType || (app?.subModule === "licence" ? "Licence" : "Home"),
          licenseDetails: app?.licenseDetails || item.licenseDetails,
          dateOfBirth: app?.licenseDetails?.dateOfBirth || item.dateOfBirth,
          pucExpiryDate: app?.pucExpiryDate || item.pucExpiryDate || v.pucExpiryDate || v.pucDetails?.expiryDate || "—",
          taxExpiryDate: app?.taxExpiryDate || item.taxExpiryDate || v.taxExpiryDate || v.taxDetails?.expiryDate || "—",
          fitnessExpiryDate: app?.fitnessExpiryDate || item.fitnessExpiryDate || v.fitnessExpiryDate || v.fitnessDetails?.expiryDate || "—",
          insuranceExpiryDate: app?.insuranceExpiryDate || item.insuranceExpiryDate || v.insuranceExpiryDate || v.insuranceDetails?.expiryDate || "—",
          nationalPermitExpiryDate: app?.nationalPermitExpiryDate || item.nationalPermitExpiryDate || v.nationalPermitExpiryDate || v.permitDetails?.nationalPermitExpiryDate || "—",
          gujaratPermitExpiryDate: app?.gujaratPermitExpiryDate || item.gujaratPermitExpiryDate || v.gujaratPermitExpiryDate || v.permitDetails?.gujaratPermitExpiryDate || "—",
          npAuthExpiryDate: app?.npAuthExpiryDate || item.npAuthExpiryDate || v.npAuthExpiryDate || v.permitDetails?.nationalAuthExpiryDate || "—",
          registrationRenewalExpiryDate: app?.registrationRenewalExpiryDate || item.registrationRenewalExpiryDate || v.registrationRenewalExpiryDate || v.registrationDetails?.registrationValidity || "—",
        };
        uniqueMap.set(item.id, enriched);
      });
      const uniqueCompleted = Array.from(uniqueMap.values());

      // Permission filtering for Completed Services
      const allowed = uniqueCompleted.filter((t: any) => {
        if (isAdmin) return true;
        return isTaskAssignedToUser(t, session);
      });

      setCompletedTasks(allowed);
    };

    const unsub1 = onSnapshot(collection(db, "registry_tasks"), (snap) => {
      snap1Data = snap;
      handleDocsUpdateAll();
    });

    const unsub2 = onSnapshot(collection(db, "registry_services_v2"), (snap) => {
      snap2Data = snap;
      handleDocsUpdateAll();
    });

    const unsub3 = onSnapshot(collection(db, "registry_applications_v1"), (snap) => {
      snap3Data = snap;
      handleDocsUpdateAll();
    });

    const unsub4 = subscribeAccountingRecords((map) => {
      accMapData = map;
      handleDocsUpdateAll();
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
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
    let list = completedTasks;
    if (activeSubModule === "driving_school") {
      list = list.filter((t: any) => t.subModule === "driving_school");
    } else if (activeSubModule === "licence") {
      list = list.filter((t: any) => {
        if (t.subModule) return t.subModule === "licence";
        return (t.applicationType || "").toLowerCase() === "licence";
      });
    } else if (activeSubModule === "insurance") {
      list = list.filter((t: any) => {
        if (t.subModule) return t.subModule === "insurance";
        return (t.applicationType || "").toLowerCase() === "insurance";
      });
    } else {
      list = list.filter((t: any) => {
        if (t.subModule) return t.subModule === "services";
        return (t.applicationType || "").toLowerCase() !== "licence" && (t.applicationType || "").toLowerCase() !== "insurance" && (t.applicationType || "").toLowerCase() !== "driving_school";
      });
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((t: any) => {
      const matchTitle = (t.title || "").toLowerCase().includes(q);
      const matchVehicle = (t.vehicleNumber || t.vehicleId || "").toLowerCase().includes(q);
      const matchClient = (t.clientName || "").toLowerCase().includes(q);
      const matchPhone = (t.mobileNumber || t.phone || "").toLowerCase().includes(q);
      const matchAppNo = (t.applicationId || "").toLowerCase().includes(q);
      const matchService = (t.serviceName || t.serviceType || "").toLowerCase().includes(q);
      return matchTitle || matchVehicle || matchClient || matchPhone || matchAppNo || matchService;
    });
  }, [completedTasks, searchQuery, activeSubModule]);

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

      {/* 3 Main Sub Module Services, Licence, Driving School Tabs */}
      <div>
        <SubModuleTabs activeTab={activeSubModule} onChange={setActiveSubModule} />
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
                  {activeSubModule === "licence" ? (
                    <>
                      <th className="p-3">CLIENT NAME</th>
                      <th className="p-3">DOB</th>
                      <th className="p-3">MOBILE NUMBER</th>
                      <th className="p-3">APPOINTMENT DATE</th>
                      <th className="p-3">DAYS</th>
                      <th className="p-3">DAYS AFTER APPOINTMENT</th>
                      {Array.from(
                        new Set(
                          filteredCompletedTasks.flatMap((t: any) => {
                            const sName = t.serviceName || t.serviceType || t.title || "License Service";
                            return sName.split(",").map((s: string) => s.trim()).filter(Boolean);
                          })
                        )
                      ).map((srv) => (
                        <th key={srv} className="p-3">
                          {srv.toUpperCase()} EXPIRE DATE
                        </th>
                      ))}
                      <th className="p-3">કુલ રકમ</th>
                      <th className="p-3">કુલ જમા</th>
                      <th className="p-3">બાકી</th>
                      <th className="p-3">PAYMENT STATUS</th>
                      <th className="p-3">STATUS OF TASK</th>
                      <th className="p-3">REFERENCE</th>
                    </>
                  ) : (
                    <>
                      <th className="p-3">APPOINTMENT DATE</th>
                      <th className="p-3 text-center">DAYS</th>
                      <th className="p-3 text-center">DAYS AFTER APPOINTMENT</th>
                      <th className="p-3">VEHICLE NUMBER</th>
                      <th className="p-3">OWNER NAME</th>
                      <th className="p-3 text-center">TOTAL SERVICES</th>
                      <th className="p-3">ASSIGNED EMPLOYEE</th>
                      <th className="p-3">TASK STATUS</th>
                      <th className="p-3">PUC EXPIRY</th>
                      <th className="p-3">TAX EXPIRY</th>
                      <th className="p-3">FITNESS EXPIRY</th>
                      {activeSubModule !== "services" && <th className="p-3">INSURANCE EXPIRY</th>}
                      <th className="p-3">NATIONAL PERMIT(GUJRAT PERMIT)</th>
                      <th className="p-3">GUJARAT PERMIT</th>
                      <th className="p-3">NP AUTHORIZATION</th>
                      <th className="p-3">REGISTRATION RENEWAL</th>
                      <th className="p-3 font-bold text-slate-900">કુલ રકમ</th>
                      <th className="p-3 font-bold text-emerald-700">કુલ જમા</th>
                      <th className="p-3">APPLICATION NUMBER</th>
                      <th className="p-3">APPLICATION TYPE</th>
                    </>
                  )}
                  <th className="p-3 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-700 font-medium">
                {filteredCompletedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={25} className="p-8 text-center text-slate-400">
                      No completed services found. Complete a task in the Task Module to transfer automatically.
                    </td>
                  </tr>
                ) : (
                  filteredCompletedTasks.map((t: any, idx: number) => {
                    // Days calculation: Appointment Date - Task Creation Date
                    const apptDate = t.appointmentDate ? new Date(t.appointmentDate) : null;
                    const createDate = t.createdDate || t.createdAt || t.issueDate ? new Date(t.createdDate || t.createdAt || t.issueDate) : null;

                    let daysDiffStr = "—";
                    if (apptDate && createDate && !isNaN(apptDate.getTime()) && !isNaN(createDate.getTime())) {
                      const diffTime = apptDate.getTime() - createDate.getTime();
                      const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                      daysDiffStr = `${diffDays}`;
                    }

                    // Days After Appointment calculation: Current Date - Appointment Date (0 if future, actual days if past)
                    let daysAfterApptStr = "0";
                    if (apptDate && !isNaN(apptDate.getTime())) {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const apptDateOnly = new Date(apptDate);
                      apptDateOnly.setHours(0, 0, 0, 0);
                      if (today.getTime() <= apptDateOnly.getTime()) {
                        daysAfterApptStr = "0";
                      } else {
                        const diffTime = today.getTime() - apptDateOnly.getTime();
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        daysAfterApptStr = `${diffDays}`;
                      }
                    }

                    if (activeSubModule === "licence") {
                      const ld = t.licenseDetails;
                      const clientDob = ld?.dateOfBirth || t.dateOfBirth || "—";
                      const totalPay = t.amount || t.totalAmount || 0;
                      const advPay = t.totalPaid || t.advanceAmount || 0;
                      const remPay = typeof t.pendingAmount === "number" ? t.pendingAmount : Math.max(0, totalPay - advPay);
                      const pStatus = t.paymentStatus || (remPay <= 0 ? "Paid" : advPay > 0 ? "Partial" : "Pending");
                      const refCode = t.reference || t.applicationId || t.id;

                      const licServices = Array.from(
                        new Set(
                          filteredCompletedTasks.flatMap((item: any) => {
                            const sName = item.serviceName || item.serviceType || item.title || "License Service";
                            return sName.split(",").map((s: string) => s.trim()).filter(Boolean);
                          })
                        )
                      );

                      const getExpiryForService = (srvName: string) => {
                        if (!ld) return t.dueDate || t.expiryDate || "—";
                        if (srvName.includes("Learning") || srvName.includes("New Learning")) {
                          return ld.newLearningLicence?.step1?.expiryDate || ld.newLearningLicence?.appointmentDate || t.dueDate || "—";
                        }
                        if (srvName.includes("Endorsement")) {
                          return ld.dlNewLlEndorsement?.step2?.expiryDate || ld.dlNewLlEndorsement?.step3?.validityDate || t.dueDate || "—";
                        }
                        if (srvName.includes("Renew")) {
                          return ld.llRenewClass?.step1?.expiryDate || ld.llRenewClass?.step3?.validityDate || t.dueDate || "—";
                        }
                        return t.dueDate || t.expiryDate || "—";
                      };

                      return (
                        <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3 text-blue-600 font-bold">{t.clientName || "—"}</td>
                          <td className="p-3 font-mono text-slate-600">{clientDob}</td>
                          <td className="p-3 font-mono text-slate-500">{t.mobileNumber || t.phone || "—"}</td>
                          <td className="p-3 font-mono font-semibold text-slate-900">
                            {t.appointmentDate ? new Date(t.appointmentDate).toLocaleDateString("en-IN") : "—"}
                          </td>
                          <td className="p-3 font-semibold text-indigo-600 text-center">{daysDiffStr}</td>
                          <td className="p-3 font-semibold text-amber-600 text-center">{daysAfterApptStr}</td>
                          {licServices.map((srv) => (
                            <td key={srv} className="p-3 font-mono text-slate-600">
                              {getExpiryForService(srv)}
                            </td>
                          ))}
                          <td className="p-3 font-bold text-slate-900 font-mono">
                            ₹{Number(totalPay).toLocaleString("en-IN")}
                          </td>
                          <td className="p-3 font-bold text-emerald-700 font-mono">
                            ₹{Number(advPay).toLocaleString("en-IN")}
                          </td>
                          <td className="p-3 font-bold text-amber-700 font-mono">
                            ₹{Number(remPay).toLocaleString("en-IN")}
                          </td>
                          <td className="p-3">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                pStatus === "Paid" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                                pStatus === "Pending" && "bg-amber-50 text-amber-700 border border-amber-200",
                                pStatus === "Partial" && "bg-blue-50 text-blue-700 border border-blue-200"
                              )}
                            >
                              {pStatus}
                            </span>
                          </td>
                          <td className="p-3">
                            {(() => {
                              const sVal = t.status || t.taskStatus || "Completed";
                              const statusVal = ["RTO", "PASS", "FAIL", "RETEST"].includes(sVal) ? sVal : "RTO";
                              return (
                                <select
                                  value={statusVal}
                                  onChange={(e) => handleLicenceStatusChange(t, e.target.value)}
                                  className="px-2 py-1 rounded text-[10px] font-bold border bg-white cursor-pointer border-slate-200"
                                >
                                  <option value="RTO">RTO</option>
                                  <option value="PASS">PASS</option>
                                  <option value="FAIL">FAIL</option>
                                  <option value="RETEST">RETEST</option>
                                </select>
                              );
                            })()}
                          </td>
                          <td className="p-3 font-mono text-slate-700 font-semibold">{refCode}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const appDoc =
                                    appsList.find(
                                      (a: any) =>
                                        a.id === (t.applicationDocId || t.recordId || t.clientId) ||
                                        a.applicationId === t.applicationId ||
                                        (t.vehicleNumber && a.vehicleNumber === t.vehicleNumber)
                                    ) || t;
                                  setSelectedAppModal(appDoc);
                                  setAppModalOpen(true);
                                }}
                                title="View Full Licence Application Details"
                              >
                                <Eye className="size-3.5 text-blue-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    const srvCount = t.services?.length || (t.serviceName ? t.serviceName.split(",").length : 1);

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono font-semibold text-slate-900">
                          {t.appointmentDate ? new Date(t.appointmentDate).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="p-3 font-semibold text-indigo-600 text-center">{daysDiffStr}</td>
                        <td className="p-3 font-semibold text-amber-600 text-center">{daysAfterApptStr}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">{t.vehicleNumber || t.vehicleId || "—"}</td>
                        <td className="p-3 font-semibold text-slate-800">{t.clientName || t.ownerName || "—"}</td>
                        <td className="p-3 text-center font-bold text-slate-800">{srvCount}</td>
                        <td className="p-3 text-slate-700">{t.assignedEmployeeName || t.assignee || "Unassigned"}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {t.status || t.taskStatus || "Completed"}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs text-slate-600">{t.pucExpiryDate || ""}</td>
                        <td className="p-3 font-mono text-xs text-slate-600">{t.taxExpiryDate || ""}</td>
                        <td className="p-3 font-mono text-xs text-slate-600">{t.fitnessExpiryDate || ""}</td>
                        {activeSubModule !== "services" && <td className="p-3 font-mono text-xs text-slate-600">{t.insuranceExpiryDate || ""}</td>}
                        <td className="p-3 font-mono text-xs text-slate-600">{t.nationalPermitExpiryDate || ""}</td>
                        <td className="p-3 font-mono text-xs text-slate-600">{t.gujaratPermitExpiryDate || ""}</td>
                        <td className="p-3 font-mono text-xs text-slate-600">{t.npAuthExpiryDate || ""}</td>
                        <td className="p-3 font-mono text-xs text-slate-600">{t.registrationRenewalExpiryDate || ""}</td>
                        <td className="p-3 font-bold text-slate-900 font-mono">
                          ₹{Number(t.amount || t.totalAmount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="p-3 font-bold text-emerald-700 font-mono">
                          ₹{Number(t.totalPaid || t.advanceAmount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="p-3 font-mono text-xs font-semibold text-blue-600">{t.applicationId || "—"}</td>
                         <td className="p-3">
                          <ApplicationTypeBadge appType={t.applicationType} />
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const appDoc =
                                  appsList.find(
                                    (a: any) =>
                                      a.id === (t.applicationDocId || t.recordId || t.clientId) ||
                                      a.applicationId === t.applicationId ||
                                      (t.vehicleNumber && a.vehicleNumber === t.vehicleNumber)
                                  ) || t;
                                setSelectedAppModal(appDoc);
                                setAppModalOpen(true);
                              }}
                              title="View Full Application Form Details"
                            >
                              <FileText className="size-3.5 text-indigo-600" />
                            </Button>
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
                          </div>
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

      <ApplicationFullDetailsModal
        open={appModalOpen}
        onOpenChange={setAppModalOpen}
        application={selectedAppModal}
      />

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

      {/* RTO Expense Popup Modal */}
      <Dialog open={showRtoExpenseModal} onOpenChange={(open) => { if (!open) handleCancelRtoExpense(); }}>
        <DialogContent className="max-w-md p-6 bg-white rounded-xl shadow-xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">RTO EXPENSE</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">RTO EXPENSE (₹)</label>
              <Input
                type="number"
                value={rtoExpenseValue === 0 ? "" : rtoExpenseValue}
                onChange={(e) => setRtoExpenseValue(Number(e.target.value) || 0)}
                placeholder="Enter RTO expense amount..."
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleCancelRtoExpense} className="px-4 py-2 text-xs rounded-lg">
              CANCEL
            </Button>
            <Button onClick={handleSaveRtoExpense} className="px-5 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold">
              SAVE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
