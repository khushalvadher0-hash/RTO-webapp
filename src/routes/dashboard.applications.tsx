import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Search,
  Plus,
  Upload,
  Calendar,
  X,
  Building2,
  Car,
  Shield,
  FileCheck,
  User,
  FileSpreadsheet,
  DollarSign,
  Receipt,
  Eye,
  CheckCircle,
  Pencil,
  Trash2,
  GraduationCap,
  FolderOpen,
  Printer,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  subscribeApplications,
  subscribeAccountingRecords,
  saveApplicationAndVehicle,
  deleteApplication,
  fetchVehicleByNumber,
  computePermitExpiry,
  type ApplicationRecord,
  type VehicleMaster,
  type ServiceAccountingItem,
  type AccountingRecord,
  type Form5DetailsData,
} from "@/lib/applications";
import { getSession } from "@/lib/auth";
import {
  saveDrivingSchoolApplication,
  subscribeDrivingSchoolApplications,
  deleteDrivingSchoolApplication,
  exportDrivingSchoolToCSV,
  exportDrivingSchoolToExcel,
  exportDrivingSchoolToPDF,
  type DrivingSchoolApplication,
} from "@/lib/drivingSchool";
import { fetchAllUsers } from "@/lib/userService";
import { createInvoice } from "@/lib/billing";
import { getInsuranceGstPercentage } from "@/lib/capitalize-settings";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const DEFAULT_APP_TYPES = [
  "Home",
  "Faceless",
  "Out Of Bhavnagar",
  "CNG",
  "Out Of Bhavnagar To Bhavnagar",
];

export function getAppTypeBadgeColor(appType?: string) {
  if (!appType) return "bg-[#F8F9FA] text-slate-800 border-slate-200";
  const clean = appType.trim().toLowerCase();
  if (clean === "home") return "bg-[#F8F9FA] text-slate-800 border-slate-200";
  if (clean === "faceless") return "bg-[#EAF4FF] text-blue-900 border-blue-200";
  if (clean === "out of bhavnagar") return "bg-[#FFEAEA] text-rose-900 border-rose-200";
  if (clean === "cng") return "bg-[#ECFFF0] text-emerald-900 border-emerald-200";
  if (clean === "out of bhavnagar to bhavnagar") return "bg-[#FFF4E6] text-amber-900 border-amber-200";
  return "bg-slate-100 text-slate-800 border-slate-200";
}

const SERVICE_GROUPS = [
  {
    category: "RC",
    items: [
      "Transfer of Ownership",
      "Duplicate RC",
      "Change Address",
      "Registration Renewal",
      "RC Particular",
      "Vehicle Correction",
      "Vahan Correction",
      "Backlog",
    ],
  },
  {
    category: "HYPOTHECATION",
    items: [
      "Hypothecation Addition",
      "Hypothecation Terminate",
      "Hypothecation Continuation",
      "No Objection Certificate",
    ],
  },
  {
    category: "FITNESS",
    items: ["Fitness Renewal RTO", "Fitness Renewal ATS", "Duplicate Fitness Certificate"],
  },
  {
    category: "PERMITS",
    items: [
      "Gujarat Permit",
      "National Permit(Gujrat Permit)",
      "Gujarat Permit Renewal",
      "National Permit(Gujrat Permit) Renewal",
    ],
  },
  {
    category: "VEHICLE",
    items: ["Vehicle Alteration", "Vehicle Conversion"],
  },
  {
    category: "COMPLIANCE / OTHER",
    items: ["Tax", "PUC", "Tax Detail Update"],
  },
];

export const Route = createFileRoute("/dashboard/applications")({
  component: ApplicationsPage,
});

import { SubModuleTabs, type SubModuleType } from "@/components/SubModuleTabs";

