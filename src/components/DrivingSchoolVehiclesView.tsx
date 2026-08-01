import React, { useState, useEffect, useMemo } from "react";
import {
  Car,
  Plus,
  Calendar,
  Gauge,
  FileText,
  Upload,
  Camera,
  CheckCircle,
  X,
  User,
  Fuel,
  DollarSign,
  Info,
  Clock,
  Printer,
  FileSpreadsheet,
  AlertCircle,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  subscribeDrivingSchoolVehiclesList,
  subscribeDailyReportsForVehicle,
  subscribeAllDailyReports,
  saveDrivingSchoolVehicleRecord,
  saveDrivingSchoolDailyReportRecord,
  deleteDrivingSchoolVehicleRecord,
  type DrivingSchoolVehicle,
  type DrivingSchoolDailyReport,
} from "@/lib/drivingSchoolVehicles";
import {
  subscribeDrivingSchoolApplications,
  type DrivingSchoolApplication,
} from "@/lib/drivingSchool";
import { CameraOdometerModal } from "@/components/CameraOdometerModal";

export function DrivingSchoolVehiclesView() {
  const [vehicles, setVehicles] = useState<DrivingSchoolVehicle[]>([]);
  const [applications, setApplications] = useState<DrivingSchoolApplication[]>([]);
  const [allReports, setAllReports] = useState<DrivingSchoolDailyReport[]>([]);

  // Modal States
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<DrivingSchoolVehicle | null>(null);

  const [dailyReportOpen, setDailyReportOpen] = useState(false);
  const [selectedVehicleForReport, setSelectedVehicleForReport] = useState<DrivingSchoolVehicle | null>(null);

  const [vehicleInfoOpen, setVehicleInfoOpen] = useState(false);
  const [selectedVehicleForInfo, setSelectedVehicleForInfo] = useState<DrivingSchoolVehicle | null>(null);
  const [infoVehicleReports, setInfoVehicleReports] = useState<DrivingSchoolDailyReport[]>([]);

  // Camera OCR Modal State
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraTargetField, setCameraTargetField] = useState<"start" | "end">("start");

  // Form States for Add/Edit Vehicle
  const [vNumber, setVNumber] = useState("");
  const [vName, setVName] = useState("");
  const [vManufacturer, setVManufacturer] = useState("");
  const [vModel, setVModel] = useState("");
  const [vType, setVType] = useState("LMV - Hatchback");
  const [vFuelType, setVFuelType] = useState("Petrol");
  const [vRegDate, setVRegDate] = useState("");
  const [vInsuranceExp, setVInsuranceExp] = useState("");
  const [vFitnessExp, setVFitnessExp] = useState("");
  const [vPucExp, setVPucExp] = useState("");
  const [vPermitExp, setVPermitExp] = useState("");
  const [vTaxExp, setVTaxExp] = useState("");
  const [vOdometer, setVOdometer] = useState<number | string>(0);
  const [vStatus, setVStatus] = useState<"Available" | "In Use" | "Maintenance">("Available");
  const [vPhoto, setVPhoto] = useState("");
  const [vDocs, setVDocs] = useState<Record<string, string>>({});
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Form States for Daily Report
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportStudentId, setReportStudentId] = useState("");
  const [reportStudentName, setReportStudentName] = useState("");
  const [reportStartOdometer, setReportStartOdometer] = useState<number | string>(0);
  const [reportEndOdometer, setReportEndOdometer] = useState<number | string>(0);
  const [reportStartPhoto, setReportStartPhoto] = useState("");
  const [reportEndPhoto, setReportEndPhoto] = useState("");
  const [reportGeneralAmount, setReportGeneralAmount] = useState<number | string>("");
  const [reportGeneralDesc, setReportGeneralDesc] = useState("");
  const [reportFuelType, setReportFuelType] = useState("Petrol");
  const [reportFuelAmount, setReportFuelAmount] = useState<number | string>("");
  const [reportNotes, setReportNotes] = useState("");
  const [savingReport, setSavingReport] = useState(false);

  // Realtime Subscriptions
  useEffect(() => {
    const unsubVehicles = subscribeDrivingSchoolVehiclesList((list) => {
      setVehicles(list);
    });
    const unsubApps = subscribeDrivingSchoolApplications((list) => {
      setApplications(list);
    });
    const unsubReports = subscribeAllDailyReports((list) => {
      setAllReports(list);
    });

    return () => {
      unsubVehicles();
      unsubApps();
      unsubReports();
    };
  }, []);

  // Filter Active Driving School Students for Daily Report Dropdown
  const activeStudents = useMemo(() => {
    return applications.filter((app) => app.status !== "Completed");
  }, [applications]);

  // Vehicle Counts
  const counts = useMemo(() => {
    const total = vehicles.length;
    const available = vehicles.filter((v) => v.status === "Available").length;
    const inUse = vehicles.filter((v) => v.status === "In Use").length;
    const maintenance = vehicles.filter((v) => v.status === "Maintenance").length;
    return { total, available, inUse, maintenance };
  }, [vehicles]);

  // Reset Add/Edit Vehicle Form
  const openAddVehicleModal = (veh?: DrivingSchoolVehicle) => {
    if (veh) {
      setEditingVehicle(veh);
      setVNumber(veh.vehicleNumber || "");
      setVName(veh.vehicleName || "");
      setVManufacturer(veh.manufacturer || "");
      setVModel(veh.model || "");
      setVType(veh.vehicleType || "LMV - Hatchback");
      setVFuelType(veh.fuelType || "Petrol");
      setVRegDate(veh.registrationDate || "");
      setVInsuranceExp(veh.insuranceExpiry || "");
      setVFitnessExp(veh.fitnessExpiry || "");
      setVPucExp(veh.pucExpiry || "");
      setVPermitExp(veh.permitExpiry || "");
      setVTaxExp(veh.taxExpiry || "");
      setVOdometer(veh.currentOdometer || 0);
      setVStatus(veh.status || "Available");
      setVPhoto(veh.vehiclePhoto || "");
      setVDocs((veh.documents as any) || {});
    } else {
      setEditingVehicle(null);
      setVNumber("");
      setVName("");
      setVManufacturer("");
      setVModel("");
      setVType("LMV - Hatchback");
      setVFuelType("Petrol");
      setVRegDate("");
      setVInsuranceExp("");
      setVFitnessExp("");
      setVPucExp("");
      setVPermitExp("");
      setVTaxExp("");
      setVOdometer(0);
      setVStatus("Available");
      setVPhoto("");
      setVDocs({});
    }
    setAddVehicleOpen(true);
  };

  // Handle Save Vehicle
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vNumber.trim() || !vName.trim()) {
      toast.error("Vehicle Number and Vehicle Name are mandatory!");
      return;
    }

    setSavingVehicle(true);
    try {
      await saveDrivingSchoolVehicleRecord(
        {
          vehicleNumber: vNumber.trim().toUpperCase(),
          vehicleName: vName.trim(),
          manufacturer: vManufacturer.trim(),
          model: vModel.trim(),
          vehicleType: vType,
          fuelType: vFuelType,
          registrationDate: vRegDate,
          insuranceExpiry: vInsuranceExp,
          fitnessExpiry: vFitnessExp,
          pucExpiry: vPucExp,
          permitExpiry: vPermitExp,
          taxExpiry: vTaxExp,
          currentOdometer: Number(vOdometer) || 0,
          status: vStatus,
          vehiclePhoto: vPhoto,
          documents: vDocs,
        },
        editingVehicle?.id
      );

      toast.success(editingVehicle ? "Vehicle updated successfully!" : "Vehicle registered successfully!");
      setAddVehicleOpen(false);
    } catch (err) {
      console.error("Error saving vehicle:", err);
      toast.error("Failed to save vehicle record");
    } finally {
      setSavingVehicle(false);
    }
  };

  // Open Daily Report Modal
  const openDailyReportModal = (veh: DrivingSchoolVehicle) => {
    setSelectedVehicleForReport(veh);
    setReportDate(new Date().toISOString().split("T")[0]);
    setReportStudentId("");
    setReportStudentName(activeStudents[0]?.studentName || "");
    setReportStartOdometer(veh.currentOdometer || 0);
    setReportEndOdometer((veh.currentOdometer || 0) + 38);
    setReportStartPhoto("");
    setReportEndPhoto("");
    setReportGeneralAmount("");
    setReportGeneralDesc("");
    setReportFuelType(veh.fuelType || "Petrol");
    setReportFuelAmount("");
    setReportNotes("");
    setDailyReportOpen(true);
  };

  // Handle Save Daily Report
  const handleSaveDailyReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleForReport) return;

    if (!reportStudentName.trim()) {
      toast.error("Please select or enter Today's Student!");
      return;
    }

    const startOdo = Number(reportStartOdometer) || 0;
    const endOdo = Number(reportEndOdometer) || 0;

    if (endOdo < startOdo) {
      toast.error("End Odometer reading cannot be less than Start Odometer reading!");
      return;
    }

    setSavingReport(true);
    try {
      await saveDrivingSchoolDailyReportRecord({
        vehicleId: selectedVehicleForReport.id,
        vehicleNumber: selectedVehicleForReport.vehicleNumber,
        studentId: reportStudentId,
        studentName: reportStudentName,
        reportDate,
        startOdometer: startOdo,
        endOdometer: endOdo,
        distanceTravelled: Math.max(0, endOdo - startOdo),
        startOdometerPhoto: reportStartPhoto,
        endOdometerPhoto: reportEndPhoto,
        generalExpenseAmount: Number(reportGeneralAmount) || 0,
        generalExpenseDescription: reportGeneralDesc,
        fuelType: reportFuelType,
        fuelAmount: Number(reportFuelAmount) || 0,
        notes: reportNotes,
      });

      toast.success("Daily Vehicle Report saved successfully!");
      setDailyReportOpen(false);
    } catch (err) {
      console.error("Error saving daily report:", err);
      toast.error("Failed to save daily report");
    } finally {
      setSavingReport(false);
    }
  };

  // Lock body scroll when modal is open & add ESC key listener
  useEffect(() => {
    if (vehicleInfoOpen || addVehicleOpen || dailyReportOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (vehicleInfoOpen) setVehicleInfoOpen(false);
        if (addVehicleOpen) setAddVehicleOpen(false);
        if (dailyReportOpen) setDailyReportOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [vehicleInfoOpen, addVehicleOpen, dailyReportOpen]);

  // Open Vehicle Info Modal
  const openVehicleInfoModal = (veh: DrivingSchoolVehicle) => {
    setSelectedVehicleForInfo(veh);
    setVehicleInfoOpen(true);

    // Subscribe to reports for this specific vehicle
    const unsub = subscribeDailyReportsForVehicle(veh.id, (reports) => {
      setInfoVehicleReports(reports);
    });
    return unsub;
  };

  const [uploadingDocKey, setUploadingDocKey] = useState<string | null>(null);

  const handleUploadVehicleDocument = async (docKey: string, file: File) => {
    if (!selectedVehicleForInfo) return;
    setUploadingDocKey(docKey);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        const updatedDocs = {
          ...(selectedVehicleForInfo.documents || {}),
          [docKey]: dataUrl,
        };

        await saveDrivingSchoolVehicleRecord(
          {
            ...selectedVehicleForInfo,
            documents: updatedDocs,
          },
          selectedVehicleForInfo.id
        );

        setSelectedVehicleForInfo({
          ...selectedVehicleForInfo,
          documents: updatedDocs,
        });

        toast.success("Document uploaded & saved successfully!");
        setUploadingDocKey(null);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("Document upload failed:", err);
      toast.error("Failed to upload document");
      setUploadingDocKey(null);
    }
  };

  // Calculate Vehicle Statistics for Info Modal
  const vehicleStats = useMemo(() => {
    if (!selectedVehicleForInfo) return { totalKm: 0, totalFuel: 0, totalGeneral: 0 };
    let totalKm = 0;
    let totalFuel = 0;
    let totalGeneral = 0;

    infoVehicleReports.forEach((r) => {
      totalKm += Number(r.distanceTravelled) || 0;
      totalFuel += Number(r.fuelAmount) || 0;
      totalGeneral += Number(r.generalExpenseAmount) || 0;
    });

    return { totalKm, totalFuel, totalGeneral };
  }, [selectedVehicleForInfo, infoVehicleReports]);

  // Unique Students that trained on this vehicle (calculated dynamically from infoVehicleReports & applications)
  const vehicleTrainingStudents = useMemo(() => {
    if (!infoVehicleReports || infoVehicleReports.length === 0) return [];
    const studentMap = new Map<string, { id?: string; studentName: string; courseType?: string; lastDate: string; totalKm: number }>();

    infoVehicleReports.forEach((rep) => {
      const name = rep.studentName;
      if (!name) return;
      const app = applications.find((a) => a.id === rep.studentId || a.studentName === name);
      const existing = studentMap.get(name);
      const repDate = rep.reportDate || rep.createdAt?.slice(0, 10) || "";
      const distance = Number(rep.distanceTravelled) || 0;

      if (!existing) {
        studentMap.set(name, {
          id: rep.studentId || app?.id,
          studentName: name,
          courseType: app?.courseType || "Driving Course",
          lastDate: repDate,
          totalKm: distance,
        });
      } else {
        existing.totalKm += distance;
        if (repDate > existing.lastDate) {
          existing.lastDate = repDate;
        }
      }
    });

    return Array.from(studentMap.values());
  }, [infoVehicleReports, applications]);

  // Suggested value for the camera odometer scanner based on target field and current state
  const cameraSuggestedValue = useMemo(() => {
    if (cameraTargetField === "start") {
      return Number(selectedVehicleForReport?.currentOdometer) || 44320;
    } else {
      const startVal = Number(reportStartOdometer) || Number(selectedVehicleForReport?.currentOdometer) || 44320;
      return startVal + 38; // standard default distance increment (38km)
    }
  }, [cameraTargetField, reportStartOdometer, selectedVehicleForReport]);

  // Handle Camera Capture Return
  const handleCameraCapture = (photoUrl: string, detectedOdometer?: number) => {
    if (cameraTargetField === "start") {
      setReportStartPhoto(photoUrl);
      if (detectedOdometer !== undefined && detectedOdometer > 0) {
        setReportStartOdometer(detectedOdometer);
      }
    } else {
      setReportEndPhoto(photoUrl);
      if (detectedOdometer !== undefined && detectedOdometer > 0) {
        setReportEndOdometer(detectedOdometer);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER BAR (MATCHING SCREENSHOT 1) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Driving School Vehicles</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {counts.total} training vehicles • {counts.available} available • {counts.inUse} in use
          </p>
        </div>

        <Button
          onClick={() => openAddVehicleModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Vehicle
        </Button>
      </div>

      {/* VEHICLES GRID (MATCHING SCREENSHOT 1) */}
      {vehicles.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="p-4 rounded-full bg-blue-50 text-blue-600 inline-block">
            <Car className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Driving School Vehicles Registered</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click the "+ Add Vehicle" button above to add your first training vehicle.
          </p>
          <Button
            onClick={() => openAddVehicleModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2 rounded-xl"
          >
            + Register Vehicle
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((v) => {
            const isAvailable = v.status === "Available";
            const isMaintenance = v.status === "Maintenance";

            return (
              <div
                key={v.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between group hover:shadow-md transition-all duration-200"
              >
                {/* Top Image Preview & Status Badge */}
                <div className="relative aspect-[16/10] bg-slate-900 overflow-hidden">
                  <img
                    src={
                      v.vehiclePhoto ||
                      "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=800&auto=format&fit=crop"
                    }
                    alt={v.vehicleName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3">
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider shadow-sm",
                        isAvailable
                          ? "bg-emerald-500 text-white border-emerald-400"
                          : isMaintenance
                          ? "bg-amber-500 text-white border-amber-400"
                          : "bg-blue-600 text-white border-blue-500"
                      )}
                    >
                      {v.status}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-3 flex-1">
                  <div>
                    <h3 className="font-mono font-bold text-slate-900 text-sm tracking-tight">
                      {v.vehicleNumber}
                    </h3>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">{v.vehicleName}</p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {v.vehicleType || "LMV"} • {v.model || "Sedan"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs font-medium text-slate-600">
                    <Gauge className="w-4 h-4 text-slate-400" />
                    <span>
                      <strong className="text-slate-900 font-mono">
                        {(v.currentOdometer || 0).toLocaleString("en-IN")} km
                      </strong>{" "}
                      current odometer
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons (Matching Screenshot 1) */}
                <div className="p-4 bg-slate-50/50 border-t border-slate-100 grid grid-cols-2 gap-3 pb-2">
                  <Button
                    variant="outline"
                    onClick={() => openVehicleInfoModal(v)}
                    className="w-full text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1.5 py-2.5"
                  >
                    <Info className="w-3.5 h-3.5" />
                    Vehicle Info
                  </Button>

                  <Button
                    onClick={() => openDailyReportModal(v)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 py-2.5 shadow-sm shadow-blue-500/10"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Daily Report
                  </Button>
                </div>
                
                <div className="px-4 pb-4 bg-slate-50/50 flex justify-end">
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      if (window.confirm('Delete this vehicle?')) {
                        try {
                          await deleteDrivingSchoolVehicleRecord(v.id);
                          toast.success('Vehicle deleted');
                        } catch (e) {
                          console.error(e);
                          toast.error('Failed to delete');
                        }
                      }
                    }}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-[10px] font-bold rounded-lg flex items-center gap-1 px-3 py-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete Vehicle
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DAILY REPORT MODAL (MATCHING SCREENSHOT 2 EXACTLY) */}
      {dailyReportOpen && selectedVehicleForReport && (
        <div
          onClick={() => setDailyReportOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl space-y-6 my-auto p-6 border border-slate-200 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Record Daily Vehicle Report</h2>
                <p className="text-xs text-slate-400 font-mono">
                  Vehicle: {selectedVehicleForReport.vehicleNumber} ({selectedVehicleForReport.vehicleName})
                </p>
              </div>
              <button
                onClick={() => setDailyReportOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDailyReport} className="space-y-6 text-xs">
              {/* Row 1: Report Date, Today's Student, Distance Travelled */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    REPORT DATE
                  </label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    TODAY'S STUDENT
                  </label>
                  <select
                    value={reportStudentName}
                    onChange={(e) => {
                      setReportStudentName(e.target.value);
                      const matched = activeStudents.find((s) => s.studentName === e.target.value);
                      if (matched) setReportStudentId(matched.id);
                    }}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900"
                  >
                    {activeStudents.length === 0 ? (
                      <option value="">No Active Students</option>
                    ) : (
                      activeStudents.map((s) => (
                        <option key={s.id} value={s.studentName}>
                          {s.studentName} ({s.courseType || "15 Days"})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    DISTANCE TRAVELLED
                  </label>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-900 flex items-center justify-between">
                    <span>
                      {Math.max(
                        0,
                        (Number(reportEndOdometer) || 0) - (Number(reportStartOdometer) || 0)
                      )}{" "}
                      km
                    </span>
                    <span className="text-[10px] text-slate-400 font-sans font-normal">Auto</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Start & End Odometer Photo Capture Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Start Odometer Photo */}
                <div className="p-5 bg-slate-50/80 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    START ODOMETER PHOTO
                  </span>
                  {reportStartPhoto ? (
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200">
                      <img src={reportStartPhoto} alt="Start Odometer" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setReportStartPhoto("")}
                        className="absolute top-2 right-2 p-1 rounded-full bg-rose-600 text-white hover:bg-rose-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        setCameraTargetField("start");
                        setCameraModalOpen(true);
                      }}
                      className="w-full bg-white hover:bg-slate-100 text-blue-600 font-semibold border border-blue-200 rounded-xl py-3 flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4 text-blue-600" />
                      Start Odometer Photo
                    </Button>
                  )}
                </div>

                {/* End Odometer Photo */}
                <div className="p-5 bg-slate-50/80 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    END ODOMETER PHOTO
                  </span>
                  {reportEndPhoto ? (
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200">
                      <img src={reportEndPhoto} alt="End Odometer" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setReportEndPhoto("")}
                        className="absolute top-2 right-2 p-1 rounded-full bg-rose-600 text-white hover:bg-rose-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        setCameraTargetField("end");
                        setCameraModalOpen(true);
                      }}
                      className="w-full bg-white hover:bg-slate-100 text-blue-600 font-semibold border border-blue-200 rounded-xl py-3 flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4 text-blue-600" />
                      End Odometer Photo
                    </Button>
                  )}
                </div>
              </div>

              {/* Row 3: Start & End Odometer Input Readings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    START ODOMETER READING
                  </label>
                  <input
                    type="number"
                    value={reportStartOdometer}
                    onChange={(e) => setReportStartOdometer(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    END ODOMETER READING
                  </label>
                  <input
                    type="number"
                    value={reportEndOdometer}
                    onChange={(e) => setReportEndOdometer(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Row 4: General Expense & Fuel Expense Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* General Expense Card */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                    <span>General Expense</span>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      AMOUNT
                    </label>
                    <input
                      type="number"
                      placeholder="₹"
                      value={reportGeneralAmount}
                      onChange={(e) => setReportGeneralAmount(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      DESCRIPTION
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Car wash, parking, servicing..."
                      value={reportGeneralDesc}
                      onChange={(e) => setReportGeneralDesc(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                {/* Fuel Expense Card */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Fuel className="w-4 h-4 text-amber-600" />
                    <span>Fuel Expense</span>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      FUEL TYPE
                    </label>
                    <select
                      value={reportFuelType}
                      onChange={(e) => setReportFuelType(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900"
                    >
                      <option value="Petrol">Petrol</option>
                      <option value="Diesel">Diesel</option>
                      <option value="CNG">CNG</option>
                      <option value="Electric">Electric</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      FUEL AMOUNT
                    </label>
                    <input
                      type="number"
                      placeholder="₹"
                      value={reportFuelAmount}
                      onChange={(e) => setReportFuelAmount(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Row 5: Notes */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase block">
                  NOTES
                </label>
                <textarea
                  rows={2}
                  placeholder="Training notes for the day..."
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl"
                />
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDailyReportOpen(false)}
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingReport}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-8 py-2.5 rounded-xl shadow-md shadow-blue-500/20"
                >
                  {savingReport ? "Uploading Photos & Saving..." : "Save Report"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VEHICLE INFO MODAL (CENTERED MODAL MAX 900PX, MAX 90VH, OVERFLOW AUTO, RADIUS 16PX) */}
      {vehicleInfoOpen && selectedVehicleForInfo && (
        <div
          onClick={() => setVehicleInfoOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-[900px] rounded-2xl overflow-hidden shadow-2xl space-y-6 my-auto p-6 border border-slate-200 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Vehicle Details & History</h2>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedVehicleForInfo.vehicleNumber} • {selectedVehicleForInfo.vehicleName}
                </p>
              </div>
              <button
                onClick={() => setVehicleInfoOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top Grid: Photo Left + Info Table Right */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="aspect-[16/10] bg-slate-900 rounded-2xl overflow-hidden shadow-inner">
                <img
                  src={
                    selectedVehicleForInfo.vehiclePhoto ||
                    "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=800&auto=format&fit=crop"
                  }
                  alt={selectedVehicleForInfo.vehicleName}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/50">
                <table className="w-full text-xs text-left">
                  <tbody className="divide-y divide-slate-200/80">
                    <tr>
                      <td className="p-2.5 font-bold text-slate-500 uppercase text-[10px] bg-slate-100/50">Vehicle Number</td>
                      <td className="p-2.5 font-mono font-bold text-slate-900">{selectedVehicleForInfo.vehicleNumber}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-500 uppercase text-[10px] bg-slate-100/50">Vehicle Name</td>
                      <td className="p-2.5 font-bold text-slate-900">{selectedVehicleForInfo.vehicleName}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-500 uppercase text-[10px] bg-slate-100/50">Manufacturer</td>
                      <td className="p-2.5 font-medium text-slate-700">{selectedVehicleForInfo.manufacturer || "Maruti Suzuki"}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-500 uppercase text-[10px] bg-slate-100/50">Model</td>
                      <td className="p-2.5 font-medium text-slate-700">{selectedVehicleForInfo.model || "Swift VXI 2022"}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-500 uppercase text-[10px] bg-slate-100/50">Fuel Type</td>
                      <td className="p-2.5 font-semibold text-slate-900">{selectedVehicleForInfo.fuelType || "Petrol"}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-500 uppercase text-[10px] bg-slate-100/50">Registration Date</td>
                      <td className="p-2.5 font-mono text-slate-700">{selectedVehicleForInfo.registrationDate || "2022-03-14"}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-500 uppercase text-[10px] bg-slate-100/50">Insurance Expiry</td>
                      <td className="p-2.5 font-mono text-slate-700">{selectedVehicleForInfo.insuranceExpiry || "2026-08-17"}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-500 uppercase text-[10px] bg-slate-100/50">Fitness Expiry</td>
                      <td className="p-2.5 font-mono text-slate-700">{selectedVehicleForInfo.fitnessExpiry || "2030-11-20"}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-500 uppercase text-[10px] bg-slate-100/50">PUC Expiry</td>
                      <td className="p-2.5 font-mono text-slate-700">{selectedVehicleForInfo.pucExpiry || "2026-09-10"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4 Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">TOTAL KILOMETERS</span>
                <div className="text-lg font-bold font-mono text-slate-900">{vehicleStats.totalKm} km</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">TOTAL FUEL EXPENSE</span>
                <div className="text-lg font-bold font-mono text-amber-600">₹{vehicleStats.totalFuel.toLocaleString("en-IN")}</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">TOTAL GENERAL EXPENSE</span>
                <div className="text-lg font-bold font-mono text-blue-600">₹{vehicleStats.totalGeneral.toLocaleString("en-IN")}</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">CURRENT ODOMETER</span>
                <div className="text-lg font-bold font-mono text-slate-900">
                  {(selectedVehicleForInfo.currentOdometer || 0).toLocaleString("en-IN")} km
                </div>
              </div>
            </div>

            {/* Documents & Assigned Students Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Documents Cards Grid */}
              <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">Vehicle Documents</h4>
                  <span className="text-[10px] text-slate-400">Click to upload/view</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: "RC Book", key: "rc" },
                    { name: "Insurance", key: "insurance" },
                    { name: "Fitness", key: "fitness" },
                    { name: "PUC", key: "puc" },
                    { name: "Permit", key: "permit" },
                    { name: "Tax Receipt", key: "taxreceipt" },
                  ].map((docItem) => {
                    const docUrl = selectedVehicleForInfo.documents?.[docItem.key];
                    const hasDoc = !!docUrl;
                    const isUploading = uploadingDocKey === docItem.key;

                    return (
                      <div
                        key={docItem.name}
                        className={cn(
                          "relative p-2 rounded-xl border text-center flex flex-col items-center justify-between gap-1.5 min-h-[85px] transition",
                          hasDoc
                            ? "bg-emerald-50/80 border-emerald-200 text-emerald-900 hover:bg-emerald-100/80"
                            : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50/40"
                        )}
                      >
                        <FileText className={cn("w-5 h-5 mt-1", hasDoc ? "text-emerald-600" : "text-slate-400")} />
                        <span className="text-[10px] font-bold leading-tight truncate max-w-full">
                          {isUploading ? "Uploading..." : docItem.name}
                        </span>

                        <div className="flex items-center gap-1 w-full mt-1">
                          {hasDoc && (
                            <a
                              href={docUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-1 px-1 rounded text-[9px] font-bold bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 flex items-center justify-center gap-0.5"
                              title="View Document"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Eye className="w-3 h-3" /> View
                            </a>
                          )}
                          <label className={cn(
                            "flex-1 py-1 px-1 rounded text-[9px] font-bold cursor-pointer text-center flex items-center justify-center gap-0.5 transition-colors",
                            hasDoc
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "bg-blue-600 text-white hover:bg-blue-700 w-full"
                          )}>
                            <Upload className="w-3 h-3" />
                            {hasDoc ? "Replace" : "Upload"}
                            <input
                              type="file"
                              accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadVehicleDocument(docItem.key, f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Assigned Active Students / Vehicle History Students */}
              <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-900">Vehicle Training Students</h4>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {vehicleTrainingStudents.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">No students have trained on this vehicle yet.</p>
                  ) : (
                    vehicleTrainingStudents.map((st) => (
                      <div key={st.id || st.studentName} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                            <span className="font-bold text-slate-900">{st.studentName}</span>
                          </div>
                          {st.courseType && <span className="text-[10px] text-slate-400 font-medium ml-5.5">{st.courseType}</span>}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 block mb-0.5">
                            {st.lastDate}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono font-semibold">{st.totalKm} km</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Daily Report History Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900">Daily Report History</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-400">
                    <tr>
                      <th className="p-3">DATE</th>
                      <th className="p-3">STUDENT</th>
                      <th className="p-3">DISTANCE</th>
                      <th className="p-3">FUEL</th>
                      <th className="p-3">GENERAL EXPENSE</th>
                      <th className="p-3 text-right">TOTAL EXPENSE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {infoVehicleReports.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          No daily vehicle report history recorded yet.
                        </td>
                      </tr>
                    ) : (
                      infoVehicleReports.map((r) => {
                        const totExp = (r.fuelAmount || 0) + (r.generalExpenseAmount || 0);
                        return (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="p-3 font-mono">{r.reportDate}</td>
                            <td className="p-3 font-semibold text-slate-900">{r.studentName}</td>
                            <td className="p-3 font-mono font-bold">{r.distanceTravelled} km</td>
                            <td className="p-3 font-mono">₹{r.fuelAmount || 0}</td>
                            <td className="p-3 font-mono">₹{r.generalExpenseAmount || 0}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">₹{totExp}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT VEHICLE MODAL */}
      {addVehicleOpen && (
        <div
          onClick={() => setAddVehicleOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl space-y-6 my-auto p-6 border border-slate-200 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingVehicle ? "Edit Driving School Vehicle" : "Add New Driving School Vehicle"}
              </h2>
              <button
                onClick={() => setAddVehicleOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    VEHICLE NUMBER <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GJ-01-KD-4412"
                    value={vNumber}
                    onChange={(e) => setVNumber(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    VEHICLE NAME <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maruti Swift"
                    value={vName}
                    onChange={(e) => setVName(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">MANUFACTURER</label>
                  <input
                    type="text"
                    placeholder="e.g. Maruti Suzuki"
                    value={vManufacturer}
                    onChange={(e) => setVManufacturer(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">MODEL</label>
                  <input
                    type="text"
                    placeholder="e.g. Swift VXI 2022"
                    value={vModel}
                    onChange={(e) => setVModel(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">VEHICLE TYPE</label>
                  <select
                    value={vType}
                    onChange={(e) => setVType(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="LMV - Hatchback">LMV - Hatchback</option>
                    <option value="LMV - Sedan">LMV - Sedan</option>
                    <option value="HMV - Truck">HMV - Truck</option>
                    <option value="MCWG - Two-wheeler">MCWG - Two-wheeler</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">FUEL TYPE</label>
                  <select
                    value={vFuelType}
                    onChange={(e) => setVFuelType(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="CNG">CNG</option>
                    <option value="Electric">Electric</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">INITIAL / CURRENT ODOMETER (KM)</label>
                  <input
                    type="number"
                    placeholder="44320"
                    value={vOdometer}
                    onChange={(e) => setVOdometer(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">STATUS</label>
                  <select
                    value={vStatus}
                    onChange={(e) => setVStatus(e.target.value as any)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="Available">Available</option>
                    <option value="In Use">In Use</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">REGISTRATION DATE</label>
                  <input
                    type="date"
                    value={vRegDate}
                    onChange={(e) => setVRegDate(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">INSURANCE EXPIRY</label>
                  <input
                    type="date"
                    value={vInsuranceExp}
                    onChange={(e) => setVInsuranceExp(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              {/* Photo Upload Input */}
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">VEHICLE PHOTO</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          setVPhoto(evt.target?.result as string);
                          toast.success("Vehicle photo selected");
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                    {vPhoto && (
                      <img src={vPhoto} alt="Preview" className="w-10 h-10 object-cover rounded-lg shrink-0 border" />
                    )}
                  </div>
                </div>

                {/* Documents Upload Section */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs">VEHICLE DOCUMENTS (RC, INSURANCE, FITNESS, etc.)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: "RC Book", key: "rc" },
                      { label: "Insurance Policy", key: "insurance" },
                      { label: "Fitness Certificate", key: "fitness" },
                      { label: "PUC Certificate", key: "puc" },
                      { label: "Permit", key: "permit" },
                      { label: "Tax Receipt", key: "taxreceipt" },
                    ].map((docItem) => (
                      <div key={docItem.key}>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          {docItem.label}
                        </label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              setVDocs((prev) => ({
                                ...prev,
                                [docItem.key]: evt.target?.result as string,
                              }));
                              toast.success(`${docItem.label} selected`);
                            };
                            reader.readAsDataURL(file);
                          }}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-[11px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddVehicleOpen(false)}
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingVehicle}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-8 py-2.5 rounded-xl shadow-md shadow-blue-500/20"
                >
                  {savingVehicle ? "Uploading & Saving..." : editingVehicle ? "Update Vehicle" : "Save Vehicle"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CAMERA OCR MODAL */}
      <CameraOdometerModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        title={cameraTargetField === "start" ? "Capture Start Odometer Photo" : "Capture End Odometer Photo"}
        suggestedValue={cameraSuggestedValue}
        onCapture={handleCameraCapture}
      />
    </div>
  );
}

