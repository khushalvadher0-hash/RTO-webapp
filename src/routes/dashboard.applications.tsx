import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";
import {
  subscribeApplications,
  saveApplicationAndVehicle,
  deleteApplication,
  fetchVehicleByNumber,
  computePermitExpiry,
  type ApplicationRecord,
  type VehicleMaster,
  type ServiceAccountingItem,
} from "@/lib/applications";
import { getSession } from "@/lib/auth";
import { fetchAllUsers } from "@/lib/userService";
import { createInvoice } from "@/lib/billing";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/applications")({
  component: ApplicationsPage,
});

const SERVICE_GROUPS = [
  {
    category: "LICENSE",
    items: ["License New", "License Renew", "License Endorsement"],
  },
  {
    category: "INSURANCE",
    items: ["Insurance"],
  },
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
      "Hypothecation Removal",
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
      "National Permit",
      "Gujarat Permit Renewal",
      "National Permit Renewal",
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

function ApplicationsPage() {
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

  useEffect(() => {
    const unsub = subscribeApplications((data) => {
      setApplications(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredApps = applications.filter((app) => {
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

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Applications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {applications.length} total records • updated a moment ago
          </p>
        </div>
        <div className="flex items-center gap-3">
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

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search vehicle, owner, mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
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

      {/* Applications Table - Showing All Columns & Necessary Details */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 text-center">SR No</th>
                <th className="py-3.5 px-4">Vehicle Number</th>
                <th className="py-3.5 px-4">Owner Name</th>
                <th className="py-3.5 px-4">Mobile</th>
                <th className="py-3.5 px-4">Service(s)</th>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Payment Status</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Advance Paid</th>
                <th className="py-3.5 px-4">Pending</th>
                <th className="py-3.5 px-4">Invoice No</th>
                <th className="py-3.5 px-4">Insurance Expiry</th>
                <th className="py-3.5 px-4">Fitness Expiry</th>
                <th className="py-3.5 px-4">Permit Expiry</th>
                <th className="py-3.5 px-4">Tax Expiry</th>
                <th className="py-3.5 px-4">PUC Expiry</th>
                <th className="py-3.5 px-4">Reg Validity</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={19} className="py-12 text-center text-slate-400">
                    Loading applications...
                  </td>
                </tr>
              ) : filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={19} className="py-12 text-center text-slate-400">
                    No applications found.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app, index) => {
                  const v = app.vehicleDetails || {};
                  const insExpiry = v.insuranceDetails?.expiryDate || "—";
                  const fitExpiry = v.fitnessDetails?.expiryDate || "—";
                  const permitExpiry = v.permitDetails?.expiryDate || "—";
                  const taxExpiry = v.taxDetails?.isLumpsum
                    ? "Lumpsum"
                    : v.taxDetails?.expiryDate || "—";
                  const pucExpiry = v.pucExpiryDate || "—";
                  const regValidity = v.registrationDetails?.registrationValidity || "—";

                  return (
                    <tr
                      key={app.id}
                      onClick={() => setViewingApp(app)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                        {app.vehicleNumber}
                      </td>
                      <td className="py-3.5 px-4">{app.ownerName}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{app.mobileNumber}</td>
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {app.services?.map((srv, idx) => (
                            <span
                              key={idx}
                              className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-medium"
                            >
                              {srv}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {app.assignedEmployeeName || "Unassigned"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            app.applicationStatus === "Approved" &&
                              "bg-emerald-50 text-emerald-700 border border-emerald-200",
                            app.applicationStatus === "Submitted" &&
                              "bg-blue-50 text-blue-700 border border-blue-200",
                            app.applicationStatus === "In Review" &&
                              "bg-amber-50 text-amber-700 border border-amber-200",
                            app.applicationStatus === "Rejected" &&
                              "bg-rose-50 text-rose-700 border border-rose-200",
                            app.applicationStatus === "On Hold" &&
                              "bg-purple-50 text-purple-700 border border-purple-200",
                            app.applicationStatus === "Draft" &&
                              "bg-slate-100 text-slate-700 border border-slate-200"
                          )}
                        >
                          {app.applicationStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            app.paymentStatus === "Paid" &&
                              "bg-emerald-50 text-emerald-700 border border-emerald-200",
                            app.paymentStatus === "Pending" &&
                              "bg-amber-50 text-amber-700 border border-amber-200",
                            app.paymentStatus === "Partial" &&
                              "bg-blue-50 text-blue-700 border border-blue-200"
                          )}
                        >
                          {app.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        ₹{app.amount?.toLocaleString("en-IN") || 0}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-700">
                        ₹{(app.totalPaid || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-amber-700">
                        ₹{(app.pendingAmount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-blue-600">
                        {app.invoiceNumber || "—"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{insExpiry}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{fitExpiry}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{permitExpiry}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{taxExpiry}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{pucExpiry}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{regValidity}</td>
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
          editingApp={editingApp}
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

function ApplicationFormModal({
  editingApp,
  onClose,
}: {
  editingApp?: ApplicationRecord | null;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState(editingApp?.vehicleNumber || "");
  const [phone, setPhone] = useState(editingApp?.mobileNumber || editingApp?.vehicleDetails?.phone || "");
  const [ownerName, setOwnerName] = useState(editingApp?.ownerName || editingApp?.vehicleDetails?.ownerName || "");
  const [fatherHusbandName, setFatherHusbandName] = useState(editingApp?.vehicleDetails?.fatherHusbandName || "");
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
  const [insuranceCompany, setInsuranceCompany] = useState(editingApp?.vehicleDetails?.insuranceDetails?.company || "");
  const [insurancePolicyNo, setInsurancePolicyNo] = useState(editingApp?.vehicleDetails?.insuranceDetails?.policyNumber || "");
  const [insurancePolicyType, setInsurancePolicyType] = useState(editingApp?.vehicleDetails?.insuranceDetails?.policyType || "Comprehensive");
  const [insuranceIssueDate, setInsuranceIssueDate] = useState(editingApp?.vehicleDetails?.insuranceDetails?.issueDate || "");
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState(editingApp?.vehicleDetails?.insuranceDetails?.expiryDate || "");
  const [insuranceAmount, setInsuranceAmount] = useState<number>(editingApp?.vehicleDetails?.insuranceDetails?.amount || 0);
  const [insurancePlace, setInsurancePlace] = useState(editingApp?.vehicleDetails?.insuranceDetails?.insurancePlace || "");

  // Permit Section
  const [permitType, setPermitType] = useState(editingApp?.vehicleDetails?.permitDetails?.permitType || "Gujarat Permit");
  const [permitIssueDate, setPermitIssueDate] = useState(editingApp?.vehicleDetails?.permitDetails?.issueDate || "");
  const [permitExpiryDate, setPermitExpiryDate] = useState(editingApp?.vehicleDetails?.permitDetails?.expiryDate || "");

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

  // Remarks / Internal Notes
  const [employeeRemarks, setEmployeeRemarks] = useState(editingApp?.remarks || "");
  const [reminder, setReminder] = useState(editingApp?.reminder || "");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Urgent">(editingApp?.priority || "Low");
  const [assignedEmployee, setAssignedEmployee] = useState(editingApp?.assignedEmployeeName || "");
  const [activeEmployees, setActiveEmployees] = useState<{ id: string; name: string }[]>([]);

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
        setInsuranceCompany(existing.insuranceDetails.company || "");
        setInsurancePolicyNo(existing.insuranceDetails.policyNumber || "");
        setInsurancePolicyType(existing.insuranceDetails.policyType || "Comprehensive");
        setInsuranceIssueDate(existing.insuranceDetails.issueDate || "");
        setInsuranceExpiryDate(existing.insuranceDetails.expiryDate || "");
        setInsuranceAmount(existing.insuranceDetails.amount || 0);
        setInsurancePlace(existing.insuranceDetails.insurancePlace || "");
      }
      if (existing.permitDetails) {
        setPermitType(existing.permitDetails.permitType || "Gujarat Permit");
        setPermitIssueDate(existing.permitDetails.issueDate || "");
        setPermitExpiryDate(existing.permitDetails.expiryDate || "");
      }
      if (existing.registrationDetails) {
        setDateOfRegistration(existing.registrationDetails.dateOfRegistration || "");
        setRegistrationValidity(existing.registrationDetails.registrationValidity || "");
      }
      if (existing.documents) {
        setUploadedDocs(existing.documents);
      }
    }
  };

  const handlePermitIssueChange = (dateVal: string) => {
    setPermitIssueDate(dateVal);
    const computedExp = computePermitExpiry(permitType, dateVal);
    setPermitExpiryDate(computedExp);
  };

  const handlePermitTypeChange = (typeVal: string) => {
    setPermitType(typeVal);
    if (permitIssueDate) {
      const computedExp = computePermitExpiry(typeVal, permitIssueDate);
      setPermitExpiryDate(computedExp);
    }
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
          [srv]: { totalAmount: 500, advancePayment: 0 },
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

    selectedServices.forEach((srv) => {
      const item = serviceAccountingMap[srv] || { totalAmount: 0, advancePayment: 0 };
      totalAmt += item.totalAmount;
      totalAdv += item.advancePayment;
    });

    const pending = Math.max(0, totalAmt - totalAdv);
    let payStatus: "Paid" | "Pending" | "Partial" = "Pending";
    if (totalAmt > 0 && totalAdv >= totalAmt) payStatus = "Paid";
    else if (totalAdv > 0) payStatus = "Partial";

    return { totalAmt, totalAdv, pending, payStatus };
  }, [selectedServices, serviceAccountingMap]);

  const handleDocSimulateUpload = (docName: string) => {
    setUploadedDocs((prev) => ({
      ...prev,
      [docName]: `https://example.com/docs/${docName}.pdf`,
    }));
    toast.success(`${docName} uploaded!`);
  };

  const handleSave = async (status: "Draft" | "Submitted") => {
    if (!vehicleNumber.trim()) {
      toast.error("Vehicle Number is required!");
      return;
    }
    if (selectedServices.length === 0) {
      toast.error("Please select at least one service!");
      return;
    }

    setSaving(true);

    const vehicleDetails: VehicleMaster = {
      id: vehicleNumber.trim().toUpperCase().replace(/[\s-]/g, ""),
      vehicleNumber,
      phone,
      ownerName,
      fatherHusbandName,
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
        amount: insuranceAmount,
        insurancePlace,
      },
      permitDetails: {
        permitType,
        issueDate: permitIssueDate,
        expiryDate: permitExpiryDate,
      },
      registrationDetails: {
        dateOfRegistration,
        registrationValidity,
      },
      documents: uploadedDocs,
    };

    // Format service accounting details map
    const serviceAccountingPayload: Record<string, ServiceAccountingItem> = {};
    selectedServices.forEach((srv) => {
      const item = serviceAccountingMap[srv] || { totalAmount: 0, advancePayment: 0 };
      serviceAccountingPayload[srv] = {
        serviceName: srv,
        totalAmount: item.totalAmount,
        advancePayment: item.advancePayment,
        pendingAmount: Math.max(0, item.totalAmount - item.advancePayment),
      };
    });

    let generatedInvoiceNumber = "";
    let generatedInvoiceId = "";

    // Connect to Accounting & Generate Invoice if selected
    if (shouldGenerateInvoice) {
      try {
        const session = getSession();
        const invoiceItems = selectedServices.map((srv) => {
          const item = serviceAccountingMap[srv] || { totalAmount: 0, advancePayment: 0 };
          return {
            serviceId: srv,
            serviceName: srv,
            vehicleNumber,
            quantity: 1,
            unitPrice: item.totalAmount,
            amount: item.totalAmount,
            tax: 0,
            total: item.totalAmount,
          };
        });

        const createdInv = await createInvoice(
          {
            id: vehicleNumber.trim().toUpperCase().replace(/[\s-]/g, ""),
            name: ownerName || vehicleNumber,
            mo: phone,
            application: address,
            mvNo: vehicleNumber,
            work: selectedServices.join(", "),
          } as any,
          invoiceItems,
          new Date().toISOString().split("T")[0],
          new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          session?.name || "System"
        );

        generatedInvoiceNumber = createdInv.invoiceNumber;
        generatedInvoiceId = createdInv.id;
        toast.success(`Invoice ${generatedInvoiceNumber} generated & connected to Accounting!`);
      } catch (invErr: any) {
        console.error("Invoice auto-generation error:", invErr);
      }
    }

    try {
      await saveApplicationAndVehicle(
        {
          vehicleId: vehicleNumber.trim().toUpperCase().replace(/[\s-]/g, ""),
          vehicleNumber,
          ownerName,
          mobileNumber: phone,
          services: selectedServices,
          serviceAccounting: serviceAccountingPayload,
          assignedEmployeeName: assignedEmployee,
          applicationStatus: status,
          paymentStatus: overallTotals.payStatus,
          amount: overallTotals.totalAmt,
          totalPaid: overallTotals.totalAdv,
          pendingAmount: overallTotals.pending,
          invoiceId: generatedInvoiceId || editingApp?.invoiceId,
          invoiceNumber: generatedInvoiceNumber || editingApp?.invoiceNumber,
          expiryDate: permitExpiryDate || insuranceExpiryDate || taxExpiryDate || pucExpiryDate,
          remarks: employeeRemarks,
          reminder,
          priority,
          vehicleDetails,
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
    "National Permit",
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
          {/* Services Tab Nav Pill */}
          <div className="flex gap-2">
            <span className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-semibold shadow-sm">
              Services
            </span>
          </div>

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

              <div className="md:col-span-2">
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

              <div>
                <label className="font-semibold text-slate-700 block mb-1">PUC EXPIRY DATE</label>
                <input
                  type="date"
                  value={pucExpiryDate}
                  onChange={(e) => setPucExpiryDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>
            </div>
          </div>

          {/* 2. Tax Details Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tax Details</h3>
                  <p className="text-[11px] text-slate-400">Lumpsum or period-based tax</p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={isLumpsumTax}
                  onChange={(e) => setIsLumpsumTax(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                Lumpsum Tax
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
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
            </div>
          </div>

          {/* 3. Fitness Details Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <FileCheck className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Fitness Details</h3>
                <p className="text-[11px] text-slate-400">Fitness validity & details</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
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
            </div>
          </div>

          {/* 4. Insurance Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <Shield className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Insurance Details</h3>
                <p className="text-[11px] text-slate-400">Policy & coverage information</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">INSURANCE COMPANY</label>
                <input
                  type="text"
                  placeholder="ICICI Lombard / HDFC Ergo"
                  value={insuranceCompany}
                  onChange={(e) => setInsuranceCompany(e.target.value)}
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
                <label className="font-semibold text-slate-700 block mb-1">POLICY TYPE</label>
                <select
                  value={insurancePolicyType}
                  onChange={(e) => setInsurancePolicyType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="Comprehensive">Comprehensive</option>
                  <option value="Third Party">Third Party</option>
                  <option value="Zero Dep">Zero Dep</option>
                </select>
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
                <label className="font-semibold text-slate-700 block mb-1">AMOUNT (₹)</label>
                <input
                  type="number"
                  placeholder="₹"
                  value={insuranceAmount}
                  onChange={(e) => setInsuranceAmount(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>
              <div className="md:col-span-3">
                <label className="font-semibold text-slate-700 block mb-1">INSURANCE PLACE</label>
                <input
                  type="text"
                  placeholder="Company branch / location (e.g. Ahmedabad Branch)"
                  value={insurancePlace}
                  onChange={(e) => setInsurancePlace(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* 5. Permit Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <Building2 className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Permit Details</h3>
                <p className="text-[11px] text-slate-400">Auto expiry rules calculation</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">PERMIT TYPE</label>
                <select
                  value={permitType}
                  onChange={(e) => handlePermitTypeChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="Gujarat Permit">Gujarat Permit (5 Yrs)</option>
                  <option value="National Permit">National Permit (5 Yrs)</option>
                  <option value="National Permit Authorization">
                    National Permit Authorization (1 Yr)
                  </option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">ISSUE DATE</label>
                <input
                  type="date"
                  value={permitIssueDate}
                  onChange={(e) => handlePermitIssueChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  EXPIRY DATE (AUTO CALCULATED)
                </label>
                <input
                  type="date"
                  value={permitExpiryDate}
                  readOnly
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold font-mono text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* 6. Renewal of Registration (NT) Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Renewal of Registration (NT)</h3>
                <p className="text-[11px] text-slate-400">Registration renewal validity</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
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
            </div>
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
                  const item = serviceAccountingMap[srv] || { totalAmount: 500, advancePayment: 0 };
                  const pending = Math.max(0, item.totalAmount - item.advancePayment);

                  return (
                    <div
                      key={srv}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-3 items-center text-xs"
                    >
                      <div className="font-bold text-slate-900">{srv}</div>

                      <div>
                        <label className="font-semibold text-slate-500 block text-[10px] mb-0.5">
                          TOTAL SERVICE FEE (₹)
                        </label>
                        <input
                          type="number"
                          value={item.totalAmount}
                          onChange={(e) =>
                            updateServiceAccounting(srv, "totalAmount", Number(e.target.value))
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-500 block text-[10px] mb-0.5">
                          ADVANCE PAYMENT (₹)
                        </label>
                        <input
                          type="number"
                          value={item.advancePayment}
                          onChange={(e) =>
                            updateServiceAccounting(srv, "advancePayment", Number(e.target.value))
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-emerald-700"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-500 block text-[10px] mb-0.5">
                          PENDING AMOUNT
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
          )}

          {/* 10. Internal Notes / Employee Remarks */}
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Fees</span>
              <p className="text-xs font-semibold text-slate-900 mt-1">
                ₹{(app.amount || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Advance Paid</span>
              <p className="text-xs font-semibold text-emerald-800 mt-1">
                ₹{(app.totalPaid || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <span className="text-[10px] font-bold text-amber-600 uppercase">Pending Due</span>
              <p className="text-xs font-semibold text-amber-800 mt-1">
                ₹{(app.pendingAmount || 0).toLocaleString("en-IN")}
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
