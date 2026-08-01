// src/routes/dashboard.accounting.tsx
import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState, useMemo } from "react";
import {
  subscribeAndSyncFinance,
  subscribePaymentHistory,
  updateRecordCollectionDate,
  setBhaylubhaRequirement,
  approveRecordBhaylubha,
  recordPaymentEntry,
  recordMultiInvoicePayment,
  recordDirectPayment,
  type FinanceRecord,
  type PaymentHistoryItem,
} from "@/lib/financeService";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  FileText,
  Filter,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Printer,
  ChevronDown,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Download,
  ExternalLink,
} from "lucide-react";
import jsPDF from "jspdf";
import { subscribeToAllInvoices, type Invoice } from "@/lib/billing";
import { subscribeToRecords, type RegistryRecord } from "@/lib/records";
import { verifyAdminPin } from "@/lib/adminSecurity";
import { doc, deleteDoc, collection, query, where, getDocs, writeBatch, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { InvoiceViewer } from "@/components/InvoiceViewer";
import { generateInvoicePDF } from "@/lib/pdfGenerator";
import { subscribeAllClients, subscribeAllVehicles, subscribeAllServices, type Service } from "@/lib/hierarchy";
import {
  subscribeAccountingRecords,
  saveAccountingRecord,
  type AccountingRecord,
} from "@/lib/applications";
import {
  subscribeDrivingSchoolApplications,
  type DrivingSchoolApplication,
} from "@/lib/drivingSchool";

export const Route = createFileRoute("/dashboard/accounting")({
  component: AccountingDashboardPage,
});

import { SubModuleTabs, type SubModuleType } from "@/components/SubModuleTabs";

function AccountingDashboardPage() {
  const [activeSubModule, setActiveSubModule] = useState<SubModuleType>("services");
  const [activeTab, setActiveTab] = useState<"collections" | "outstanding" | "payments" | "ledger">("collections");
  const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);
  const [paymentEntries, setPaymentEntries] = useState<PaymentHistoryItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [v2Clients, setV2Clients] = useState<any[]>([]);
  const [v2Vehicles, setV2Vehicles] = useState<any[]>([]);
  const [v2Services, setV2Services] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterService, setFilterService] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // Add Payment Modal & Form state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentClientId, setPaymentClientId] = useState("");
  const [paymentModeType, setPaymentModeType] = useState<"single" | "multi">("single");
  const [selectedSingleInvoiceId, setSelectedSingleInvoiceId] = useState("");
  const [multiAllocations, setMultiAllocations] = useState<{ [invoiceId: string]: number }>({});
  
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<any>("UPI");
  const [payAccount, setPayAccount] = useState<any>("ICICI Bank");
  const [payRemarks, setPayRemarks] = useState("");
  const [payReference, setPayReference] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingPayment, setSavingPayment] = useState(false);

  // Ledger Modal
  const [ledgerClientId, setLedgerClientId] = useState<string | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);

  // PIN verification states
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentHistoryItem | null>(null);
  const [invoiceToDeleteId, setInvoiceToDeleteId] = useState<string | null>(null);

  // Approval state
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [approving, setApproving] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FinanceRecord | null>(null);

  // PDF Viewer
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const session = getSession();
  const userRole = session?.role || "employee";
  const username = session?.name || session?.username || "unknown";
  const isAdmin = userRole === "admin" || userRole === "manager";
  const isStaff = userRole === "employee" || userRole === "viewer";

  const [applications, setApplications] = useState<any[]>([]);
  const [drivingSchoolApps, setDrivingSchoolApps] = useState<DrivingSchoolApplication[]>([]);
  const [accountingMap, setAccountingMap] = useState<Map<string, AccountingRecord>>(new Map());

  // Subscriptions
  useEffect(() => {
    setLoading(true);
    const unsubFinance = subscribeAndSyncFinance((list) => {
      setFinanceRecords(list);
      setLoading(false);
    });
    const unsubPayments = subscribePaymentHistory((list) => {
      setPaymentEntries(list);
    });
    const unsubInvoices = subscribeToAllInvoices((list) => {
      setInvoices(list);
    });
    const unsubClients = subscribeAllClients(setV2Clients);
    const unsubVehicles = subscribeAllVehicles(setV2Vehicles);
    const unsubServices = subscribeAllServices(setV2Services);
    const unsubApps = onSnapshot(collection(db, "registry_applications_v1"), (snap) => {
      setApplications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubDSApps = subscribeDrivingSchoolApplications(setDrivingSchoolApps);
    const unsubAcc = subscribeAccountingRecords(setAccountingMap);

    return () => {
      unsubFinance();
      unsubPayments();
      unsubInvoices();
      unsubClients();
      unsubVehicles();
      unsubServices();
      unsubApps();
      unsubDSApps();
      unsubAcc();
    };
  }, []);

  // Maps for enrichment
  const invoicesMap = useMemo(() => {
    const map = new Map<string, Invoice>();
    invoices.forEach((inv) => map.set(inv.id, inv));
    return map;
  }, [invoices]);

  const allClientsList = useMemo(() => {
    return v2Clients.map((c) => {
      const clientVehicles = v2Vehicles.filter((v) => v.clientId === c.id);
      const vehicleNum = clientVehicles.map((v) => v.vehicleNumber).join(", ") || "—";
      return {
        id: c.id,
        name: c.name,
        mo: c.mobile || "",
        mvNo: vehicleNum,
        serviceType: c.type === "lead" ? "Lead" : "Client",
      };
    });
  }, [v2Clients, v2Vehicles]);

  const clientDetailsMap = useMemo(() => {
    const map = new Map<string, { mobile: string; vehicleNo: string; name: string }>();
    allClientsList.forEach((c) => {
      map.set(c.id, {
        name: c.name || "Unknown",
        mobile: c.mo || "",
        vehicleNo: c.mvNo || "",
      });
    });
    return map;
  }, [allClientsList]);

  // Aggregate Client Ledger Summaries
  const clientSummaries = useMemo(() => {
    const summariesMap = new Map<string, {
      clientId: string;
      clientName: string;
      mobile: string;
      vehicleNumber: string;
      serviceType: string;
      totalInvoiceAmount: number;
      totalReceived: number;
      totalOutstanding: number;
      lastPaymentDate: string;
      invoicesCount: number;
    }>();

    // Populate all clients from list
    allClientsList.forEach((c) => {
      summariesMap.set(c.id, {
        clientId: c.id,
        clientName: c.name || "Unknown",
        mobile: c.mo || "—",
        vehicleNumber: c.mvNo || "—",
        serviceType: c.serviceType || "—",
        totalInvoiceAmount: 0,
        totalReceived: 0,
        totalOutstanding: 0,
        lastPaymentDate: "—",
        invoicesCount: 0,
      });
    });

    // Aggregate invoice level metrics
    financeRecords.forEach((r) => {
      let s = summariesMap.get(r.clientId);
      if (!s) {
        s = {
          clientId: r.clientId,
          clientName: r.clientName || "Unknown Client",
          mobile: "—",
          vehicleNumber: "—",
          serviceType: "—",
          totalInvoiceAmount: 0,
          totalReceived: 0,
          totalOutstanding: 0,
          lastPaymentDate: "—",
          invoicesCount: 0,
        };
        summariesMap.set(r.clientId, s);
      }
      s.totalInvoiceAmount += r.invoiceAmount;
      s.totalReceived += r.receivedAmount;
      s.totalOutstanding += r.balanceAmount;
      s.invoicesCount += 1;
    });

    // Update missing vehicle/mobile/serviceType info from invoices
    invoices.forEach((inv) => {
      const s = summariesMap.get(inv.clientId);
      if (s) {
        if (s.mobile === "—" && inv.clientMobile) s.mobile = inv.clientMobile;
        if (s.vehicleNumber === "—" && inv.vehicleNumber) s.vehicleNumber = inv.vehicleNumber;
        const serviceNames = inv.services?.map((ser) => ser.serviceName).join(", ");
        if (s.serviceType === "—" && serviceNames) s.serviceType = serviceNames;
      }
    });

    // Populate last payment date from payment history
    paymentEntries.forEach((p) => {
      const r = financeRecords.find((rec) => rec.invoiceId === p.invoiceId);
      const clientId = r?.clientId || (p as any).clientId;
      if (clientId) {
        const s = summariesMap.get(clientId);
        if (s) {
          const pDate = p.receivedAt?.slice(0, 10) || "—";
          if (s.lastPaymentDate === "—" || (pDate !== "—" && pDate > s.lastPaymentDate)) {
            s.lastPaymentDate = pDate;
          }
        }
      }
    });

    return Array.from(summariesMap.values());
  }, [allClientsList, financeRecords, invoices, paymentEntries]);

  // Unique lists for filters
  // Unique lists for filters
  const employees = useMemo(() => {
    const set = new Set<string>();
    v2Services.forEach((s) => s.assignedStaff && set.add(s.assignedStaff));
    v2Clients.forEach((c) => c.assignee && set.add(c.assignee));
    return Array.from(set);
  }, [v2Services, v2Clients]);

  const servicesList = useMemo(() => {
    const set = new Set<string>();
    v2Services.forEach((s) => s.serviceType && set.add(s.serviceType));
    return Array.from(set);
  }, [v2Services]);

  // Filtered lists

  const [expandedVehicles, setExpandedVehicles] = useState<Record<string, boolean>>({});

  const toggleVehicleExpand = (id: string) => {
    setExpandedVehicles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const allAccountingRows = useMemo(() => {
    const vehicleGroups = new Map<string, any>();
    const clientsWithServices = new Set<string>();

    v2Services.forEach((s) => {
      const isLicense = s.serviceType === "License New" || s.serviceType === "License Renew";
      const vehicle = s.vehicleId ? v2Vehicles.find((v) => v.id === s.vehicleId) : null;
      const vehicleNum = vehicle?.vehicleNumber || (s as any).vehicleNumber || (isLicense ? "Personal Service" : "Unassigned Vehicle");
      const clientId = s.clientId || vehicle?.clientId || "";
      if (clientId) {
        clientsWithServices.add(clientId);
      }

      const client = v2Clients.find((c) => c.id === clientId);
      const clientName = client?.name || s.clientName || "Unknown Client";
      const clientMobile = client?.mobile || client?.mo || s.clientMobile || "";

      // Unique accounting row key per vehicle/service
      const groupKey = isLicense ? `license-${s.id}` : (s.vehicleId ? `veh-${s.vehicleId}` : `client-${clientId}-${vehicleNum}`);

      const amt = s.serviceAmount || 0;
      const rec = (s.amountReceived || 0) + (s.advancePayment || 0);
      const bal = Math.max(0, amt - rec);
      const colDate = s.collectionDate || s.dueDate || "";

      if (!vehicleGroups.has(groupKey)) {
        vehicleGroups.set(groupKey, {
          id: groupKey,
          vehicleId: s.vehicleId || "",
          clientId: clientId,
          clientName: clientName,
          clientMobile: clientMobile,
          vehicleNumber: vehicleNum,
          invoiceId: s.invoiceId || s.id,
          invoiceNumber: s.invoiceNumber || "Services Batch",
          totalAmount: 0,
          totalReceived: 0,
          totalOutstanding: 0,
          collectionDate: colDate,
          askBhaylubha: false,
          assignedEmployee: s.assignedStaff || client?.assignee || "—",
          services: [],
          hasInvoice: !!s.invoiceNumber,
        });
      }

      const group = vehicleGroups.get(groupKey)!;
      group.totalAmount += amt;
      group.totalReceived += rec;
      group.totalOutstanding += bal;

      if (s.askBhaylubha) group.askBhaylubha = true;
      if (s.invoiceNumber) {
        group.hasInvoice = true;
        group.invoiceNumber = s.invoiceNumber;
        group.invoiceId = s.invoiceId || s.id;
      }
      if (colDate && (!group.collectionDate || colDate > group.collectionDate)) {
        group.collectionDate = colDate;
      }

      group.services.push({
        id: s.id,
        serviceType: s.serviceType,
        amount: amt,
        received: rec,
        outstanding: bal,
        status: s.taskStatus || "Not Started",
        dueDate: colDate,
      });
    });

    const rows: any[] = [];
    vehicleGroups.forEach((group) => {
      const paymentStatus =
        group.totalOutstanding === 0
          ? "Paid"
          : group.totalReceived > 0
            ? "Partially Paid"
            : "Pending";

      let daysOverdue = 0;
      if (paymentStatus !== "Paid" && group.collectionDate) {
        const due = new Date(group.collectionDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        if (today.getTime() > due.getTime()) {
          daysOverdue = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      const serviceTypesStr = group.services.map((ser: any) => ser.serviceType).join(", ");

      rows.push({
        ...group,
        invoiceAmount: group.totalAmount,
        receivedAmount: group.totalReceived,
        balanceAmount: group.totalOutstanding,
        paymentStatus,
        daysOverdue,
        services: serviceTypesStr,
        serviceList: group.services,
      });
    });

    // Include applications directly into accounting metrics
    applications.forEach((app) => {
      const appKey = `app-fin-${app.id}`;
      const srvList = app.services || [];
      const appServicesStr = srvList.length > 0 ? srvList.join(", ") : "General Service";

      const acc = accountingMap.get(app.id) || accountingMap.get(app.applicationId);

      let totAmt = acc?.totalPayment ?? app.totalFee ?? app.amount ?? 0;
      let totPaid = acc?.advancePayment ?? app.totalAdvance ?? app.totalPaid ?? 0;

      if (!acc) {
        // Extract fees from licenseDetails if subModule === 'licence'
        if (app.subModule === "licence" && app.licenseDetails) {
          let licTot = 0;
          let licPaid = 0;
          const lic = app.licenseDetails;

          if (lic.newLearningLicence?.enabled) {
            licTot += Number(lic.newLearningLicence.totalAmount) || 0;
            licPaid += Number(lic.newLearningLicence.advanceAmount) || 0;
          }
          if (lic.dlNewLlEndorsement?.enabled) {
            licTot += Number(lic.dlNewLlEndorsement.totalAmount) || 0;
            licPaid += Number(lic.dlNewLlEndorsement.advanceAmount) || 0;
          }
          if (lic.llRenewClass?.enabled) {
            licTot += Number(lic.llRenewClass.totalAmount) || 0;
            licPaid += Number(lic.llRenewClass.advanceAmount) || 0;
          }
          if (lic.dlRenewRetest?.enabled) {
            licTot += Number(lic.dlRenewRetest.totalAmount) || 0;
            licPaid += Number(lic.dlRenewRetest.advanceAmount) || 0;
          }
          if (lic.generalLicenceServices?.serviceAccounting) {
            Object.values(lic.generalLicenceServices.serviceAccounting).forEach((item: any) => {
              licTot += Number(item.totalAmount) || 0;
              licPaid += Number(item.advanceAmount) || 0;
            });
          }

          if (licTot > 0) {
            totAmt = licTot;
            totPaid = licPaid;
          }
        } else if (app.serviceFees && Object.keys(app.serviceFees).length > 0) {
          let calcTot = 0;
          let calcPaid = 0;
          Object.entries(app.serviceFees).forEach(([sKey, feeVal]) => {
            if (srvList.length === 0 || srvList.includes(sKey)) {
              calcTot += Number(feeVal) || 0;
              calcPaid += Number(app.serviceAdvances?.[sKey]) || 0;
            }
          });
          if (calcTot > 0) {
            totAmt = calcTot;
            totPaid = calcPaid;
          }
        } else if (app.serviceAccounting) {
          let calcTot = 0;
          let calcPaid = 0;
          Object.values(app.serviceAccounting).forEach((sa: any) => {
            calcTot += sa.totalAmount || sa.fee || 0;
            calcPaid += sa.advancePayment || sa.advance || 0;
          });
          if (calcTot > 0) {
            totAmt = calcTot;
            totPaid = calcPaid;
          }
        }
      }

      const balAmt = acc?.remainingPayment ?? Math.max(0, totAmt - totPaid);
      const paymentStatus = acc?.paymentStatus ?? (balAmt === 0 && totAmt > 0 ? "Paid" : totPaid > 0 ? "Partially Paid" : "Pending");

      const srvCount = srvList.length;
      const serviceList = srvList.map((srv: string) => {
        let srvAmount = 0;
        let srvReceived = 0;

        // Check licenseDetails breakdown
        if (app.subModule === "licence" && app.licenseDetails) {
          const lic = app.licenseDetails;
          if (srv.includes("Learning") || srv.includes("New Learning")) {
            if (lic.newLearningLicence?.enabled) {
              srvAmount = Number(lic.newLearningLicence.totalAmount) || 0;
              srvReceived = Number(lic.newLearningLicence.advanceAmount) || 0;
            }
          } else if (srv.includes("Endorsement")) {
            if (lic.dlNewLlEndorsement?.enabled) {
              srvAmount = Number(lic.dlNewLlEndorsement.totalAmount) || 0;
              srvReceived = Number(lic.dlNewLlEndorsement.advanceAmount) || 0;
            }
          } else if (srv.includes("Renew Class") || srv === "LL Renew Class") {
            if (lic.llRenewClass?.enabled) {
              srvAmount = Number(lic.llRenewClass.totalAmount) || 0;
              srvReceived = Number(lic.llRenewClass.advanceAmount) || 0;
            }
          } else if (srv.includes("Retest") || srv.includes("DL Renew")) {
            if (lic.dlRenewRetest?.enabled) {
              srvAmount = Number(lic.dlRenewRetest.totalAmount) || 0;
              srvReceived = Number(lic.dlRenewRetest.advanceAmount) || 0;
            }
          } else if (lic.generalLicenceServices?.serviceAccounting?.[srv]) {
            const item = lic.generalLicenceServices.serviceAccounting[srv];
            srvAmount = Number(item.totalAmount) || 0;
            srvReceived = Number(item.advanceAmount) || 0;
          }
        }

        if (srvAmount === 0 && app.serviceFees && app.serviceFees[srv] !== undefined && app.serviceFees[srv] !== null) {
          srvAmount = Number(app.serviceFees[srv]) || 0;
        }
        if (srvAmount === 0 && app.serviceAccounting && app.serviceAccounting[srv]) {
          srvAmount = Number(app.serviceAccounting[srv].totalAmount || app.serviceAccounting[srv].fee) || 0;
        }

        if (srvReceived === 0 && app.serviceAdvances && app.serviceAdvances[srv] !== undefined && app.serviceAdvances[srv] !== null) {
          srvReceived = Number(app.serviceAdvances[srv]) || 0;
        }
        if (srvReceived === 0 && app.serviceAccounting && app.serviceAccounting[srv]) {
          srvReceived = Number(app.serviceAccounting[srv].advancePayment || app.serviceAccounting[srv].advance) || 0;
        }

        // Fallback for amount: if srvAmount is 0 and totAmt > 0 & srvCount > 0
        if (srvAmount === 0 && totAmt > 0 && srvCount > 0) {
          srvAmount = Math.round((totAmt / srvCount) * 100) / 100;
        }

        // Fallback for received: proportion totPaid according to srvAmount vs totAmt
        if (totPaid > 0) {
          if (totAmt > 0 && srvAmount > 0) {
            const ratio = srvAmount / totAmt;
            srvReceived = Math.round((totPaid * ratio) * 100) / 100;
          } else if (srvCount > 0) {
            srvReceived = Math.round((totPaid / srvCount) * 100) / 100;
          }
        }

        const srvOutstanding = Math.max(0, srvAmount - srvReceived);

        return {
          id: `${app.id}-${srv}`,
          serviceType: srv,
          amount: srvAmount,
          received: srvReceived,
          outstanding: srvOutstanding,
          status: app.applicationStatus || "Pending",
          dueDate: app.createdAt?.slice(0, 10) || "",
        };
      });

      rows.push({
        id: appKey,
        subModule: app.subModule || (app.licenseDetails ? "licence" : "services"),
        applicationId: app.applicationId || app.id,
        vehicleId: app.vehicleId || app.vehicleNumber,
        clientId: app.id,
        clientName: app.ownerName || "Unknown Owner",
        clientMobile: app.mobileNumber || "",
        vehicleNumber: app.vehicleNumber || "—",
        invoiceId: app.invoiceId || app.id,
        invoiceNumber: app.invoiceNumber || app.applicationId || "Application Invoice",
        invoiceAmount: totAmt,
        receivedAmount: totPaid,
        balanceAmount: balAmt,
        collectionDate: app.expiryDate || app.createdAt?.slice(0, 10) || "",
        paymentStatus: paymentStatus,
        askBhaylubha: false,
        assignedEmployee: app.assignedEmployeeName || "Unassigned",
        services: appServicesStr,
        serviceList: serviceList,
        hasInvoice: true,
        daysOverdue: 0,
      });
    });

    // Add clients with no services as Pending Invoice fallback
    v2Clients.forEach((c) => {
      if (!clientsWithServices.has(c.id)) {
        const clientVehicles = v2Vehicles.filter((v) => v.clientId === c.id);
        const vehicleNum = c.mvNo || clientVehicles.map((v) => v.vehicleNumber).join(", ") || "—";
        rows.push({
          id: `no-service-${c.id}`,
          vehicleId: "",
          clientId: c.id,
          clientName: c.name || "Unknown Client",
          clientMobile: c.mo || c.mobile || "",
          vehicleNumber: vehicleNum,
          invoiceId: "none",
          invoiceNumber: "Pending Invoice",
          invoiceAmount: 0,
          receivedAmount: 0,
          balanceAmount: 0,
          collectionDate: "",
          paymentStatus: "Pending Invoice",
          askBhaylubha: false,
          assignedEmployee: c.assignee || "—",
          daysOverdue: 0,
          services: "—",
          serviceList: [],
          hasInvoice: false,
        });
      }
    });

    // Add Driving School Applications into Accounting Rows
    drivingSchoolApps.forEach((ds) => {
      const acc = accountingMap.get(ds.id) || accountingMap.get(ds.applicationId);
      const totFee = acc?.totalPayment ?? (Number(ds.totalCourseFees) || 0);
      const advFee = acc?.advancePayment ?? (Number(ds.advancePaid) || 0);
      const remFee = acc?.remainingPayment ?? (typeof ds.remainingFees === "number" ? ds.remainingFees : Math.max(0, totFee - advFee));
      const pStatus: "Paid" | "Partially Paid" | "Pending" =
        remFee <= 0 && totFee > 0 ? "Paid" : advFee > 0 ? "Partially Paid" : "Pending";

      rows.push({
        id: `ds-${ds.id}`,
        subModule: "driving_school",
        applicationId: ds.applicationId || ds.id,
        vehicleId: ds.vehicleNumber || "",
        clientId: ds.id,
        clientName: ds.studentName || "Unknown Student",
        clientMobile: ds.mobileNumber || "",
        vehicleNumber: ds.vehicleNumber || "—",
        invoiceId: ds.id,
        invoiceNumber: ds.applicationId || "Driving School",
        invoiceAmount: totFee,
        receivedAmount: advFee,
        balanceAmount: remFee,
        collectionDate: ds.courseEndDate || ds.joiningDate || ds.createdAt?.slice(0, 10) || "",
        paymentStatus: pStatus,
        askBhaylubha: false,
        assignedEmployee: ds.assignedEmployee || "Unassigned",
        services: ds.courseType || "Driving School Course",
        serviceList: [
          {
            id: ds.id,
            serviceType: ds.courseType || "Driving School Course",
            amount: totFee,
            received: advFee,
            outstanding: remFee,
            status: ds.status || "Active",
            dueDate: ds.courseEndDate || "",
          },
        ],
        hasInvoice: true,
        daysOverdue: 0,
      });
    });

    // Filter out invalid "Unknown Client" / 0 amount orphan records
    return rows.filter((r) => {
      const cName = (r.clientName || "").trim().toLowerCase();
      const isUnknown = cName === "unknown client" || cName === "unknown owner" || cName === "unknown student" || cName === "";
      const isZeroAmt = (r.invoiceAmount || 0) === 0 && (r.receivedAmount || 0) === 0 && (r.balanceAmount || 0) === 0;
      if (isUnknown && isZeroAmt) {
        return false;
      }
      return true;
    });
  }, [v2Clients, v2Vehicles, v2Services, applications, drivingSchoolApps, accountingMap]);

  const filteredRecords = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return allAccountingRows.filter((r) => {
      if (r.subModule) {
        if (r.subModule !== activeSubModule) return false;
      } else {
        const srvs = (r.services || "").toLowerCase();
        const isLic = srvs.includes("license") || srvs.includes("licence") || srvs.includes("learning") || srvs.includes("dl") || srvs.includes("ll");
        if (activeSubModule === "licence" && !isLic) return false;
        if (activeSubModule === "services" && isLic) return false;
        if (activeSubModule === "driving_school") return false;
      }

      const term = searchTerm.toLowerCase();
      const mobile = r.clientMobile || "";
      const vehicle = r.vehicleNumber || "";
      
      const matchesSearch =
        searchTerm === "" ||
        r.clientName.toLowerCase().includes(term) ||
        r.invoiceNumber.toLowerCase().includes(term) ||
        mobile.includes(term) ||
        vehicle.toLowerCase().includes(term);

      if (!matchesSearch) return false;
      if (filterEmployee !== "all" && r.assignedEmployee !== filterEmployee) return false;

      if (filterService !== "all") {
        if (!r.services || !r.services.toLowerCase().includes(filterService.toLowerCase())) return false;
      }

      if (filterStatus !== "all") {
        if (filterStatus === "Overdue") {
          if (r.paymentStatus === "Pending Invoice" || r.paymentStatus === "Paid") return false;
          const isOverdue = r.collectionDate && r.collectionDate < todayStr;
          if (!isOverdue) return false;
        } else if (filterStatus === "Pending") {
          if (r.paymentStatus !== "Pending") return false;
        } else if (filterStatus === "Partially Paid") {
          if (r.paymentStatus !== "Partially Paid") return false;
        } else if (filterStatus === "Paid") {
          if (r.paymentStatus !== "Paid") return false;
        }
      }

      if (filterStartDate && r.collectionDate && r.collectionDate < filterStartDate) return false;
      if (filterEndDate && r.collectionDate && r.collectionDate > filterEndDate) return false;

      return true;
    });
  }, [allAccountingRows, searchTerm, filterEmployee, filterService, filterStatus, filterStartDate, filterEndDate, activeSubModule]);

  const filteredPayments = useMemo(() => {
    return paymentEntries.filter((p) => {
      const inv = invoicesMap.get(p.invoiceId);
      const r = financeRecords.find((rec) => rec.invoiceId === p.invoiceId);
      const cDetails = r ? clientDetailsMap.get(r.clientId) : clientDetailsMap.get((p as any).clientId);

      const term = searchTerm.toLowerCase();
      const mobile = inv?.clientMobile || cDetails?.mobile || "";
      const vehicle = inv?.vehicleNumber || cDetails?.vehicleNo || "";
      const clientName = r?.clientName || p.clientName || "";
      const matchesSearch =
        searchTerm === "" ||
        clientName.toLowerCase().includes(term) ||
        p.invoiceId.toLowerCase().includes(term) ||
        (p as any).invoiceNumber?.toLowerCase().includes(term) ||
        mobile.includes(term) ||
        vehicle.toLowerCase().includes(term) ||
        p.receivedBy.toLowerCase().includes(term) ||
        p.remarks.toLowerCase().includes(term);

      if (!matchesSearch) return false;
      if (filterEmployee !== "all" && r?.assignedEmployee !== filterEmployee) return false;

      if (filterService !== "all") {
        const hasService = inv?.services?.some((s) => s.serviceName === filterService);
        if (!hasService) return false;
      }

      if (filterMethod !== "all" && p.method !== filterMethod) return false;

      const pDate = p.receivedAt?.slice(0, 10);
      if (filterStartDate && pDate && pDate < filterStartDate) return false;
      if (filterEndDate && pDate && pDate > filterEndDate) return false;

      return true;
    });
  }, [paymentEntries, invoicesMap, financeRecords, clientDetailsMap, searchTerm, filterEmployee, filterService, filterMethod, filterStartDate, filterEndDate]);

  const flattenedPayments = useMemo(() => {
    const list: any[] = [];
    filteredPayments.forEach((p) => {
      if (p.allocations && p.allocations.length > 0) {
        p.allocations.forEach((alloc) => {
          list.push({
            ...p,
            uniqueKey: `${p.id}-${alloc.invoiceId}`,
            invoiceId: alloc.invoiceId,
            invoiceNumber: alloc.invoiceNumber,
            allocatedAmount: alloc.allocatedAmount,
          });
        });
      } else {
        // Direct non-invoiced payment or legacy payment without allocations array
        list.push({
          ...p,
          uniqueKey: p.id,
          invoiceId: p.invoiceId || "non-invoiced",
          invoiceNumber: p.invoiceId === "non-invoiced" ? "Non-Invoiced (Direct)" : `#${p.invoiceId?.slice(-6).toUpperCase()}`,
          allocatedAmount: p.amount,
        });
      }
    });
    return list;
  }, [filteredPayments]);

  const filteredClientSummaries = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return clientSummaries.filter((s) => {
      return (
        searchTerm === "" ||
        s.clientName.toLowerCase().includes(term) ||
        s.mobile.includes(term) ||
        s.vehicleNumber.toLowerCase().includes(term) ||
        s.serviceType.toLowerCase().includes(term) ||
        financeRecords.some((r) => r.clientId === s.clientId && r.invoiceNumber.toLowerCase().includes(term))
      );
    });
  }, [clientSummaries, searchTerm, financeRecords]);

  // Metrics (Independent per subModule)
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    let totalReceivable = 0;
    let totalReceived = 0;
    let overdueCollections = 0;

    filteredRecords.forEach((r) => {
      const amt = r.invoiceAmount || 0;
      const rec = r.receivedAmount || 0;
      const pending = r.balanceAmount || 0;

      totalReceivable += amt;
      totalReceived += rec;

      if (pending > 0 && r.collectionDate && r.collectionDate < todayStr) {
        overdueCollections += pending;
      }
    });

    const outstandingAmount = Math.max(0, totalReceivable - totalReceived);

    const todayCollections = paymentEntries
      .filter((p) => {
        const payDateStr = p.paymentDate || p.receivedAt?.slice(0, 10) || "";
        return payDateStr === todayStr;
      })
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      totalReceivable,
      totalReceived,
      outstandingAmount,
      todayCollections,
      overdueCollections,
    };
  }, [filteredRecords, paymentEntries]);

  // Payment allocations calculator
  const outstandingInvoicesForClient = useMemo(() => {
    if (!paymentClientId) return [];
    return financeRecords.filter((r) => r.clientId === paymentClientId && r.balanceAmount > 0);
  }, [paymentClientId, financeRecords]);

  const handleClientChange = (clientId: string) => {
    setPaymentClientId(clientId);
    setSelectedSingleInvoiceId("");
    setMultiAllocations({});
    setPayAmount("");
  };

  const handlePayAmountChange = (val: string) => {
    setPayAmount(val);
    const amt = Number(val);
    if (!isNaN(amt) && amt > 0 && paymentModeType === "multi") {
      let remaining = amt;
      const newAllocations: { [invoiceId: string]: number } = {};
      const sorted = [...outstandingInvoicesForClient].sort((a, b) => {
        return (a.collectionDate || a.createdAt).localeCompare(b.collectionDate || b.createdAt);
      });
      sorted.forEach((inv) => {
        if (remaining <= 0) {
          newAllocations[inv.id] = 0;
        } else {
          const unpaid = inv.balanceAmount;
          const alloc = Math.min(unpaid, remaining);
          newAllocations[inv.id] = alloc;
          remaining -= alloc;
        }
      });
      setMultiAllocations(newAllocations);
    }
  };

  const handleUpdateDate = async (recordId: string, date: string) => {
    try {
      await updateRecordCollectionDate(recordId, date, username);
      toast.success("Collection date updated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to update date");
    }
  };

  const handleToggleBhaylubhaFlag = async (recordId: string, required: boolean) => {
    if (isStaff) return toast.error("Access Denied: Staff cannot modify finance settings.");
    try {
      await setBhaylubhaRequirement(recordId, required, username);
      toast.success(required ? "Approval required enabled" : "Approval requirement cleared");
    } catch (e: any) {
      toast.error(e.message || "Failed to toggle approval requirement");
    }
  };

  const handleApprove = async () => {
    if (!selectedRecord) return;
    if (!isAdmin) return toast.error("Access Denied: Only Admins can grant approvals.");
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

  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStaff) return toast.error("Access Denied: Staff cannot record payments.");
    if (!paymentClientId) return toast.error("Please select a client.");

    const amt = Number(payAmount);
    if (!payAmount || isNaN(amt) || amt <= 0) return toast.error("Enter a valid payment amount");

    const client = allClientsList.find((c) => c.id === paymentClientId);
    const clientName = client?.name || "Unknown Client";

    setSavingPayment(true);
    try {
      if (outstandingInvoicesForClient.length === 0) {
        // Direct Non-Invoiced Payment
        await recordDirectPayment(paymentClientId, clientName, {
          amount: amt,
          method: payMethod,
          accountName: payAccount,
          remarks: payRemarks || "Direct Payment (No Invoice)",
          receivedBy: username,
          paymentDate: payDate,
          referenceNumber: payReference || null,
        });
        toast.success("Direct payment recorded successfully!");
      } else if (paymentModeType === "single") {
        if (!selectedSingleInvoiceId) throw new Error("Please select an invoice.");
        const fRec = financeRecords.find((r) => r.id === selectedSingleInvoiceId);
        if (amt > (fRec?.balanceAmount || 0)) {
          throw new Error("Payment amount exceeds remaining balance of selected invoice.");
        }
        await recordPaymentEntry(selectedSingleInvoiceId, {
          amount: amt,
          method: payMethod,
          accountName: payAccount,
          remarks: payRemarks,
          receivedBy: username,
          paymentDate: payDate,
          referenceNumber: payReference || null,
        });

        // Sync registry_accounting record directly
        const targetId = selectedSingleInvoiceId;
        const currentAcc = accountingMap.get(targetId);
        const newPaid = (currentAcc?.advancePayment || fRec?.receivedAmount || 0) + amt;
        const totalAmount = currentAcc?.totalPayment || fRec?.invoiceAmount || amt;
        const newBal = Math.max(0, totalAmount - newPaid);
        const newStatus = newBal === 0 ? "Paid" : newPaid > 0 ? "Partially Paid" : "Pending";

        await saveAccountingRecord({
          id: targetId,
          applicationId: currentAcc?.applicationId || targetId,
          applicationDocId: currentAcc?.applicationDocId || targetId,
          clientId: paymentClientId,
          clientName: clientName,
          totalPayment: totalAmount,
          advancePayment: newPaid,
          remainingPayment: newBal,
          paymentStatus: newStatus,
        });

        // Sync directly to DrivingSchoolApplications if record originates from driving school
        const cleanDsId = targetId.replace(/^ds-/, "");
        const dsRef = doc(db, "DrivingSchoolApplications", cleanDsId);
        const dsSnap = await getDoc(dsRef);
        if (dsSnap.exists()) {
          const dsData = dsSnap.data();
          const dsTotal = Number(dsData.totalCourseFees) || totalAmount;
          const dsNewPaid = Math.min(dsTotal, (Number(dsData.advancePaid) || 0) + amt);
          const dsNewBal = Math.max(0, dsTotal - dsNewPaid);
          const dsStatus: "Paid" | "Partial" | "Pending" =
            dsNewBal <= 0 && dsTotal > 0 ? "Paid" : dsNewPaid > 0 ? "Partial" : "Pending";

          await setDoc(
            dsRef,
            {
              advancePaid: dsNewPaid,
              remainingFees: dsNewBal,
              paymentStatus: dsStatus,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }

        toast.success("Payment recorded successfully!");
      } else {
        // Multiple Invoice Allocation
        const allocationsList = Object.entries(multiAllocations).map(([invoiceId, value]) => ({
          invoiceId,
          amount: Number(value),
        }));
        const totalAllocated = allocationsList.reduce((sum, a) => sum + a.amount, 0);
        if (Math.abs(totalAllocated - amt) > 0.01) {
          throw new Error(`Allocated sum (₹${totalAllocated}) must equal received amount (₹${amt})`);
        }
        await recordMultiInvoicePayment(paymentClientId, clientName, allocationsList, {
          amount: amt,
          method: payMethod,
          accountName: payAccount,
          remarks: payRemarks || "Multi-invoice Payment Allocation",
          receivedBy: username,
          paymentDate: payDate,
          referenceNumber: payReference || null,
        });
        toast.success("Multi-invoice payments allocated successfully!");
      }

      setPaymentDialogOpen(false);
      setPayAmount("");
      setPayRemarks("");
      setPayReference("");
      setPaymentClientId("");
      setSelectedSingleInvoiceId("");
      setMultiAllocations({});
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSavingPayment(false);
    }
  };

  const startDeletePayment = (payment: PaymentHistoryItem) => {
    if (!isAdmin) return toast.error("Access Denied: Only Admin can delete payments.");
    setPaymentToDelete(payment);
    setInvoiceToDeleteId(null);
    setPinDialogOpen(true);
  };

  const startDeleteInvoice = (id: string) => {
    if (!isAdmin) return toast.error("Access Denied: Only Admin can delete invoices.");
    setInvoiceToDeleteId(id);
    setPaymentToDelete(null);
    setPinDialogOpen(true);
  };

  const handleDeleteInvoiceVerified = async () => {
    if (!invoiceToDeleteId) return;
    const ok = await verifyAdminPin(adminPin);
    if (!ok) {
      toast.error("Invalid Admin PIN");
      return;
    }

    try {
      // Import dynamic secured deletion
      const { deleteInvoiceSecured } = await import("@/lib/financeService");
      await deleteInvoiceSecured(
        invoiceToDeleteId,
        adminPin,
        "Deleted from Accounting Dashboard",
        username,
        userRole
      );
      toast.success("Invoice deleted successfully!");
      setPinDialogOpen(false);
      setAdminPin("");
      setInvoiceToDeleteId(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete invoice");
    }
  };

  const handleDeletePaymentVerified = async () => {
    if (!paymentToDelete) return;
    const ok = await verifyAdminPin(adminPin);
    if (!ok) {
      toast.error("Invalid Admin PIN");
      return;
    }

    try {
      const batch = writeBatch(db);

      // Revert allocations in billing_invoices and registry_services_v2
      if (paymentToDelete.allocations && paymentToDelete.allocations.length > 0) {
        for (const alloc of paymentToDelete.allocations) {
          const invoiceRef = doc(db, "billing_invoices", alloc.invoiceId);
          const iSnap = await getDoc(invoiceRef);
          if (!iSnap.exists()) continue;
          const iData = iSnap.data() as any;

          const newReceived = Math.max(0, (iData.totalPaid || 0) - alloc.allocatedAmount);
          const newBalance = iData.totalAmount - newReceived;
          const newStatus = newBalance === 0 ? "Paid" : newReceived > 0 ? "Partially Paid" : "Pending";

          batch.update(invoiceRef, {
            status: newStatus,
            totalPaid: newReceived,
          });

          // Revert registry_services_v2 service amount received
          if (iData.services && iData.services.length > 0) {
            for (const sItem of iData.services) {
              const sId = sItem.serviceId;
              if (!sId) continue;
              const sRef = doc(db, "registry_services_v2", sId);
              const sSnap = await getDoc(sRef);
              if (sSnap.exists()) {
                const sData = sSnap.data() as any;
                const serviceRatio = sItem.total / iData.totalAmount;
                const allocatedAmount = Math.round(alloc.allocatedAmount * serviceRatio);
                const newSReceived = Math.max(0, (sData.amountReceived || 0) - allocatedAmount);
                const newSPending = Math.max(0, sItem.total - newSReceived);
                batch.update(sRef, {
                  amountReceived: newSReceived,
                  pendingAmount: newSPending,
                  taskStatus: newSPending === 0 ? "Completed" : sData.taskStatus,
                });
              }
            }
          }
        }
      } else if (paymentToDelete.invoiceId !== "non-invoiced") {
        // Fallback for legacy payments without allocations array or direct service payments
        const invoiceRef = doc(db, "billing_invoices", paymentToDelete.invoiceId);
        const iSnap = await getDoc(invoiceRef);
        if (iSnap.exists()) {
          const iData = iSnap.data() as any;
          const newReceived = Math.max(0, (iData.totalPaid || 0) - paymentToDelete.amount);
          const newBalance = iData.totalAmount - newReceived;
          const newStatus = newBalance === 0 ? "Paid" : newReceived > 0 ? "Partially Paid" : "Pending";

          batch.update(invoiceRef, {
            status: newStatus,
            totalPaid: newReceived,
          });

          if (iData.services && iData.services.length > 0) {
            for (const sItem of iData.services) {
              const sId = sItem.serviceId;
              if (!sId) continue;
              const sRef = doc(db, "registry_services_v2", sId);
              const sSnap = await getDoc(sRef);
              if (sSnap.exists()) {
                const sData = sSnap.data() as any;
                const serviceRatio = sItem.total / iData.totalAmount;
                const allocatedAmount = Math.round(paymentToDelete.amount * serviceRatio);
                const newSReceived = Math.max(0, (sData.amountReceived || 0) - allocatedAmount);
                const newSPending = Math.max(0, sItem.total - newSReceived);
                batch.update(sRef, {
                  amountReceived: newSReceived,
                  pendingAmount: newSPending,
                  taskStatus: newSPending === 0 ? "Completed" : sData.taskStatus,
                });
              }
            }
          }
        } else {
          // Check if invoiceId is actually a serviceId (direct service payment log)
          const sRef = doc(db, "registry_services_v2", paymentToDelete.invoiceId);
          const sSnap = await getDoc(sRef);
          if (sSnap.exists()) {
            const sData = sSnap.data() as any;
            const newSReceived = Math.max(0, (sData.amountReceived || 0) - paymentToDelete.amount);
            const newSPending = Math.max(0, sData.serviceAmount - newSReceived);
            batch.update(sRef, {
              amountReceived: newSReceived,
              pendingAmount: newSPending,
              taskStatus: newSPending === 0 ? "Completed" : sData.taskStatus,
            });
          }
        }
      }

      // Delete payment record
      batch.delete(doc(db, "payment_history", paymentToDelete.id!));

      // Clean up ledger entries
      const ledgerSnap = await getDocs(
        query(collection(db, "accounts_ledger"), where("referenceId", "==", paymentToDelete.id!))
      );
      ledgerSnap.forEach((d) => {
        batch.delete(d.ref);
      });

      await batch.commit();
      toast.success("Payment deleted successfully!");
      setPinDialogOpen(false);
      setAdminPin("");
      setPaymentToDelete(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete payment");
    }
  };

  const sendWhatsAppReminder = (mobile: string, name: string, invoiceNo: string, amount: number) => {
    if (!mobile) return toast.error("No mobile number available.");
    const formattedNumber = mobile.replace(/[^0-9]/g, "");
    const text = `Hi ${name}, this is a reminder regarding your outstanding invoice ${invoiceNo} of ₹${amount.toLocaleString("en-IN")}. Please arrange for payment. Thank you!`;
    window.open(`https://wa.me/${formattedNumber.startsWith("91") ? "" : "91"}${formattedNumber}?text=${encodeURIComponent(text)}`, "_blank");
  };

  // PDF exports
  const generateSummaryPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Accounting Summary Statement", 14, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Date Generated: ${new Date().toLocaleString("en-IN")}`, 14, 26);

    const values = [
      ["Total Receivable", `INR ${metrics.totalReceivable.toLocaleString("en-IN")}`],
      ["Total Received", `INR ${metrics.totalReceived.toLocaleString("en-IN")}`],
      ["Outstanding Amount", `INR ${metrics.outstandingAmount.toLocaleString("en-IN")}`],
      ["Today's Collections", `INR ${metrics.todayCollections.toLocaleString("en-IN")}`],
      ["Overdue Collections", `INR ${metrics.overdueCollections.toLocaleString("en-IN")}`],
    ];

    let y = 40;
    values.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, 120, y);
      y += 10;
    });

    doc.save("ACCOUNTING_SUMMARY.pdf");
  };

  const generateCollectionsPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Scheduled Collections Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 26);

    let y = 40;
    doc.setFont("helvetica", "bold");
    doc.text("Client Name", 14, y);
    doc.text("Invoice No", 70, y);
    doc.text("Date", 110, y);
    doc.text("Amount", 150, y);
    doc.text("Balance", 180, y);
    doc.line(14, y + 2, 196, y + 2);
    y += 10;

    doc.setFont("helvetica", "normal");
    filteredRecords.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(r.clientName.slice(0, 24), 14, y);
      doc.text(r.invoiceNumber, 70, y);
      doc.text(r.collectionDate || "—", 110, y);
      doc.text(r.invoiceAmount.toLocaleString("en-IN"), 150, y);
      doc.text(r.balanceAmount.toLocaleString("en-IN"), 180, y);
      y += 8;
    });

    doc.save("COLLECTIONS_REPORT.pdf");
  };

  const generateOutstandingPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Outstanding Payments Statement", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 26);

    let y = 40;
    doc.setFont("helvetica", "bold");
    doc.text("Client Name", 14, y);
    doc.text("Invoice", 70, y);
    doc.text("Due Date", 110, y);
    doc.text("Paid", 150, y);
    doc.text("Outstanding", 180, y);
    doc.line(14, y + 2, 196, y + 2);
    y += 10;

    doc.setFont("helvetica", "normal");
    filteredRecords.filter(r => r.balanceAmount > 0).forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(r.clientName.slice(0, 24), 14, y);
      doc.text(r.invoiceNumber, 70, y);
      doc.text(r.collectionDate || "—", 110, y);
      doc.text(r.receivedAmount.toLocaleString("en-IN"), 150, y);
      doc.text(r.balanceAmount.toLocaleString("en-IN"), 180, y);
      y += 8;
    });

    doc.save("OUTSTANDING_PAYMENTS.pdf");
  };

  const generatePaymentsPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Payment Entries Logs", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 26);

    let y = 40;
    doc.setFont("helvetica", "bold");
    doc.text("Date", 14, y);
    doc.text("Client", 40, y);
    doc.text("Invoice No", 90, y);
    doc.text("Amount", 130, y);
    doc.text("Method", 160, y);
    doc.line(14, y + 2, 196, y + 2);
    y += 10;

    doc.setFont("helvetica", "normal");
    filteredPayments.forEach((p) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const clientName = financeRecords.find((r) => r.invoiceId === p.invoiceId)?.clientName || p.clientName || "—";
      doc.text(p.receivedAt?.slice(0, 10) || "—", 14, y);
      doc.text(clientName.slice(0, 20), 40, y);
      doc.text(p.invoiceId === "non-invoiced" ? "Direct" : p.invoiceId?.slice(0, 12) || "—", 90, y);
      doc.text(p.amount.toLocaleString("en-IN"), 130, y);
      doc.text(p.method || "—", 160, y);
      y += 8;
    });

    doc.save("PAYMENT_ENTRIES.pdf");
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Accounting Dashboard
          </h2>
          <p className="text-muted-foreground text-sm">
            Invoice-driven payment allocation, scheduled collections, and financial ledger summaries.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" size="sm" onClick={() => setPaymentDialogOpen(true)} className="text-xs bg-blue-600 hover:bg-blue-700 shadow-md">
            <Plus className="size-4 mr-1" /> Add Payment Log
          </Button>
          <Button variant="outline" size="sm" onClick={generateSummaryPDF} className="text-xs bg-slate-50 border-slate-200">
            <FileText className="size-4 mr-1 text-red-600" /> Summary PDF
          </Button>
          <Button variant="outline" size="sm" onClick={generateCollectionsPDF} className="text-xs bg-slate-50 border-slate-200">
            <FileText className="size-4 mr-1 text-red-600" /> Collections PDF
          </Button>
          <Button variant="outline" size="sm" onClick={generateOutstandingPDF} className="text-xs bg-slate-50 border-slate-200">
            <FileText className="size-4 mr-1 text-red-600" /> Outstanding PDF
          </Button>
          <Button variant="outline" size="sm" onClick={generatePaymentsPDF} className="text-xs bg-slate-50 border-slate-200">
            <FileText className="size-4 mr-1 text-red-600" /> Payments Log PDF
          </Button>
        </div>
      </div>

      {/* 3 Main Sub Module Services, Licence, Driving School Tabs */}
      <div>
        <SubModuleTabs activeTab={activeSubModule} onChange={setActiveSubModule} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Total Receivable</p>
              <h3 className="text-xl font-bold mt-1 text-blue-600">₹{metrics.totalReceivable.toLocaleString("en-IN")}</h3>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Total Received</p>
              <h3 className="text-xl font-bold mt-1 text-green-600">₹{metrics.totalReceived.toLocaleString("en-IN")}</h3>
            </div>
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <CheckCircle className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Outstanding Amount</p>
              <h3 className="text-xl font-bold mt-1 text-rose-600">₹{metrics.outstandingAmount.toLocaleString("en-IN")}</h3>
            </div>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <TrendingUp className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Today's Collections</p>
              <h3 className="text-xl font-bold mt-1 text-amber-600">₹{metrics.todayCollections.toLocaleString("en-IN")}</h3>
            </div>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Calendar className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Overdue Collections</p>
              <h3 className="text-xl font-bold mt-1 text-red-600">₹{metrics.overdueCollections.toLocaleString("en-IN")}</h3>
            </div>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <AlertCircle className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shared Filters Panel */}
      <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search Client Name, Vehicle, Invoice, Mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 bg-white py-1.5 text-xs h-9"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
            <div className="flex items-center gap-1 text-xs">
              <Filter className="size-3.5 text-slate-500" />
              <span className="font-bold text-slate-500 uppercase mr-1">Employee:</span>
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="py-1.5 px-2.5 border rounded-md bg-white text-gray-700 font-semibold"
              >
                <option value="all">All</option>
                {employees.map((emp) => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 text-xs">
              <span className="font-bold text-slate-500 uppercase mr-1">Service:</span>
              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                className="py-1.5 px-2.5 border rounded-md bg-white text-gray-700 font-semibold max-w-[150px]"
              >
                <option value="all">All</option>
                {servicesList.map((srv) => (
                  <option key={srv} value={srv}>{srv}</option>
                ))}
              </select>
            </div>

            {activeTab !== "payments" && activeTab !== "ledger" && (
              <div className="flex items-center gap-1 text-xs">
                <span className="font-bold text-slate-500 uppercase mr-1">Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="py-1.5 px-2.5 border rounded-md bg-white text-gray-700 font-semibold"
                >
                  <option value="all">All</option>
                  <option value="Pending">Pending</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Paid">Paid</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>
            )}

            {activeTab === "payments" && (
              <div className="flex items-center gap-1 text-xs">
                <span className="font-bold text-slate-500 uppercase mr-1">Method:</span>
                <select
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value)}
                  className="py-1.5 px-2.5 border rounded-md bg-white text-gray-700 font-semibold"
                >
                  <option value="all">All</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Online">Online</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center border-t pt-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-500 uppercase">Start Date:</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="py-1 px-2 border rounded bg-white text-slate-700 font-mono"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-500 uppercase">End Date:</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="py-1 px-2 border rounded bg-white text-slate-700 font-mono"
            />
          </div>
          {(filterStartDate || filterEndDate || filterEmployee !== "all" || filterService !== "all" || filterStatus !== "all" || filterMethod !== "all" || searchTerm !== "") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setFilterEmployee("all");
                setFilterService("all");
                setFilterStatus("all");
                setFilterMethod("all");
                setFilterStartDate("");
                setFilterEndDate("");
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex border-b border-slate-200">
          {(["collections", "outstanding", "payments", "ledger"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 px-6 font-bold text-sm border-b-2 capitalize transition ${
                activeTab === tab
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "ledger" ? "Client Ledger" : tab === "payments" ? "Payment Entries" : tab}
            </button>
          ))}
        </div>

        {/* Tab 1: Collections */}
        {activeTab === "collections" && (
          <Card className="shadow-sm border border-slate-100">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground text-sm">
                  No collection records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50 uppercase text-[9px] font-bold text-muted-foreground">
                        <th className="p-3">Client</th>
                        <th className="p-3">Vehicle Number</th>
                        <th className="p-3">Services</th>
                        <th className="p-3">Collection Date</th>
                        <th className="p-3 text-right">Total Amount</th>
                        <th className="p-3 text-right">Received Amount</th>
                        <th className="p-3 text-right">Outstanding Balance</th>
                        <th className="p-3">Assigned Employee</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-gray-700">
                      {filteredRecords.map((r) => {
                        const mobile = r.clientMobile || "";
                        const isExpanded = !!expandedVehicles[r.id];

                        return (
                          <React.Fragment key={r.id}>
                            <tr className="hover:bg-slate-50 transition">
                              <td className="p-3 font-semibold text-gray-900">
                                <div className="flex items-center gap-1.5">
                                  {r.serviceList && r.serviceList.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleVehicleExpand(r.id)}
                                      className="text-xs font-mono font-bold px-1.5 py-0.5 border rounded bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0"
                                      title="Expand/Collapse Services"
                                    >
                                      {isExpanded ? "▼" : "▶"}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setLedgerClientId(r.clientId);
                                      setShowLedgerModal(true);
                                    }}
                                    className="text-blue-600 hover:underline font-bold text-left"
                                  >
                                    {r.clientName}
                                  </button>
                                </div>
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-800">{r.vehicleNumber}</td>
                              <td className="p-3 max-w-[160px] truncate text-slate-600" title={r.services}>
                                {r.services}
                              </td>
                              <td className="p-3">
                                {r.hasInvoice ? (
                                  <input
                                    type="date"
                                    value={r.collectionDate || ""}
                                    onChange={(e) => handleUpdateDate(r.id, e.target.value)}
                                    disabled={isStaff}
                                    className="bg-white border rounded p-1 text-[11px] font-mono focus:ring-1 focus:ring-primary w-28 disabled:bg-slate-50"
                                  />
                                ) : (
                                  <span className="text-slate-400">Not Scheduled</span>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-900">₹{r.invoiceAmount.toLocaleString("en-IN")}</td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-600">₹{r.receivedAmount.toLocaleString("en-IN")}</td>
                              <td className="p-3 text-right font-mono font-bold text-rose-600">₹{r.balanceAmount.toLocaleString("en-IN")}</td>
                              <td className="p-3 text-slate-600">{r.assignedEmployee || "—"}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                  r.paymentStatus === "Paid"
                                    ? "bg-green-100 text-green-800"
                                    : r.paymentStatus === "Partially Paid"
                                      ? "bg-amber-100 text-amber-800"
                                      : r.paymentStatus === "Pending Invoice"
                                        ? "bg-slate-100 text-slate-500"
                                        : "bg-orange-100 text-orange-800"
                                }`}>
                                  {r.paymentStatus}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      handleClientChange(r.clientId);
                                      setPaymentModeType("single");
                                      setSelectedSingleInvoiceId(r.invoiceId);
                                      setPaymentDialogOpen(true);
                                    }}
                                    className="text-indigo-600 hover:text-indigo-900 text-xs px-2 py-1 h-auto font-semibold"
                                  >
                                    Record Payment
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => sendWhatsAppReminder(mobile, r.clientName, r.vehicleNumber, r.balanceAmount)}
                                    className="text-emerald-600 hover:text-emerald-900 text-xs px-2 py-1 h-auto font-semibold"
                                  >
                                    WhatsApp
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={async () => {
                                      if (confirm(`Are you sure you want to delete payment entry for "${r.clientName}"?`)) {
                                        try {
                                          if (r.clientId) await deleteDoc(doc(db, "v2_clients", r.clientId)).catch(() => {});
                                          if (r.invoiceId && r.invoiceId !== "none") {
                                            await deleteDoc(doc(db, "registry_accounting", r.invoiceId)).catch(() => {});
                                            await deleteDoc(doc(db, "registry_services_v2", r.invoiceId)).catch(() => {});
                                          }
                                          if (r.serviceList && r.serviceList.length > 0) {
                                            for (const s of r.serviceList) {
                                              if (s.id) await deleteDoc(doc(db, "registry_services_v2", s.id)).catch(() => {});
                                            }
                                          }
                                          toast.success("Entry deleted successfully!");
                                        } catch (err) {
                                          toast.error("Failed to delete entry");
                                        }
                                      }
                                    }}
                                    className="text-rose-600 hover:text-rose-900 text-xs px-2 py-1 h-auto font-semibold"
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </td>
                            </tr>

                            {/* Expandable Service Details */}
                            {isExpanded && r.serviceList && r.serviceList.length > 0 && (
                              <tr className="bg-slate-50/90">
                                <td colSpan={10} className="p-3 pl-8">
                                  <div className="rounded-lg border bg-white p-3 space-y-2 shadow-sm">
                                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between border-b pb-1">
                                      <span>Services Breakdown — Vehicle {r.vehicleNumber}</span>
                                      <span className="font-mono text-[10px] text-muted-foreground">{r.serviceList.length} service(s)</span>
                                    </div>
                                    <div className="space-y-1 text-xs">
                                      {r.serviceList.map((ser: any) => (
                                        <div key={ser.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-1.5 border-b last:border-b-0 text-slate-700 gap-1 font-mono">
                                          <span className="font-semibold text-slate-900 font-sans">{ser.serviceType}</span>
                                          <div className="flex items-center gap-4 text-right text-[11px]">
                                            <span>Amount: <strong className="text-slate-900">₹{ser.amount.toLocaleString("en-IN")}</strong></span>
                                            <span>Received: <strong className="text-emerald-600">₹{ser.received.toLocaleString("en-IN")}</strong></span>
                                            <span>Outstanding: <strong className="text-rose-600">₹{ser.outstanding.toLocaleString("en-IN")}</strong></span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="pt-2 text-xs font-bold font-mono flex justify-between border-t border-slate-200 text-slate-900">
                                      <span>Vehicle Total</span>
                                      <div className="flex items-center gap-4 text-right">
                                        <span>Total: ₹{r.invoiceAmount.toLocaleString("en-IN")}</span>
                                        <span className="text-emerald-600">Received: ₹{r.receivedAmount.toLocaleString("en-IN")}</span>
                                        <span className="text-rose-600">Outstanding: ₹{r.balanceAmount.toLocaleString("en-IN")}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 2: Outstanding Payments */}
        {activeTab === "outstanding" && (
          <Card className="shadow-sm border border-slate-100">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredRecords.filter(r => r.balanceAmount > 0).length === 0 ? (
                <div className="text-center py-20 text-muted-foreground text-sm">
                  No outstanding payment records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50 uppercase text-[9px] font-bold text-muted-foreground">
                        <th className="p-3">Client</th>
                        <th className="p-3">Vehicle Number</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 text-right">Outstanding</th>
                        <th className="p-3">Collection Date</th>
                        <th className="p-3">Days Due</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-gray-700">
                      {filteredRecords.filter(r => r.balanceAmount > 0).map((r) => {
                        const inv = invoicesMap.get(r.invoiceId);
                        const cDetails = clientDetailsMap.get(r.clientId);
                        const mobile = inv?.clientMobile || cDetails?.mobile || "";
                        const isExpanded = !!expandedVehicles[r.id];

                        let daysOverdue = 0;
                        if (r.collectionDate) {
                          const due = new Date(r.collectionDate);
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          due.setHours(0,0,0,0);
                          if (today.getTime() > due.getTime()) {
                            daysOverdue = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
                          }
                        }

                        return (
                          <React.Fragment key={r.id}>
                            <tr className="hover:bg-slate-50 transition">
                              <td className="p-3 font-semibold text-gray-900">
                                <div className="flex items-center gap-1.5">
                                  {r.serviceList && r.serviceList.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleVehicleExpand(r.id)}
                                      className="text-xs font-mono font-bold px-1.5 py-0.5 border rounded bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0"
                                      title="Expand/Collapse Services"
                                    >
                                      {isExpanded ? "▼" : "▶"}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setLedgerClientId(r.clientId);
                                      setShowLedgerModal(true);
                                    }}
                                    className="text-blue-600 hover:underline font-bold text-left"
                                  >
                                    {r.clientName}
                                  </button>
                                </div>
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-800">{r.vehicleNumber}</td>
                              <td className="p-3 text-right font-mono font-bold text-slate-900">₹{r.invoiceAmount.toLocaleString("en-IN")}</td>
                              <td className="p-3 text-right font-mono font-bold text-rose-600">₹{r.balanceAmount.toLocaleString("en-IN")}</td>
                              <td className="p-3 font-mono">{r.collectionDate || "—"}</td>
                              <td className="p-3 text-red-600 font-bold">{daysOverdue > 0 ? `${daysOverdue} Days` : "—"}</td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      handleClientChange(r.clientId);
                                      setPaymentModeType("single");
                                      setSelectedSingleInvoiceId(r.invoiceId);
                                      setPaymentDialogOpen(true);
                                    }}
                                    className="text-indigo-600 hover:text-indigo-900 text-xs px-2 py-1 h-auto font-semibold"
                                  >
                                    Record Payment
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => sendWhatsAppReminder(mobile, r.clientName, r.vehicleNumber, r.balanceAmount)}
                                    className="text-emerald-600 hover:text-emerald-900 text-xs px-2 py-1 h-auto font-semibold"
                                  >
                                    WhatsApp
                                  </Button>
                                </div>
                              </td>
                            </tr>

                            {/* Expandable Service Details */}
                            {isExpanded && r.serviceList && r.serviceList.length > 0 && (
                              <tr className="bg-slate-50/90">
                                <td colSpan={7} className="p-3 pl-8">
                                  <div className="rounded-lg border bg-white p-3 space-y-2 shadow-sm">
                                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between border-b pb-1">
                                      <span>Services Breakdown — Vehicle {r.vehicleNumber}</span>
                                      <span className="font-mono text-[10px] text-muted-foreground">{r.serviceList.length} service(s)</span>
                                    </div>
                                    <div className="space-y-1 text-xs">
                                      {r.serviceList.map((ser: any) => (
                                        <div key={ser.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-1.5 border-b last:border-b-0 text-slate-700 gap-1 font-mono">
                                          <span className="font-semibold text-slate-900 font-sans">{ser.serviceType}</span>
                                          <div className="flex items-center gap-4 text-right text-[11px]">
                                            <span>Amount: <strong className="text-slate-900">₹{ser.amount.toLocaleString("en-IN")}</strong></span>
                                            <span>Received: <strong className="text-emerald-600">₹{ser.received.toLocaleString("en-IN")}</strong></span>
                                            <span>Outstanding: <strong className="text-rose-600">₹{ser.outstanding.toLocaleString("en-IN")}</strong></span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="pt-2 text-xs font-bold font-mono flex justify-between border-t border-slate-200 text-slate-900">
                                      <span>Vehicle Total</span>
                                      <div className="flex items-center gap-4 text-right">
                                        <span>Total: ₹{r.invoiceAmount.toLocaleString("en-IN")}</span>
                                        <span className="text-emerald-600">Received: ₹{r.receivedAmount.toLocaleString("en-IN")}</span>
                                        <span className="text-rose-600">Outstanding: ₹{r.balanceAmount.toLocaleString("en-IN")}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 3: Payment Entries */}
        {activeTab === "payments" && (
          <Card className="shadow-sm border border-slate-100">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : flattenedPayments.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground text-sm">
                  No payment history found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50 uppercase text-[9px] font-bold text-muted-foreground">
                        <th className="p-3">Payment Date</th>
                        <th className="p-3">Client</th>
                        <th className="p-3">Invoice</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Account</th>
                        <th className="p-3">Received By</th>
                        <th className="p-3">Remarks</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-gray-700">
                      {flattenedPayments.map((p) => {
                        const inv = invoicesMap.get(p.invoiceId);
                        const r = financeRecords.find((rec) => rec.invoiceId === p.invoiceId);
                        const clientName = r?.clientName || p.clientName || "—";

                        return (
                          <tr key={p.uniqueKey} className="hover:bg-slate-50 transition">
                            <td className="p-3 font-mono">{p.receivedAt?.slice(0, 10) || "—"}</td>
                            <td className="p-3 font-semibold text-gray-900">
                              <button
                                onClick={() => {
                                  const cId = r?.clientId || p.clientId;
                                  if (cId) {
                                    setLedgerClientId(cId);
                                    setShowLedgerModal(true);
                                  }
                                }}
                                className="text-blue-600 hover:underline font-bold"
                              >
                                {clientName}
                              </button>
                            </td>
                            <td className="p-3 font-mono">
                              {p.invoiceId === "non-invoiced" ? (
                                <span className="text-slate-500 font-semibold italic">Non-Invoiced (Direct)</span>
                              ) : (
                                p.invoiceNumber || `#${p.invoiceId?.slice(-6).toUpperCase()}`
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-600">₹{p.allocatedAmount.toLocaleString("en-IN")}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-800">
                                {p.method}
                              </span>
                            </td>
                            <td className="p-3 text-slate-700">{p.accountName}</td>
                            <td className="p-3 text-slate-700">{p.receivedBy}</td>
                            <td className="p-3 italic text-muted-foreground truncate max-w-[150px]" title={p.remarks}>{p.remarks || "—"}</td>
                            <td className="p-3 font-mono">{p.referenceNumber || p.paymentId || "—"}</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startDeletePayment(p)}
                                  disabled={isStaff}
                                  className="text-red-600 hover:text-red-900 text-xs px-2 py-1 h-auto"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
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
        )}

        {/* Tab 4: Client Ledger */}
        {activeTab === "ledger" && (
          <Card className="shadow-sm border border-slate-100">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredClientSummaries.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground text-sm">
                  No client records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50 uppercase text-[9px] font-bold text-muted-foreground">
                        <th className="p-3">Client Name</th>
                        <th className="p-3">Mobile</th>
                        <th className="p-3">Vehicle Number</th>
                        <th className="p-3">Service Type</th>
                        <th className="p-3 text-center">Total Invoices</th>
                        <th className="p-3 text-right">Invoiced Amount</th>
                        <th className="p-3 text-right">Total Received</th>
                        <th className="p-3 text-right">Total Outstanding</th>
                        <th className="p-3">Last Payment Date</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-gray-700">
                      {filteredClientSummaries.map((s) => (
                        <tr key={s.clientId} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-semibold text-gray-900">
                            <button
                              onClick={() => {
                                setLedgerClientId(s.clientId);
                                setShowLedgerModal(true);
                              }}
                              className="text-blue-600 hover:underline font-bold"
                            >
                              {s.clientName}
                            </button>
                          </td>
                          <td className="p-3">{s.mobile}</td>
                          <td className="p-3 font-mono">{s.vehicleNumber}</td>
                          <td className="p-3 truncate max-w-[150px]" title={s.serviceType}>{s.serviceType}</td>
                          <td className="p-3 text-center font-bold">{s.invoicesCount}</td>
                          <td className="p-3 text-right font-mono">₹{s.totalInvoiceAmount.toLocaleString("en-IN")}</td>
                          <td className="p-3 text-right font-mono text-emerald-600">₹{s.totalReceived.toLocaleString("en-IN")}</td>
                          <td className="p-3 text-right font-mono font-bold text-rose-600">₹{s.totalOutstanding.toLocaleString("en-IN")}</td>
                          <td className="p-3 font-mono">{s.lastPaymentDate}</td>
                          <td className="p-3 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setLedgerClientId(s.clientId);
                                setShowLedgerModal(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 text-xs font-semibold px-2 py-1 h-auto"
                            >
                              View Ledger
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Payment Dialog */}
      {paymentDialogOpen && (
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-gray-800">
                Record Received Payment
              </DialogTitle>
              <CardDescription>
                Record payment allocation against single or multiple client invoices.
              </CardDescription>
            </DialogHeader>

            <form onSubmit={handleAddPaymentSubmit} className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-gray-500">Select Client *</Label>
                <select
                  required
                  value={paymentClientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full text-xs border rounded-md p-2 bg-white"
                >
                  <option value="">-- Choose Client --</option>
                  {allClientsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.mvNo ? `(${c.mvNo})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {paymentClientId && outstandingInvoicesForClient.length > 0 && (
                <div className="space-y-2 border p-3 rounded-lg bg-slate-50">
                  <Label className="text-[10px] font-bold uppercase text-gray-500 block mb-1">Invoice Selection Mode</Label>
                  <div className="flex gap-4 text-xs font-medium">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="modeType"
                        checked={paymentModeType === "single"}
                        onChange={() => {
                          setPaymentModeType("single");
                          setMultiAllocations({});
                          setPayAmount("");
                        }}
                      />
                      Single Invoice
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="modeType"
                        checked={paymentModeType === "multi"}
                        onChange={() => {
                          setPaymentModeType("multi");
                          setSelectedSingleInvoiceId("");
                          setPayAmount("");
                        }}
                      />
                      Multiple Invoices
                    </label>
                  </div>

                  {paymentModeType === "single" && (
                    <div className="space-y-1 mt-2.5">
                      <Label className="text-[10px] font-bold uppercase text-gray-500">Select Invoice *</Label>
                      <select
                        required
                        value={selectedSingleInvoiceId}
                        onChange={(e) => setSelectedSingleInvoiceId(e.target.value)}
                        className="w-full text-xs border rounded-md p-2 bg-white"
                      >
                        <option value="">-- Choose Invoice --</option>
                        {outstandingInvoicesForClient.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.invoiceNumber} (Amt: ₹{inv.invoiceAmount} | Outstanding: ₹{inv.balanceAmount})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {paymentModeType === "single" && selectedSingleInvoiceId && (() => {
                    const selectedInv = outstandingInvoicesForClient.find(i => i.id === selectedSingleInvoiceId);
                    if (!selectedInv) return null;
                    return (
                      <div className="grid grid-cols-3 gap-2 mt-2 bg-slate-50 p-2 border rounded-md text-xs">
                        <div>
                          <Label className="text-[9px] font-bold uppercase text-gray-400">Invoice Number</Label>
                          <Input readOnly value={selectedInv.invoiceNumber} className="bg-slate-100 text-xs h-8 border-slate-200" />
                        </div>
                        <div>
                          <Label className="text-[9px] font-bold uppercase text-gray-400">Invoice Amount</Label>
                          <Input readOnly value={`₹${selectedInv.invoiceAmount.toLocaleString("en-IN")}`} className="bg-slate-100 text-xs h-8 font-mono border-slate-200" />
                        </div>
                        <div>
                          <Label className="text-[9px] font-bold uppercase text-gray-400">Current Outstanding</Label>
                          <Input readOnly value={`₹${selectedInv.balanceAmount.toLocaleString("en-IN")}`} className="bg-slate-100 text-xs h-8 font-mono text-rose-600 font-bold border-slate-200" />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {paymentClientId && outstandingInvoicesForClient.length === 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-xs font-medium">
                  Client has no generated invoices. Recording direct payment under <strong>Non-Invoiced Payments</strong>.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-gray-500">Amount Received (₹) *</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 15000"
                    required
                    value={payAmount}
                    onChange={(e) => handlePayAmountChange(e.target.value)}
                    className="bg-white text-xs"
                  />
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
              </div>

              {paymentModeType === "multi" && outstandingInvoicesForClient.length > 0 && payAmount && (
                <div className="space-y-2 border border-emerald-200 bg-emerald-50/40 p-3 rounded-lg">
                  <Label className="text-[10px] font-bold uppercase text-emerald-800 block">Allocate Payments Across Invoices</Label>
                  <div className="space-y-2 text-xs">
                    {outstandingInvoicesForClient.map((inv) => (
                      <div key={inv.id} className="flex justify-between items-center gap-4 py-1 border-b border-emerald-100/50">
                        <span className="font-semibold text-slate-700">{inv.invoiceNumber} (Bal: ₹{inv.balanceAmount})</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500">₹</span>
                          <Input
                            type="number"
                            value={multiAllocations[inv.id] || 0}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setMultiAllocations({
                                ...multiAllocations,
                                [inv.id]: val,
                              });
                            }}
                            className="w-24 bg-white text-xs text-right h-8"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold text-emerald-800 pt-1.5 border-t">
                      <span>Total Allocated:</span>
                      <span>₹{Object.values(multiAllocations).reduce((sum, v) => sum + v, 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-gray-500">Payment Method</Label>
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-gray-500">Received By</Label>
                  <Input
                    readOnly
                    value={username}
                    className="bg-slate-50 text-xs border-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-gray-500">Reference Number (Optional)</Label>
                  <Input
                    placeholder="e.g. TXN123456"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    className="bg-white text-xs"
                  />
                </div>
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

              <DialogFooter className="pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingPayment}>
                  {savingPayment ? "Recording..." : "Record Payment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Client Financial Ledger Modal */}
      {showLedgerModal && ledgerClientId && (
        <Dialog open={showLedgerModal} onOpenChange={setShowLedgerModal}>
          <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-800">
                Client Financial Ledger
              </DialogTitle>
            </DialogHeader>

            {(() => {
              const summary = clientSummaries.find((s) => s.clientId === ledgerClientId);
              const clientInvoices = financeRecords.filter((r) => r.clientId === ledgerClientId);
              const directPayments = paymentEntries.filter((p) => (p as any).clientId === ledgerClientId && p.invoiceId === "non-invoiced");

              if (!summary) return <p className="text-sm text-red-500">Client summary not found.</p>;

              return (
                <div className="space-y-6 mt-4">
                  {/* Client Info Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Client Name</span>
                      <p className="font-semibold text-slate-800">{summary.clientName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Mobile Number</span>
                      <p className="font-semibold text-slate-800">{summary.mobile}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Vehicle Number</span>
                      <p className="font-semibold text-slate-800 font-mono">{summary.vehicleNumber}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Service Type</span>
                      <p className="font-semibold text-slate-800">{summary.serviceType}</p>
                    </div>
                  </div>

                  {/* Ledger Metrics Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="p-3 border rounded-lg bg-white">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Total Invoices</span>
                      <p className="text-lg font-bold text-slate-800">{summary.invoicesCount}</p>
                    </div>
                    <div className="p-3 border rounded-lg bg-white">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Total Invoice Amount</span>
                      <p className="text-lg font-bold text-slate-800">₹{summary.totalInvoiceAmount.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="p-3 border rounded-lg bg-white">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Total Received</span>
                      <p className="text-lg font-bold text-emerald-600">₹{summary.totalReceived.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="p-3 border rounded-lg bg-white">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Outstanding</span>
                      <p className="text-lg font-bold text-rose-600">₹{summary.totalOutstanding.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="p-3 border rounded-lg bg-white">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Last Payment Date</span>
                      <p className="text-lg font-bold text-slate-700 font-mono">{summary.lastPaymentDate}</p>
                    </div>
                  </div>

                  {/* Generated Invoices Section */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase text-slate-500 border-b pb-1">Generated Invoices</h3>
                    {clientInvoices.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No invoices generated for this client.</p>
                    ) : (
                      <div className="space-y-4">
                        {clientInvoices.map((rec) => {
                          const inv = invoicesMap.get(rec.invoiceId);
                          const history = paymentEntries
                             .filter((p) => p.invoiceId === rec.invoiceId || p.allocations?.some(alloc => alloc.invoiceId === rec.invoiceId))
                             .map((p) => {
                               const alloc = p.allocations?.find(a => a.invoiceId === rec.invoiceId);
                               const allocatedAmt = alloc ? alloc.allocatedAmount : p.amount;
                               return {
                                 ...p,
                                 allocatedAmount: allocatedAmt,
                               };
                             });
                           const serviceNames = inv?.services?.map((s) => s.serviceName).join(", ") || "—";

                           return (
                             <div key={rec.id} className="border rounded-xl p-4 space-y-3 bg-white hover:shadow-sm transition">
                               <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-2">
                                 <div className="space-y-0.5">
                                   <h4 className="font-bold text-slate-800">{rec.invoiceNumber}</h4>
                                   <p className="text-xs text-slate-500">Service: {serviceNames} | Date: {rec.createdAt?.slice(0, 10)}</p>
                                 </div>
                                 <div className="flex items-center gap-2">
                                   <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                     rec.paymentStatus === "Paid" ? "bg-green-100 text-green-800" :
                                     rec.paymentStatus === "Partially Paid" ? "bg-amber-100 text-amber-800" : "bg-orange-100 text-orange-800"
                                   }`}>
                                     {rec.paymentStatus}
                                   </span>
                                   {inv && (
                                     <>
                                       <Button
                                         size="sm"
                                         variant="outline"
                                         onClick={() => setSelectedInvoice(inv)}
                                         className="h-7 text-xs gap-1"
                                       >
                                         <ExternalLink className="size-3" /> View PDF
                                       </Button>
                                       <Button
                                         size="sm"
                                         variant="outline"
                                         onClick={() => generateInvoicePDF(inv)}
                                         className="h-7 text-xs gap-1"
                                       >
                                         <Download className="size-3" /> Download PDF
                                       </Button>
                                     </>
                                   )}
                                 </div>
                               </div>

                               {/* Invoice Financial details */}
                               <div className="grid grid-cols-3 gap-2 text-center text-xs p-2 rounded bg-slate-50">
                                 <div>
                                   <span className="text-[10px] text-slate-400 font-bold block">Invoice Amount</span>
                                   <span className="font-bold text-slate-700">₹{rec.invoiceAmount.toLocaleString()}</span>
                                 </div>
                                 <div>
                                   <span className="text-[10px] text-slate-400 font-bold block">Total Received</span>
                                   <span className="font-bold text-emerald-600">₹{rec.receivedAmount.toLocaleString()}</span>
                                 </div>
                                 <div>
                                   <span className="text-[10px] text-slate-400 font-bold block">Balance</span>
                                   <span className="font-bold text-rose-600">₹{rec.balanceAmount.toLocaleString()}</span>
                                 </div>
                                </div>

                               {/* Allocated Payments */}
                               <div className="space-y-1.5 mt-2">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Allocated Payments</span>
                                 {history.length === 0 ? (
                                   <p className="text-[11px] text-muted-foreground italic">No allocated payments.</p>
                                 ) : (
                                   <div className="space-y-1">
                                     {history.map((p) => (
                                       <div key={p.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 border rounded font-mono">
                                         <div className="flex gap-2">
                                           <span className="font-bold text-indigo-600">{p.paymentId || "PAY-Legacy"}</span>
                                           <span className="text-slate-500">{p.receivedAt?.slice(0, 10)}</span>
                                         </div>
                                         <span className="font-bold text-emerald-600">₹{p.allocatedAmount.toLocaleString("en-IN")}</span>
                                       </div>
                                     ))}
                                   </div>
                                 )}
                               </div>
                             </div>
                           );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Direct Non-Invoiced Payments */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase text-slate-500 border-b pb-1">Non-Invoiced Payments</h3>
                    {directPayments.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No non-invoiced payments recorded.</p>
                    ) : (
                      <div className="overflow-x-auto border rounded-xl bg-white p-3">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-slate-400 border-b">
                              <th className="py-1.5">Date</th>
                              <th className="py-1.5 text-right">Amount</th>
                              <th className="py-1.5">Method</th>
                              <th className="py-1.5">Account</th>
                              <th className="py-1.5">Received By</th>
                              <th className="py-1.5">Remarks</th>
                              <th className="py-1.5 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {directPayments.map((p) => (
                              <tr key={p.id} className="border-b last:border-0">
                                <td className="py-2 font-mono">{p.receivedAt?.slice(0, 10)}</td>
                                <td className="py-2 text-right font-bold text-emerald-600">₹{p.amount.toLocaleString()}</td>
                                <td className="py-2">{p.method}</td>
                                <td className="py-2">{p.accountName}</td>
                                <td className="py-2 text-slate-600">{p.receivedBy}</td>
                                <td className="py-2 italic text-slate-500">{p.remarks}</td>
                                <td className="py-2 text-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startDeletePayment(p)}
                                    disabled={isStaff}
                                    className="text-red-600 hover:text-red-900 text-xs px-2 py-0.5 h-auto"
                                  >
                                    Delete
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <DialogFooter className="mt-4 pt-2 border-t">
              <Button onClick={() => setShowLedgerModal(false)}>
                Close Ledger
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Invoice Viewer Modal */}
      {selectedInvoice && (
        <InvoiceViewer invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}

      {/* Admin PIN Dialog for Deletion */}
      {pinDialogOpen && (
        <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-gray-800">
                Admin Action Required
              </DialogTitle>
              <CardDescription>
                Please enter the Admin PIN to authorize the deletion of this {invoiceToDeleteId ? "invoice" : "payment"}.
              </CardDescription>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <Label className="text-[10px] font-bold uppercase text-gray-500">Admin PIN</Label>
              <Input
                type="password"
                placeholder="••••"
                maxLength={4}
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                className="bg-white font-mono text-center text-lg tracking-widest"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => {
                setPinDialogOpen(false);
                setInvoiceToDeleteId(null);
                setPaymentToDelete(null);
              }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={invoiceToDeleteId ? handleDeleteInvoiceVerified : handleDeletePaymentVerified}
              >
                Authorize & Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
