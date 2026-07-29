import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  subscribeApplications,
  type ApplicationRecord,
  type VehicleMaster,
} from "@/lib/applications";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { VEHICLES_CENTRIC_COL } from "@/lib/applications";
import {
  Shield,
  FileCheck,
  Calendar,
  Building2,
  FileText,
  Lightbulb,
  AlertCircle,
  Clock,
  ArrowRight,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/")({
  component: Overview,
});

interface ExpiryItem {
  vehicleNumber: string;
  ownerName: string;
  phone: string;
  makerName?: string;
  modelName?: string;
  fuelType?: string;
  vehicleClass?: string;
  coName?: string;
  groupName?: string;
  expiryDate: string;
  daysRemaining: number;
  isCritical: boolean;
}

function computeDaysRemaining(expiryStr: string): number {
  if (!expiryStr) return 999;
  const exp = new Date(expiryStr);
  if (isNaN(exp.getTime())) return 999;
  const now = new Date();
  const diffTime = exp.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function Overview() {
  const [vehicles, setVehicles] = useState<VehicleMaster[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Subscribe to master vehicles
    const qV = query(collection(db, VEHICLES_CENTRIC_COL));
    const unsubV = onSnapshot(qV, (snap) => {
      const vList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as VehicleMaster));
      setVehicles(vList);
      setLoading(false);
    });

    // 2. Subscribe to applications
    const unsubA = subscribeApplications((data) => {
      setApplications(data);
    });

    return () => {
      unsubV();
      unsubA();
    };
  }, []);

  const activeVehicles = useMemo(() => {
    const validVehicleNumbers = new Set(
      applications.map((app) =>
        (app.vehicleNumber || app.vehicleId || "")
          .trim()
          .toUpperCase()
          .replace(/[\s-]/g, "")
      )
    );

    return vehicles.filter((v) => {
      const cleanNo = (v.vehicleNumber || v.id || "")
        .trim()
        .toUpperCase()
        .replace(/[\s-]/g, "");
      return validVehicleNumbers.has(cleanNo);
    });
  }, [vehicles, applications]);

  // Compute 8 Expiry Categories strictly matching reference
  const expiryCategories = useMemo(() => {
    const insuranceList: ExpiryItem[] = [];
    const fitnessList: ExpiryItem[] = [];
    const regRenewalList: ExpiryItem[] = [];
    const natAuthList: ExpiryItem[] = [];
    const natPermitList: ExpiryItem[] = [];
    const gujPermitList: ExpiryItem[] = [];
    const taxList: ExpiryItem[] = [];
    const pucList: ExpiryItem[] = [];

    activeVehicles.forEach((v) => {
      const baseInfo = {
        vehicleNumber: v.vehicleNumber || v.id,
        ownerName: v.ownerName || "Unknown Owner",
        phone: v.phone || "—",
        makerName: v.makerName,
        modelName: v.modelName,
        fuelType: v.fuelType,
        vehicleClass: v.vehicleClass,
        coName: v.coName,
        groupName: v.groupName,
      };

      const track = v.trackExpiry || {};
      const shouldTrackInsurance = track.insurance !== false;
      const shouldTrackFitness = track.fitness !== false;
      const shouldTrackPermit = track.permit !== false;
      const shouldTrackTax = track.tax !== false;
      const shouldTrackPuc = track.puc !== false;

      // 1. Insurance
      if (shouldTrackInsurance && v.insuranceDetails?.expiryDate) {
        const days = computeDaysRemaining(v.insuranceDetails.expiryDate);
        insuranceList.push({
          ...baseInfo,
          expiryDate: v.insuranceDetails.expiryDate,
          daysRemaining: days,
          isCritical: days <= 15,
        });
      }

      // 2. Fitness
      if (shouldTrackFitness && v.fitnessDetails?.expiryDate) {
        const days = computeDaysRemaining(v.fitnessDetails.expiryDate);
        fitnessList.push({
          ...baseInfo,
          expiryDate: v.fitnessDetails.expiryDate,
          daysRemaining: days,
          isCritical: days <= 15,
        });
      }

      // 3. Renewal of Registration
      if (shouldTrackFitness && v.registrationDetails?.registrationValidity) {
        const days = computeDaysRemaining(v.registrationDetails.registrationValidity);
        regRenewalList.push({
          ...baseInfo,
          expiryDate: v.registrationDetails.registrationValidity,
          daysRemaining: days,
          isCritical: days <= 30,
        });
      }

      // 4. National Authorization
      const natAuthExpiry = v.permitDetails?.nationalAuthExpiryDate ||
        (v.permitDetails?.permitType === "National Permit Authorization" ? v.permitDetails?.expiryDate : "");
      if (shouldTrackPermit && natAuthExpiry) {
        const days = computeDaysRemaining(natAuthExpiry);
        natAuthList.push({
          ...baseInfo,
          expiryDate: natAuthExpiry,
          daysRemaining: days,
          isCritical: days <= 15,
        });
      }

      // 5. National Permit
      const natPermitExpiry = v.permitDetails?.nationalPermitExpiryDate ||
        (v.permitDetails?.permitType === "National Permit" ? v.permitDetails?.expiryDate : "");
      if (shouldTrackPermit && natPermitExpiry) {
        const days = computeDaysRemaining(natPermitExpiry);
        natPermitList.push({
          ...baseInfo,
          expiryDate: natPermitExpiry,
          daysRemaining: days,
          isCritical: days <= 30,
        });
      }

      // 6. Gujarat Permit
      const gujPermitExpiry = v.permitDetails?.gujaratPermitExpiryDate ||
        (v.permitDetails?.permitType === "Gujarat Permit" ? v.permitDetails?.expiryDate : "");
      if (shouldTrackPermit && gujPermitExpiry) {
        const days = computeDaysRemaining(gujPermitExpiry);
        gujPermitList.push({
          ...baseInfo,
          expiryDate: gujPermitExpiry,
          daysRemaining: days,
          isCritical: days <= 30,
        });
      }

      // 7. Tax
      if (shouldTrackTax && !v.taxDetails?.isLumpsum && v.taxDetails?.expiryDate) {
        const days = computeDaysRemaining(v.taxDetails.expiryDate);
        taxList.push({
          ...baseInfo,
          expiryDate: v.taxDetails.expiryDate,
          daysRemaining: days,
          isCritical: days <= 10,
        });
      }

      // 8. PUC
      if (shouldTrackPuc && v.pucExpiryDate) {
        const days = computeDaysRemaining(v.pucExpiryDate);
        pucList.push({
          ...baseInfo,
          expiryDate: v.pucExpiryDate,
          daysRemaining: days,
          isCritical: days <= 7,
        });
      }
    });

    const sortFn = (a: ExpiryItem, b: ExpiryItem) => a.daysRemaining - b.daysRemaining;

    return [
      {
        title: "Insurance Due",
        icon: Shield,
        items: insuranceList.sort(sortFn),
        color: "text-rose-600 bg-rose-50 border-rose-100",
      },
      {
        title: "Fitness Due",
        icon: FileCheck,
        items: fitnessList.sort(sortFn),
        color: "text-amber-600 bg-amber-50 border-amber-100",
      },
      {
        title: "Renewal of Registration Due",
        icon: Calendar,
        items: regRenewalList.sort(sortFn),
        color: "text-blue-600 bg-blue-50 border-blue-100",
      },
      {
        title: "National Authorization Due",
        icon: Building2,
        items: natAuthList.sort(sortFn),
        color: "text-purple-600 bg-purple-50 border-purple-100",
      },
      {
        title: "National Permit Due",
        icon: Building2,
        items: natPermitList.sort(sortFn),
        color: "text-indigo-600 bg-indigo-50 border-indigo-100",
      },
      {
        title: "Gujarat Permit Due",
        icon: FileText,
        items: gujPermitList.sort(sortFn),
        color: "text-emerald-600 bg-emerald-50 border-emerald-100",
      },
      {
        title: "Tax Due",
        icon: FileText,
        items: taxList.sort(sortFn),
        color: "text-cyan-600 bg-cyan-50 border-cyan-100",
      },
      {
        title: "PUC Due",
        icon: Lightbulb,
        items: pucList.sort(sortFn),
        color: "text-teal-600 bg-teal-50 border-teal-100",
      },
    ];
  }, [activeVehicles]);

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Today's Operations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Upcoming expiries and renewals across your entire fleet database.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/applications"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-md shadow-blue-500/20 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            New Application
          </Link>
        </div>
      </div>

      {/* 8 Expiry Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {expiryCategories.map((cat, idx) => {
          const Icon = cat.icon;
          const criticalCount = cat.items.filter((i) => i.isCritical).length;

          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between"
            >
              {/* Card Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl border", cat.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 leading-snug">{cat.title}</h3>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {cat.items.length} upcoming •{" "}
                      <span className="text-rose-600 font-semibold">{criticalCount} critical</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[300px] divide-y divide-slate-100">
                {cat.items.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-6">No upcoming expiries</p>
                ) : (
                  cat.items.slice(0, 5).map((item, iIdx) => (
                    <div key={iIdx} className="pt-2.5 first:pt-0 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 font-mono tracking-tight">
                          {item.vehicleNumber}
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium">{item.ownerName}</div>
                        {(item.makerName || item.modelName) && (
                          <div className="text-[10px] text-slate-400 font-sans">
                            {item.makerName || ""} {item.modelName || ""}{" "}
                            {item.fuelType ? `(${item.fuelType})` : ""}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="font-mono text-[10px] text-slate-400">{item.expiryDate}</div>
                        <span
                          className={cn(
                            "inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5",
                            item.daysRemaining <= 0
                              ? "bg-rose-100 text-rose-700"
                              : item.daysRemaining <= 15
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {item.daysRemaining <= 0
                            ? `${Math.abs(item.daysRemaining)}d overdue`
                            : `${item.daysRemaining}d left`}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Card Footer */}
              <div className="p-3 bg-slate-50/80 border-t border-slate-100 text-center">
                <Link
                  to="/dashboard/applications"
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                >
                  View all {cat.items.length} vehicles <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
