import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { removeUndefined } from "./records";
import { getSession } from "./auth";

export const APPLICATIONS_COL = "registry_applications_v1";
export const VEHICLES_CENTRIC_COL = "registry_vehicles_master_v1";

export interface VehicleMaster {
  id: string;
  vehicleNumber: string;
  phone: string;
  ownerName: string;
  fatherHusbandName: string;
  address: string;
  registrationDate: string;
  chassisNumber: string;
  engineNumber: string;
  fuelType: string;
  vehicleClass: string;
  makerName: string;
  modelName: string;
  colour: string;
  bodyType: string;
  seatingCapacity: number;
  grossWeight: number;
  unladenWeight: number;
  payload: number;
  horsePower: string;
  cylinderCount: number;
  pucExpiryDate: string;
  taxDetails?: {
    isLumpsum: boolean;
    issueDate?: string;
    expiryDate?: string;
    amount?: number;
    receiptUrl?: string;
    rcUrl?: string;
  };
  fitnessDetails?: {
    issueDate?: string;
    expiryDate?: string;
    documentUrl?: string;
  };
  insuranceDetails?: {
    company?: string;
    policyNumber?: string;
    policyType?: string;
    issueDate?: string;
    expiryDate?: string;
    amount?: number;
    insurancePlace?: string;
    documentUrl?: string;
  };
  permitDetails?: {
    permitType?: "Gujarat Permit" | "National Permit" | "National Permit Authorization" | string;
    issueDate?: string;
    expiryDate?: string;
    documentUrl?: string;
  };
  registrationDetails?: {
    dateOfRegistration?: string;
    registrationValidity?: string;
  };
  documents?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceAccountingItem {
  serviceName: string;
  totalAmount: number;
  advancePayment: number;
  pendingAmount: number;
}

export interface ApplicationRecord {
  id: string;
  applicationId: string;
  vehicleId: string;
  vehicleNumber: string;
  ownerName: string;
  mobileNumber: string;
  services: string[];
  serviceAccounting?: Record<string, ServiceAccountingItem>;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  applicationStatus: "Draft" | "Submitted" | "In Review" | "Approved" | "Rejected" | "On Hold";
  paymentStatus: "Paid" | "Pending" | "Partial";
  amount: number;
  totalPaid?: number;
  pendingAmount?: number;
  invoiceId?: string;
  invoiceNumber?: string;
  expiryDate?: string;
  allExpiries?: Array<{ title: string; date: string }>;
  remarks?: string;
  reminder?: string;
  priority?: "Low" | "Medium" | "High" | "Urgent";
  vehicleDetails: VehicleMaster;
  createdAt: string;
  updatedAt: string;
}

export function computePermitExpiry(permitType: string, issueDate: string): string {
  if (!issueDate) return "";
  const date = new Date(issueDate);
  if (isNaN(date.getTime())) return "";

  if (permitType === "Gujarat Permit" || permitType === "National Permit") {
    date.setFullYear(date.getFullYear() + 5);
  } else if (permitType === "National Permit Authorization") {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setFullYear(date.getFullYear() + 5);
  }
  return date.toISOString().split("T")[0];
}

export async function fetchVehicleByNumber(vehicleNumber: string): Promise<VehicleMaster | null> {
  const cleanNumber = vehicleNumber.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!cleanNumber) return null;

  try {
    const q = query(
      collection(db, VEHICLES_CENTRIC_COL),
      where("vehicleNumberClean", "==", cleanNumber)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0].data();
      return { id: snap.docs[0].id, ...docData } as VehicleMaster;
    }
  } catch (err) {
    console.error("Error fetching vehicle by number:", err);
  }
  return null;
}

export function subscribeApplications(
  callback: (apps: ApplicationRecord[]) => void
): () => void {
  const q = query(collection(db, APPLICATIONS_COL), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const apps = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApplicationRecord));
      callback(apps);
    },
    (err) => {
      console.error("Error subscribing applications:", err);
      callback([]);
    }
  );
}

export async function saveApplicationAndVehicle(
  appData: Omit<ApplicationRecord, "id" | "applicationId" | "createdAt" | "updatedAt">,
  existingAppId?: string
): Promise<string> {
  const session = getSession();
  const now = new Date().toISOString();
  const cleanVehicleNo = appData.vehicleNumber.trim().toUpperCase().replace(/[\s-]/g, "");

  const vehicleRef = doc(db, VEHICLES_CENTRIC_COL, cleanVehicleNo);
  const vehiclePayload = removeUndefined({
    ...appData.vehicleDetails,
    id: cleanVehicleNo,
    vehicleNumber: appData.vehicleNumber,
    vehicleNumberClean: cleanVehicleNo,
    ownerName: appData.ownerName,
    phone: appData.mobileNumber,
    updatedAt: now,
    updatedBy: session?.name || "System",
  });

  const existingVehicleSnap = await getDoc(vehicleRef);
  if (!existingVehicleSnap.exists()) {
    vehiclePayload.createdAt = now;
  }
  await setDoc(vehicleRef, vehiclePayload, { merge: true });

  let finalAppId = existingAppId;
  let docRef;

  if (!finalAppId) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generatedId = `APL-2026-${randomNum}`;
    docRef = doc(collection(db, APPLICATIONS_COL));
    finalAppId = docRef.id;

    const newAppPayload = removeUndefined({
      ...appData,
      id: finalAppId,
      applicationId: generatedId,
      vehicleId: cleanVehicleNo,
      createdAt: now,
      updatedAt: now,
      createdBy: session?.name || "System",
    });

    await setDoc(docRef, newAppPayload);
  } else {
    docRef = doc(db, APPLICATIONS_COL, finalAppId);
    const updatePayload = removeUndefined({
      ...appData,
      vehicleId: cleanVehicleNo,
      updatedAt: now,
      updatedBy: session?.name || "System",
    });

    await setDoc(docRef, updatePayload, { merge: true });
  }

  return finalAppId;
}
