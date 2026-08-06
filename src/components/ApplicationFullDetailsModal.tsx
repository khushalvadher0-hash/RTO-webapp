import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Car,
  FileText,
  Shield,
  FileCheck,
  Receipt,
  Activity,
  UserCheck,
  Calendar,
  CheckCircle2,
  XCircle,
  Hash,
  Download,
  Printer,
} from "lucide-react";

interface ApplicationFullDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: any;
  vehicle?: any;
}

const getAppTypeColor = (type?: string) => {
  switch (type) {
    case "Home":
      return "bg-[#F8F9FA] text-slate-800 border-slate-200";
    case "Faceless":
      return "bg-[#EAF4FF] text-blue-900 border-blue-200";
    case "Out Of Bhavnagar":
      return "bg-[#FFEAEA] text-rose-900 border-rose-200";
    case "CNG":
      return "bg-[#ECFFF0] text-emerald-900 border-emerald-200";
    case "Out Of Bhavnagar To Bhavnagar":
      return "bg-[#FFF4E6] text-amber-900 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-IN");
};

export function ApplicationFullDetailsModal({
  open,
  onOpenChange,
  application,
  vehicle,
}: ApplicationFullDetailsModalProps) {
  if (!application && !vehicle) return null;

  const app = application || {};
  const isLicence = app.subModule === "licence" || !!app.licenseDetails;
  const veh = vehicle || (app as any).vehicleDetails || (app as any).vehicleMaster || app || {};
  const track = app.trackExpiry || veh.trackExpiry || {};

  // Extract insurance details
  const ins = app.insuranceDetails || veh.insuranceDetails || {};
  // Extract permit details
  const permit = app.permitDetails || veh.permitDetails || {};
  // Extract tax details
  const tax = app.taxDetails || veh.taxDetails || {};
  // Extract fitness details
  const fitness = app.fitnessDetails || veh.fitnessDetails || {};
  // Extract reg details
  const reg = app.registrationDetails || veh.registrationDetails || {};

  const services: string[] = app.services || [];
  const serviceAccounting = app.serviceAccounting || {};
  const serviceFees = app.serviceFees || {};
  const serviceAdvances = app.serviceAdvances || {};
  const totalFee = app.totalFee || app.amount || app.totalAmount || 0;
  const totalAdvance = app.totalAdvance || app.totalPaid || app.advancePayment || 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 bg-slate-50/50">
        <DialogHeader className="border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold text-slate-900">
                  Application Details
                </DialogTitle>
                <Badge
                  variant="outline"
                  className={`font-semibold border ${getAppTypeColor(app.applicationType || veh.applicationType)}`}
                >
                  {app.applicationType || veh.applicationType || "Home"}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Application ID: <span className="font-mono font-bold text-slate-800">{app.applicationId || app.id || "—"}</span>
                {" • "}
                {(!isLicence && (app.vehicleNumber || veh.vehicleNumber)) && (
                  <>
                    Vehicle: <span className="font-mono font-bold text-slate-800">{app.vehicleNumber || veh.vehicleNumber || "—"}</span>
                    {" • "}
                  </>
                )}
                Owner: <span className="font-semibold text-slate-800">{app.ownerName || veh.ownerName || "—"}</span>
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs">
                <Printer className="size-3.5 mr-1" /> Print
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4 text-xs">
          {!isLicence ? (
            <>
              {/* Section 1: Vehicle & Owner Master Details */}
              <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm border-b pb-2">
                  <Car className="size-4 text-blue-600" />
                  <span>1. Vehicle & Owner Master Details</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Vehicle Number</span>
                    <span className="font-mono font-bold text-slate-900">{app.vehicleNumber || veh.vehicleNumber || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Owner Name</span>
                    <span className="font-semibold text-slate-900">{app.ownerName || veh.ownerName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Mobile Number</span>
                    <span className="font-mono font-semibold text-slate-900">{app.mobileNumber || veh.mobileNumber || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Father/Husband Name</span>
                    <span className="font-semibold text-slate-900">{veh.fatherHusbandName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">CO Name (C/O)</span>
                    <span className="font-semibold text-slate-900">{app.coName || veh.coName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Group Name</span>
                    <span className="font-semibold text-slate-900">{app.groupName || veh.groupName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Chassis Number</span>
                    <span className="font-mono font-semibold text-slate-900">{veh.chassisNumber || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Engine Number</span>
                    <span className="font-mono font-semibold text-slate-900">{veh.engineNumber || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Fuel Type</span>
                    <span className="font-semibold text-slate-900">{veh.fuelType || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Maker Name</span>
                    <span className="font-semibold text-slate-900">{veh.makerName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Model Name</span>
                    <span className="font-semibold text-slate-900">{veh.modelName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Vehicle Class</span>
                    <span className="font-semibold text-slate-900">{veh.vehicleClass || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Seating Capacity</span>
                    <span className="font-semibold text-slate-900">{veh.seatingCapacity || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Colour</span>
                    <span className="font-semibold text-slate-900">{veh.colour || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Body Type</span>
                    <span className="font-semibold text-slate-900">{veh.bodyType || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Registration Date</span>
                    <span className="font-mono font-semibold text-slate-900">{formatDate(veh.registrationDate)}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Insurance Details (17 Fields) */}
              <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <Shield className="size-4 text-emerald-600" />
                    <span>2. Insurance Details</span>
                  </div>
                  <Badge variant={track.insurance !== false ? "default" : "secondary"} className="text-[10px]">
                    {track.insurance !== false ? "Dashboard Expiry Active" : "Dashboard Expiry Hidden"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Policy Sub-Category</span>
                    <span className="font-semibold text-slate-900">{ins.policySubCategory || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Vehicle Type</span>
                    <span className="font-semibold text-slate-900">{ins.vehicleType || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Agent</span>
                    <span className="font-semibold text-slate-900">{ins.agent || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Insurance Agency</span>
                    <span className="font-semibold text-slate-900">{ins.insuranceAgency || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Reference</span>
                    <span className="font-semibold text-slate-900">{ins.reference || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Policy No</span>
                    <span className="font-mono font-semibold text-slate-900">{ins.policyNo || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Insurer Company</span>
                    <span className="font-semibold text-slate-900">{ins.insurerCompany || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Premium Excl. GST</span>
                    <span className="font-mono font-semibold text-slate-900">₹{ins.premiumExclGst || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">GST Amount (18%)</span>
                    <span className="font-mono font-semibold text-slate-900">₹{ins.gstAmount || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Premium</span>
                    <span className="font-mono font-bold text-emerald-700">₹{ins.totalPremium || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Insurer Commission</span>
                    <span className="font-mono font-semibold text-slate-900">₹{ins.insurerCommission || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Client Discount</span>
                    <span className="font-mono font-semibold text-slate-900">₹{ins.clientDiscount || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Net Commission</span>
                    <span className="font-mono font-bold text-blue-700">₹{ins.netCommission || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Insurance Expiry</span>
                    <span className="font-mono font-bold text-rose-700">{formatDate(ins.expiryDate)}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Permit Details (3 Fixed Permits) */}
              <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <FileCheck className="size-4 text-indigo-600" />
                    <span>3. Permit Details (Fixed 3 Permits)</span>
                  </div>
                  <Badge variant={track.permit !== false ? "default" : "secondary"} className="text-[10px]">
                    {track.permit !== false ? "Dashboard Expiry Active" : "Dashboard Expiry Hidden"}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <span className="font-bold text-slate-900 block mb-1 text-xs">Gujarat Permit</span>
                    <div className="space-y-1 text-[11px]">
                      <div><span className="text-slate-400">Issue Date:</span> <span className="font-mono font-semibold">{formatDate(permit.gujaratPermitIssueDate)}</span></div>
                      <div><span className="text-slate-400">Expiry Date (+5 Yrs):</span> <span className="font-mono font-bold text-slate-900">{formatDate(permit.gujaratPermitExpiryDate || permit.expiryDate)}</span></div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <span className="font-bold text-slate-900 block mb-1 text-xs">National Permit</span>
                    <div className="space-y-1 text-[11px]">
                      <div><span className="text-slate-400">Issue Date:</span> <span className="font-mono font-semibold">{formatDate(permit.nationalPermitIssueDate)}</span></div>
                      <div><span className="text-slate-400">Expiry Date (+5 Yrs):</span> <span className="font-mono font-bold text-slate-900">{formatDate(permit.nationalPermitExpiryDate)}</span></div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <span className="font-bold text-slate-900 block mb-1 text-xs">National Permit Authorization</span>
                    <div className="space-y-1 text-[11px]">
                      <div><span className="text-slate-400">Issue Date:</span> <span className="font-mono font-semibold">{formatDate(permit.nationalAuthIssueDate)}</span></div>
                      <div><span className="text-slate-400">Expiry Date (+1 Yr):</span> <span className="font-mono font-bold text-slate-900">{formatDate(permit.nationalAuthExpiryDate)}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Tax, Fitness, PUC & Reg Validity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <Receipt className="size-4 text-amber-600" />
                      <span>4. Tax Details</span>
                    </div>
                    <Badge variant={track.tax !== false ? "default" : "secondary"} className="text-[10px]">
                      {track.tax !== false ? "Track Active" : "Hidden"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Tax Mode</span>
                      <span className="font-semibold text-slate-900">{tax.isLumpsum ? "Lumpsum Tax" : "Period Tax"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Tax Amount</span>
                      <span className="font-mono font-bold text-slate-900">₹{tax.amount || 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Issue Date</span>
                      <span className="font-mono font-semibold text-slate-900">{formatDate(tax.issueDate)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Expiry Date</span>
                      <span className="font-mono font-bold text-amber-700">{tax.isLumpsum ? "Lumpsum (No Expiry)" : formatDate(tax.expiryDate)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <Activity className="size-4 text-cyan-600" />
                      <span>5. Fitness, PUC & Reg Validity</span>
                    </div>
                    <Badge variant={track.fitness !== false ? "default" : "secondary"} className="text-[10px]">
                      {track.fitness !== false ? "Track Active" : "Hidden"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Fitness Expiry</span>
                      <span className="font-mono font-bold text-cyan-700">{formatDate(fitness.expiryDate)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">PUC Expiry</span>
                      <span className="font-mono font-bold text-emerald-700">{formatDate(app.pucExpiryDate || veh.pucExpiryDate)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Date of Reg</span>
                      <span className="font-mono font-semibold text-slate-900">{formatDate(reg.registrationDate || veh.registrationDate)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Reg Validity</span>
                      <span className="font-mono font-bold text-slate-900">{formatDate(reg.registrationValidity)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Licence Application & Applicant Details */}
              <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm border-b pb-2">
                  <UserCheck className="size-4 text-blue-600" />
                  <span>1. Licence Application & Applicant Details</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Applicant Name</span>
                    <span className="font-semibold text-slate-900">{app.ownerName || app.clientName || veh.ownerName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Mobile Number</span>
                    <span className="font-mono font-semibold text-slate-900">{app.mobileNumber || veh.mobileNumber || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Date of Birth</span>
                    <span className="font-mono font-semibold text-slate-900">{formatDate(app.licenseDetails?.dateOfBirth || app.dateOfBirth)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Licence Status</span>
                    <span className="font-bold text-slate-900">{app.status || app.taskStatus || "—"}</span>
                  </div>
                  {app.rtoExpense !== undefined && app.rtoExpense > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-600 block">RTO Expense</span>
                      <span className="font-bold text-amber-700 font-mono text-xs">₹{app.rtoExpense}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Licence Step Details */}
              {app.licenseDetails && (
                <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm border-b pb-2">
                    <FileCheck className="size-4 text-indigo-600" />
                    <span>2. Licence Step Details</span>
                  </div>
                  {(() => {
                    const lic = app.licenseDetails || {};
                    return (
                      <div className="space-y-4">
                        {(lic.newLearningLicence?.applicationNo || lic.dlNewLlEndorsement?.applicationNo || lic.llRenewClass?.applicationNo || lic.dlRenewRetest?.applicationNo) && (
                          <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            {lic.newLearningLicence?.enabled && lic.newLearningLicence?.applicationNo && (
                              <div><span className="font-semibold text-slate-600">New Learning Licence App No:</span> <span className="font-mono font-bold text-slate-800">{lic.newLearningLicence.applicationNo}</span></div>
                            )}
                            {lic.dlNewLlEndorsement?.enabled && lic.dlNewLlEndorsement?.applicationNo && (
                              <div><span className="font-semibold text-slate-600">DL Endorsement App No:</span> <span className="font-mono font-bold text-slate-800">{lic.dlNewLlEndorsement.applicationNo}</span></div>
                            )}
                            {lic.llRenewClass?.enabled && lic.llRenewClass?.applicationNo && (
                              <div><span className="font-semibold text-slate-600">LL Renew Class App No:</span> <span className="font-mono font-bold text-slate-800">{lic.llRenewClass.applicationNo}</span></div>
                            )}
                            {lic.dlRenewRetest?.enabled && lic.dlRenewRetest?.applicationNo && (
                              <div><span className="font-semibold text-slate-600">DL Renew + Retest App No:</span> <span className="font-mono font-bold text-slate-800">{lic.dlRenewRetest.applicationNo}</span></div>
                            )}
                          </div>
                        )}

                        {/* Step 1 */}
                        {(lic.newLearningLicence?.enabled || lic.dlNewLlEndorsement?.enabled || lic.llRenewClass?.enabled || lic.dlRenewRetest?.enabled) ? (
                          <div className="bg-slate-50 p-3 rounded-lg border space-y-1">
                            <div className="flex items-center gap-2 font-bold text-blue-900 text-xs">
                              <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                              <span>STEP 1: LEARNING / DL DETAILS</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-700">
                              <div><span className="font-semibold text-slate-500 block">LL / DL NO:</span> {lic.newLearningLicence?.step1?.llNumber || lic.dlNewLlEndorsement?.step1?.dlNumber || lic.llRenewClass?.step1?.llNumber || lic.dlRenewRetest?.step1?.dlNumber || "—"}</div>
                              <div><span className="font-semibold text-slate-500 block">ISSUE DATE:</span> {formatDate(lic.newLearningLicence?.step1?.issueDate || lic.dlNewLlEndorsement?.step1?.issueDate || lic.llRenewClass?.step1?.issueDate || lic.dlRenewRetest?.step1?.issueDate)}</div>
                              <div><span className="font-semibold text-slate-500 block">EXPIRY / VALIDITY:</span> {formatDate(lic.newLearningLicence?.step1?.expiryDate || lic.dlNewLlEndorsement?.step1?.validityDate || lic.llRenewClass?.step1?.expiryDate || lic.dlRenewRetest?.step1?.expiryDate)}</div>
                            </div>
                          </div>
                        ) : null}

                        {/* Step 2 */}
                        {(lic.newLearningLicence?.enabled || lic.dlNewLlEndorsement?.enabled || lic.llRenewClass?.enabled || lic.dlRenewRetest?.enabled) ? (
                          <div className="bg-slate-50 p-3 rounded-lg border space-y-1">
                            <div className="flex items-center gap-2 font-bold text-blue-900 text-xs">
                              <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                              <span>STEP 2: DRIVING LICENCE DETAILS</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-700">
                              <div><span className="font-semibold text-slate-500 block">DL NO:</span> {lic.newLearningLicence?.step2?.dlNumber || lic.dlNewLlEndorsement?.step2?.llNumber || lic.llRenewClass?.step2?.dlNumber || lic.dlRenewRetest?.step2?.dlNumber || "—"}</div>
                              <div><span className="font-semibold text-slate-500 block">ISSUE DATE:</span> {formatDate(lic.newLearningLicence?.step2?.issueDate || lic.dlNewLlEndorsement?.step2?.issueDate || lic.llRenewClass?.step2?.issueDate || lic.dlRenewRetest?.step2?.issueDate)}</div>
                              <div><span className="font-semibold text-slate-500 block">VALIDITY DATE:</span> {formatDate(lic.newLearningLicence?.step2?.validityDate || lic.dlNewLlEndorsement?.step2?.expiryDate || lic.llRenewClass?.step2?.validityDate || lic.dlRenewRetest?.step2?.validityDate)}</div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {/* Section 5: Service Selection & Financial Accounting Breakdown */}
          <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <FileText className="size-4 text-purple-600" />
                <span>6. Selected Services & Accounting Breakdown</span>
              </div>
              <span className="font-mono font-bold text-xs text-slate-700">
                Total Fee: ₹{totalFee}
              </span>
            </div>

            {services.length === 0 ? (
              <p className="text-slate-400 italic text-[11px]">No services selected for this application.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-bold border-b">
                    <tr>
                      <th className="p-2">SERVICE NAME</th>
                      <th className="p-2 text-right">FEE (₹)</th>
                      <th className="p-2 text-right">ADVANCE PAID (₹)</th>
                      <th className="p-2 text-right">PENDING BALANCE (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium text-slate-800">
                    {services.map((srv) => {
                      const item = serviceAccounting[srv] || {};
                      const fee = Number(item.totalAmount ?? serviceFees[srv] ?? 0);
                      const adv = Number(item.advancePayment ?? serviceAdvances[srv] ?? 0);
                      const bal = Math.max(0, fee - adv);
                      return (
                        <tr key={srv} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-900">{srv}</td>
                          <td className="p-2 text-right font-mono font-semibold">₹{fee}</td>
                          <td className="p-2 text-right font-mono font-semibold text-emerald-600">₹{adv}</td>
                          <td className="p-2 text-right font-mono font-bold text-rose-600">₹{bal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t font-bold text-xs">
                    <tr>
                      <td className="p-2 uppercase text-slate-500 text-[10px]">Total Accounting</td>
                      <td className="p-2 text-right font-mono text-slate-900">₹{totalFee}</td>
                      <td className="p-2 text-right font-mono text-emerald-700">₹{totalAdvance}</td>
                      <td className="p-2 text-right font-mono text-rose-700">
                        ₹{Math.max(0, totalFee - totalAdvance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Section 6: Internal Notes & Employee Assignment */}
          <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm border-b pb-2">
              <UserCheck className="size-4 text-blue-600" />
              <span>7. Internal Notes & Employee Assignment</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-slate-700">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Employee</span>
                <span className="font-semibold text-slate-900">{app.assignedEmployeeName || "Unassigned"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Application Type</span>
                <span className="font-semibold text-slate-900">{app.applicationType || "Home"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Appointment Date</span>
                <span className="font-mono font-semibold text-slate-900">{formatDate(app.appointmentDate)}</span>
              </div>
              <div className="col-span-2 md:col-span-3">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Remarks / Internal Notes</span>
                <p className="p-2.5 bg-slate-50 border rounded-lg text-slate-800 mt-1 whitespace-pre-wrap">
                  {app.internalRemarks || app.remarks || "No remarks entered."}
                </p>
              </div>
            </div>
          </div>

          {/* Section 8: Timeline & Activity Log */}
          <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm border-b pb-2">
              <Activity className="size-4 text-rose-600" />
              <span>8. Timeline & Activity Log</span>
            </div>
            <div className="space-y-3">
              {(app.activityLogs ?? []).length === 0 && (app.activity ?? []).length === 0 ? (
                <p className="text-slate-400 italic text-[11px]">No activity history yet.</p>
              ) : (
                <ol className="relative border-l border-slate-200 pl-4 space-y-4">
                  {(app.activityLogs ?? []).length > 0
                    ? (app.activityLogs ?? []).map((log: any, idx: number) => (
                        <li key={log.id || idx} className="text-xs relative">
                          <span className="absolute -left-[21px] mt-1 w-2 h-2 rounded-full bg-rose-500" />
                          <div className="font-semibold text-slate-800 leading-tight">{log.action}</div>
                          {log.field && (log.oldValue !== undefined || log.newValue !== undefined) && (
                            <div className="text-slate-500 mt-0.5 font-medium">
                              {log.field}: <span className="line-through text-slate-400">{log.oldValue || "—"}</span> → <span className="font-semibold text-slate-700">{log.newValue || "—"}</span>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 mt-1">
                            {log.actor} • {new Date(log.timestamp).toLocaleString("en-IN")}
                          </div>
                        </li>
                      ))
                    : (app.activity ?? []).map((a: any, idx: number) => (
                        <li key={a.id || idx} className="text-xs relative">
                          <span className="absolute -left-[21px] mt-1 w-2 h-2 rounded-full bg-rose-500" />
                          <div className="text-slate-800 leading-tight">{a.message}</div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {a.actor} • {new Date(a.at).toLocaleString("en-IN")}
                          </div>
                        </li>
                      ))}
                </ol>
              )}
            </div>
          </div>

          {/* Section 9: Documents & Uploaded Attachments */}
          <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm border-b pb-2">
              <FileCheck className="size-4 text-emerald-600" />
              <span>9. Documents & Uploaded Attachments</span>
            </div>
            {(() => {
              const attachments = app.attachments || app.documents || veh.attachments || veh.documents || [];
              if (attachments.length === 0) {
                return <p className="text-slate-400 italic text-[11px]">No uploaded documents for this application.</p>;
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((a: any, idx: number) => {
                    const name = a.name || a.title || `Document #${idx + 1}`;
                    const url = a.downloadUrl || a.url || a.fileUrl;
                    if (!url) return null;
                    return (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2.5 bg-slate-50 border rounded-lg hover:bg-slate-100 transition-colors text-blue-600 font-semibold"
                      >
                        <FileText className="size-4 shrink-0 text-slate-400" />
                        <span className="truncate">{name}</span>
                      </a>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