function ApplicationsPage() {
  const location = useLocation();
  const [activeSubModule, setActiveSubModule] = useState<SubModuleType>("services");

  const [courseTypes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("driving_school_course_types");
      return saved ? JSON.parse(saved) : ["15 Days", "21 Days", "26 Days", "45 Days", "60 Days"];
    } catch {
      return ["15 Days", "21 Days", "26 Days", "45 Days", "60 Days"];
    }
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sub = params.get("subModule");
    if (sub && (sub === "services" || sub === "licence" || sub === "driving_school" || sub === "insurance" || sub === "form5")) {
      setActiveSubModule(sub as SubModuleType);
    }
  }, [location.search]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<ApplicationRecord | null>(null);
  const [viewingApp, setViewingApp] = useState<ApplicationRecord | null>(null);

  // Delete modal state
  const [deletingApp, setDeletingApp] = useState<ApplicationRecord | null>(null);
  const [deletePasscode, setDeletePasscode] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (deletePasscode !== "1234") {
      toast.error("Invalid password! Default passcode is 1234.");
      return;
    }
    if (!deletingApp) return;

    setDeleting(true);
    try {
      await deleteApplication(deletingApp.id);
      toast.success("Application deleted successfully!");
      setDeletingApp(null);
      setDeletePasscode("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete application");
    } finally {
      setDeleting(false);
    }
  };

  const [accountingMap, setAccountingMap] = useState<Map<string, AccountingRecord>>(new Map());
  const [drivingSchoolApps, setDrivingSchoolApps] = useState<DrivingSchoolApplication[]>([]);
  const [dsCourseFilter, setDsCourseFilter] = useState("all");
  const [dsEmployeeFilter, setDsEmployeeFilter] = useState("all");
  const [dsStatusFilter, setDsStatusFilter] = useState("all");

  useEffect(() => {
    const unsubApps = subscribeApplications((data) => {
      setApplications(data);
      setLoading(false);
    });
    const unsubAcc = subscribeAccountingRecords((map) => {
      setAccountingMap(map);
    });
    const unsubDS = subscribeDrivingSchoolApplications((data) => {
      setDrivingSchoolApps(data);
    });
    return () => {
      unsubApps();
      unsubAcc();
      unsubDS();
    };
  }, []);

  const handlePrintPDF = () => {
    const tableEl = document.querySelector("table");
    if (!tableEl) {
      toast.error("No data available to print");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Failed to open print window");
      return;
    }

    const clonedTable = tableEl.cloneNode(true) as HTMLTableElement;
    
    const headers = clonedTable.querySelectorAll("thead th");
    const lastHeader = headers[headers.length - 1];
    if (lastHeader && lastHeader.textContent?.toLowerCase().includes("action")) {
      lastHeader.remove();
    }
    const rows = clonedTable.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length > 0) {
        const lastCell = cells[cells.length - 1];
        lastCell.remove();
      }
    });

    const activeTabLabel = activeSubModule.toUpperCase();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${activeTabLabel} Applications Report</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 24px;
            color: #1e293b;
            background-color: #ffffff;
          }
          .header {
            margin-bottom: 24px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 16px;
          }
          .title {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 6px 0;
            text-transform: uppercase;
          }
          .meta {
            font-size: 11px;
            color: #64748b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            text-align: left;
          }
          th {
            background-color: #f8fafc;
            color: #475569;
            font-weight: 600;
            padding: 8px 10px;
            border-bottom: 2px solid #e2e8f0;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #f1f5f9;
            color: #334155;
            font-weight: 500;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">${activeTabLabel} APPLICATIONS REPORT</h1>
          <div class="meta">Generated on ${new Date().toLocaleString("en-IN")}</div>
        </div>
        ${clonedTable.outerHTML}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExportExcel = () => {
    const tableEl = document.querySelector("table");
    if (!tableEl) {
      toast.error("No data available to export");
      return;
    }

    const headers: string[] = [];
    const headerCols = tableEl.querySelectorAll("thead th");
    headerCols.forEach((th, idx) => {
      if (idx < headerCols.length - 1 || !th.textContent?.toLowerCase().includes("action")) {
        headers.push(`"${th.textContent?.trim().replace(/"/g, '""') || ""}"`);
      }
    });

    const rows: string[][] = [];
    const bodyRows = tableEl.querySelectorAll("tbody tr");
    bodyRows.forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      const rowData: string[] = [];
      cells.forEach((td, idx) => {
        if (idx < cells.length - 1 || !headerCols[idx]?.textContent?.toLowerCase().includes("action")) {
          let val = td.textContent?.trim() || "";
          val = val.replace(/\s+/g, " ");
          rowData.push(`"${val.replace(/"/g, '""')}"`);
        }
      });
      if (rowData.length > 0) {
        rows.push(rowData);
      }
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeSubModule}_applications_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Excel file downloaded successfully!");
  };

  const filteredApps = applications.filter((app) => {
    if (activeSubModule === "driving_school") return false;

    const isForm5App = app.subModule === "form5";

    const isLicenceApp =
      app.subModule === "licence" ||
      app.applicationType === "Licence" ||
      (app.licenseDetails &&
        (app.licenseDetails.newLearningLicence?.enabled ||
          app.licenseDetails.dlNewLlEndorsement?.enabled ||
          app.licenseDetails.llRenewClass?.enabled ||
          app.licenseDetails.dlRenewRetest?.enabled ||
          (app.licenseDetails.generalLicenceServices?.selectedServices &&
            app.licenseDetails.generalLicenceServices.selectedServices.length > 0)));

    const isInsuranceApp =
      app.subModule === "insurance" ||
      (app.services || []).includes("Insurance");

    if (activeSubModule === "form5") {
      if (!isForm5App) return false;
    } else if (activeSubModule === "licence") {
      if (!isLicenceApp || isForm5App) return false;
    } else if (activeSubModule === "insurance") {
      if (!isInsuranceApp || isForm5App) return false;
    } else if (activeSubModule === "services") {
      if (isLicenceApp || isInsuranceApp || isForm5App) return false;
    }

    const term = searchTerm.toLowerCase();
    const matchSearch =
      app.vehicleNumber.toLowerCase().includes(term) ||
      app.ownerName.toLowerCase().includes(term) ||
      app.mobileNumber.toLowerCase().includes(term) ||
      app.applicationId.toLowerCase().includes(term);

    const matchStatus = statusFilter === "all" || app.applicationStatus === statusFilter;
    const matchPayment = paymentFilter === "all" || app.paymentStatus === paymentFilter;

    return matchSearch && matchStatus && matchPayment;
  });

  const filteredDrivingSchoolApps = useMemo(() => {
    return drivingSchoolApps.filter((ds) => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        ds.studentName.toLowerCase().includes(term) ||
        (ds.mobileNumber && ds.mobileNumber.includes(term)) ||
        (ds.courseType && ds.courseType.toLowerCase().includes(term)) ||
        (ds.applicationId && ds.applicationId.toLowerCase().includes(term));

      const matchPayment = paymentFilter === "all" || ds.paymentStatus === paymentFilter;
      const matchCourse = dsCourseFilter === "all" || ds.courseType === dsCourseFilter;
      const matchEmployee = dsEmployeeFilter === "all" || ds.assignedEmployee === dsEmployeeFilter;
      const matchStatus = dsStatusFilter === "all" || ds.status === dsStatusFilter;

      return matchSearch && matchPayment && matchCourse && matchEmployee && matchStatus;
    });
  }, [drivingSchoolApps, searchTerm, paymentFilter, dsCourseFilter, dsEmployeeFilter, dsStatusFilter]);

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {activeSubModule === "driving_school" ? "Driving School Applications" : "Applications"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {activeSubModule === "driving_school" ? drivingSchoolApps.length : applications.length} total records • updated a moment ago
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintPDF}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all shadow-sm active:scale-[0.98]"
          >
            <Printer className="w-4 h-4 text-rose-500" />
            Print / PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all shadow-sm active:scale-[0.98]"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            Excel
          </button>
          <button
            onClick={() => {
              setEditingApp(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-md shadow-blue-500/20 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            New Application
          </button>
        </div>
      </div>

      {/* 3 Main Sub Module Services, Licence, Driving School Tabs */}
      <div>
        <SubModuleTabs activeTab={activeSubModule} onChange={setActiveSubModule} />
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={activeSubModule === "driving_school" ? "Search student, mobile, course..." : "Search vehicle, owner, mobile..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {activeSubModule === "driving_school" ? (
            <>
              <select
                value={dsCourseFilter}
                onChange={(e) => setDsCourseFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Courses</option>
                {courseTypes.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
              <select
                value={dsStatusFilter}
                onChange={(e) => setDsStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </>
          ) : (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="In Review">In Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="On Hold">On Hold</option>
            </select>
          )}

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Payments</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Partial">Partial</option>
          </select>
        </div>
      </div>

      {/* Applications Table - Dynamic Column View according to SubModule */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 text-center">SR No</th>
                {activeSubModule === "driving_school" ? (
                  <>
                    <th className="py-3.5 px-4 font-bold text-slate-900">Student Name</th>
                    <th className="py-3.5 px-4">Mobile Number</th>
                    <th className="py-3.5 px-4">Date of Birth</th>
                    <th className="py-3.5 px-4">Course</th>
                    <th className="py-3.5 px-4">Joining Date</th>
                    <th className="py-3.5 px-4">Course End Date</th>
                    <th className="py-3.5 px-4">Duration</th>
                    <th className="py-3.5 px-4 font-bold text-slate-900">કુલ રકમ</th>
                    <th className="py-3.5 px-4 font-bold text-emerald-700">કુલ જમા</th>
                    <th className="py-3.5 px-4 font-bold text-amber-700">બાકી</th>
                    <th className="py-3.5 px-4">Payment Status</th>
                    <th className="py-3.5 px-4">Assigned Employee</th>
                    <th className="py-3.5 px-4">Status</th>
                  </>
                ) : activeSubModule === "form5" ? (
                  <>
                    <th className="py-3.5 px-4 font-bold text-slate-900">Name</th>
                    <th className="py-3.5 px-4">Date Of Birth</th>
                    <th className="py-3.5 px-4 font-bold text-slate-900">Application No</th>
                    <th className="py-3.5 px-4">Adhar No</th>
                    <th className="py-3.5 px-4">LL NO</th>
                    <th className="py-3.5 px-4">DL NO</th>
                    <th className="py-3.5 px-4">Expire date</th>
                    <th className="py-3.5 px-4">nt validity</th>
                    <th className="py-3.5 px-4">tr validity</th>
                  </>
                ) : activeSubModule === "licence" ? (
                  <>
                    <th className="py-3.5 px-4">Client Name</th>
                    <th className="py-3.5 px-4">DOB</th>
                    <th className="py-3.5 px-4">Mobile Number</th>
                    {/* Dynamic service expiries */}
                    {Array.from(
                      new Set(
                        filteredApps.flatMap((app) => {
                          const services: string[] = app.services || [];
                          if (services.length > 0) return services;
                          const licServices: string[] = [];
                          const ld = app.licenseDetails;
                          if (ld?.newLearningLicence?.enabled) licServices.push("New Learning Licence");
                          if (ld?.dlNewLlEndorsement?.enabled) licServices.push("DL New LL Endorsement");
                          if (ld?.llRenewClass?.enabled) licServices.push("LL Renew Class");
                          if (ld?.dlRenewRetest?.enabled) licServices.push("DL Renew / Retest");
                          if (ld?.generalLicenceServices?.selectedServices) {
                            licServices.push(...ld.generalLicenceServices.selectedServices);
                          }
                          return licServices.length > 0 ? licServices : ["License Service"];
                        })
                      )
                    ).map((srvName) => (
                      <th key={srvName} className="py-3.5 px-4">
                        {srvName} Expire Date
                      </th>
                    ))}
                    <th className="py-3.5 px-4 font-bold text-slate-900">કુલ રકમ</th>
                    <th className="py-3.5 px-4 font-bold text-emerald-700">કુલ જમા</th>
                    <th className="py-3.5 px-4 font-bold text-amber-700">બાકી</th>
                    <th className="py-3.5 px-4">Payment Status</th>
                    <th className="py-3.5 px-4 font-mono text-slate-600">Reference</th>
                  </>
                ) : activeSubModule === "insurance" ? (
                  <>
                    <th className="py-3.5 px-4 font-bold text-slate-900">Vehicle Number</th>
                    <th className="py-3.5 px-4">Owner Name</th>
                    <th className="py-3.5 px-4">Phone Number</th>
                    <th className="py-3.5 px-4">Issue Date</th>
                    <th className="py-3.5 px-4">Expiry Date</th>
                    <th className="py-3.5 px-4">Total Premium</th>
                    <th className="py-3.5 px-4">Net Commission</th>
                    <th className="py-3.5 px-4 font-bold text-slate-900">કુલ રકમ</th>
                    <th className="py-3.5 px-4 font-bold text-emerald-700">કુલ જમા</th>
                  </>
                ) : (
                  <>
                    <th className="py-3.5 px-4 font-bold text-slate-900">Vehicle Number</th>
                    <th className="py-3.5 px-4">Owner Name</th>
                    <th className="py-3.5 px-4">Phone Number</th>
                    <th className="py-3.5 px-4">Maker Name</th>
                    <th className="py-3.5 px-4">Model Name</th>
                    <th className="py-3.5 px-4">PUC Expiry</th>
                    <th className="py-3.5 px-4">Tax Expiry</th>
                    <th className="py-3.5 px-4">Fitness Expiry</th>
                    {activeSubModule !== "services" && <th className="py-3.5 px-4">Insurance Expiry</th>}
                    <th className="py-3.5 px-4">National Permit(Gujrat Permit) Expiry</th>
                    <th className="py-3.5 px-4">Gujarat Permit Expiry</th>
                    <th className="py-3.5 px-4">NP Authorization Expiry</th>
                    <th className="py-3.5 px-4">Registration Renewal Expiry</th>
                    <th className="py-3.5 px-4 text-center">Total Services</th>
                    <th className="py-3.5 px-4 font-bold text-slate-900">કુલ રકમ</th>
                    <th className="py-3.5 px-4 font-bold text-emerald-700">કુલ જમા</th>
                  </>
                )}
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={25} className="py-12 text-center text-slate-400">
                    Loading applications...
                  </td>
                </tr>
              ) : activeSubModule === "driving_school" ? (
                filteredDrivingSchoolApps.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-12 text-center text-slate-400">
                      No Driving School Applications Found.
                    </td>
                  </tr>
                ) : (
                  filteredDrivingSchoolApps.map((ds, index) => {
                    const totFee = Number(ds.totalCourseFees) || 0;
                    const advFee = Number(ds.advancePaid) || 0;
                    const remFee = typeof ds.remainingFees === "number" ? ds.remainingFees : Math.max(0, totFee - advFee);
                    const pStatus = remFee <= 0 && totFee > 0 ? "Paid" : advFee > 0 ? "Partial" : "Pending";

                    let durationStr = "—";
                    if (ds.courseStartDate && ds.courseEndDate) {
                      const start = new Date(ds.courseStartDate);
                      const end = new Date(ds.courseEndDate);
                      const diffTime = Math.abs(end.getTime() - start.getTime());
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      durationStr = `${diffDays} Days`;
                    }

                    return (
                      <tr
                        key={ds.id}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{index + 1}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{ds.studentName}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{ds.mobileNumber || "—"}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{ds.dateOfBirth || "—"}</td>
                        <td className="py-3.5 px-4 font-semibold text-blue-600">{ds.courseType || "—"}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{ds.joiningDate || "—"}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{ds.courseEndDate || "—"}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">{durationStr}</td>
                        <td className="py-3.5 px-4 font-bold font-mono text-slate-900">₹{totFee.toLocaleString("en-IN")}</td>
                        <td className="py-3.5 px-4 font-bold font-mono text-emerald-700">₹{advFee.toLocaleString("en-IN")}</td>
                        <td className="py-3.5 px-4 font-bold font-mono text-amber-700">₹{remFee.toLocaleString("en-IN")}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-bold border",
                              pStatus === "Paid"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : pStatus === "Partial"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            )}
                          >
                            {pStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{ds.assignedEmployee || "Unassigned"}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-md text-[10px] font-semibold",
                              ds.status === "Completed"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-blue-50 text-blue-700"
                            )}
                          >
                            {ds.status || "Active"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setEditingApp({
                                  id: ds.id,
                                  applicationId: ds.applicationId || ds.id,
                                  vehicleNumber: ds.vehicleNumber || "",
                                  ownerName: ds.studentName,
                                  mobileNumber: ds.mobileNumber,
                                  subModule: "driving_school",
                                  dateOfBirth: ds.dateOfBirth,
                                  joiningDate: ds.joiningDate,
                                  courseStartDate: ds.courseStartDate,
                                  courseEndDate: ds.courseEndDate,
                                  courseType: ds.courseType,
                                  totalCourseFees: ds.totalCourseFees,
                                  advancePaid: ds.advancePaid,
                                  remainingFees: ds.remainingFees,
                                  assignedEmployee: ds.assignedEmployee,
                                  reminderDate: ds.reminderDate,
                                  priority: ds.priority,
                                  employeeNotes: ds.employeeNotes,
                                  documents: ds.documents,
                                  status: ds.status,
                                  bloodGroup: ds.bloodGroup,
                                } as any);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition-colors"
                              title="Edit Application"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm(`Delete Driving School application for ${ds.studentName}?`)) {
                                  try {
                                    await deleteDrivingSchoolApplication(ds.id);
                                    toast.success("Driving School application deleted.");
                                  } catch (err) {
                                    toast.error("Failed to delete application.");
                                  }
                                }
                              }}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-rose-600 transition-colors"
                              title="Delete Application"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={25} className="py-12 text-center text-slate-400">
                    No applications found.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app, index) => {
                  if (activeSubModule === "form5") {
                    const fd = app.form5Details || {};
                    const nameVal = fd.name || "—";
                    const dobVal = fd.dateOfBirth || "—";
                    const appNoVal = fd.applicationNo || "—";
                    const aadhaarVal = fd.aadhaarNumber || "—";
                    const llVal = fd.llNumber || "—";
                    const dlVal = fd.dlNumber || "—";
                    const llExpiryVal = fd.llExpiryDate || "—";
                    const ntVal = fd.ntValidityDate || "—";
                    const trVal = fd.trValidityDate || "—";

                    return (
                      <tr
                        key={app.id}
                        onClick={() => setViewingApp(app)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{index + 1}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{nameVal}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{dobVal}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 font-bold">{appNoVal}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{aadhaarVal}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{llVal}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{dlVal}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{llExpiryVal}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{ntVal}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{trVal}</td>
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setViewingApp(app)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-blue-600 transition-all"
                              title="View Application Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingApp(app);
                                if (app.form5Details) {
                                  setForm5Details(app.form5Details);
                                }
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600 transition-all"
                              title="Edit Application"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDeletingApp(app);
                                setDeletePasscode("");
                              }}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-all"
                              title="Delete Application"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (activeSubModule === "insurance") {
                    const appRaw = app as any;
                    const v = appRaw.vehicleDetails || appRaw.vehicleMaster || appRaw || {};
                    const insDetails = appRaw.insuranceDetails || v.insuranceDetails || {};
                    const acc = accountingMap.get(app.id) || accountingMap.get(app.applicationId);
                    const totalPay = app.amount || app.serviceAccounting?.Insurance?.totalAmount || (acc?.totalCharges ?? acc?.totalPayment ?? 0);
                    const advPay = app.totalPaid || app.serviceAccounting?.Insurance?.advancePayment || (acc?.advancePaid ?? acc?.advancePayment ?? 0);

                    const ownerName = app.ownerName || appRaw.clientName || v.ownerName || "—";
                    const phoneNo = app.mobileNumber || appRaw.phone || appRaw.phoneNo || v.phone || v.mobileNumber || "—";
                    const vehNo = app.vehicleNumber || app.vehicleId || "—";

                    const issueDate = insDetails.issueDate || appRaw.insuranceIssueDate || "—";
                    const expiryDate = insDetails.expiryDate || appRaw.insuranceExpiryDate || "—";
                    const totalPremium = insDetails.totalPremium ?? insDetails.amount ?? appRaw.totalPremium ?? "—";
                    const netCommission = insDetails.netCommission ?? appRaw.netCommission ?? "—";

                    return (
                      <tr
                        key={app.id}
                        onClick={() => setViewingApp(app)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{index + 1}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                          {vehNo}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {ownerName}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">
                          {phoneNo}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{issueDate}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{expiryDate}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {typeof totalPremium === "number" ? `₹${totalPremium.toLocaleString("en-IN")}` : totalPremium}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {typeof netCommission === "number" ? `₹${netCommission.toLocaleString("en-IN")}` : netCommission}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                          ₹{totalPay.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700 font-mono">
                          ₹{advPay.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setViewingApp(app)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-blue-600 transition-all"
                              title="View Application Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingApp(app);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600 transition-all"
                              title="Edit Application"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDeletingApp(app);
                                setDeletePasscode("");
                              }}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-all"
                              title="Delete Application"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (activeSubModule === "licence") {
                    const ld = app.licenseDetails;
                    const clientDob = ld?.dateOfBirth || "—";
                    const acc = accountingMap.get(app.id) || accountingMap.get(app.applicationId);
                    const totalPay = acc?.totalPayment ?? app.amount ?? 0;
                    const advPay = acc?.advancePayment ?? app.totalPaid ?? 0;
                    const remPay = acc?.remainingPayment ?? (typeof app.pendingAmount === "number" ? app.pendingAmount : Math.max(0, totalPay - advPay));
                    const rawStatus = acc?.paymentStatus ?? app.paymentStatus ?? (remPay <= 0 ? "Paid" : advPay > 0 ? "Partially Paid" : "Pending");
                    const pStatus = rawStatus === "Partially Paid" ? "Partial" : rawStatus;
                    const refCode = app.applicationId || (app as any).reference || "—";

                    // Compute dynamic services list & exps
                    const allUniqueServices = Array.from(
                      new Set(
                        filteredApps.flatMap((a) => {
                          const services: string[] = a.services || [];
                          if (services.length > 0) return services;
                          const licServices: string[] = [];
                          const l = a.licenseDetails;
                          if (l?.newLearningLicence?.enabled) licServices.push("New Learning Licence");
                          if (l?.dlNewLlEndorsement?.enabled) licServices.push("DL New LL Endorsement");
                          if (l?.llRenewClass?.enabled) licServices.push("LL Renew Class");
                          if (l?.dlRenewRetest?.enabled) licServices.push("DL Renew / Retest");
                          if (l?.generalLicenceServices?.selectedServices) {
                            licServices.push(...l.generalLicenceServices.selectedServices);
                          }
                          return licServices.length > 0 ? licServices : ["License Service"];
                        })
                      )
                    );

                    const getExpiryForService = (srvName: string) => {
                      if (!ld) return app.expiryDate || "—";
                      if (srvName.includes("Learning") || srvName.includes("New Learning")) {
                        return ld.newLearningLicence?.step1?.expiryDate || ld.newLearningLicence?.appointmentDate || app.expiryDate || "—";
                      }
                      if (srvName.includes("Endorsement")) {
                        return ld.dlNewLlEndorsement?.step2?.expiryDate || ld.dlNewLlEndorsement?.step3?.validityDate || app.expiryDate || "—";
                      }
                      if (srvName.includes("Renew")) {
                        return ld.llRenewClass?.step1?.expiryDate || ld.llRenewClass?.step3?.validityDate || app.expiryDate || "—";
                      }
                      return app.expiryDate || "—";
                    };

                    return (
                      <tr
                        key={app.id}
                        onClick={() => setViewingApp(app)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{index + 1}</td>
                        <td className="py-3.5 px-4 font-bold text-blue-900">{app.ownerName}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{clientDob}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">{app.mobileNumber}</td>
                        {allUniqueServices.map((srvName) => (
                          <td key={srvName} className="py-3.5 px-4 font-mono text-slate-600">
                            {getExpiryForService(srvName)}
                          </td>
                        ))}
                        <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                          ₹{totalPay.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700 font-mono">
                          ₹{advPay.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-amber-700 font-mono">
                          ₹{remPay.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              pStatus === "Paid" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                              pStatus === "Pending" && "bg-amber-50 text-amber-700 border border-amber-200",
                              pStatus === "Partial" && "bg-blue-50 text-blue-700 border border-blue-200"
                            )}
                          >
                            {pStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700 font-semibold">{refCode}</td>
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setViewingApp(app)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-blue-600 transition-all"
                              title="View Application Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingApp(app);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600 transition-all"
                              title="Edit Application"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDeletingApp(app);
                                setDeletePasscode("");
                              }}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-all"
                              title="Delete Application"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const appRaw = app as any;
                  const v = appRaw.vehicleDetails || appRaw.vehicleMaster || appRaw || {};
                  const acc = accountingMap.get(app.id) || accountingMap.get(app.applicationId);
                  const regTotalPay = acc?.totalCharges ?? acc?.totalPayment ?? app.amount ?? 0;
                  const regAdvPay = acc?.advancePaid ?? acc?.advancePayment ?? app.totalPaid ?? 0;

                  const srvs = app.services || [];
                  const ownerName = app.ownerName || appRaw.clientName || v.ownerName || "—";
                  const phoneNo = app.mobileNumber || appRaw.phone || appRaw.phoneNo || v.phone || v.mobileNumber || "—";
                  const makerName = v.makerName || appRaw.makerName || "—";
                  const modelName = v.modelName || appRaw.modelName || "—";

                  const pucExp = appRaw.pucExpiryDate || v.pucExpiryDate || v.pucDetails?.expiryDate || "—";
                  const taxExp = appRaw.taxExpiryDate || v.taxExpiryDate || v.taxDetails?.expiryDate || "—";
                  const fitExp = appRaw.fitnessExpiryDate || v.fitnessExpiryDate || v.fitnessDetails?.expiryDate || "—";
                  const insExp = appRaw.insuranceExpiryDate || v.insuranceExpiryDate || v.insuranceDetails?.expiryDate || "—";
                  const natPermitExp = appRaw.nationalPermitExpiryDate || v.nationalPermitExpiryDate || v.permitDetails?.nationalPermitExpiryDate || "—";
                  const gujPermitExp = appRaw.gujaratPermitExpiryDate || v.gujaratPermitExpiryDate || v.permitDetails?.gujaratPermitExpiryDate || "—";
                  const npAuthExp = appRaw.npAuthExpiryDate || v.npAuthExpiryDate || v.permitDetails?.nationalAuthExpiryDate || "—";
                  const regValidity = appRaw.registrationRenewalExpiryDate || v.registrationRenewalExpiryDate || v.registrationDetails?.registrationValidity || "—";

                  return (
                    <tr
                      key={app.id}
                      onClick={() => setViewingApp(app)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{index + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                        {app.vehicleNumber}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {ownerName}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {phoneNo}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {makerName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {modelName}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{pucExp}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{taxExp}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{fitExp}</td>
                      {activeSubModule !== "services" && <td className="py-3.5 px-4 font-mono text-slate-600">{insExp}</td>}
                      <td className="py-3.5 px-4 font-mono text-slate-600">{natPermitExp}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{gujPermitExp}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{npAuthExp}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{regValidity}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        {srvs.length}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                        ₹{regTotalPay.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700 font-mono">
                        ₹{regAdvPay.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingApp(app)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-blue-600 transition-all"
                            title="View Application Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingApp(app);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600 transition-all"
                            title="Edit Application"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeletingApp(app);
                              setDeletePasscode("");
                            }}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-all"
                            title="Delete Application"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Delete Passcode Confirmation Dialog */}
      {deletingApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">Delete Application</h3>
              <button
                onClick={() => setDeletingApp(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to delete application for vehicle{" "}
              <strong className="text-slate-900 font-mono">{deletingApp.vehicleNumber}</strong>?
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Enter Passcode to Confirm</label>
              <input
                type="password"
                placeholder="Passcode (Default: 1234)"
                value={deletePasscode}
                onChange={(e) => setDeletePasscode(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingApp(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow transition disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Application"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Application Modal */}
      {isModalOpen && (
        <ApplicationFormModal
          initialSubModule={activeSubModule}
          editingApp={editingApp}
          applications={applications}
          onClose={() => {
            setIsModalOpen(false);
            setEditingApp(null);
          }}
        />
      )}

      {/* View Application Details Popup Modal */}
      {viewingApp && <ApplicationDetailsModal app={viewingApp} onClose={() => setViewingApp(null)} />}
    </div>
  );
}

function InlineDocUpload({
  label,
  docName,
  uploadedDocs,
  setUploadedDocs,
  setPreviewDoc,
}: {
  label: string;
  docName: string;
  uploadedDocs: Record<string, string>;
  setUploadedDocs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPreviewDoc: (doc: { name: string; url: string } | null) => void;
}) {
  const docUrl = uploadedDocs[docName];
  const isUploaded = !!docUrl;

  const printDoc = (url: string, name: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print ${name}</title>
          <style>
            body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
            img, iframe { max-width: 100%; max-height: 100%; object-fit: contain; }
          </style>
        </head>
        <body>
    `);
    if (url.startsWith("data:application/pdf")) {
      printWindow.document.write(`<iframe src="${url}" width="100%" height="100%" style="border: none;"></iframe>`);
    } else {
      printWindow.document.write(`<img src="${url}" onload="window.print(); window.close();" />`);
    }
    printWindow.document.write(`
        </body>
      </html>
    `);
    printWindow.document.close();
    if (url.startsWith("data:application/pdf")) {
      setTimeout(() => {
        printWindow.print();
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col gap-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2 mt-1">
        {isUploaded ? (
          <div className="flex items-center justify-between w-full bg-emerald-50/60 border border-emerald-200 p-1.5 rounded-lg">
            <span className="text-xs font-semibold text-emerald-800 truncate max-w-[120px]">{docName}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewDoc({ name: docName, url: docUrl })}
                className="text-[9px] font-bold text-blue-600 hover:bg-blue-100/50 px-1.5 py-0.5 rounded transition"
              >
                View
              </button>
              <button
                type="button"
                onClick={() => printDoc(docUrl, docName)}
                className="text-[9px] font-bold text-emerald-600 hover:bg-emerald-100/50 px-1.5 py-0.5 rounded transition"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadedDocs((prev) => {
                    const next = { ...prev };
                    delete next[docName];
                    return next;
                  });
                }}
                className="text-[9px] font-bold text-rose-600 hover:bg-rose-100/50 px-1.5 py-0.5 rounded transition"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-1.5 w-full border border-dashed border-slate-300 hover:border-blue-400 p-1.5 rounded-lg cursor-pointer transition hover:bg-white text-slate-600">
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 15 * 1024 * 1024) {
                  toast.error("File size must be under 15MB");
                  return;
                }
                const reader = new FileReader();
                reader.onload = (evt) => {
                  const result = evt.target?.result as string;
                  setUploadedDocs((prev) => ({ ...prev, [docName]: result }));
                  toast.success(`${docName} uploaded!`);
                };
                reader.readAsDataURL(file);
              }}
            />
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold">Upload Document</span>
          </label>
        )}
      </div>
    </div>
  );
}

function ApplicationFormModal({
  initialSubModule = "services",
  editingApp,
  applications = [],
  onClose,
}: {
  initialSubModule?: SubModuleType;
  editingApp?: ApplicationRecord | null;
  applications?: ApplicationRecord[];
  onClose: () => void;
}) {
  const [activeSubModule, setActiveSubModule] = useState<SubModuleType>(
    editingApp?.subModule || initialSubModule
  );

  const gstPercentage = getInsuranceGstPercentage();
  const [showLicenseDocsSection, setShowLicenseDocsSection] = useState(true);

  // Driving School State
  const [courseTypes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("driving_school_course_types");
      return saved ? JSON.parse(saved) : ["15 Days", "21 Days", "26 Days", "45 Days", "60 Days"];
    } catch {
      return ["15 Days", "21 Days", "26 Days", "45 Days", "60 Days"];
    }
  });
  const [dsGender, setDsGender] = useState<"Male" | "Female" | "Other">((editingApp as any)?.gender || "Male");
  const [dsHasDrivingLicence, setDsHasDrivingLicence] = useState<boolean>((editingApp as any)?.hasDrivingLicence || false);
  const [dsDlNumber, setDsDlNumber] = useState<string>((editingApp as any)?.drivingLicenceNumber || "");
  const [dsBloodGroup, setDsBloodGroup] = useState<string>((editingApp as any)?.bloodGroup || "");
  const [dsJoiningDate, setDsJoiningDate] = useState<string>((editingApp as any)?.joiningDate || new Date().toISOString().split("T")[0]);
  const [dsCourseStartDate, setDsCourseStartDate] = useState<string>((editingApp as any)?.courseStartDate || new Date().toISOString().split("T")[0]);
  const [dsCourseEndDate, setDsCourseEndDate] = useState<string>(
    (editingApp as any)?.courseEndDate || new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0]
  );
  const [dsCourseType, setDsCourseType] = useState<string>((editingApp as any)?.courseType || courseTypes[0] || "15 Days");
  const [dsTotalCourseFees, setDsTotalCourseFees] = useState<number | string>((editingApp as any)?.totalCourseFees || 9500);
  const [dsAdvancePaid, setDsAdvancePaid] = useState<number | string>((editingApp as any)?.advancePaid || 4000);

  // License Applicant Details
  const [dateOfBirth, setDateOfBirth] = useState(editingApp?.licenseDetails?.dateOfBirth || "");
  const [isDrivingSchoolHolder, setIsDrivingSchoolHolder] = useState(
    editingApp?.licenseDetails?.isDrivingSchoolHolder ?? true
  );
  const [groupOptions, setGroupOptions] = useState<string[]>(["Select group", "Self", "Company Fleet"]);
  const [showAddGroupInput, setShowAddGroupInput] = useState(false);
  const [suggestedClasses, setSuggestedClasses] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("custom_vehicle_classes");
      return saved ? JSON.parse(saved) : ["MCWG", "LMV", "TRANS", "MCWOG", "3W-DET", "HGMV", "HPMV"];
    } catch (e) {
      return ["MCWG", "LMV", "TRANS", "MCWOG", "3W-DET", "HGMV", "HPMV"];
    }
  });
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [customClassInput, setCustomClassInput] = useState("");
  const [showLlRenewS1Dropdown, setShowLlRenewS1Dropdown] = useState(false);
  const [showLlRenewS2Dropdown, setShowLlRenewS2Dropdown] = useState(false);
  const [showLlRenewS3Dropdown, setShowLlRenewS3Dropdown] = useState(false);
  const [customClassInputS1, setCustomClassInputS1] = useState("");
  const [customClassInputS2, setCustomClassInputS2] = useState("");
  const [customClassInputS3, setCustomClassInputS3] = useState("");

  // License Services State
  const [newLL, setNewLL] = useState({
    enabled: editingApp?.licenseDetails?.newLearningLicence?.enabled ?? false,
    appointmentDate: editingApp?.licenseDetails?.newLearningLicence?.appointmentDate || "",
    applicationNo: editingApp?.licenseDetails?.newLearningLicence?.applicationNo || "",
    classOfVehicle: editingApp?.licenseDetails?.newLearningLicence?.classOfVehicle || [],
    totalAmount: editingApp?.licenseDetails?.newLearningLicence?.totalAmount || "",
    advanceAmount: editingApp?.licenseDetails?.newLearningLicence?.advanceAmount || "",
    step1: {
      llNumber: editingApp?.licenseDetails?.newLearningLicence?.step1?.llNumber || "",
      issueDate: editingApp?.licenseDetails?.newLearningLicence?.step1?.issueDate || "",
      expiryDate: editingApp?.licenseDetails?.newLearningLicence?.step1?.expiryDate || "",
    },
    step2: {
      dlNumber: editingApp?.licenseDetails?.newLearningLicence?.step2?.dlNumber || "",
      issueDate: editingApp?.licenseDetails?.newLearningLicence?.step2?.issueDate || "",
      validityDate: editingApp?.licenseDetails?.newLearningLicence?.step2?.validityDate || "",
      vehicleTypes: editingApp?.licenseDetails?.newLearningLicence?.step2?.vehicleTypes || { nt: false, tr: false, hazardous: false },
      classOfVehicle: editingApp?.licenseDetails?.newLearningLicence?.step2?.classOfVehicle || [],
    },
  });

  const [dlEndorsement, setDlEndorsement] = useState({
    enabled: editingApp?.licenseDetails?.dlNewLlEndorsement?.enabled ?? false,
    applicationNo: editingApp?.licenseDetails?.dlNewLlEndorsement?.applicationNo || "",
    totalAmount: editingApp?.licenseDetails?.dlNewLlEndorsement?.totalAmount || "",
    advanceAmount: editingApp?.licenseDetails?.dlNewLlEndorsement?.advanceAmount || "",
    step1: {
      dlNumber: editingApp?.licenseDetails?.dlNewLlEndorsement?.step1?.dlNumber || "",
      issueDate: editingApp?.licenseDetails?.dlNewLlEndorsement?.step1?.issueDate || "",
      validityDate: editingApp?.licenseDetails?.dlNewLlEndorsement?.step1?.validityDate || "",
      vehicleTypes: editingApp?.licenseDetails?.dlNewLlEndorsement?.step1?.vehicleTypes || { nt: false, tr: false, hazardous: false },
      classOfVehicle: editingApp?.licenseDetails?.dlNewLlEndorsement?.step1?.classOfVehicle || "",
    },
    step2: {
      llNumber: editingApp?.licenseDetails?.dlNewLlEndorsement?.step2?.llNumber || "",
      issueDate: editingApp?.licenseDetails?.dlNewLlEndorsement?.step2?.issueDate || "",
      expiryDate: editingApp?.licenseDetails?.dlNewLlEndorsement?.step2?.expiryDate || "",
      classOfVehicle: editingApp?.licenseDetails?.dlNewLlEndorsement?.step2?.classOfVehicle || "",
    },
    step3: {
      dlNumber: editingApp?.licenseDetails?.dlNewLlEndorsement?.step3?.dlNumber || "",
      issueDate: editingApp?.licenseDetails?.dlNewLlEndorsement?.step3?.issueDate || "",
      validityDate: editingApp?.licenseDetails?.dlNewLlEndorsement?.step3?.validityDate || "",
      vehicleTypes: editingApp?.licenseDetails?.dlNewLlEndorsement?.step3?.vehicleTypes || { nt: false, tr: false, hazardous: false },
      classOfVehicle: editingApp?.licenseDetails?.dlNewLlEndorsement?.step3?.classOfVehicle || "",
    },
  });

  const [llRenew, setLlRenew] = useState({
    enabled: editingApp?.licenseDetails?.llRenewClass?.enabled ?? false,
    appointmentDate: editingApp?.licenseDetails?.llRenewClass?.appointmentDate || "",
    applicationNo: editingApp?.licenseDetails?.llRenewClass?.applicationNo || "",
    totalAmount: editingApp?.licenseDetails?.llRenewClass?.totalAmount || "",
    advanceAmount: editingApp?.licenseDetails?.llRenewClass?.advanceAmount || "",
    step1: { llNumber: editingApp?.licenseDetails?.llRenewClass?.step1?.llNumber || "", issueDate: editingApp?.licenseDetails?.llRenewClass?.step1?.issueDate || "", expiryDate: editingApp?.licenseDetails?.llRenewClass?.step1?.expiryDate || "", classOfVehicle: editingApp?.licenseDetails?.llRenewClass?.step1?.classOfVehicle || [] },
    step2: { dlNumber: editingApp?.licenseDetails?.llRenewClass?.step2?.dlNumber || "", issueDate: editingApp?.licenseDetails?.llRenewClass?.step2?.issueDate || "", validityDate: editingApp?.licenseDetails?.llRenewClass?.step2?.validityDate || "", classOfVehicle: editingApp?.licenseDetails?.llRenewClass?.step2?.classOfVehicle || [] },
    step3: { dlNumber: editingApp?.licenseDetails?.llRenewClass?.step3?.dlNumber || "", issueDate: editingApp?.licenseDetails?.llRenewClass?.step3?.issueDate || "", validityDate: editingApp?.licenseDetails?.llRenewClass?.step3?.validityDate || "", classOfVehicle: editingApp?.licenseDetails?.llRenewClass?.step3?.classOfVehicle || [] },
  });

  const [dlRenewRetest, setDlRenewRetest] = useState({
    enabled: editingApp?.licenseDetails?.dlRenewRetest?.enabled ?? false,
    applicationNo: editingApp?.licenseDetails?.dlRenewRetest?.applicationNo || "",
    totalAmount: editingApp?.licenseDetails?.dlRenewRetest?.totalAmount || "",
    advanceAmount: editingApp?.licenseDetails?.dlRenewRetest?.advanceAmount || "",
    step1: { dlNumber: editingApp?.licenseDetails?.dlRenewRetest?.step1?.dlNumber || "", issueDate: editingApp?.licenseDetails?.dlRenewRetest?.step1?.issueDate || "", validityDate: editingApp?.licenseDetails?.dlRenewRetest?.step1?.validityDate || "", appNo1: editingApp?.licenseDetails?.dlRenewRetest?.step1?.appNo1 || "" },
    step2: { llNumber: editingApp?.licenseDetails?.dlRenewRetest?.step2?.llNumber || "", issueDate: editingApp?.licenseDetails?.dlRenewRetest?.step2?.issueDate || "", expiryDate: editingApp?.licenseDetails?.dlRenewRetest?.step2?.expiryDate || "", appNo2: editingApp?.licenseDetails?.dlRenewRetest?.step2?.appNo2 || "" },
    step3: { dlNumber: editingApp?.licenseDetails?.dlRenewRetest?.step3?.dlNumber || "", issueDate: editingApp?.licenseDetails?.dlRenewRetest?.step3?.issueDate || "", validityDate: editingApp?.licenseDetails?.dlRenewRetest?.step3?.validityDate || "", appNo1: editingApp?.licenseDetails?.dlRenewRetest?.step3?.appNo1 || "" },
  });

  const [generalLicServices, setGeneralLicServices] = useState<{
    selected: string[];
    accounting: Record<string, { totalAmount: string | number; advanceAmount: string | number }>;
  }>({
    selected: editingApp?.licenseDetails?.generalLicenceServices?.selectedServices || [],
    accounting: editingApp?.licenseDetails?.generalLicenceServices?.serviceAccounting || {},
  });

  const [form5Details, setForm5Details] = useState<Form5DetailsData>({
    form5Type: editingApp?.form5Details?.form5Type || "",
    name: editingApp?.form5Details?.name || editingApp?.ownerName || "",
    dlNumber: editingApp?.form5Details?.dlNumber || "",
    applicationNo: editingApp?.form5Details?.applicationNo || "",
    dateOfBirth: editingApp?.form5Details?.dateOfBirth || editingApp?.licenseDetails?.dateOfBirth || "",
    llNumber: editingApp?.form5Details?.llNumber || "",
    llIssueDate: editingApp?.form5Details?.llIssueDate || "",
    llExpiryDate: editingApp?.form5Details?.llExpiryDate || "",
    ntValidityDate: editingApp?.form5Details?.ntValidityDate || "",
    trValidityDate: editingApp?.form5Details?.trValidityDate || "",
    aadhaarNumber: editingApp?.form5Details?.aadhaarNumber || "",
  });

  const [saving, setSaving] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState(editingApp?.vehicleNumber || "");
  const [phone, setPhone] = useState(editingApp?.mobileNumber || editingApp?.vehicleDetails?.phone || "");
  const [ownerName, setOwnerName] = useState(editingApp?.ownerName || editingApp?.vehicleDetails?.ownerName || "");
  const [fatherHusbandName, setFatherHusbandName] = useState(editingApp?.vehicleDetails?.fatherHusbandName || "");
  const [coName, setCoName] = useState(editingApp?.vehicleDetails?.coName || "");
  const [groupName, setGroupName] = useState(editingApp?.vehicleDetails?.groupName || "");
  const [address, setAddress] = useState(editingApp?.vehicleDetails?.address || "");
  const [registrationDate, setRegistrationDate] = useState(editingApp?.vehicleDetails?.registrationDate || "");
  const [chassisNumber, setChassisNumber] = useState(editingApp?.vehicleDetails?.chassisNumber || "");
  const [engineNumber, setEngineNumber] = useState(editingApp?.vehicleDetails?.engineNumber || "");
  const [fuelType, setFuelType] = useState(editingApp?.vehicleDetails?.fuelType || "Petrol");
  const [vehicleClass, setVehicleClass] = useState(editingApp?.vehicleDetails?.vehicleClass || "LMV");
  const [makerName, setMakerName] = useState(editingApp?.vehicleDetails?.makerName || "");
  const [modelName, setModelName] = useState(editingApp?.vehicleDetails?.modelName || "");
  const [colour, setColour] = useState(editingApp?.vehicleDetails?.colour || "");
  const [bodyType, setBodyType] = useState(editingApp?.vehicleDetails?.bodyType || "");
  const [seatingCapacity, setSeatingCapacity] = useState<number>(editingApp?.vehicleDetails?.seatingCapacity || 5);
  const [grossWeight, setGrossWeight] = useState<number>(editingApp?.vehicleDetails?.grossWeight || 4990);
  const [unladenWeight, setUnladenWeight] = useState<number>(editingApp?.vehicleDetails?.unladenWeight || 1620);
  const [payload, setPayload] = useState<number>(editingApp?.vehicleDetails?.payload || 3370);
  const [horsePower, setHorsePower] = useState(editingApp?.vehicleDetails?.horsePower || "");
  const [cylinderCount, setCylinderCount] = useState<number>(editingApp?.vehicleDetails?.cylinderCount || 4);
  const [pucExpiryDate, setPucExpiryDate] = useState(editingApp?.vehicleDetails?.pucExpiryDate || "");

  // Tax Section
  const [isLumpsumTax, setIsLumpsumTax] = useState(editingApp?.vehicleDetails?.taxDetails?.isLumpsum || false);
  const [taxIssueDate, setTaxIssueDate] = useState(editingApp?.vehicleDetails?.taxDetails?.issueDate || "");
  const [taxExpiryDate, setTaxExpiryDate] = useState(editingApp?.vehicleDetails?.taxDetails?.expiryDate || "");
  const [taxAmount, setTaxAmount] = useState<number>(editingApp?.vehicleDetails?.taxDetails?.amount || 0);

  // Fitness Section
  const [fitnessIssueDate, setFitnessIssueDate] = useState(editingApp?.vehicleDetails?.fitnessDetails?.issueDate || "");
  const [fitnessExpiryDate, setFitnessExpiryDate] = useState(editingApp?.vehicleDetails?.fitnessDetails?.expiryDate || "");

  // Insurance Section
  const [insuranceCompany, setInsuranceCompany] = useState(editingApp?.vehicleDetails?.insuranceDetails?.company || "New India");
  const [insurancePolicyNo, setInsurancePolicyNo] = useState(editingApp?.vehicleDetails?.insuranceDetails?.policyNumber || "");
  const [insurancePolicyType, setInsurancePolicyType] = useState(editingApp?.vehicleDetails?.insuranceDetails?.policyType || "Third Party");
  const [insuranceIssueDate, setInsuranceIssueDate] = useState(editingApp?.vehicleDetails?.insuranceDetails?.issueDate || "");
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState(editingApp?.vehicleDetails?.insuranceDetails?.expiryDate || "");
  const [insuranceAmount, setInsuranceAmount] = useState<number>(editingApp?.vehicleDetails?.insuranceDetails?.amount || 0);
  const [insurancePlace, setInsurancePlace] = useState(editingApp?.vehicleDetails?.insuranceDetails?.insurancePlace || "");

  const [policySubCategory, setPolicySubCategory] = useState(editingApp?.vehicleDetails?.insuranceDetails?.policySubCategory || "Motor / Vehicle");
  const [insVehicleType, setInsVehicleType] = useState(editingApp?.vehicleDetails?.insuranceDetails?.vehicleType || "4 Wheel");
  const [agent, setAgent] = useState(editingApp?.vehicleDetails?.insuranceDetails?.agent || "");
  const [insuranceAgency, setInsuranceAgency] = useState(editingApp?.vehicleDetails?.insuranceDetails?.insuranceAgency || "");
  const [reference, setReference] = useState(editingApp?.vehicleDetails?.insuranceDetails?.reference || "");
  const [insFuelType, setInsFuelType] = useState(editingApp?.vehicleDetails?.insuranceDetails?.fuelType || "Petrol");
  const [insVehicleRegNumber, setInsVehicleRegNumber] = useState(editingApp?.vehicleDetails?.insuranceDetails?.vehicleRegistrationNumber || editingApp?.vehicleNumber || "");
  const [insVehicleModelDetails, setInsVehicleModelDetails] = useState(editingApp?.vehicleDetails?.insuranceDetails?.vehicleModelDetails || "");
  const [premiumExclGst, setPremiumExclGst] = useState<number>(editingApp?.vehicleDetails?.insuranceDetails?.premiumExclGst || 0);
  const [gstAmount, setGstAmount] = useState<number>(editingApp?.vehicleDetails?.insuranceDetails?.gstAmount || 0);
  const [totalPremium, setTotalPremium] = useState<number>(editingApp?.vehicleDetails?.insuranceDetails?.totalPremium || 0);
  const [insurerCommission, setInsurerCommission] = useState<number>(editingApp?.vehicleDetails?.insuranceDetails?.insurerCommission || 0);
  const [clientDiscount, setClientDiscount] = useState<number>(editingApp?.vehicleDetails?.insuranceDetails?.clientDiscount || 0);
  const [netCommission, setNetCommission] = useState<number>(editingApp?.vehicleDetails?.insuranceDetails?.netCommission || 0);
  const [insTotalFees, setInsTotalFees] = useState<number>(editingApp?.amount || (editingApp as any)?.serviceAccounting?.Insurance?.totalAmount || 0);
  const [insAdvancePayment, setInsAdvancePayment] = useState<number>(editingApp?.totalPaid || (editingApp as any)?.serviceAccounting?.Insurance?.advancePayment || 0);

  // Permit Section - 3 Fixed Permits
  const [gujaratPermitIssueDate, setGujaratPermitIssueDate] = useState(
    editingApp?.vehicleDetails?.permitDetails?.gujaratPermitIssueDate ||
      (editingApp?.vehicleDetails?.permitDetails?.permitType === "Gujarat Permit"
        ? editingApp?.vehicleDetails?.permitDetails?.issueDate
        : "") ||
      ""
  );
  const [gujaratPermitExpiryDate, setGujaratPermitExpiryDate] = useState(
    editingApp?.vehicleDetails?.permitDetails?.gujaratPermitExpiryDate ||
      (editingApp?.vehicleDetails?.permitDetails?.permitType === "Gujarat Permit"
        ? editingApp?.vehicleDetails?.permitDetails?.expiryDate
        : "") ||
      ""
  );

  const [nationalPermitIssueDate, setNationalPermitIssueDate] = useState(
    editingApp?.vehicleDetails?.permitDetails?.nationalPermitIssueDate ||
      ((editingApp?.vehicleDetails?.permitDetails?.permitType === "National Permit" || editingApp?.vehicleDetails?.permitDetails?.permitType === "National Permit(Gujrat Permit)")
        ? editingApp?.vehicleDetails?.permitDetails?.issueDate
        : "") ||
      ""
  );
  const [nationalPermitExpiryDate, setNationalPermitExpiryDate] = useState(
    editingApp?.vehicleDetails?.permitDetails?.nationalPermitExpiryDate ||
      ((editingApp?.vehicleDetails?.permitDetails?.permitType === "National Permit" || editingApp?.vehicleDetails?.permitDetails?.permitType === "National Permit(Gujrat Permit)")
        ? editingApp?.vehicleDetails?.permitDetails?.expiryDate
        : "") ||
      ""
  );

  const [nationalAuthIssueDate, setNationalAuthIssueDate] = useState(
    editingApp?.vehicleDetails?.permitDetails?.nationalAuthIssueDate ||
      (editingApp?.vehicleDetails?.permitDetails?.permitType === "National Permit Authorization"
        ? editingApp?.vehicleDetails?.permitDetails?.issueDate
        : "") ||
      ""
  );
  const [nationalAuthExpiryDate, setNationalAuthExpiryDate] = useState(
    editingApp?.vehicleDetails?.permitDetails?.nationalAuthExpiryDate ||
      (editingApp?.vehicleDetails?.permitDetails?.permitType === "National Permit Authorization"
        ? editingApp?.vehicleDetails?.permitDetails?.expiryDate
        : "") ||
      ""
  );

  // Registration Renewal Section
  const [dateOfRegistration, setDateOfRegistration] = useState(editingApp?.vehicleDetails?.registrationDetails?.dateOfRegistration || "");
  const [registrationValidity, setRegistrationValidity] = useState(editingApp?.vehicleDetails?.registrationDetails?.registrationValidity || "");

  // Services Selected
  const [selectedServices, setSelectedServices] = useState<string[]>(editingApp?.services || []);

  // Service Accounting Map (Service Name -> Total Amount & Advance Payment)
  const [serviceAccountingMap, setServiceAccountingMap] = useState<
    Record<string, { totalAmount: number; advancePayment: number }>
  >(() => {
    if (editingApp?.serviceAccounting) {
      const map: Record<string, { totalAmount: number; advancePayment: number }> = {};
      Object.entries(editingApp.serviceAccounting).forEach(([key, item]) => {
        map[key] = { totalAmount: item.totalAmount, advancePayment: item.advancePayment };
      });
      return map;
    }
    return {};
  });

  // Generate Invoice Checkbox
  const [shouldGenerateInvoice, setShouldGenerateInvoice] = useState(!editingApp);

  // Remarks / Internal Notes & Task Assignment
  const [employeeRemarks, setEmployeeRemarks] = useState(editingApp?.remarks || "");
  const [reminder, setReminder] = useState(editingApp?.reminder || "");
  const [dueDate, setDueDate] = useState(editingApp?.dueDate || "");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Urgent">(editingApp?.priority || "Low");
  const [createTaskAuto, setCreateTaskAuto] = useState(editingApp?.createTaskAuto ?? true);
  const [assignedEmployee, setAssignedEmployee] = useState(editingApp?.assignedEmployeeName || "");
  const [activeEmployees, setActiveEmployees] = useState<{ id: string; name: string }[]>([]);

  // Unique suggestions collected from existing application records
  const coNameSuggestions = useMemo(() => {
    return Array.from(new Set(
      applications
        .map((app) => app.vehicleDetails?.coName || "")
        .map((val) => val.trim())
        .filter((val) => val.length > 0)
    ));
  }, [applications]);

  const groupNameSuggestions = useMemo(() => {
    return Array.from(new Set(
      applications
        .map((app) => app.vehicleDetails?.groupName || app.groupName || "")
        .map((val) => val.trim())
        .filter((val) => val.length > 0)
    ));
  }, [applications]);

  const vehicleClassSuggestions = useMemo(() => {
    return Array.from(new Set(
      applications
        .map((app) => app.vehicleDetails?.vehicleClass || "")
        .map((val) => val.trim())
        .filter((val) => val.length > 0)
    ));
  }, [applications]);

  const makerNameSuggestions = useMemo(() => {
    return Array.from(new Set(
      applications
        .map((app) => app.vehicleDetails?.makerName || "")
        .map((val) => val.trim())
        .filter((val) => val.length > 0)
    ));
  }, [applications]);

  const modelNameSuggestions = useMemo(() => {
    return Array.from(new Set(
      applications
        .map((app) => app.vehicleDetails?.modelName || "")
        .map((val) => val.trim())
        .filter((val) => val.length > 0)
    ));
  }, [applications]);

  const colourSuggestions = useMemo(() => {
    return Array.from(new Set(
      applications
        .map((app) => app.vehicleDetails?.colour || "")
        .map((val) => val.trim())
        .filter((val) => val.length > 0)
    ));
  }, [applications]);

  const bodyTypeSuggestions = useMemo(() => {
    return Array.from(new Set(
      applications
        .map((app) => app.vehicleDetails?.bodyType || "")
        .map((val) => val.trim())
        .filter((val) => val.length > 0)
    ));
  }, [applications]);

  // Application Type State
  const [availableAppTypes, setAvailableAppTypes] = useState<string[]>(DEFAULT_APP_TYPES);
  const [appTypeSelect, setAppTypeSelect] = useState<string>(editingApp?.applicationType || "Home");
  const [isCustomAppType, setIsCustomAppType] = useState(false);
  const [customAppTypeInput, setCustomAppTypeInput] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("custom_application_types");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const combined = Array.from(new Set([...DEFAULT_APP_TYPES, ...parsed]));
          setAvailableAppTypes(combined);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (editingApp?.applicationType) {
      if (!DEFAULT_APP_TYPES.includes(editingApp.applicationType)) {
        setAvailableAppTypes((prev) => Array.from(new Set([...prev, editingApp.applicationType!])));
      }
      setAppTypeSelect(editingApp.applicationType);
    }
  }, [editingApp]);

  // Track Expiry Settings (Show on Dashboard Checkboxes, default true)
  const [trackPuc, setTrackPuc] = useState<boolean>(
    editingApp?.trackExpiry?.puc ?? editingApp?.vehicleDetails?.trackExpiry?.puc ?? true
  );
  const [trackTax, setTrackTax] = useState<boolean>(
    editingApp?.trackExpiry?.tax ?? editingApp?.vehicleDetails?.trackExpiry?.tax ?? true
  );
  const [trackInsurance, setTrackInsurance] = useState<boolean>(
    editingApp?.trackExpiry?.insurance ?? editingApp?.vehicleDetails?.trackExpiry?.insurance ?? true
  );
  const [trackPermit, setTrackPermit] = useState<boolean>(
    editingApp?.trackExpiry?.permit ?? editingApp?.vehicleDetails?.trackExpiry?.permit ?? true
  );
  const [trackFitness, setTrackFitness] = useState<boolean>(
    editingApp?.trackExpiry?.fitness ?? editingApp?.vehicleDetails?.trackExpiry?.fitness ?? true
  );

  const [showPucDetails, setShowPucDetails] = useState<boolean>(
    !!editingApp?.pucExpiryDate || !!editingApp?.vehicleDetails?.pucExpiryDate
  );
  const [showTaxDetails, setShowTaxDetails] = useState<boolean>(
    !!editingApp?.taxExpiryDate || !!editingApp?.vehicleDetails?.taxDetails?.expiryDate
  );
  const [showFitnessDetails, setShowFitnessDetails] = useState<boolean>(
    !!editingApp?.fitnessExpiryDate || !!editingApp?.vehicleDetails?.fitnessDetails?.expiryDate
  );
  const [showPermitDetails, setShowPermitDetails] = useState<boolean>(
    !!editingApp?.permitExpiryDate || !!editingApp?.vehicleDetails?.permitDetails?.expiryDate || !!editingApp?.vehicleDetails?.permitDetails?.gujaratPermitExpiryDate
  );
  const [showRegistrationDetails, setShowRegistrationDetails] = useState<boolean>(
    !!editingApp?.registrationRenewalExpiryDate || !!editingApp?.vehicleDetails?.registrationDetails?.registrationValidity
  );

  // Document Uploads State (Simulated upload status map for color backgrounds)
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>(editingApp?.vehicleDetails?.documents || {});
  const [previewDoc, setPreviewDoc] = useState<{ name: string; url: string } | null>(null);

  useEffect(() => {
    fetchAllUsers()
      .then((users) => {
        const active = users
          .filter((u) => u.status === "active" || u.isActive !== false)
          .map((u) => ({ id: u.uid || u.userId, name: u.fullName || u.username }));

        setActiveEmployees(active);
        if (active.length > 0 && !assignedEmployee) {
          setAssignedEmployee(active[0].name);
        }
      })
      .catch(() => {
        const fallbacks = [
          { id: "1", name: "Suresh Kumar" },
          { id: "2", name: "Anita Khan" },
          { id: "3", name: "Rahul Shah" },
          { id: "4", name: "Priya Verma" },
        ];
        setActiveEmployees(fallbacks);
        if (!assignedEmployee) {
          setAssignedEmployee(fallbacks[0].name);
        }
      });
  }, []);

  // Auto-Fill Vehicle Lookup
  const handleVehicleBlur = async () => {
    if (!vehicleNumber.trim()) return;
    const existing = await fetchVehicleByNumber(vehicleNumber);
    if (existing) {
      toast.success("Existing vehicle details auto-populated!");
      setPhone(existing.phone || "");
      setOwnerName(existing.ownerName || "");
      setFatherHusbandName(existing.fatherHusbandName || "");
      setCoName(existing.coName || "");
      setGroupName(existing.groupName || "");
      setAddress(existing.address || "");
      setRegistrationDate(existing.registrationDate || "");
      setChassisNumber(existing.chassisNumber || "");
      setEngineNumber(existing.engineNumber || "");
      setFuelType(existing.fuelType || "Petrol");
      setVehicleClass(existing.vehicleClass || "LMV");
      setMakerName(existing.makerName || "");
      setModelName(existing.modelName || "");
      setColour(existing.colour || "");
      setBodyType(existing.bodyType || "");
      setSeatingCapacity(existing.seatingCapacity || 5);
      setGrossWeight(existing.grossWeight || 0);
      setUnladenWeight(existing.unladenWeight || 0);
      setPayload(existing.payload || 0);
      setHorsePower(existing.horsePower || "");
      setCylinderCount(existing.cylinderCount || 4);
      setPucExpiryDate(existing.pucExpiryDate || "");

      if (existing.taxDetails) {
        setIsLumpsumTax(existing.taxDetails.isLumpsum || false);
        setTaxIssueDate(existing.taxDetails.issueDate || "");
        setTaxExpiryDate(existing.taxDetails.expiryDate || "");
        setTaxAmount(existing.taxDetails.amount || 0);
      }
      if (existing.fitnessDetails) {
        setFitnessIssueDate(existing.fitnessDetails.issueDate || "");
        setFitnessExpiryDate(existing.fitnessDetails.expiryDate || "");
      }
      if (existing.insuranceDetails) {
        setInsuranceCompany(existing.insuranceDetails.company || "New India");
        setInsurancePolicyNo(existing.insuranceDetails.policyNumber || "");
        setInsurancePolicyType(existing.insuranceDetails.policyType || "Third Party");
        setInsuranceIssueDate(existing.insuranceDetails.issueDate || "");
        setInsuranceExpiryDate(existing.insuranceDetails.expiryDate || "");
        setInsuranceAmount(existing.insuranceDetails.amount || 0);
        setInsurancePlace(existing.insuranceDetails.insurancePlace || "");
        setPolicySubCategory(existing.insuranceDetails.policySubCategory || "Motor / Vehicle");
        setInsVehicleType(existing.insuranceDetails.vehicleType || "4 Wheel");
        setAgent(existing.insuranceDetails.agent || "");
        setInsuranceAgency(existing.insuranceDetails.insuranceAgency || "");
        setReference(existing.insuranceDetails.reference || "");
        setInsFuelType(existing.insuranceDetails.fuelType || existing.fuelType || "Petrol");
        setInsVehicleRegNumber(existing.insuranceDetails.vehicleRegistrationNumber || existing.vehicleNumber || "");
        setInsVehicleModelDetails(existing.insuranceDetails.vehicleModelDetails || `${existing.makerName || ""} ${existing.modelName || ""}`.trim());
        setPremiumExclGst(existing.insuranceDetails.premiumExclGst || 0);
        setGstAmount(existing.insuranceDetails.gstAmount || 0);
        setTotalPremium(existing.insuranceDetails.totalPremium || 0);
        setInsurerCommission(existing.insuranceDetails.insurerCommission || 0);
        setClientDiscount(existing.insuranceDetails.clientDiscount || 0);
        setNetCommission(existing.insuranceDetails.netCommission || 0);
      }
      if (existing.permitDetails) {
        const p = existing.permitDetails;
        const gIss = p.gujaratPermitIssueDate || (p.permitType === "Gujarat Permit" ? p.issueDate : "") || "";
        const gExp = p.gujaratPermitExpiryDate || (p.permitType === "Gujarat Permit" ? p.expiryDate : "") || "";
        const nIss = p.nationalPermitIssueDate || (p.permitType === "National Permit" || p.permitType === "National Permit(Gujrat Permit)" ? p.issueDate : "") || "";
        const nExp = p.nationalPermitExpiryDate || (p.permitType === "National Permit" || p.permitType === "National Permit(Gujrat Permit)" ? p.expiryDate : "") || "";
        const naIss = p.nationalAuthIssueDate || (p.permitType === "National Permit Authorization" ? p.issueDate : "") || "";
        const naExp = p.nationalAuthExpiryDate || (p.permitType === "National Permit Authorization" ? p.expiryDate : "") || "";

        setGujaratPermitIssueDate(gIss);
        setGujaratPermitExpiryDate(gExp);
        setNationalPermitIssueDate(nIss);
        setNationalPermitExpiryDate(nExp);
        setNationalAuthIssueDate(naIss);
        setNationalAuthExpiryDate(naExp);
      }
      if (existing.registrationDetails) {
        setDateOfRegistration(existing.registrationDetails.dateOfRegistration || "");
        setRegistrationValidity(existing.registrationDetails.registrationValidity || "");
      }
      if (existing.documents) {
        setUploadedDocs(existing.documents);
      }
      if (existing.trackExpiry) {
        setTrackPuc(existing.trackExpiry.puc ?? true);
        setTrackTax(existing.trackExpiry.tax ?? true);
        setTrackInsurance(existing.trackExpiry.insurance ?? true);
        setTrackPermit(existing.trackExpiry.permit ?? true);
        setTrackFitness(existing.trackExpiry.fitness ?? true);
      }
    }
  };

  const handleGujaratIssueChange = (dateVal: string) => {
    setGujaratPermitIssueDate(dateVal);
    setGujaratPermitExpiryDate(computePermitExpiry("Gujarat Permit", dateVal));
  };

  const handleNationalIssueChange = (dateVal: string) => {
    setNationalPermitIssueDate(dateVal);
    setNationalPermitExpiryDate(computePermitExpiry("National Permit(Gujrat Permit)", dateVal));
  };

  const handleNationalAuthIssueChange = (dateVal: string) => {
    setNationalAuthIssueDate(dateVal);
    setNationalAuthExpiryDate(computePermitExpiry("National Permit Authorization", dateVal));
  };

  const toggleService = (srv: string) => {
    setSelectedServices((prev) => {
      if (prev.includes(srv)) {
        const next = prev.filter((s) => s !== srv);
        setServiceAccountingMap((oldMap) => {
          const newMap = { ...oldMap };
          delete newMap[srv];
          return newMap;
        });
        return next;
      } else {
        setServiceAccountingMap((oldMap) => ({
          ...oldMap,
          [srv]: { totalAmount: 0, advancePayment: 0 },
        }));
        return [...prev, srv];
      }
    });
  };

  const updateServiceAccounting = (
    srv: string,
    field: "totalAmount" | "advancePayment",
    val: number
  ) => {
    setServiceAccountingMap((prev) => ({
      ...prev,
      [srv]: {
        ...(prev[srv] || { totalAmount: 0, advancePayment: 0 }),
        [field]: val,
      },
    }));
  };

  // Calculate dynamic totals
  const overallTotals = useMemo(() => {
    let totalAmt = 0;
    let totalAdv = 0;

    if (activeSubModule === "insurance") {
      totalAmt = Number(insTotalFees) || 0;
      totalAdv = Number(insAdvancePayment) || 0;
    } else if (activeSubModule === "licence") {
      if (newLL.enabled) {
        totalAmt += Number(newLL.totalAmount) || 0;
        totalAdv += Number(newLL.advanceAmount) || 0;
      }
      if (dlEndorsement.enabled) {
        totalAmt += Number(dlEndorsement.totalAmount) || 0;
        totalAdv += Number(dlEndorsement.advanceAmount) || 0;
      }
      if (llRenew.enabled) {
        totalAmt += Number(llRenew.totalAmount) || 0;
        totalAdv += Number(llRenew.advanceAmount) || 0;
      }
      if (dlRenewRetest.enabled) {
        totalAmt += Number(dlRenewRetest.totalAmount) || 0;
        totalAdv += Number(dlRenewRetest.advanceAmount) || 0;
      }
      if (generalLicServices.accounting) {
        Object.values(generalLicServices.accounting).forEach((item: any) => {
          totalAmt += Number(item.totalAmount) || 0;
          totalAdv += Number(item.advanceAmount) || 0;
        });
      }
    } else if (activeSubModule === "form5") {
      totalAmt = 0;
      totalAdv = 0;
    } else {
      selectedServices.forEach((srv) => {
        const item = serviceAccountingMap[srv] || { totalAmount: 0, advancePayment: 0 };
        totalAmt += item.totalAmount;
        totalAdv += item.advancePayment;
      });
    }

    const pending = Math.max(0, totalAmt - totalAdv);
    let payStatus: "Paid" | "Pending" | "Partial" = "Pending";
    if (totalAmt > 0 && totalAdv >= totalAmt) payStatus = "Paid";
    else if (totalAdv > 0) payStatus = "Partial";

    return { totalAmt, totalAdv, pending, payStatus };
  }, [
    activeSubModule,
    newLL,
    dlEndorsement,
    llRenew,
    dlRenewRetest,
    generalLicServices,
    selectedServices,
    serviceAccountingMap,
    insTotalFees,
    insAdvancePayment,
  ]);

  const handleDocSimulateUpload = (docName: string) => {
    setUploadedDocs((prev) => ({
      ...prev,
      [docName]: `https://example.com/docs/${docName}.pdf`,
    }));
    toast.success(`${docName} uploaded!`);
  };

  const handleSave = async (status: "Draft" | "Submitted") => {
    if (activeSubModule === "driving_school") {
      if (!ownerName.trim()) {
        toast.error("Student Name is mandatory!");
        return;
      }
      if (!dateOfBirth.trim()) {
        toast.error("Date of Birth is mandatory!");
        return;
      }

      setSaving(true);
      try {
        const totFee = Number(dsTotalCourseFees) || 0;
        const advFee = Number(dsAdvancePaid) || 0;
        const remFee = Math.max(0, totFee - advFee);
        const pStatus: "Paid" | "Partial" | "Pending" =
          remFee <= 0 ? "Paid" : advFee > 0 ? "Partial" : "Pending";

        await saveDrivingSchoolApplication({
          studentName: ownerName.trim(),
          mobileNumber: phone.trim(),
          bloodGroup: dsBloodGroup,
          address: address.trim(),
          dateOfBirth,
          gender: dsGender,
          hasDrivingLicence: dsHasDrivingLicence,
          drivingLicenceNumber: dsHasDrivingLicence ? dsDlNumber.trim() : "",
          joiningDate: dsJoiningDate,
          courseStartDate: dsCourseStartDate,
          courseEndDate: dsCourseEndDate,
          courseType: dsCourseType,
          totalCourseFees: totFee,
          advancePaid: advFee,
          remainingFees: remFee,
          paymentStatus: pStatus,
          assignedEmployee,
          reminderDate: reminder,
          priority,
          employeeNotes: employeeRemarks,
          documents: uploadedDocs,
          vehicleNumber: vehicleNumber.trim() || undefined,
          status: "Active",
        }, editingApp?.id);

        toast.success("Driving School Application Created Successfully!");
        setSaving(false);
        onClose();
        return;
      } catch (err) {
        console.error("Error creating Driving School application:", err);
        toast.error("Failed to create Driving School application");
        setSaving(false);
        return;
      }
    }

    if (activeSubModule === "insurance") {
      if (!ownerName.trim() || !dateOfBirth.trim()) {
        toast.error("Name and Date of Birth are mandatory for Insurance Applications!");
        return;
      }
      if (!insTotalFees) {
        toast.error("Total Fees is required!");
        return;
      }
    } else if (activeSubModule === "form5") {
      if (!form5Details.name?.trim()) {
        toast.error("Name is mandatory for Form 5 Applications!");
        return;
      }
    } else if (activeSubModule === "licence") {
      if (!ownerName.trim() || !dateOfBirth.trim()) {
        toast.error("Name and Date of Birth are mandatory for License Applications!");
        return;
      }
    } else if (activeSubModule === "services") {
      if (!vehicleNumber.trim()) {
        toast.error("Vehicle Number is required!");
        return;
      }
      if (selectedServices.length === 0) {
        toast.error("Please select at least one service!");
        return;
      }
    }

    setSaving(true);

    const finalVehNo =
      activeSubModule === "insurance"
        ? (insVehicleRegNumber.trim() || `INS-${Date.now().toString().slice(-6)}`)
        : activeSubModule === "form5"
        ? `F5-${Date.now().toString().slice(-6)}`
        : (vehicleNumber.trim() || `LIC-${Date.now().toString().slice(-6)}`);
    const cleanVehNo = finalVehNo.toUpperCase().replace(/[\s-]/g, "");

    const vehicleDetails: VehicleMaster = {
      id: cleanVehNo,
      vehicleNumber: finalVehNo,
      phone,
      ownerName,
      fatherHusbandName,
      coName,
      groupName,
      address,
      registrationDate,
      chassisNumber,
      engineNumber,
      fuelType,
      vehicleClass,
      makerName,
      modelName,
      colour,
      bodyType,
      seatingCapacity,
      grossWeight,
      unladenWeight,
      payload,
      horsePower,
      cylinderCount,
      pucExpiryDate,
      taxDetails: {
        isLumpsum: isLumpsumTax,
        issueDate: taxIssueDate,
        expiryDate: taxExpiryDate,
        amount: taxAmount,
      },
      fitnessDetails: {
        issueDate: fitnessIssueDate,
        expiryDate: fitnessExpiryDate,
      },
      insuranceDetails: {
        company: insuranceCompany,
        policyNumber: insurancePolicyNo,
        policyType: insurancePolicyType,
        issueDate: insuranceIssueDate,
        expiryDate: insuranceExpiryDate,
        amount: totalPremium || insuranceAmount,
        insurancePlace,
        policySubCategory,
        vehicleType: insVehicleType,
        agent,
        insuranceAgency,
        reference,
        fuelType: insFuelType,
        vehicleRegistrationNumber: insVehicleRegNumber || vehicleNumber,
        vehicleModelDetails: insVehicleModelDetails || `${makerName || ""} ${modelName || ""}`.trim(),
        premiumExclGst,
        gstAmount,
        totalPremium,
        insurerCommission,
        clientDiscount,
        netCommission,
      },
      permitDetails: {
        permitType: "Fixed Permits",
        issueDate: gujaratPermitIssueDate || nationalPermitIssueDate || nationalAuthIssueDate || "",
        expiryDate: gujaratPermitExpiryDate || nationalPermitExpiryDate || nationalAuthExpiryDate || "",
        gujaratPermitIssueDate,
        gujaratPermitExpiryDate,
        nationalPermitIssueDate,
        nationalPermitExpiryDate,
        nationalAuthIssueDate,
        nationalAuthExpiryDate,
      },
      registrationDetails: {
        dateOfRegistration,
        registrationValidity,
      },
      documents: uploadedDocs,
    };

    // Format service accounting details map
    const serviceAccountingPayload: Record<string, ServiceAccountingItem> = {};
    if (activeSubModule === "insurance") {
      serviceAccountingPayload["Insurance"] = {
        serviceName: "Insurance",
        totalAmount: Number(insTotalFees) || 0,
        advancePayment: Number(insAdvancePayment) || 0,
        pendingAmount: Math.max(0, (Number(insTotalFees) || 0) - (Number(insAdvancePayment) || 0)),
      };
    } else {
      selectedServices.forEach((srv) => {
        const item = serviceAccountingMap[srv] || { totalAmount: 0, advancePayment: 0 };
        serviceAccountingPayload[srv] = {
          serviceName: srv,
          totalAmount: item.totalAmount,
          advancePayment: item.advancePayment,
          pendingAmount: Math.max(0, item.totalAmount - item.advancePayment),
        };
      });
    }

    let generatedInvoiceNumber = "";
    let generatedInvoiceId = "";

    const selectedLicServices: string[] = [];
    if (newLL.enabled) selectedLicServices.push("New Learning Licence");
    if (dlEndorsement.enabled) selectedLicServices.push("DL New LL Endorsement");
    if (llRenew.enabled) selectedLicServices.push("LL Renew Class");
    if (dlRenewRetest.enabled) selectedLicServices.push("DL Renew + Retest");
    if (generalLicServices.selected.length > 0) selectedLicServices.push(...generalLicServices.selected);

    const finalServicesList =
      activeSubModule === "licence"
        ? selectedLicServices
        : activeSubModule === "form5"
        ? [form5Details.form5Type === "new_hgv" ? "Form 5 New HGV" : "Form 5A Renew HGV"]
        : activeSubModule === "insurance"
        ? ["Insurance"]
        : selectedServices;

    // Connect to Accounting & Generate Invoice if selected
    if (shouldGenerateInvoice) {
      try {
        const session = getSession();
        const clientNameStr = ownerName || (name as any) || finalVehNo || "Client";
        const vehicleNumStr = finalVehNo || "";
        const invoiceItems = finalServicesList.map((srv) => {
          let srvTotal = 0;
          if (activeSubModule === "insurance" && srv === "Insurance") {
            srvTotal = insTotalFees;
          } else {
            const item = serviceAccountingMap[srv] || { totalAmount: 0, advancePayment: 0 };
            srvTotal = item.totalAmount;
          }
          return {
            serviceId: srv,
            serviceName: srv,
            vehicleNumber: vehicleNumStr,
            quantity: 1,
            unitPrice: srvTotal,
            amount: srvTotal,
            tax: 0,
            total: srvTotal,
          };
        });

        if (invoiceItems.length > 0) {
          const createdInv = await createInvoice(
            {
              id: vehicleNumStr.trim().toUpperCase().replace(/[\s-]/g, "") || "CLIENT",
              name: clientNameStr,
              mo: phone,
              application: address,
              mvNo: vehicleNumStr,
              work: finalServicesList.join(", "),
            } as any,
            invoiceItems,
            new Date().toISOString().split("T")[0],
            new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
            session?.name || "System"
          );

          generatedInvoiceNumber = createdInv.invoiceNumber;
          generatedInvoiceId = createdInv.id;
          toast.success(`Invoice ${generatedInvoiceNumber} generated & connected to Accounting!`);
        }
      } catch (invErr: any) {
        console.error("Invoice auto-generation error:", invErr);
      }
    }

    let finalAppType = appTypeSelect;
    if (isCustomAppType && customAppTypeInput.trim()) {
      finalAppType = customAppTypeInput.trim();
      try {
        const saved = localStorage.getItem("custom_application_types");
        const currentList: string[] = saved ? JSON.parse(saved) : [];
        const updatedList = Array.from(new Set([...currentList, finalAppType]));
        localStorage.setItem("custom_application_types", JSON.stringify(updatedList));
      } catch (e) {
        console.error(e);
      }
    }

    try {
      await saveApplicationAndVehicle(
        {
          subModule: activeSubModule,
          dateOfBirth: activeSubModule === "form5" ? form5Details.dateOfBirth : (activeSubModule === "licence" || activeSubModule === "insurance" ? dateOfBirth : undefined),
          licenseDetails: activeSubModule === "licence" ? {
            subModule: activeSubModule,
            dateOfBirth,
            isDrivingSchoolHolder,
            newLearningLicence: newLL,
            dlNewLlEndorsement: dlEndorsement,
            llRenewClass: llRenew,
            dlRenewRetest: dlRenewRetest,
            generalLicenceServices: {
              selectedServices: generalLicServices.selected,
              serviceAccounting: generalLicServices.accounting,
            },
          } : undefined,
          form5Details: activeSubModule === "form5" ? form5Details : undefined,
          vehicleId: finalVehNo.toUpperCase().replace(/[\s-]/g, ""),
          vehicleNumber: finalVehNo,
          ownerName: activeSubModule === "form5" ? (form5Details.name || "") : ownerName,
          mobileNumber: phone,
          services: finalServicesList,
          serviceAccounting: serviceAccountingPayload,
          assignedEmployeeName: assignedEmployee,
          applicationStatus: status,
          paymentStatus: overallTotals.payStatus,
          amount: overallTotals.totalAmt,
          totalPaid: overallTotals.totalAdv,
          pendingAmount: overallTotals.pending,
          invoiceId: generatedInvoiceId || undefined,
          invoiceNumber: generatedInvoiceNumber || undefined,
          remarks: employeeRemarks,
          dueDate,
          reminder,
          priority,
          createTaskAuto,
          documents: uploadedDocs,
          applicationType: finalAppType,
          trackExpiry: {
            puc: activeSubModule === "insurance" ? false : (showPucDetails && !!pucExpiryDate),
            tax: activeSubModule === "insurance" ? false : (showTaxDetails && (!!taxExpiryDate || taxAmount > 0)),
            insurance: activeSubModule === "insurance" ? true : false,
            permit: activeSubModule === "insurance" ? false : (showPermitDetails && (!!gujaratPermitIssueDate || !!nationalPermitIssueDate || !!nationalAuthIssueDate)),
            fitness: activeSubModule === "insurance" ? false : (showFitnessDetails && !!fitnessExpiryDate),
          },
          vehicleDetails: vehicleDetails as any,
        },
        editingApp?.id
      );

      toast.success(
        editingApp
          ? "Application Updated Successfully!"
          : "Application Created & Connected to Accounting!"
      );
      setSaving(false);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save application");
      setSaving(false);
    }
  };

  const documentItems = [
    "RC Book",
    "Tax Receipt",
    "Fitness",
    "Gujarat Permit",
    "National Permit(Gujrat Permit)",
    "National Permit Authorization",
    "PUC",
    "Insurance",
    "Owner Aadhaar",
    "Buyer Aadhaar",
    "Seller Aadhaar",
    "PAN Card",
    "Other Document 1",
    "Other Document 2",
    "Other Document 3",
  ];

  const licenseDocumentItems = [
    "Aadhaar Card",
    "Date Of Birth Certificate",
    "PAN Card",
    "School Leaving Certificate",
    "Passport",
    "Visa",
    "Air Ticket",
    "Marriage Certificate",
    "Ration Card",
    "Driving Licence",
    "Learning Licence",
    "Election Card",
    "Hazardous Card",
  ];

  const form5DocumentItems = [
    "Document 1",
    "Document 2",
    "Document 3",
    "Document 4",
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto flex justify-center p-4 sm:p-6">
      <div className="bg-slate-50 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 z-20">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingApp ? "Edit Application" : "New Application"}
            </h2>
            <p className="text-xs text-slate-500">Services workflow • All in one scroll</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave("Submitted")}
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all"
            >
              {saving ? "Saving..." : editingApp ? "Save Application" : "Create Application"}
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Sub Module Tabs Nav Pills */}
          <div>
            <SubModuleTabs activeTab={activeSubModule} onChange={setActiveSubModule} />
          </div>

          {/* LICENCE SUB MODULE FORM */}
          {activeSubModule === "licence" && (
            <div className="space-y-6">
              {/* Applicant Details Section */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Applicant Details</h3>
                    <p className="text-[11px] text-slate-400">Only Name and Date of Birth are mandatory.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">NAME *</label>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">DATE OF BIRTH *</label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">MOBILE NUMBER</label>
                    <input
                      type="text"
                      placeholder="+91 9XXXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">ADDRESS</label>
                    <input
                      type="text"
                      placeholder="House, street, city"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">C/O</label>
                    <input
                      type="text"
                      placeholder="Father / Husband name"
                      value={fatherHusbandName}
                      onChange={(e) => setFatherHusbandName(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  {/* GROUP NAME DROPDOWN WITH ADD NEW OPTION */}
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">GROUP NAME</label>
                    {!showAddGroupInput ? (
                      <div className="flex gap-2">
                        <select
                          value={groupName}
                          onChange={(e) => {
                            if (e.target.value === "ADD_NEW") {
                              setShowAddGroupInput(true);
                            } else {
                              setGroupName(e.target.value);
                            }
                          }}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                        >
                          {groupOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                          <option value="ADD_NEW">+ Add New Group...</option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter new group name"
                          value={newGroupInput}
                          onChange={(e) => setNewGroupInput(e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newGroupInput.trim()) {
                              const added = newGroupInput.trim();
                              setGroupOptions((prev) => [...prev, added]);
                              setGroupName(added);
                              setNewGroupInput("");
                              setShowAddGroupInput(false);
                              toast.success(`Group "${added}" added and selected!`);
                            }
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <input
                        type="checkbox"
                        checked={isDrivingSchoolHolder}
                        onChange={(e) => setIsDrivingSchoolHolder(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Driving School Holder</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Licence Services Accordions Section */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Licence Services</h3>
                  <p className="text-[11px] text-slate-400">Select a service to expand its form</p>
                </div>

                {/* 1. New Learning Licence Service */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                  <label className="flex items-center gap-3 p-4 bg-white cursor-pointer border-b border-slate-200/80 select-none">
                    <input
                      type="checkbox"
                      checked={newLL.enabled}
                      onChange={(e) => setNewLL((prev) => ({ ...prev, enabled: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-slate-900 text-xs">New Learning Licence</span>
                  </label>

                  {newLL.enabled && (
                    <div className="p-5 space-y-5 text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">APPLICATION NO.</label>
                          <input
                            type="text"
                            placeholder="Enter application number"
                            value={newLL.applicationNo}
                            onChange={(e) => setNewLL((prev) => ({ ...prev, applicationNo: e.target.value }))}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-mono"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">APPOINTMENT DATE</label>
                          <input
                            type="date"
                            value={newLL.appointmentDate}
                            onChange={(prev) => setNewLL((prevVal) => ({ ...prevVal, appointmentDate: prev.target.value }))}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                          />
                        </div>
                      </div>

                      {/* Step 1: Learning Licence Details */}
                      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 font-bold text-blue-900 text-xs">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                          <span>LEARNING LICENCE DETAILS</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="font-semibold text-slate-600 block mb-1">LL NUMBER</label>
                            <input
                              type="text"
                              placeholder="GJ0120260001234"
                              value={newLL.step1.llNumber}
                              onChange={(e) => setNewLL((prev) => ({ ...prev, step1: { ...prev.step1, llNumber: e.target.value } }))}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-600 block mb-1">ISSUE DATE</label>
                            <input
                              type="date"
                              value={newLL.step1.issueDate}
                              onChange={(e) => setNewLL((prev) => ({ ...prev, step1: { ...prev.step1, issueDate: e.target.value } }))}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-600 block mb-1">EXPIRY DATE</label>
                            <input
                              type="date"
                              value={newLL.step1.expiryDate}
                              onChange={(e) => setNewLL((prev) => ({ ...prev, step1: { ...prev.step1, expiryDate: e.target.value } }))}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                            />
                          </div>
                          <div className="relative">
                            <label className="font-semibold text-slate-700 block mb-1">CLASS OF VEHICLE (MULTIPLE SELECTION)</label>
                            <div 
                              className="min-h-[42px] p-1.5 bg-white border border-slate-200 rounded-xl flex flex-wrap gap-1.5 items-center cursor-pointer select-none text-xs"
                              onClick={() => setShowClassDropdown(!showClassDropdown)}
                            >
                              {newLL.classOfVehicle.length === 0 ? (
                                <span className="text-slate-400 pl-2 text-[11px]">Select Class of Vehicle...</span>
                              ) : (
                                newLL.classOfVehicle.map((val) => (
                                  <span 
                                    key={val} 
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-800 text-[10px] font-bold rounded-lg border border-blue-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = newLL.classOfVehicle.filter((v) => v !== val);
                                      setNewLL((prevVal) => {
                                        const updated = {
                                          ...prevVal,
                                          classOfVehicle: next,
                                          step2: {
                                            ...prevVal.step2,
                                            classOfVehicle: next,
                                          }
                                        };
                                        return updated;
                                      });
                                    }}
                                  >
                                    {val}
                                    <span className="text-blue-500 hover:text-blue-700 font-bold ml-0.5">×</span>
                                  </span>
                                ))
                              )}
                            </div>

                            {showClassDropdown && (
                              <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 space-y-2.5 max-h-[250px] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-1.5">
                                  {suggestedClasses.map((item) => {
                                    const isSelected = newLL.classOfVehicle.includes(item);
                                    return (
                                      <label 
                                        key={item} 
                                        className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer font-semibold text-[11px] transition-all select-none ${
                                          isSelected ? "bg-blue-50 border-blue-200 text-blue-900" : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-700"
                                        }`}
                                      >
                                        <input 
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            const next = e.target.checked 
                                              ? [...newLL.classOfVehicle, item]
                                              : newLL.classOfVehicle.filter((v) => v !== item);
                                            
                                            setNewLL((prevVal) => {
                                              const updated = {
                                                ...prevVal,
                                                classOfVehicle: next,
                                                step2: {
                                                  ...prevVal.step2,
                                                  classOfVehicle: next,
                                                }
                                              };
                                              return updated;
                                            });
                                          }}
                                          className="w-3.5 h-3.5 text-blue-600 rounded"
                                        />
                                        <span>{item}</span>
                                      </label>
                                    );
                                  })}
                                </div>

                                <div className="border-t pt-2 flex gap-2">
                                  <input 
                                    type="text"
                                    placeholder="Add custom class..."
                                    value={customClassInput}
                                    onChange={(e) => setCustomClassInput(e.target.value.toUpperCase())}
                                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const cleaned = customClassInput.trim();
                                      if (cleaned && !suggestedClasses.includes(cleaned)) {
                                        const nextSuggested = [...suggestedClasses, cleaned];
                                        setSuggestedClasses(nextSuggested);
                                        localStorage.setItem("custom_vehicle_classes", JSON.stringify(nextSuggested));
                                        
                                        const nextSelected = [...newLL.classOfVehicle, cleaned];
                                        setNewLL((prevVal) => ({
                                          ...prevVal,
                                          classOfVehicle: nextSelected,
                                          step2: {
                                            ...prevVal.step2,
                                            classOfVehicle: nextSelected,
                                          }
                                        }));
                                        setCustomClassInput("");
                                      }
                                    }}
                                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
                                  >
                                    + Add
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowClassDropdown(false);
                                    }}
                                    className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold whitespace-nowrap"
                                  >
                                    Close
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Driving Licence Details */}
                      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 font-bold text-blue-900 text-xs">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                          <span>DRIVING LICENCE DETAILS</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="font-semibold text-slate-600 block mb-1">DL NUMBER</label>
                            <input
                              type="text"
                              placeholder="GJ01 20260001234"
                              value={newLL.step2.dlNumber}
                              onChange={(e) => setNewLL((prev) => ({ ...prev, step2: { ...prev.step2, dlNumber: e.target.value } }))}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-600 block mb-1">ISSUE DATE</label>
                            <input
                              type="date"
                              value={newLL.step2.issueDate}
                              onChange={(e) => setNewLL((prev) => ({ ...prev, step2: { ...prev.step2, issueDate: e.target.value } }))}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-600 block mb-1">VALIDITY DATE</label>
                            <input
                              type="date"
                              value={newLL.step2.validityDate}
                              onChange={(e) => setNewLL((prev) => ({ ...prev, step2: { ...prev.step2, validityDate: e.target.value } }))}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-600 block mb-1">CLASS OF VEHICLE</label>
                            <input
                              type="text"
                              disabled
                              value={newLL.step2.classOfVehicle?.join(", ") || ""}
                              className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-semibold text-slate-500 cursor-not-allowed"
                              placeholder="Auto-taken from step 1"
                            />
                          </div>
                        </div>

                        {/* Vehicle Type Checkboxes & Validity Dates (NT, TR, Hazardous) */}
                        <div className="pt-2 space-y-3 border-t border-slate-100">
                          <label className="font-semibold text-slate-700 block mb-1">VEHICLE TYPE & VALIDITY DATES</label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                              { label: "NT Validity Date", key: "nt", stateKey: "ntValidity" },
                              { label: "TR Validity Date", key: "tr", stateKey: "trValidity" },
                              { label: "Hazardous Validity Date", key: "hazardous", stateKey: "hazardousValidity" },
                            ].map((vtItem) => {
                              const vtKey = vtItem.key as "nt" | "tr" | "hazardous";
                              const checked = !!newLL.step2.vehicleTypes?.[vtKey];
                              const validityVal = (newLL.step2 as any)[vtItem.stateKey] || "";

                              return (
                                <div key={vtItem.key} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 text-xs select-none">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) =>
                                        setNewLL((prev) => ({
                                          ...prev,
                                          step2: {
                                            ...prev.step2,
                                            vehicleTypes: { ...prev.step2.vehicleTypes, [vtKey]: e.target.checked },
                                          },
                                        }))
                                      }
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>{vtItem.key.toUpperCase()}</span>
                                  </label>

                                  {checked && (
                                    <div>
                                      <label className="text-[10px] font-semibold text-slate-500 block mb-1 uppercase">{vtItem.label}</label>
                                      <input
                                        type="date"
                                        value={validityVal}
                                        onChange={(e) =>
                                          setNewLL((prev) => ({
                                            ...prev,
                                            step2: {
                                              ...prev.step2,
                                              [vtItem.stateKey]: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Accounting Module for New Learning Licence */}
                      <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">TOTAL AMOUNT (₹)</label>
                          <input
                            type="number"
                            placeholder="Enter total amount"
                            value={newLL.totalAmount}
                            onChange={(e) => setNewLL((prev) => ({ ...prev, totalAmount: e.target.value }))}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">ADVANCE AMOUNT (₹)</label>
                          <input
                            type="number"
                            placeholder="Enter advance amount"
                            value={newLL.advanceAmount}
                            onChange={(e) => setNewLL((prev) => ({ ...prev, advanceAmount: e.target.value }))}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-emerald-700"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. DL New LL Endorsement Service (3 Steps) */}
                <div className="border border-blue-200/80 rounded-2xl overflow-hidden bg-blue-50/20">
                  <label className="flex items-center gap-3 p-4 bg-white cursor-pointer border-b border-slate-200/80 select-none">
                    <input
                      type="checkbox"
                      checked={dlEndorsement.enabled}
                      onChange={(e) => setDlEndorsement((prev) => ({ ...prev, enabled: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-slate-900 text-xs">DL New LL Endorsement</span>
                  </label>

                  {dlEndorsement.enabled && (
                    <div className="p-5 space-y-5 text-xs">
                      {/* General Application Number */}
                      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">APPLICATION NO.</label>
                            <input
                              type="text"
                              placeholder="Enter application number"
                              value={dlEndorsement.applicationNo}
                              onChange={(e) => setDlEndorsement((prev) => ({ ...prev, applicationNo: e.target.value }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Step 1: DL Details */}
                      <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 font-bold text-blue-900 text-xs">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
                          <span className="uppercase tracking-wider">DL DETAILS</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">DL NUMBER</label>
                            <input
                              type="text"
                              value={dlEndorsement.step1.dlNumber}
                              onChange={(e) => setDlEndorsement((prev) => ({ ...prev, step1: { ...prev.step1, dlNumber: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">ISSUE DATE</label>
                            <input
                              type="date"
                              value={dlEndorsement.step1.issueDate}
                              onChange={(e) => setDlEndorsement((prev) => ({ ...prev, step1: { ...prev.step1, issueDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">VALIDITY</label>
                            <input
                              type="date"
                              value={dlEndorsement.step1.validityDate}
                              onChange={(e) => setDlEndorsement((prev) => ({ ...prev, step1: { ...prev.step1, validityDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">CLASS OF VEHICLE</label>
                            <input
                              type="text"
                              placeholder="Select or enter vehicle class..."
                              value={dlEndorsement.step1.classOfVehicle || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDlEndorsement((prev) => {
                                  const s1 = val;
                                  const s2 = prev.step2.classOfVehicle || "";
                                  const combined = [s1, s2].map(s => s.trim()).filter(Boolean).join(", ");
                                  return {
                                    ...prev,
                                    step1: { ...prev.step1, classOfVehicle: s1 },
                                    step3: { ...prev.step3, classOfVehicle: combined }
                                  };
                                });
                              }}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                            />
                          </div>
                        </div>

                        {/* Vehicle Type Checkboxes */}
                        <div className="pt-2">
                          <label className="font-semibold text-slate-500 text-[11px] block mb-2 uppercase">VEHICLE TYPE</label>
                          <div className="flex gap-6">
                            {["NT", "TR", "Hazardous"].map((vt) => {
                              const k = vt.toLowerCase() as "nt" | "tr" | "hazardous";
                              const checked = !!(dlEndorsement.step1 as any)?.vehicleTypes?.[k];
                              return (
                                <label key={vt} className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 text-xs select-none">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) =>
                                      setDlEndorsement((prev) => ({
                                        ...prev,
                                        step1: {
                                          ...prev.step1,
                                          vehicleTypes: { ...(prev.step1 as any)?.vehicleTypes, [k]: e.target.checked },
                                        },
                                      }))
                                    }
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                  />
                                  <span>{vt}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Step 2: LL Details */}
                      <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 font-bold text-blue-900 text-xs">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
                          <span className="uppercase tracking-wider">LL DETAILS</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">LL NUMBER</label>
                            <input
                              type="text"
                              value={dlEndorsement.step2.llNumber}
                              onChange={(e) => setDlEndorsement((prev) => ({ ...prev, step2: { ...prev.step2, llNumber: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">ISSUE DATE</label>
                            <input
                              type="date"
                              value={dlEndorsement.step2.issueDate}
                              onChange={(e) => setDlEndorsement((prev) => ({ ...prev, step2: { ...prev.step2, issueDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">EXPIRY DATE</label>
                            <input
                              type="date"
                              value={dlEndorsement.step2.expiryDate}
                              onChange={(e) => setDlEndorsement((prev) => ({ ...prev, step2: { ...prev.step2, expiryDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">CLASS OF VEHICLE</label>
                            <input
                              type="text"
                              placeholder="Select or enter vehicle class..."
                              value={(dlEndorsement.step2 as any).classOfVehicle || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDlEndorsement((prev) => {
                                  const s1 = prev.step1.classOfVehicle || "";
                                  const s2 = val;
                                  const combined = [s1, s2].map(s => s.trim()).filter(Boolean).join(", ");
                                  return {
                                    ...prev,
                                    step2: { ...prev.step2, classOfVehicle: s2 },
                                    step3: { ...prev.step3, classOfVehicle: combined }
                                  };
                                });
                              }}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Step 3: DL Details */}
                      <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 font-bold text-blue-900 text-xs">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
                          <span className="uppercase tracking-wider">DL DETAILS</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">DL NUMBER</label>
                            <input
                              type="text"
                              value={dlEndorsement.step3.dlNumber}
                              onChange={(e) => setDlEndorsement((prev) => ({ ...prev, step3: { ...prev.step3, dlNumber: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">ISSUE DATE</label>
                            <input
                              type="date"
                              value={dlEndorsement.step3.issueDate}
                              onChange={(e) => setDlEndorsement((prev) => ({ ...prev, step3: { ...prev.step3, issueDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">VALIDITY</label>
                            <input
                              type="date"
                              value={dlEndorsement.step3.validityDate}
                              onChange={(e) => setDlEndorsement((prev) => ({ ...prev, step3: { ...prev.step3, validityDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-2 uppercase">VEHICLE TYPE</label>
                            <div className="flex gap-6">
                              {["NT", "TR", "Hazardous"].map((vt) => {
                                const k = vt.toLowerCase() as "nt" | "tr" | "hazardous";
                                const checked = !!(dlEndorsement.step3 as any)?.vehicleTypes?.[k];
                                return (
                                  <label key={vt} className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 text-xs select-none">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) =>
                                        setDlEndorsement((prev) => ({
                                          ...prev,
                                          step3: {
                                            ...prev.step3,
                                            vehicleTypes: { ...(prev.step3 as any)?.vehicleTypes, [k]: e.target.checked },
                                          },
                                        }))
                                      }
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>{vt}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">CLASS OF VEHICLE (COMBINED)</label>
                            <input
                              type="text"
                              disabled={true}
                              placeholder="Combined class of vehicle..."
                              value={(dlEndorsement.step3 as any).classOfVehicle || ""}
                              className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Accounting Module for DL New LL Endorsement */}
                      <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">TOTAL AMOUNT (₹)</label>
                          <input
                            type="number"
                            placeholder="Enter total amount"
                            value={dlEndorsement.totalAmount}
                            onChange={(e) => setDlEndorsement((prev) => ({ ...prev, totalAmount: e.target.value }))}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">ADVANCE AMOUNT (₹)</label>
                          <input
                            type="number"
                            placeholder="Enter advance amount"
                            value={dlEndorsement.advanceAmount}
                            onChange={(e) => setDlEndorsement((prev) => ({ ...prev, advanceAmount: e.target.value }))}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-emerald-700"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. LL Renew Class (3 Steps + Appointment Date + Class of Vehicle) */}
                <div className="border border-blue-200/80 rounded-2xl overflow-hidden bg-blue-50/20">
                  <label className="flex items-center gap-3 p-4 bg-white cursor-pointer border-b border-slate-200/80 select-none">
                    <input
                      type="checkbox"
                      checked={llRenew.enabled}
                      onChange={(e) => setLlRenew((prev) => ({ ...prev, enabled: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-slate-900 text-xs">LL Renew Class</span>
                  </label>

                  {llRenew.enabled && (
                    <div className="p-5 space-y-5 text-xs">
                      {/* General Application Number */}
                      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">APPLICATION NO.</label>
                            <input
                              type="text"
                              placeholder="Enter application number"
                              value={llRenew.applicationNo}
                              onChange={(e) => setLlRenew((prev) => ({ ...prev, applicationNo: e.target.value }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Step 1: LL DETAILS */}
                      <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 font-bold text-blue-900 text-xs">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
                          <span className="uppercase tracking-wider">LL DETAILS</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">LL NUMBER</label>
                            <input
                              type="text"
                              value={(llRenew as any).step1?.llNumber || ""}
                              onChange={(e) => setLlRenew((prev) => ({ ...prev, step1: { ...prev.step1, llNumber: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">ISSUE DATE</label>
                            <input
                              type="date"
                              value={(llRenew as any).step1?.issueDate || ""}
                              onChange={(e) => setLlRenew((prev) => ({ ...prev, step1: { ...prev.step1, issueDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">EXPIRY DATE</label>
                            <input
                              type="date"
                              value={(llRenew as any).step1?.expiryDate || ""}
                              onChange={(e) => setLlRenew((prev) => ({ ...prev, step1: { ...prev.step1, expiryDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div className="relative">
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">CLASS OF VEHICLE</label>
                            <div 
                              className="min-h-[42px] p-1.5 bg-white border border-slate-200 rounded-xl flex flex-wrap gap-1.5 items-center cursor-pointer select-none text-xs"
                              onClick={() => setShowLlRenewS1Dropdown(!showLlRenewS1Dropdown)}
                            >
                              {((llRenew as any).step1?.classOfVehicle || []).length === 0 ? (
                                <span className="text-slate-400 pl-2 text-[11px]">Select Class of Vehicle...</span>
                              ) : (
                                (llRenew.step1.classOfVehicle || []).map((val: string) => (
                                  <span 
                                    key={val} 
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-800 text-[10px] font-bold rounded-lg border border-blue-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = (llRenew.step1.classOfVehicle || []).filter((v: string) => v !== val);
                                      setLlRenew((prevVal) => ({
                                        ...prevVal,
                                        step1: { ...prevVal.step1, classOfVehicle: next }
                                      }));
                                    }}
                                  >
                                    {val}
                                    <span className="text-blue-500 hover:text-blue-700 font-bold ml-0.5">×</span>
                                  </span>
                                ))
                              )}
                            </div>

                            {showLlRenewS1Dropdown && (
                              <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 space-y-2.5 max-h-[250px] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-1.5">
                                  {suggestedClasses.map((item) => {
                                    const isSelected = ((llRenew as any).step1?.classOfVehicle || []).includes(item);
                                    return (
                                      <label 
                                        key={item} 
                                        className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer font-semibold text-[11px] transition-all select-none ${
                                          isSelected ? "bg-blue-50 border-blue-200 text-blue-900" : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-700"
                                        }`}
                                      >
                                        <input 
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            const next = e.target.checked 
                                              ? [...((llRenew as any).step1?.classOfVehicle || []), item]
                                              : ((llRenew as any).step1?.classOfVehicle || []).filter((v: string) => v !== item);
                                            
                                            setLlRenew((prevVal) => ({
                                              ...prevVal,
                                              step1: { ...prevVal.step1, classOfVehicle: next }
                                            }));
                                          }}
                                          className="w-3.5 h-3.5 text-blue-600 rounded"
                                        />
                                        <span>{item}</span>
                                      </label>
                                    );
                                  })}
                                </div>

                                <div className="border-t pt-2 flex gap-2">
                                  <input 
                                    type="text"
                                    placeholder="Add custom..."
                                    value={customClassInputS1}
                                    onChange={(e) => setCustomClassInputS1(e.target.value.toUpperCase())}
                                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const cleaned = customClassInputS1.trim();
                                      if (cleaned && !suggestedClasses.includes(cleaned)) {
                                        const nextSuggested = [...suggestedClasses, cleaned];
                                        setSuggestedClasses(nextSuggested);
                                        localStorage.setItem("custom_vehicle_classes", JSON.stringify(nextSuggested));
                                        
                                        const nextSelected = [...((llRenew as any).step1?.classOfVehicle || []), cleaned];
                                        setLlRenew((prevVal) => ({
                                          ...prevVal,
                                          step1: { ...prevVal.step1, classOfVehicle: nextSelected }
                                        }));
                                        setCustomClassInputS1("");
                                      }
                                    }}
                                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
                                  >
                                    + Add
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowLlRenewS1Dropdown(false);
                                    }}
                                    className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold whitespace-nowrap"
                                  >
                                    Close
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Step 2: NEW LL DETAILS */}
                      <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 font-bold text-blue-900 text-xs">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
                          <span className="uppercase tracking-wider">NEW LL DETAILS</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">LL NUMBER</label>
                            <input
                              type="text"
                              value={(llRenew as any).step2?.llNumber || ""}
                              onChange={(e) => setLlRenew((prev) => ({ ...prev, step2: { ...prev.step2, llNumber: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">ISSUE DATE</label>
                            <input
                              type="date"
                              value={(llRenew as any).step2?.issueDate || ""}
                              onChange={(e) => setLlRenew((prev) => ({ ...prev, step2: { ...prev.step2, issueDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">EXPIRY DATE</label>
                            <input
                              type="date"
                              value={(llRenew as any).step2?.expiryDate || ""}
                              onChange={(e) => setLlRenew((prev) => ({ ...prev, step2: { ...prev.step2, expiryDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div className="relative">
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">CLASS OF VEHICLE</label>
                            <div 
                              className="min-h-[42px] p-1.5 bg-white border border-slate-200 rounded-xl flex flex-wrap gap-1.5 items-center cursor-pointer select-none text-xs"
                              onClick={() => setShowLlRenewS2Dropdown(!showLlRenewS2Dropdown)}
                            >
                              {((llRenew as any).step2?.classOfVehicle || []).length === 0 ? (
                                <span className="text-slate-400 pl-2 text-[11px]">Select Class of Vehicle...</span>
                              ) : (
                                (llRenew.step2.classOfVehicle || []).map((val: string) => (
                                  <span 
                                    key={val} 
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-800 text-[10px] font-bold rounded-lg border border-blue-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = (llRenew.step2.classOfVehicle || []).filter((v: string) => v !== val);
                                      setLlRenew((prevVal) => ({
                                        ...prevVal,
                                        step2: { ...prevVal.step2, classOfVehicle: next }
                                      }));
                                    }}
                                  >
                                    {val}
                                    <span className="text-blue-500 hover:text-blue-700 font-bold ml-0.5">×</span>
                                  </span>
                                ))
                              )}
                            </div>

                            {showLlRenewS2Dropdown && (
                              <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 space-y-2.5 max-h-[250px] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-1.5">
                                  {suggestedClasses.map((item) => {
                                    const isSelected = ((llRenew as any).step2?.classOfVehicle || []).includes(item);
                                    return (
                                      <label 
                                        key={item} 
                                        className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer font-semibold text-[11px] transition-all select-none ${
                                          isSelected ? "bg-blue-50 border-blue-200 text-blue-900" : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-700"
                                        }`}
                                      >
                                        <input 
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            const next = e.target.checked 
                                              ? [...((llRenew as any).step2?.classOfVehicle || []), item]
                                              : ((llRenew as any).step2?.classOfVehicle || []).filter((v: string) => v !== item);
                                            
                                            setLlRenew((prevVal) => ({
                                              ...prevVal,
                                              step2: { ...prevVal.step2, classOfVehicle: next }
                                            }));
                                          }}
                                          className="w-3.5 h-3.5 text-blue-600 rounded"
                                        />
                                        <span>{item}</span>
                                      </label>
                                    );
                                  })}
                                </div>

                                <div className="border-t pt-2 flex gap-2">
                                  <input 
                                    type="text"
                                    placeholder="Add custom..."
                                    value={customClassInputS2}
                                    onChange={(e) => setCustomClassInputS2(e.target.value.toUpperCase())}
                                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const cleaned = customClassInputS2.trim();
                                      if (cleaned && !suggestedClasses.includes(cleaned)) {
                                        const nextSuggested = [...suggestedClasses, cleaned];
                                        setSuggestedClasses(nextSuggested);
                                        localStorage.setItem("custom_vehicle_classes", JSON.stringify(nextSuggested));
                                        
                                        const nextSelected = [...((llRenew as any).step2?.classOfVehicle || []), cleaned];
                                        setLlRenew((prevVal) => ({
                                          ...prevVal,
                                          step2: { ...prevVal.step2, classOfVehicle: nextSelected }
                                        }));
                                        setCustomClassInputS2("");
                                      }
                                    }}
                                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
                                  >
                                    + Add
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Step 3: DL DETAILS */}
                      <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 font-bold text-blue-900 text-xs">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
                          <span className="uppercase tracking-wider">DL DETAILS</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">DL NUMBER</label>
                            <input
                              type="text"
                              value={(llRenew as any).step3?.dlNumber || ""}
                              onChange={(e) => setLlRenew((prev) => ({ ...prev, step3: { ...prev.step3, dlNumber: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">ISSUE DATE</label>
                            <input
                              type="date"
                              value={(llRenew as any).step3?.issueDate || ""}
                              onChange={(e) => setLlRenew((prev) => ({ ...prev, step3: { ...prev.step3, issueDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">VALIDITY</label>
                            <input
                              type="date"
                              value={(llRenew as any).step3?.validityDate || ""}
                              onChange={(e) => setLlRenew((prev) => ({ ...prev, step3: { ...prev.step3, validityDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">APPOINTMENT DATE</label>
                            <input
                              type="date"
                              value={llRenew.appointmentDate}
                              onChange={(e) => setLlRenew((prev) => ({ ...prev, appointmentDate: e.target.value }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs"
                            />
                          </div>
                          <div className="relative">
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">CLASS OF VEHICLE</label>
                            <div 
                              className="min-h-[42px] p-1.5 bg-white border border-slate-200 rounded-xl flex flex-wrap gap-1.5 items-center cursor-pointer select-none text-xs"
                              onClick={() => setShowLlRenewS3Dropdown(!showLlRenewS3Dropdown)}
                            >
                              {((llRenew as any).step3?.classOfVehicle || []).length === 0 ? (
                                <span className="text-slate-400 pl-2 text-[11px]">Select Class of Vehicle...</span>
                              ) : (
                                (llRenew.step3.classOfVehicle || []).map((val: string) => (
                                  <span 
                                    key={val} 
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-800 text-[10px] font-bold rounded-lg border border-blue-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = (llRenew.step3.classOfVehicle || []).filter((v: string) => v !== val);
                                      setLlRenew((prevVal) => ({
                                        ...prevVal,
                                        step3: { ...prevVal.step3, classOfVehicle: next }
                                      }));
                                    }}
                                  >
                                    {val}
                                    <span className="text-blue-500 hover:text-blue-700 font-bold ml-0.5">×</span>
                                  </span>
                                ))
                              )}
                            </div>

                            {showLlRenewS3Dropdown && (
                              <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 space-y-2.5 max-h-[250px] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-1.5">
                                  {suggestedClasses.map((item) => {
                                    const isSelected = ((llRenew as any).step3?.classOfVehicle || []).includes(item);
                                    return (
                                      <label 
                                        key={item} 
                                        className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer font-semibold text-[11px] transition-all select-none ${
                                          isSelected ? "bg-blue-50 border-blue-200 text-blue-900" : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-700"
                                        }`}
                                      >
                                        <input 
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            const next = e.target.checked 
                                              ? [...((llRenew as any).step3?.classOfVehicle || []), item]
                                              : ((llRenew as any).step3?.classOfVehicle || []).filter((v: string) => v !== item);
                                            
                                            setLlRenew((prevVal) => ({
                                              ...prevVal,
                                              step3: { ...prevVal.step3, classOfVehicle: next }
                                            }));
                                          }}
                                          className="w-3.5 h-3.5 text-blue-600 rounded"
                                        />
                                        <span>{item}</span>
                                      </label>
                                    );
                                  })}
                                </div>

                                <div className="border-t pt-2 flex gap-2">
                                  <input 
                                    type="text"
                                    placeholder="Add custom..."
                                    value={customClassInputS3}
                                    onChange={(e) => setCustomClassInputS3(e.target.value.toUpperCase())}
                                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const cleaned = customClassInputS3.trim();
                                      if (cleaned && !suggestedClasses.includes(cleaned)) {
                                        const nextSuggested = [...suggestedClasses, cleaned];
                                        setSuggestedClasses(nextSuggested);
                                        localStorage.setItem("custom_vehicle_classes", JSON.stringify(nextSuggested));
                                        
                                        const nextSelected = [...((llRenew as any).step3?.classOfVehicle || []), cleaned];
                                        setLlRenew((prevVal) => ({
                                          ...prevVal,
                                          step3: { ...prevVal.step3, classOfVehicle: nextSelected }
                                        }));
                                        setCustomClassInputS3("");
                                      }
                                    }}
                                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
                                  >
                                    + Add
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Accounting Module for LL Renew Class */}
                      <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">TOTAL AMOUNT (₹)</label>
                          <input
                            type="number"
                            placeholder="Enter total amount"
                            value={llRenew.totalAmount}
                            onChange={(e) => setLlRenew((prev) => ({ ...prev, totalAmount: e.target.value }))}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">ADVANCE AMOUNT (₹)</label>
                          <input
                            type="number"
                            placeholder="Enter advance amount"
                            value={llRenew.advanceAmount}
                            onChange={(e) => setLlRenew((prev) => ({ ...prev, advanceAmount: e.target.value }))}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-emerald-700"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. DL Renew + Retest (3 Steps + Application Numbers) */}
                <div className="border border-blue-200/80 rounded-2xl overflow-hidden bg-blue-50/20">
                  <label className="flex items-center gap-3 p-4 bg-white cursor-pointer border-b border-slate-200/80 select-none">
                    <input
                      type="checkbox"
                      checked={dlRenewRetest.enabled}
                      onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, enabled: e.target.checked }))}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-slate-900 text-xs">DL Renew + Retest</span>
                  </label>

                  {dlRenewRetest.enabled && (
                    <div className="p-5 space-y-5 text-xs">
                      {/* General Application Number */}
                      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">APPLICATION NO.</label>
                            <input
                              type="text"
                              placeholder="Enter application number"
                              value={dlRenewRetest.applicationNo}
                              onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, applicationNo: e.target.value }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Step 1: DL DETAILS */}
                      <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 font-bold text-blue-900 text-xs">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
                          <span className="uppercase tracking-wider">DL DETAILS</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">DL NUMBER</label>
                            <input
                              type="text"
                              value={dlRenewRetest.step1.dlNumber}
                              onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, step1: { ...prev.step1, dlNumber: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">ISSUE DATE</label>
                            <input
                              type="date"
                              value={dlRenewRetest.step1.issueDate}
                              onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, step1: { ...prev.step1, issueDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">VALIDITY</label>
                            <input
                              type="date"
                              value={dlRenewRetest.step1.validityDate}
                              onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, step1: { ...prev.step1, validityDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">APPLICATION NUMBER 1</label>
                            <input
                              type="text"
                              value={dlRenewRetest.step1.appNo1}
                              onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, step1: { ...prev.step1, appNo1: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Step 2: LL DETAILS */}
                      <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 font-bold text-blue-900 text-xs">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
                          <span className="uppercase tracking-wider">LL DETAILS</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">LL NUMBER</label>
                            <input
                              type="text"
                              value={(dlRenewRetest as any).step2?.llNumber || ""}
                              onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, step2: { ...prev.step2, llNumber: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">ISSUE DATE</label>
                            <input
                              type="date"
                              value={(dlRenewRetest as any).step2?.issueDate || ""}
                              onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, step2: { ...prev.step2, issueDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">EXPIRY DATE</label>
                            <input
                              type="date"
                              value={(dlRenewRetest as any).step2?.expiryDate || ""}
                              onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, step2: { ...prev.step2, expiryDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">APPLICATION NUMBER 2</label>
                            <input
                              type="text"
                              value={(dlRenewRetest as any).step2?.appNo2 || ""}
                              onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, step2: { ...prev.step2, appNo2: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Step 3: DL DETAILS */}
                      <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 font-bold text-blue-900 text-xs">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
                          <span className="uppercase tracking-wider">DL DETAILS</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">DL NUMBER</label>
                            <input
                              type="text"
                              value={(dlRenewRetest as any).step3?.dlNumber || ""}
                              onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, step3: { ...prev.step3, dlNumber: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">ISSUE DATE</label>
                            <input
                              type="date"
                              value={(dlRenewRetest as any).step3?.issueDate || ""}
                              onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, step3: { ...prev.step3, issueDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">VALIDITY</label>
                            <input
                              type="date"
                              value={(dlRenewRetest as any).step3?.validityDate || ""}
                              onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, step3: { ...prev.step3, validityDate: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-500 text-[11px] block mb-1 uppercase">APPLICATION NUMBER 1</label>
                            <input
                              type="text"
                              value={(dlRenewRetest as any).step3?.appNo1 || ""}
                              onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, step3: { ...prev.step3, appNo1: e.target.value } }))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Accounting Module for DL Renew + Retest */}
                      <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">TOTAL AMOUNT (₹)</label>
                          <input
                            type="number"
                            placeholder="Enter total amount"
                            value={dlRenewRetest.totalAmount}
                            onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, totalAmount: e.target.value }))}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">ADVANCE AMOUNT (₹)</label>
                          <input
                            type="number"
                            placeholder="Enter advance amount"
                            value={dlRenewRetest.advanceAmount}
                            onChange={(e) => setDlRenewRetest((prev) => ({ ...prev, advanceAmount: e.target.value }))}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-emerald-700"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* General Licence Services Grid */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">General Licence Services</h3>
                  <p className="text-[11px] text-slate-400">Select multiple general services</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {[
                    "Issue Of Duplicate DL",
                    "Change Of Address In DL",
                    "Change Of Name In DL",
                    "Photo & Signature Change",
                    "Hazardous Material Endorsement",
                    "DL Replacement",
                    "DL Extract",
                    "Hazardous Training Card",
                    "International Licence",
                    "Change Date Of Birth In DL",
                    "DL New",
                  ].map((srv) => {
                    const isChecked = generalLicServices.selected.includes(srv);
                    return (
                      <label
                        key={srv}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border cursor-pointer font-medium transition-all",
                          isChecked ? "bg-blue-50 border-blue-300 text-blue-900 font-semibold" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...generalLicServices.selected, srv]
                              : generalLicServices.selected.filter((s) => s !== srv);
                            setGeneralLicServices((prev) => ({ ...prev, selected: next }));
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{srv}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Change Date Of Birth Note Box */}
                {generalLicServices.selected.includes("Change Date Of Birth In DL") && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium">
                    On task completion a popup will capture the New Date Of Birth and update the applicant profile.
                  </div>
                )}

                {/* Service Wise Amount Fields for General License Services */}
                {generalLicServices.selected.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <h4 className="font-bold text-slate-800 text-xs">Service Wise Accounting (General License Services)</h4>
                    {generalLicServices.selected.map((genSrv) => {
                      const acc = generalLicServices.accounting[genSrv] || { totalAmount: "", advanceAmount: "" };
                      return (
                        <div key={genSrv} className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-3 items-center text-xs">
                          <span className="font-bold text-slate-800">{genSrv}</span>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">TOTAL AMOUNT (₹)</label>
                            <input
                              type="number"
                              placeholder="0"
                              value={acc.totalAmount}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGeneralLicServices((prev) => ({
                                  ...prev,
                                  accounting: {
                                    ...prev.accounting,
                                    [genSrv]: { ...acc, totalAmount: val },
                                  },
                                }));
                              }}
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">ADVANCE AMOUNT (₹)</label>
                            <input
                              type="number"
                              placeholder="0"
                              value={acc.advanceAmount}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGeneralLicServices((prev) => ({
                                  ...prev,
                                  accounting: {
                                    ...prev.accounting,
                                    [genSrv]: { ...acc, advanceAmount: val },
                                  },
                                }));
                              }}
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-emerald-700"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* License Accounting Summary Section */}
              <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm space-y-4 bg-blue-50/20">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        License Accounting & Invoice Generation
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Specify service charges & advance payments. Connected to Accounting & Invoicing.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={shouldGenerateInvoice}
                      onChange={(e) => setShouldGenerateInvoice(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    Auto-Generate Invoice in Accounting
                  </label>
                </div>

                {/* Total Accounting Summary */}
                <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-wrap justify-between items-center text-xs font-medium gap-4">
                  <div>
                    <span className="text-slate-400">Total Charges:</span>{" "}
                    <strong className="text-white text-sm">
                      ₹{overallTotals.totalAmt.toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Advance Received:</span>{" "}
                    <strong className="text-emerald-400 text-sm">
                      ₹{overallTotals.totalAdv.toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Net Balance Due:</span>{" "}
                    <strong className="text-amber-400 text-sm">
                      ₹{overallTotals.pending.toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      Payment Status: {overallTotals.payStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* License Documents Section */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div 
                  className="flex items-center justify-between p-6 cursor-pointer select-none bg-white hover:bg-slate-50/50 transition-colors"
                  onClick={() => setShowLicenseDocsSection(!showLicenseDocsSection)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <FolderOpen className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Documents</h3>
                      <p className="text-[11px] text-slate-400">Upload supporting documents</p>
                    </div>
                  </div>
                  {showLicenseDocsSection ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                {showLicenseDocsSection && (
                  <div className="p-6 pt-0 border-t border-slate-100 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {licenseDocumentItems.map((docName) => {
                        const docUrl = uploadedDocs[docName];
                        const isUploaded = !!docUrl;
                        return (
                          <div
                            key={docName}
                            className={cn(
                              "p-4 rounded-2xl border transition-all flex items-center gap-3.5 relative min-h-[70px]",
                              isUploaded
                                ? "bg-emerald-50/40 border-emerald-200/80"
                                : "bg-white border-slate-200/80 hover:border-blue-300 border-dashed"
                            )}
                          >
                            {/* Upload Cloud / File Thumbnail */}
                            <label className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors select-none",
                              isUploaded 
                                ? "bg-emerald-100/70 text-emerald-700" 
                                : "bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100 cursor-pointer"
                            )}>
                              {!isUploaded && (
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    if (file.size > 15 * 1024 * 1024) {
                                      toast.error("File size must be under 15MB");
                                      return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = (evt) => {
                                      const result = evt.target?.result as string;
                                      setUploadedDocs((prev) => ({ ...prev, [docName]: result }));
                                      toast.success(`${docName} uploaded!`);
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                />
                              )}
                              <Upload className="w-5 h-5" />
                            </label>

                            {/* Info & Actions */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <span className="text-xs font-bold text-slate-800 truncate block leading-tight">
                                {docName}
                              </span>
                              
                              {isUploaded ? (
                                <div className="flex items-center gap-3 mt-1.5 text-[10px] font-bold">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewDoc({ name: docName, url: docUrl })}
                                    className="text-blue-600 hover:text-blue-800 transition uppercase tracking-wider"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const printWindow = window.open("", "_blank");
                                      if (!printWindow) return;
                                      printWindow.document.write(`
                                        <html>
                                          <head>
                                            <title>Print ${docName}</title>
                                            <style>
                                              body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                                              img, iframe { max-width: 100%; max-height: 100%; object-fit: contain; }
                                            </style>
                                          </head>
                                          <body>
                                      `);
                                      if (docUrl.startsWith("data:application/pdf")) {
                                        printWindow.document.write(`<iframe src="${docUrl}" width="100%" height="100%" style="border: none;"></iframe>`);
                                      } else {
                                        printWindow.document.write(`<img src="${docUrl}" onload="window.print(); window.close();" />`);
                                      }
                                      printWindow.document.write(`
                                          </body>
                                        </html>
                                      `);
                                      printWindow.document.close();
                                      if (docUrl.startsWith("data:application/pdf")) {
                                        setTimeout(() => {
                                          printWindow.print();
                                        }, 1000);
                                      }
                                    }}
                                    className="text-emerald-600 hover:text-emerald-800 transition uppercase tracking-wider"
                                  >
                                    Print
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setUploadedDocs((prev) => {
                                        const next = { ...prev };
                                        delete next[docName];
                                        return next;
                                      });
                                      toast.info(`${docName} removed`);
                                    }}
                                    className="text-rose-600 hover:text-rose-800 transition uppercase tracking-wider"
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                                  PDF, JPG • max 5 MB
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* License Task Assignment & Internal Notes */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Task Assignment & Internal Notes</h3>
                    <p className="text-[11px] text-slate-400">Assign employee, set priority, due date, reminder and remarks</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      EMPLOYEE REMARKS
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Notes visible to internal team only..."
                      value={employeeRemarks}
                      onChange={(e) => setEmployeeRemarks(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">DUE DATE</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">REMINDER</label>
                      <input
                        type="date"
                        value={reminder}
                        onChange={(e) => setReminder(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">PRIORITY</label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        ASSIGNED EMPLOYEE
                      </label>
                      <select
                        value={assignedEmployee}
                        onChange={(e) => setAssignedEmployee(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                      >
                        {activeEmployees.map((emp) => (
                          <option key={emp.id} value={emp.name}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={createTaskAuto}
                        onChange={(e) => setCreateTaskAuto(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Create Task Automatically</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FORM 5 SUB MODULE FORM */}
          {activeSubModule === "form5" && (
            <div className="space-y-6">
              {/* Type Selection */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Application Type Selection</h3>
                    <p className="text-[11px] text-slate-400">Select any one HGV application option.</p>
                  </div>
                </div>
                <div className="flex gap-8 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 text-xs select-none">
                    <input
                      type="checkbox"
                      checked={form5Details.form5Type === "new_hgv"}
                      onChange={(e) => {
                        setForm5Details(prev => ({ 
                          ...prev, 
                          form5Type: e.target.checked ? "new_hgv" : "" 
                        }));
                      }}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Form 5 New HGV</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 text-xs select-none">
                    <input
                      type="checkbox"
                      checked={form5Details.form5Type === "renew_hgv"}
                      onChange={(e) => {
                        setForm5Details(prev => ({ 
                          ...prev, 
                          form5Type: e.target.checked ? "renew_hgv" : "" 
                        }));
                      }}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Form 5A Renew HGV</span>
                  </label>
                </div>
              </div>

              {/* Details Section */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Form 5 Applicant Details</h3>
                    <p className="text-[11px] text-slate-400">Fill the required credentials below.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">NAME *</label>
                    <input
                      type="text"
                      placeholder="Applicant's name"
                      value={form5Details.name || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm5Details(prev => ({ ...prev, name: val }));
                        setOwnerName(val);
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">DATE OF BIRTH</label>
                    <input
                      type="date"
                      value={form5Details.dateOfBirth || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm5Details(prev => ({ ...prev, dateOfBirth: val }));
                        setDateOfBirth(val);
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">APPLICATION NO.</label>
                    <input
                      type="text"
                      placeholder="Enter application number"
                      value={form5Details.applicationNo || ""}
                      onChange={(e) => setForm5Details(prev => ({ ...prev, applicationNo: e.target.value }))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">AADHAAR NO.</label>
                    <input
                      type="text"
                      placeholder="12-digit Aadhaar number"
                      value={form5Details.aadhaarNumber || ""}
                      onChange={(e) => setForm5Details(prev => ({ ...prev, aadhaarNumber: e.target.value }))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">LL NO.</label>
                    <input
                      type="text"
                      placeholder="LL Number"
                      value={form5Details.llNumber || ""}
                      onChange={(e) => setForm5Details(prev => ({ ...prev, llNumber: e.target.value }))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">LL ISSUE DATE</label>
                    <input
                      type="date"
                      value={form5Details.llIssueDate || ""}
                      onChange={(e) => setForm5Details(prev => ({ ...prev, llIssueDate: e.target.value }))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">LL EXPIRY DATE</label>
                    <input
                      type="date"
                      value={form5Details.llExpiryDate || ""}
                      onChange={(e) => setForm5Details(prev => ({ ...prev, llExpiryDate: e.target.value }))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">DL NO.</label>
                    <input
                      type="text"
                      placeholder="DL Number"
                      value={form5Details.dlNumber || ""}
                      onChange={(e) => setForm5Details(prev => ({ ...prev, dlNumber: e.target.value }))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">NT VALIDITY</label>
                    <input
                      type="date"
                      value={form5Details.ntValidityDate || ""}
                      onChange={(e) => setForm5Details(prev => ({ ...prev, ntValidityDate: e.target.value }))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">TR VALIDITY</label>
                    <input
                      type="date"
                      value={form5Details.trValidityDate || ""}
                      onChange={(e) => setForm5Details(prev => ({ ...prev, trValidityDate: e.target.value }))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Form 5 Documents Section */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div 
                  className="flex items-center justify-between p-6 cursor-pointer select-none bg-white hover:bg-slate-50/50 transition-colors"
                  onClick={() => setShowLicenseDocsSection(!showLicenseDocsSection)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <FolderOpen className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Documents</h3>
                      <p className="text-[11px] text-slate-400">Upload supporting documents</p>
                    </div>
                  </div>
                  {showLicenseDocsSection ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                {showLicenseDocsSection && (
                  <div className="p-6 pt-0 border-t border-slate-100 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {form5DocumentItems.map((docName) => {
                        const docUrl = uploadedDocs[docName];
                        const isUploaded = !!docUrl;
                        return (
                          <div
                            key={docName}
                            className={cn(
                              "p-4 rounded-2xl border transition-all flex items-center gap-3.5 relative min-h-[70px]",
                              isUploaded
                                ? "bg-emerald-50/40 border-emerald-200/80"
                                : "bg-white border-slate-200/80 hover:border-blue-300 border-dashed"
                            )}
                          >
                            {/* Upload Cloud Icon */}
                            <label className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors select-none",
                              isUploaded 
                                ? "bg-emerald-100/70 text-emerald-700" 
                                : "bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100 cursor-pointer"
                            )}>
                              {!isUploaded && (
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    if (file.size > 15 * 1024 * 1024) {
                                      toast.error("File size must be under 15MB");
                                      return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = (evt) => {
                                      const result = evt.target?.result as string;
                                      setUploadedDocs((prev) => ({ ...prev, [docName]: result }));
                                      toast.success(`${docName} uploaded!`);
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                />
                              )}
                              <Upload className="w-5 h-5" />
                            </label>

                            {/* Info & Actions */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <span className="text-xs font-bold text-slate-800 truncate block leading-tight">
                                {docName}
                              </span>
                              
                              {isUploaded ? (
                                <div className="flex items-center gap-3 mt-1.5 text-[10px] font-bold">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewDoc({ name: docName, url: docUrl })}
                                    className="text-blue-600 hover:text-blue-800 transition uppercase tracking-wider"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const printWindow = window.open("", "_blank");
                                      if (!printWindow) return;
                                      printWindow.document.write(`
                                        <html>
                                          <head>
                                            <title>Print ${docName}</title>
                                            <style>
                                              body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                                              img, iframe { max-width: 100%; max-height: 100%; object-fit: contain; }
                                            </style>
                                          </head>
                                          <body>
                                      `);
                                      if (docUrl.startsWith("data:application/pdf")) {
                                        printWindow.document.write(`<iframe src="${docUrl}" width="100%" height="100%" style="border: none;"></iframe>`);
                                      } else {
                                        printWindow.document.write(`<img src="${docUrl}" onload="window.print(); window.close();" />`);
                                      }
                                      printWindow.document.write(`
                                          </body>
                                        </html>
                                      `);
                                      printWindow.document.close();
                                      if (docUrl.startsWith("data:application/pdf")) {
                                        setTimeout(() => {
                                          printWindow.print();
                                        }, 1000);
                                      }
                                    }}
                                    className="text-emerald-600 hover:text-emerald-800 transition uppercase tracking-wider"
                                  >
                                    Print
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setUploadedDocs((prev) => {
                                        const next = { ...prev };
                                        delete next[docName];
                                        return next;
                                      });
                                      toast.info(`${docName} removed`);
                                    }}
                                    className="text-rose-600 hover:text-rose-800 transition uppercase tracking-wider"
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                                  PDF, JPG • max 5 MB
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Task Assignment & Internal Notes */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Task Assignment & Internal Notes</h3>
                    <p className="text-[11px] text-slate-400">Assign employee, set priority, due date, reminder and remarks</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      EMPLOYEE REMARKS
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Notes visible to internal team only..."
                      value={employeeRemarks}
                      onChange={(e) => setEmployeeRemarks(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">DUE DATE</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">REMINDER</label>
                      <input
                        type="date"
                        value={reminder}
                        onChange={(e) => setReminder(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">PRIORITY</label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        ASSIGNED EMPLOYEE
                      </label>
                      <select
                        value={assignedEmployee}
                        onChange={(e) => setAssignedEmployee(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                      >
                        {activeEmployees.map((emp) => (
                          <option key={emp.id} value={emp.name}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={createTaskAuto}
                        onChange={(e) => setCreateTaskAuto(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Create Task Automatically</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DRIVING SCHOOL FORM (MATCHING SCREENSHOT 1) */}
          {activeSubModule === "driving_school" && (
            <div className="space-y-6">
              {/* SECTION 1 — STUDENT DETAILS */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Student Details</h3>
                    <p className="text-[11px] text-slate-400">
                      Only Student Name and Date Of Birth are mandatory.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      STUDENT NAME <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">MOBILE NUMBER</label>
                    <input
                      type="text"
                      placeholder="+91 XXXXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">BLOOD GROUP</label>
                    <select
                      value={dsBloodGroup}
                      onChange={(e) => setDsBloodGroup(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">ADDRESS</label>
                    <input
                      type="text"
                      placeholder="House, street, city"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      DATE OF BIRTH <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">GENDER</label>
                    <select
                      value={dsGender}
                      onChange={(e) => setDsGender(e.target.value as any)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Driving Licence Status Toggle */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="font-semibold text-slate-700 block mb-2 text-xs uppercase tracking-wider">
                    DRIVING LICENCE STATUS
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <label
                      className={cn(
                        "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer font-medium transition-all select-none",
                        dsHasDrivingLicence
                          ? "bg-blue-50 border-blue-300 text-blue-900 font-semibold"
                          : "bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <input
                        type="radio"
                        name="dsDlStatus"
                        checked={dsHasDrivingLicence}
                        onChange={() => setDsHasDrivingLicence(true)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span>already with Driving license</span>
                    </label>

                    <label
                      className={cn(
                        "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer font-medium transition-all select-none",
                        !dsHasDrivingLicence
                          ? "bg-blue-50 border-blue-300 text-blue-900 font-semibold"
                          : "bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <input
                        type="radio"
                        name="dsDlStatus"
                        checked={!dsHasDrivingLicence}
                        onChange={() => setDsHasDrivingLicence(false)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Without Driving Licence</span>
                    </label>
                  </div>

                  {dsHasDrivingLicence && (
                    <div className="mt-3">
                      <label className="font-semibold text-slate-700 block mb-1 text-xs">
                        DRIVING LICENCE NUMBER
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. GJ01 20260001234"
                        value={dsDlNumber}
                        onChange={(e) => setDsDlNumber(e.target.value)}
                        className="w-full p-3 bg-white border border-blue-300 rounded-xl font-mono text-xs font-semibold text-slate-900"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2 — COURSE DETAILS */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Course Details</h3>
                    <p className="text-[11px] text-slate-400">Fees are calculated automatically</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">JOINING DATE</label>
                    <input
                      type="date"
                      value={dsJoiningDate}
                      onChange={(e) => setDsJoiningDate(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">COURSE START DATE</label>
                    <input
                      type="date"
                      value={dsCourseStartDate}
                      onChange={(e) => setDsCourseStartDate(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">COURSE END DATE</label>
                    <input
                      type="date"
                      value={dsCourseEndDate}
                      onChange={(e) => setDsCourseEndDate(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">COURSE TYPE</label>
                    <select
                      value={dsCourseType}
                      onChange={(e) => setDsCourseType(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                    >
                      {courseTypes.map((course) => (
                        <option key={course} value={course}>
                          {course}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">TOTAL COURSE FEES</label>
                    <input
                      type="number"
                      placeholder="9500"
                      value={dsTotalCourseFees}
                      onChange={(e) => setDsTotalCourseFees(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">ADVANCE PAID</label>
                    <input
                      type="number"
                      placeholder="4000"
                      value={dsAdvancePaid}
                      onChange={(e) => setDsAdvancePaid(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-emerald-700"
                    />
                  </div>
                </div>

                {/* Auto Calculated Remaining Fees & Payment Status Badge */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="font-semibold text-slate-500 block text-[10px] uppercase">
                      REMAINING FEES
                    </span>
                    <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                      ₹
                      {Math.max(
                        0,
                        (Number(dsTotalCourseFees) || 0) - (Number(dsAdvancePaid) || 0)
                      ).toLocaleString("en-IN")}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Auto = Total Fees − Advance Paid
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-600 text-xs">PAYMENT STATUS</span>
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider",
                        (Number(dsTotalCourseFees) || 0) - (Number(dsAdvancePaid) || 0) <= 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : (Number(dsAdvancePaid) || 0) > 0
                          ? "bg-amber-50 text-amber-700 border-amber-300"
                          : "bg-rose-50 text-rose-700 border-rose-300"
                      )}
                    >
                      {(Number(dsTotalCourseFees) || 0) - (Number(dsAdvancePaid) || 0) <= 0
                        ? "Paid"
                        : (Number(dsAdvancePaid) || 0) > 0
                        ? "Partial"
                        : "Pending"}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 3 — DOCUMENTS */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Documents</h3>
                    <p className="text-[11px] text-slate-400">Upload supporting documents</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {[
                    "Aadhaar",
                    "Driving Licence",
                    "Learning Licence",
                    "Passport Size Photo",
                    "Medical Certificate",
                    "Other Document",
                  ].map((docName) => {
                    const docUrl = uploadedDocs[docName];
                    const isUploaded = !!docUrl;

                    return (
                      <div
                        key={docName}
                        className={cn(
                          "p-4 rounded-2xl border border-dashed text-center transition-all flex flex-col items-center justify-center gap-2 min-h-[120px] relative group",
                          isUploaded
                            ? "bg-emerald-50/70 border-emerald-300 text-emerald-900"
                            : "bg-slate-50/60 border-slate-300 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-1.5">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 15 * 1024 * 1024) {
                                toast.error("File size must be under 15MB");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                const result = evt.target?.result as string;
                                setUploadedDocs((prev) => ({ ...prev, [docName]: result }));
                                toast.success(`${docName} uploaded!`);
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                          <Upload
                            className={cn(
                              "w-5 h-5",
                              isUploaded ? "text-emerald-600" : "text-slate-400"
                            )}
                          />
                          <span className="text-xs font-bold text-slate-900 leading-tight">
                            {docName}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 uppercase">
                            PDF • JPG • PNG
                          </span>
                        </label>

                        {isUploaded && (
                          <div className="flex gap-1 mt-1 z-10">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewDoc({ name: docName, url: docUrl });
                              }}
                              className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-white/90 px-2 py-0.5 rounded border border-emerald-200"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUploadedDocs((prev) => {
                                  const next = { ...prev };
                                  delete next[docName];
                                  return next;
                                });
                                toast.info(`${docName} removed`);
                              }}
                              className="text-[10px] font-bold text-rose-600 hover:text-rose-900 ml-1 bg-white/90 px-2 py-0.5 rounded border border-rose-200"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 4 — INTERNAL NOTES */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Internal Notes</h3>
                    <p className="text-[11px] text-slate-400">Visible to internal team only</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      EMPLOYEE NOTES
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Notes visible to internal team only..."
                      value={employeeRemarks}
                      onChange={(e) => setEmployeeRemarks(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        ASSIGNED EMPLOYEE
                      </label>
                      <select
                        value={assignedEmployee}
                        onChange={(e) => setAssignedEmployee(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                      >
                        {activeEmployees.map((emp) => (
                          <option key={emp.id} value={emp.name}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">REMINDER</label>
                      <input
                        type="date"
                        value={reminder}
                        onChange={(e) => setReminder(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">PRIORITY</label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubModule === "insurance" && (
            <div className="space-y-6">
              {/* Section 1: Applicant Details */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Applicant Details</h3>
                    <p className="text-[11px] text-slate-400">Only Name and Date of Birth are mandatory.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">NAME *</label>
                    <input
                      type="text"
                      placeholder="Applicant's full name"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">DATE OF BIRTH *</label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">MOBILE NUMBER</label>
                    <input
                      type="text"
                      placeholder="10 digit mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">ADDRESS</label>
                    <input
                      type="text"
                      placeholder="House, street, city"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">C/O</label>
                    <input
                      type="text"
                      placeholder="Father / Husband name"
                      value={fatherHusbandName}
                      onChange={(e) => setFatherHusbandName(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">GROUP NAME</label>
                    <select
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="">Select group</option>
                      <option value="Group A">Group A</option>
                      <option value="Group B">Group B</option>
                      <option value="Individual">Individual</option>
                      <option value="Corporate">Corporate</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Register Vehicle Insurance */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Register Vehicle Insurance</h3>
                      <p className="text-[11px] text-slate-400">Policy, premium calculation & commission details</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      checked={trackInsurance}
                      onChange={(e) => setTrackInsurance(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Show Expiry on Dashboard</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">POLICY SUB-CATEGORY *</label>
                    <select
                      value={policySubCategory}
                      onChange={(e) => setPolicySubCategory(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="Motor / Vehicle">Motor / Vehicle</option>
                      <option value="Health">Health</option>
                      <option value="Life">Life</option>
                      <option value="General">General</option>
                      <option value="Commercial">Commercial</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">VEHICLE TYPE (IF MOTOR)</label>
                    <select
                      value={insVehicleType}
                      onChange={(e) => setInsVehicleType(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="4 Wheel">4 Wheel</option>
                      <option value="2 Wheel">2 Wheel</option>
                      <option value="3 Wheel">3 Wheel</option>
                      <option value="Commercial Vehicle">Commercial Vehicle</option>
                      <option value="Heavy Vehicle">Heavy Vehicle</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">INSURANCE COMPANY *</label>
                    <select
                      value={insuranceCompany}
                      onChange={(e) => setInsuranceCompany(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    >
                      <option value="New India">New India Assurance</option>
                      <option value="ICICI Lombard">ICICI Lombard</option>
                      <option value="HDFC Ergo">HDFC Ergo</option>
                      <option value="Bajaj Allianz">Bajaj Allianz</option>
                      <option value="TATA AIG">TATA AIG</option>
                      <option value="SBI General">SBI General</option>
                      <option value="National Insurance">National Insurance</option>
                      <option value="United India">United India Insurance</option>
                      <option value="Oriental Insurance">Oriental Insurance</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">AGENT *</label>
                    <select
                      value={agent}
                      onChange={(e) => setAgent(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="">Select Agent</option>
                      {activeEmployees.map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name}
                        </option>
                      ))}
                      <option value="Direct">Direct</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">INSURANCE AGENCY</label>
                    <select
                      value={insuranceAgency}
                      onChange={(e) => setInsuranceAgency(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="">-- Select Agency --</option>
                      <option value="Primary Agency">Primary Agency</option>
                      <option value="Branch Agency">Branch Agency</option>
                      <option value="Broker Agency">Broker Agency</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">REFERENCE</label>
                    <input
                      type="text"
                      placeholder="e.g. Mr. Sharma"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">POLICY TYPE *</label>
                    <select
                      value={insurancePolicyType}
                      onChange={(e) => setInsurancePolicyType(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="Third Party">Third Party</option>
                      <option value="Comprehensive">Comprehensive</option>
                      <option value="Zero Dep">Zero Dep</option>
                      <option value="Standalone Own Damage">Standalone Own Damage</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">FUEL TYPE</label>
                    <select
                      value={insFuelType}
                      onChange={(e) => setInsFuelType(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="Petrol">Petrol</option>
                      <option value="Diesel">Diesel</option>
                      <option value="CNG">CNG</option>
                      <option value="Petrol+CNG">Petrol+CNG</option>
                      <option value="Electric">Electric</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">VEHICLE REGISTRATION NUMBER</label>
                    <input
                      type="text"
                      placeholder="e.g. MH-02-AB-1234"
                      value={insVehicleRegNumber}
                      onChange={(e) => setInsVehicleRegNumber(e.target.value.toUpperCase())}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase"
                    />
                  </div>

                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="font-semibold text-slate-700 block mb-1">VEHICLE MODEL DETAILS</label>
                    <input
                      type="text"
                      placeholder="e.g. Honda City ZX (2023)"
                      value={insVehicleModelDetails}
                      onChange={(e) => setInsVehicleModelDetails(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">POLICY NUMBER</label>
                    <input
                      type="text"
                      placeholder="POL-XXXX"
                      value={insurancePolicyNo}
                      onChange={(e) => setInsurancePolicyNo(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">ISSUE DATE</label>
                    <input
                      type="date"
                      value={insuranceIssueDate}
                      onChange={(e) => setInsuranceIssueDate(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">EXPIRY DATE</label>
                    <input
                      type="date"
                      value={insuranceExpiryDate}
                      onChange={(e) => setInsuranceExpiryDate(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">PREMIUM EXCL-GST (INR) *</label>
                    <input
                      type="number"
                      placeholder="1000"
                      value={premiumExclGst || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setPremiumExclGst(val);
                        const gst = Math.round(val * (gstPercentage / 100));
                        setGstAmount(gst);
                        const tot = val + gst;
                        setTotalPremium(tot);
                        setInsuranceAmount(tot);
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">GST @{gstPercentage}% (INR)</label>
                    <input
                      type="number"
                      placeholder={String(Math.round(1000 * (gstPercentage / 100)))}
                      value={gstAmount || ""}
                      onChange={(e) => {
                        const gst = Number(e.target.value);
                        setGstAmount(gst);
                        const tot = (premiumExclGst || 0) + gst;
                        setTotalPremium(tot);
                        setInsuranceAmount(tot);
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-blue-700"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">TOTAL PREMIUM (INR)</label>
                    <input
                      type="number"
                      placeholder="1180"
                      value={totalPremium || ""}
                      onChange={(e) => {
                        const tot = Number(e.target.value);
                        setTotalPremium(tot);
                        setInsuranceAmount(tot);
                      }}
                      className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">INSURER COMMISSION (INR)</label>
                    <input
                      type="number"
                      placeholder="500"
                      value={insurerCommission || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setInsurerCommission(val);
                        setNetCommission(val - (clientDiscount || 0));
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">CLIENT DISCOUNT (INR)</label>
                    <input
                      type="number"
                      placeholder="200"
                      value={clientDiscount || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setClientDiscount(val);
                        setNetCommission((insurerCommission || 0) - val);
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">NET COMMISSION (INR)</label>
                    <input
                      type="number"
                      placeholder="300"
                      value={netCommission || ""}
                      onChange={(e) => setNetCommission(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-emerald-700"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-800 block mb-1 text-xs uppercase">કુલ રકમ (₹) *</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={insTotalFees || ""}
                      onChange={(e) => setInsTotalFees(Number(e.target.value))}
                      className="w-full p-3 bg-white border-2 border-blue-200 rounded-xl font-bold text-slate-900 text-sm shadow-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-800 block mb-1 text-xs uppercase">કુલ જમા (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={insAdvancePayment || ""}
                      onChange={(e) => setInsAdvancePayment(Number(e.target.value))}
                      className="w-full p-3 bg-white border-2 border-emerald-200 rounded-xl font-bold text-emerald-700 text-sm shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Internal Notes */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Internal Notes</h3>
                    <p className="text-[11px] text-slate-400">Visible to internal team only</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">EMPLOYEE REMARKS</label>
                    <textarea
                      rows={3}
                      placeholder="Notes visible to internal team only..."
                      value={employeeRemarks}
                      onChange={(e) => setEmployeeRemarks(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">REMINDER</label>
                      <input
                        type="date"
                        value={reminder}
                        onChange={(e) => setReminder(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">PRIORITY</label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">ASSIGNED EMPLOYEE</label>
                      <select
                        value={assignedEmployee}
                        onChange={(e) => setAssignedEmployee(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                      >
                        {activeEmployees.map((emp) => (
                          <option key={emp.id} value={emp.name}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {activeSubModule === "insurance" && (
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">APPLICATION TYPE</label>
                        <select
                          value={isCustomAppType ? "__CUSTOM__" : appTypeSelect}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "__CUSTOM__") {
                              setIsCustomAppType(true);
                            } else {
                              setIsCustomAppType(false);
                              setAppTypeSelect(val);
                            }
                          }}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                        >
                          {availableAppTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                          <option value="__CUSTOM__">+ Add Custom Type</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SERVICES SUB MODULE FORM */}
          {activeSubModule === "services" && (
            <div className="space-y-6">
              {/* 1. Vehicle Details Section */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <Car className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Vehicle Details</h3>
                    <p className="text-[11px] text-slate-400">
                      Only Vehicle Number is mandatory. Rest is optional. Entering existing number auto populates details.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      VEHICLE NUMBER *
                    </label>
                    <input
                      type="text"
                      placeholder="GJ-01-AB-1234"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                      onBlur={handleVehicleBlur}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">PHONE</label>
                <input
                  type="text"
                  placeholder="+91 9XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">OWNER NAME</label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  FATHER / HUSBAND NAME
                </label>
                <input
                  type="text"
                  placeholder="Guardian name"
                  value={fatherHusbandName}
                  onChange={(e) => setFatherHusbandName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">CO (C/O)</label>
                <input
                  type="text"
                  placeholder="Care of name"
                  value={coName}
                  onChange={(e) => setCoName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  list="co-name-suggestions"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">GROUP NAME</label>
                <input
                  type="text"
                  placeholder="Group / Fleet name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  list="group-name-suggestions"
                />
              </div>

              <div className="md:col-span-3">
                <label className="font-semibold text-slate-700 block mb-1">ADDRESS</label>
                <input
                  type="text"
                  placeholder="House, street, city"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">REGISTRATION DATE</label>
                <input
                  type="date"
                  value={registrationDate}
                  onChange={(e) => setRegistrationDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">CHASSIS NUMBER</label>
                <input
                  type="text"
                  placeholder="17-char VIN"
                  value={chassisNumber}
                  onChange={(e) => setChassisNumber(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">ENGINE NUMBER</label>
                <input
                  type="text"
                  placeholder="Engine Code"
                  value={engineNumber}
                  onChange={(e) => setEngineNumber(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">FUEL TYPE</label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="CNG">CNG</option>
                  <option value="Petrol+CNG">Petrol+CNG</option>
                  <option value="Electric">Electric</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">VEHICLE CLASS</label>
                <input
                  type="text"
                  placeholder="LMV / LCV / HGV"
                  value={vehicleClass}
                  onChange={(e) => setVehicleClass(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  list="vehicle-class-suggestions"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">MAKER NAME</label>
                <input
                  type="text"
                  placeholder="Tata / Maruti / Ashok Leyland"
                  value={makerName}
                  onChange={(e) => setMakerName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  list="maker-name-suggestions"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">MODEL NAME</label>
                <input
                  type="text"
                  placeholder="Model name"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  list="model-name-suggestions"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">COLOUR</label>
                <input
                  type="text"
                  placeholder="Colour"
                  value={colour}
                  onChange={(e) => setColour(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  list="colour-suggestions"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">BODY TYPE</label>
                <input
                  type="text"
                  placeholder="Saloon / Truck / Bus"
                  value={bodyType}
                  onChange={(e) => setBodyType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  list="body-type-suggestions"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">SEATING CAPACITY</label>
                <input
                  type="number"
                  value={seatingCapacity}
                  onChange={(e) => setSeatingCapacity(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">GROSS WEIGHT (KG)</label>
                <input
                  type="number"
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">UNLADEN WEIGHT (KG)</label>
                <input
                  type="number"
                  value={unladenWeight}
                  onChange={(e) => setUnladenWeight(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">PAYLOAD (KG)</label>
                <input
                  type="number"
                  value={payload}
                  onChange={(e) => setPayload(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">HORSE POWER</label>
                <input
                  type="text"
                  placeholder="1497 cc"
                  value={horsePower}
                  onChange={(e) => setHorsePower(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">NUMBER OF CYLINDERS</label>
                <input
                  type="number"
                  value={cylinderCount}
                  onChange={(e) => setCylinderCount(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="md:col-span-3 border-t border-slate-100 pt-4 mt-2">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-900 uppercase">
                  <input
                    type="checkbox"
                    checked={showPucDetails}
                    onChange={(e) => setShowPucDetails(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  PUC Details
                </label>
                {showPucDetails && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div>
                      <div className="mb-1">
                        <label className="font-semibold text-slate-700 block">PUC EXPIRY DATE</label>
                      </div>
                      <input
                        type="date"
                        value={pucExpiryDate}
                        onChange={(e) => setPucExpiryDate(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Tax Details Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-bold text-slate-900 uppercase">
                <input
                  type="checkbox"
                  checked={showTaxDetails}
                  onChange={(e) => setShowTaxDetails(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                Tax Details
              </label>
              {showTaxDetails && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={isLumpsumTax}
                      onChange={(e) => setIsLumpsumTax(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    Lumpsum Tax
                  </label>
                </div>
              )}
            </div>

            {showTaxDetails && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs transition-all duration-300">
                {!isLumpsumTax && (
                  <>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">ISSUE DATE</label>
                      <input
                        type="date"
                        value={taxIssueDate}
                        onChange={(e) => setTaxIssueDate(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">EXPIRY DATE</label>
                      <input
                        type="date"
                        value={taxExpiryDate}
                        onChange={(e) => setTaxExpiryDate(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">AMOUNT (₹)</label>
                  <input
                    type="number"
                    placeholder="₹"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                  />
                </div>
                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  <InlineDocUpload
                    label="Rc Document"
                    docName="Tax RC Document"
                    uploadedDocs={uploadedDocs}
                    setUploadedDocs={setUploadedDocs}
                    setPreviewDoc={setPreviewDoc}
                  />
                  <InlineDocUpload
                    label="Tax Receipt Document"
                    docName="Tax Receipt Document"
                    uploadedDocs={uploadedDocs}
                    setUploadedDocs={setUploadedDocs}
                    setPreviewDoc={setPreviewDoc}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Fitness Details Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-bold text-slate-900 uppercase">
                <input
                  type="checkbox"
                  checked={showFitnessDetails}
                  onChange={(e) => setShowFitnessDetails(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                Fitness Details
              </label>
            </div>
            {showFitnessDetails && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs transition-all duration-300">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ISSUE DATE</label>
                  <input
                    type="date"
                    value={fitnessIssueDate}
                    onChange={(e) => setFitnessIssueDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">EXPIRY DATE</label>
                  <input
                    type="date"
                    value={fitnessExpiryDate}
                    onChange={(e) => setFitnessExpiryDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="md:col-span-2 mt-2">
                  <InlineDocUpload
                    label="Fitness Document"
                    docName="Fitness Document"
                    uploadedDocs={uploadedDocs}
                    setUploadedDocs={setUploadedDocs}
                    setPreviewDoc={setPreviewDoc}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. Permit Section - 3 Fixed Permits */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-bold text-slate-900 uppercase">
                <input
                  type="checkbox"
                  checked={showPermitDetails}
                  onChange={(e) => setShowPermitDetails(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                Permit Details
              </label>
            </div>

            {showPermitDetails && (
              <div className="space-y-4 text-xs transition-all duration-300">
                {/* 1. Gujarat Permit (5 Yrs Gap) */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">Gujarat Permit</span>
                    <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                      Fixed 5 Years Expiry Gap
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">ISSUE DATE</label>
                      <input
                        type="date"
                        value={gujaratPermitIssueDate}
                        onChange={(e) => handleGujaratIssueChange(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        EXPIRY DATE (+5 YEARS AUTO)
                      </label>
                      <input
                        type="date"
                        value={gujaratPermitExpiryDate}
                        readOnly
                        className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold font-mono text-slate-800"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <InlineDocUpload
                      label="Gujarat Permit Doc"
                      docName="Gujarat Permit Document"
                      uploadedDocs={uploadedDocs}
                      setUploadedDocs={setUploadedDocs}
                      setPreviewDoc={setPreviewDoc}
                    />
                  </div>
                </div>

                {/* 2. National Permit (5 Yrs Gap) */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">National Permit(Gujrat Permit)</span>
                    <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">
                      Fixed 5 Years Expiry Gap
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">ISSUE DATE</label>
                      <input
                        type="date"
                        value={nationalPermitIssueDate}
                        onChange={(e) => handleNationalIssueChange(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        EXPIRY DATE (+5 YEARS AUTO)
                      </label>
                      <input
                        type="date"
                        value={nationalPermitExpiryDate}
                        readOnly
                        className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold font-mono text-slate-800"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <InlineDocUpload
                      label="National Permit(Gujrat Permit) Doc"
                      docName="National Permit(Gujrat Permit) Document"
                      uploadedDocs={uploadedDocs}
                      setUploadedDocs={setUploadedDocs}
                      setPreviewDoc={setPreviewDoc}
                    />
                  </div>
                </div>

                {/* 3. National Permit Authorization (1 Yr Gap) */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">
                      National Permit Authorization
                    </span>
                    <span className="text-[10px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md">
                      Fixed 1 Year Expiry Gap
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">ISSUE DATE</label>
                      <input
                        type="date"
                        value={nationalAuthIssueDate}
                        onChange={(e) => handleNationalAuthIssueChange(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        EXPIRY DATE (+1 YEAR AUTO)
                      </label>
                      <input
                        type="date"
                        value={nationalAuthExpiryDate}
                        readOnly
                        className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold font-mono text-slate-800"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <InlineDocUpload
                      label="National Permit Authorization Box"
                      docName="National Permit Authorization Document"
                      uploadedDocs={uploadedDocs}
                      setUploadedDocs={setUploadedDocs}
                      setPreviewDoc={setPreviewDoc}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6. Renewal of Registration (NT) Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-bold text-slate-900 uppercase">
                <input
                  type="checkbox"
                  checked={showRegistrationDetails}
                  onChange={(e) => setShowRegistrationDetails(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                Renewal of Registration (NT)
              </label>
            </div>
            {showRegistrationDetails && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs transition-all duration-300">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    DATE OF REGISTRATION
                  </label>
                  <input
                    type="date"
                    value={dateOfRegistration}
                    onChange={(e) => setDateOfRegistration(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    REGISTRATION VALIDITY
                  </label>
                  <input
                    type="date"
                    value={registrationValidity}
                    onChange={(e) => setRegistrationValidity(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="md:col-span-2 mt-2">
                  <InlineDocUpload
                    label="Rc Document"
                    docName="Registration RC Document"
                    uploadedDocs={uploadedDocs}
                    setUploadedDocs={setUploadedDocs}
                    setPreviewDoc={setPreviewDoc}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 7. Documents Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Documents Upload</h3>
                  <p className="text-[11px] text-slate-400">
                    Light Red = Missing • Light Green = Uploaded
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {documentItems.map((docName) => {
                const docUrl = uploadedDocs[docName];
                const isUploaded = !!docUrl;
                return (
                  <div
                    key={docName}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 min-h-[100px] relative group",
                      isUploaded
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : "bg-rose-50/80 border-rose-200 text-rose-800"
                    )}
                  >
                    <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-1">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 15 * 1024 * 1024) {
                            toast.error("File size must be under 15MB");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const result = evt.target?.result as string;
                            setUploadedDocs((prev) => ({ ...prev, [docName]: result }));
                            toast.success(`${docName} file uploaded!`);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                      <Upload
                        className={cn("w-5 h-5", isUploaded ? "text-emerald-600" : "text-rose-500")}
                      />
                      <span className="text-[11px] font-bold leading-tight px-1">{docName}</span>
                      <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border bg-white/80">
                        {isUploaded ? "✓ Uploaded" : "Click to Upload"}
                      </span>
                    </label>

                    {isUploaded && (
                      <div className="flex gap-1 mt-1 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewDoc({ name: docName, url: docUrl });
                          }}
                          className="text-[9px] underline font-bold text-emerald-700 hover:text-emerald-900 bg-white/90 px-1.5 py-0.5 rounded border border-emerald-200"
                        >
                          View File
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedDocs((prev) => {
                              const next = { ...prev };
                              delete next[docName];
                              return next;
                            });
                            toast.info(`${docName} removed`);
                          }}
                          className="text-[9px] font-bold text-rose-600 hover:text-rose-900 ml-1 bg-white/90 px-1.5 py-0.5 rounded border border-rose-200"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 8. Service Selection Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Services Selection</h3>
                <p className="text-[11px] text-slate-400">Choose services attached to this application</p>
              </div>
            </div>

            <div className="space-y-4">
              {SERVICE_GROUPS.map((group) => (
                <div key={group.category} className="space-y-2">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {group.category}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {group.items.map((srv) => {
                      const isSelected = selectedServices.includes(srv);
                      return (
                        <label
                          key={srv}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-xs font-medium",
                            isSelected
                              ? "bg-blue-50 border-blue-300 text-blue-900 font-semibold"
                              : "bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleService(srv)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span>{srv}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* NEW 9. Service Accounting & Invoice Details Section */}
          {selectedServices.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm space-y-4 bg-blue-50/20">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Service Accounting & Invoice Generation
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Specify service charges & advance payments. Connected to Accounting & Invoicing.
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={shouldGenerateInvoice}
                    onChange={(e) => setShouldGenerateInvoice(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  Auto-Generate Invoice in Accounting
                </label>
              </div>

              <div className="space-y-3">
                {selectedServices.map((srv) => {
                  const item = serviceAccountingMap[srv] || { totalAmount: 0, advancePayment: 0 };
                  const pending = Math.max(0, item.totalAmount - item.advancePayment);
                  const srvDisplayName = srv === "Hypothecation Removal" ? "Hypothecation Terminate" : srv;

                  return (
                    <div
                      key={srv}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-3 items-center text-xs"
                    >
                      <div className="font-bold text-slate-900">{srvDisplayName}</div>

                      <div>
                        <label className="font-semibold text-slate-500 block text-[10px] mb-0.5">
                          કુલ રકમ (₹)
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={item.totalAmount || ""}
                          onChange={(e) =>
                            updateServiceAccounting(srv, "totalAmount", Number(e.target.value))
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-500 block text-[10px] mb-0.5">
                          કુલ જમા (₹)
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={item.advancePayment || ""}
                          onChange={(e) =>
                            updateServiceAccounting(srv, "advancePayment", Number(e.target.value))
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-emerald-700"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-500 block text-[10px] mb-0.5">
                          બાકી
                        </label>
                        <div className="p-2 bg-slate-100 rounded-lg font-bold font-mono text-amber-700">
                          ₹{pending.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Accounting Summary */}
              <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-wrap justify-between items-center text-xs font-medium gap-4">
                <div>
                  <span className="text-slate-400">કુલ રકમ:</span>{" "}
                  <strong className="text-white text-sm">
                    ₹{overallTotals.totalAmt.toLocaleString("en-IN")}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">કુલ જમા:</span>{" "}
                  <strong className="text-emerald-400 text-sm">
                    ₹{overallTotals.totalAdv.toLocaleString("en-IN")}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">બાકી:</span>{" "}
                  <strong className="text-amber-400 text-sm">
                    ₹{overallTotals.pending.toLocaleString("en-IN")}
                  </strong>
                </div>
                <div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    Payment Status: {overallTotals.payStatus}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 10. Internal Notes / Employee Remarks */}
          {activeSubModule !== "insurance" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <User className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Internal Notes</h3>
                <p className="text-[11px] text-slate-400">Visible to internal team only</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  EMPLOYEE REMARKS
                </label>
                <textarea
                  rows={3}
                  placeholder="Notes visible to internal team only..."
                  value={employeeRemarks}
                  onChange={(e) => setEmployeeRemarks(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">REMINDER</label>
                  <input
                    type="date"
                    value={reminder}
                    onChange={(e) => setReminder(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">PRIORITY</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    ASSIGNED EMPLOYEE
                  </label>
                  <select
                    value={assignedEmployee}
                    onChange={(e) => setAssignedEmployee(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    {activeEmployees.map((emp) => (
                      <option key={emp.id} value={emp.name}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      )}
      </div>

        {/* Document Preview Modal */}
        {previewDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{previewDoc.name}</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Document Preview</p>
                </div>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 p-4 overflow-auto flex items-center justify-center bg-slate-100 min-h-[350px]">
                {previewDoc.url.startsWith("data:application/pdf") ? (
                  <iframe src={previewDoc.url} className="w-full h-[500px] rounded-xl border" title="PDF Preview" />
                ) : (
                  <img src={previewDoc.url} alt={previewDoc.name} className="max-h-[500px] max-w-full object-contain rounded-xl shadow-md border" />
                )}
              </div>
              <div className="p-3 border-t border-slate-100 flex justify-end bg-slate-50">
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}

        <datalist id="co-name-suggestions">
          {coNameSuggestions.map((val) => (
            <option key={val} value={val} />
          ))}
        </datalist>
        <datalist id="group-name-suggestions">
          {groupNameSuggestions.map((val) => (
            <option key={val} value={val} />
          ))}
        </datalist>
        <datalist id="vehicle-class-suggestions">
          {vehicleClassSuggestions.map((val) => (
            <option key={val} value={val} />
          ))}
        </datalist>
        <datalist id="maker-name-suggestions">
          {makerNameSuggestions.map((val) => (
            <option key={val} value={val} />
          ))}
        </datalist>
        <datalist id="model-name-suggestions">
          {modelNameSuggestions.map((val) => (
            <option key={val} value={val} />
          ))}
        </datalist>
        <datalist id="colour-suggestions">
          {colourSuggestions.map((val) => (
            <option key={val} value={val} />
          ))}
        </datalist>
        <datalist id="body-type-suggestions">
          {bodyTypeSuggestions.map((val) => (
            <option key={val} value={val} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

function ApplicationDetailsModal({
  app,
  onClose,
}: {
  app: ApplicationRecord;
  onClose: () => void;
}) {
  const v = app.vehicleDetails || {};

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto flex justify-center p-4 sm:p-6">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-mono font-bold tracking-tight text-blue-400">
                {app.vehicleNumber}
              </h2>
              <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-xs font-semibold uppercase">
                {app.applicationStatus}
              </span>
              {app.applicationType && (
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                    getAppTypeBadgeColor(app.applicationType)
                  )}
                >
                  Type: {app.applicationType}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Owner: {app.ownerName} • Phone: {app.mobileNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Assigned Staff</span>
              <p className="text-xs font-semibold text-slate-900 mt-1">
                {app.assignedEmployeeName || "Unassigned"}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">કુલ રકમ</span>
              <p className="text-xs font-semibold text-slate-900 mt-1">
                ₹{(app.amount || app.serviceAccounting?.Insurance?.totalAmount || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-600 uppercase">કુલ જમા</span>
              <p className="text-xs font-semibold text-emerald-800 mt-1">
                ₹{(app.totalPaid || app.serviceAccounting?.Insurance?.advancePayment || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <span className="text-[10px] font-bold text-amber-600 uppercase">બાકી</span>
              <p className="text-xs font-semibold text-amber-800 mt-1">
                ₹{(app.pendingAmount || app.serviceAccounting?.Insurance?.pendingAmount || 0).toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* Connected Invoice Banner */}
          {app.invoiceNumber && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-900 font-medium">
                <Receipt className="w-4 h-4 text-blue-600" />
                <span>Connected Invoice: <strong className="font-mono">{app.invoiceNumber}</strong></span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-600 text-white rounded-md">
                Connected to Accounting
              </span>
            </div>
          )}

          {/* Selected Services Accounting Breakdown */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" /> Selected Services & Accounting
            </h3>
            <div className="divide-y divide-slate-200">
              {app.services?.map((srv, idx) => {
                const sAcc = app.serviceAccounting?.[srv];
                return (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{srv}</span>
                    {sAcc ? (
                      <div className="flex items-center gap-4 text-slate-600 font-mono text-[11px]">
                        <span>Fee: ₹{sAcc.totalAmount}</span>
                        <span className="text-emerald-700">Adv: ₹{sAcc.advancePayment}</span>
                        <span className="text-amber-700 font-bold">Due: ₹{sAcc.pendingAmount}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 font-mono">Standard Service</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form 5 Details Card */}
          {app.subModule === "form5" && app.form5Details && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" /> Form 5 Details
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div>
                  <span className="text-slate-400">Application Option:</span>
                  <p className="font-bold text-blue-800">
                    {app.form5Details.form5Type === "new_hgv" ? "Form 5 New HGV" : "Form 5A Renew HGV"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Name:</span>
                  <p className="font-semibold">{app.form5Details.name || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Date Of Birth:</span>
                  <p className="font-semibold">{app.form5Details.dateOfBirth || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Application No:</span>
                  <p className="font-semibold font-mono">{app.form5Details.applicationNo || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Adhar No:</span>
                  <p className="font-semibold font-mono">{app.form5Details.aadhaarNumber || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">LL NO:</span>
                  <p className="font-semibold font-mono">{app.form5Details.llNumber || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">LL Issue Date:</span>
                  <p className="font-semibold">{app.form5Details.llIssueDate || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">LL Expiry Date:</span>
                  <p className="font-semibold">{app.form5Details.llExpiryDate || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">DL NO:</span>
                  <p className="font-semibold font-mono">{app.form5Details.dlNumber || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">nt validity:</span>
                  <p className="font-semibold">{app.form5Details.ntValidityDate || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">tr validity:</span>
                  <p className="font-semibold">{app.form5Details.trValidityDate || "—"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Vehicle Insurance breakdown */}
          {v.insuranceDetails && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" /> Vehicle Insurance Details
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div>
                  <span className="text-slate-400">Sub-Category:</span>
                  <p className="font-semibold">{v.insuranceDetails.policySubCategory || "Motor / Vehicle"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Vehicle Type:</span>
                  <p className="font-semibold">{v.insuranceDetails.vehicleType || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Company:</span>
                  <p className="font-semibold">{v.insuranceDetails.company || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Agent:</span>
                  <p className="font-semibold">{v.insuranceDetails.agent || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Agency:</span>
                  <p className="font-semibold">{v.insuranceDetails.insuranceAgency || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Reference:</span>
                  <p className="font-semibold">{v.insuranceDetails.reference || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Policy Type:</span>
                  <p className="font-semibold">{v.insuranceDetails.policyType || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Fuel Type:</span>
                  <p className="font-semibold">{v.insuranceDetails.fuelType || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-400">Premium Excl-GST:</span>
                  <p className="font-mono font-semibold">₹{v.insuranceDetails.premiumExclGst || 0}</p>
                </div>
                <div>
                  <span className="text-slate-400">GST @18%:</span>
                  <p className="font-mono font-semibold text-blue-700">₹{v.insuranceDetails.gstAmount || 0}</p>
                </div>
                <div>
                  <span className="text-slate-400">Total Premium:</span>
                  <p className="font-mono font-bold text-slate-900">₹{v.insuranceDetails.totalPremium || v.insuranceDetails.amount || 0}</p>
                </div>
                <div>
                  <span className="text-slate-400">Net Commission:</span>
                  <p className="font-mono font-bold text-emerald-700">₹{v.insuranceDetails.netCommission || 0}</p>
                </div>
              </div>
            </div>
          )}

          {/* All Expiries Section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" /> All Vehicle Expiry Dates
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-400 block font-semibold">INSURANCE EXPIRY</span>
                <span className="font-mono font-bold text-slate-800">
                  {v.insuranceDetails?.expiryDate || "—"}
                </span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-400 block font-semibold">FITNESS EXPIRY</span>
                <span className="font-mono font-bold text-slate-800">
                  {v.fitnessDetails?.expiryDate || "—"}
                </span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-400 block font-semibold">PERMIT EXPIRY</span>
                <span className="font-mono font-bold text-slate-800">
                  {v.permitDetails?.expiryDate || "—"}
                </span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-400 block font-semibold">TAX EXPIRY</span>
                <span className="font-mono font-bold text-slate-800">
                  {v.taxDetails?.isLumpsum ? "Lumpsum Tax" : v.taxDetails?.expiryDate || "—"}
                </span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-400 block font-semibold">PUC EXPIRY</span>
                <span className="font-mono font-bold text-slate-800">{v.pucExpiryDate || "—"}</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-400 block font-semibold">
                  REGISTRATION VALIDITY
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {v.registrationDetails?.registrationValidity || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Full Vehicle Technical Details Grid */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Car className="w-4 h-4 text-blue-600" /> Full Vehicle Specifications
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div>
                <span className="text-slate-400">Father/Husband:</span>
                <p className="font-semibold">{v.fatherHusbandName || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400">CO (C/O):</span>
                <p className="font-semibold">{v.coName || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400">Group Name:</span>
                <p className="font-semibold">{v.groupName || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400">Chassis No:</span>
                <p className="font-mono font-semibold">{v.chassisNumber || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400">Engine No:</span>
                <p className="font-mono font-semibold">{v.engineNumber || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400">Fuel Type:</span>
                <p className="font-semibold">{v.fuelType || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400">Maker Name:</span>
                <p className="font-semibold">{v.makerName || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400">Model Name:</span>
                <p className="font-semibold">{v.modelName || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400">Vehicle Class:</span>
                <p className="font-semibold">{v.vehicleClass || "—"}</p>
              </div>
              <div>
                <span className="text-slate-400">Gross / Unladen:</span>
                <p className="font-semibold">
                  {v.grossWeight || 0} kg / {v.unladenWeight || 0} kg
                </p>
              </div>
            </div>
          </div>

          {/* Internal Notes */}
          {app.remarks && (
            <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 text-amber-900">
              <h3 className="font-bold text-amber-950 mb-1">Employee Remarks</h3>
              <p className="text-xs">{app.remarks}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
