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
  deleteDoc,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { removeUndefined } from "./records";
import { getSession } from "./auth";

export const APPLICATIONS_COL = "registry_applications_v1";
export const VEHICLES_CENTRIC_COL = "registry_vehicles_master_v1";
export const ACCOUNTING_COL = "registry_accounting";

export interface AccountingRecord {
  id: string;
  applicationId: string;
  applicationDocId?: string;
  clientId?: string;
  clientName?: string;
  ownerName?: string;
  mobileNumber?: string;
  vehicleNumber?: string;
  employee?: string;
  assignedEmployeeName?: string;
  serviceCount?: number;
  selectedServices?: string[] | string;
  totalCharges?: number;
  advancePaid?: number;
  outstanding?: number;
  rtoExpense?: number;
  totalPayment: number;
  advancePayment: number;
  remainingPayment: number;
  paymentStatus: "Paid" | "Partially Paid" | "Pending";
  createdAt?: string;
  updatedAt?: string;
}

export function subscribeAccountingRecords(
  callback: (recordsMap: Map<string, AccountingRecord>) => void
): () => void {
  const q = query(collection(db, ACCOUNTING_COL));
  return onSnapshot(
    q,
    (snap) => {
      const map = new Map<string, AccountingRecord>();
      snap.docs.forEach((d) => {
        const data = d.data() as AccountingRecord;
        const rec = { ...data, id: d.id };
        map.set(d.id, rec);
        if (data.applicationId) {
          map.set(data.applicationId, rec);
        }
        if (data.applicationDocId) {
          map.set(data.applicationDocId, rec);
        }
      });
      callback(map);
    },
    (err) => {
      console.error("Error subscribing to accounting records:", err);
      callback(new Map());
    }
  );
}

export async function saveAccountingRecord(payload: AccountingRecord): Promise<void> {
  const docId = payload.applicationDocId || payload.id || payload.applicationId;
  if (!docId) return;
  const ref = doc(db, ACCOUNTING_COL, docId);
  const now = new Date().toISOString();
  await setDoc(
    ref,
    removeUndefined({
      ...payload,
      id: docId,
      updatedAt: now,
    }),
    { merge: true }
  );
}

export interface TrackExpirySettings {
  puc?: boolean;
  tax?: boolean;
  permit?: boolean;
  insurance?: boolean;
  fitness?: boolean;
}

export interface VehicleMaster {
  id: string;
  vehicleNumber: string;
  phone: string;
  ownerName: string;
  fatherHusbandName: string;
  coName?: string;
  groupName?: string;
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
    policySubCategory?: string;
    vehicleType?: string;
    agent?: string;
    insuranceAgency?: string;
    reference?: string;
    fuelType?: string;
    vehicleRegistrationNumber?: string;
    vehicleModelDetails?: string;
    premiumExclGst?: number;
    gstAmount?: number;
    totalPremium?: number;
    insurerCommission?: number;
    clientDiscount?: number;
    netCommission?: number;
  };
  permitDetails?: {
    permitType?: "Gujarat Permit" | "National Permit" | "National Permit(Gujrat Permit)" | "National Permit Authorization" | string;
    issueDate?: string;
    expiryDate?: string;
    gujaratPermitIssueDate?: string;
    gujaratPermitExpiryDate?: string;
    nationalPermitIssueDate?: string;
    nationalPermitExpiryDate?: string;
    nationalAuthIssueDate?: string;
    nationalAuthExpiryDate?: string;
    documentUrl?: string;
  };
  registrationDetails?: {
    dateOfRegistration?: string;
    registrationValidity?: string;
  };
  trackExpiry?: TrackExpirySettings;
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

export interface LicenseDetailsData {
  subModule?: "services" | "licence" | "driving_school" | "insurance";
  dateOfBirth?: string;
  isDrivingSchoolHolder?: boolean;
  newLearningLicence?: {
    enabled: boolean;
    appointmentDate?: string;
    applicationNo?: string;
    classOfVehicle?: string[];
    totalAmount?: number | string;
    advanceAmount?: number | string;
    step1?: {
      llNumber?: string;
      issueDate?: string;
      expiryDate?: string;
      classOfVehicle?: string[];
    };
    step2?: {
      dlNumber?: string;
      issueDate?: string;
      expiryDate?: string;
      validityDate?: string;
      vehicleTypes?: { nt?: boolean; tr?: boolean; hazardous?: boolean };
      classOfVehicle?: string[];
    };
  };
  dlNewLlEndorsement?: {
    enabled: boolean;
    applicationNo?: string;
    totalAmount?: number | string;
    advanceAmount?: number | string;
    step1?: {
      dlNumber?: string;
      issueDate?: string;
      validityDate?: string;
      vehicleTypes?: { nt?: boolean; tr?: boolean; hazardous?: boolean };
      classOfVehicle?: string;
    };
    step2?: {
      llNumber?: string;
      issueDate?: string;
      expiryDate?: string;
      classOfVehicle?: string;
    };
    step3?: {
      dlNumber?: string;
      issueDate?: string;
      validityDate?: string;
      vehicleTypes?: { nt?: boolean; tr?: boolean; hazardous?: boolean };
      classOfVehicle?: string;
    };
  };
  llRenewClass?: {
    enabled: boolean;
    appointmentDate?: string;
    applicationNo?: string;
    totalAmount?: number | string;
    advanceAmount?: number | string;
    step1?: { llNumber?: string; issueDate?: string; expiryDate?: string; classOfVehicle?: string[] };
    step2?: { dlNumber?: string; issueDate?: string; validityDate?: string; classOfVehicle?: string[] };
    step3?: { dlNumber?: string; issueDate?: string; validityDate?: string; classOfVehicle?: string[] };
  };
  dlRenewRetest?: {
    enabled: boolean;
    applicationNo?: string;
    totalAmount?: number | string;
    advanceAmount?: number | string;
    step1?: { dlNumber?: string; issueDate?: string; validityDate?: string; appNo1?: string };
    step2?: { llNumber?: string; issueDate?: string; expiryDate?: string; appNo2?: string };
    step3?: { dlNumber?: string; issueDate?: string; validityDate?: string; appNo1?: string };
  };
  generalLicenceServices?: {
    selectedServices?: string[];
    serviceAccounting?: Record<string, { totalAmount: number | string; advanceAmount: number | string }>;
    changeDobData?: {
      dlNumber?: string;
      classOfVehicle?: string;
      issueDate?: string;
      validityDate?: string;
      vehicleTypes?: { nt?: boolean; tr?: boolean; hazardous?: boolean };
      newDob?: string;
    };
  };
}

export interface Form5DetailsData {
  form5Type: "new_hgv" | "renew_hgv" | "";
  name?: string;
  dlNumber?: string;
  applicationNo?: string;
  dateOfBirth?: string;
  llNumber?: string;
  llIssueDate?: string;
  llExpiryDate?: string;
  ntValidityDate?: string;
  trValidityDate?: string;
  aadhaarNumber?: string;
}

export interface ApplicationRecord {
  id: string;
  applicationId: string;
  vehicleId: string;
  vehicleNumber: string;
  ownerName: string;
  mobileNumber: string;
  services: string[];
  subModule?: "services" | "licence" | "driving_school" | "insurance" | "form5";
  licenseDetails?: LicenseDetailsData;
  form5Details?: Form5DetailsData;
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
  dueDate?: string;
  priority?: "Low" | "Medium" | "High" | "Urgent";
  createTaskAuto?: boolean;
  documents?: Record<string, string>;
  applicationType?: string;
  trackExpiry?: TrackExpirySettings;
  vehicleDetails: VehicleMaster;
  // Special Services fields
  pucExpiryDate?: string;
  pucCharges?: number;
  pucRemarks?: string;
  insuranceCompany?: string;
  insurancePolicyNumber?: string;
  insuranceExpiryDate?: string;
  insuranceCharges?: number;
  insuranceRemarks?: string;
  taxExpiryDate?: string;
  taxCharges?: number;
  taxRemarks?: string;
  fitnessExpiryDate?: string;
  fitnessCharges?: number;
  fitnessRemarks?: string;
  permitType?: "National" | "Gujarat" | string;
  npAuth?: boolean;
  permitExpiryDate?: string;
  permitCharges?: number;
  permitRemarks?: string;
  nationalPermitExpiryDate?: string;
  gujaratPermitExpiryDate?: string;
  npAuthExpiryDate?: string;
  registrationRenewalExpiryDate?: string;
  registrationRenewalCharges?: number;
  registrationRenewalRemarks?: string;
  specialServicesDetails?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export function computePermitExpiry(permitType: string, issueDate: string): string {
  if (!issueDate) return "";
  const date = new Date(issueDate);
  if (isNaN(date.getTime())) return "";

  if (permitType === "Gujarat Permit" || permitType === "National Permit" || permitType === "National Permit(Gujrat Permit)") {
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
    pucExpiryDate: appData.pucExpiryDate || appData.vehicleDetails?.pucExpiryDate || "",
    insuranceDetails: appData.insuranceCompany || appData.insuranceExpiryDate ? {
      company: appData.insuranceCompany || "",
      policyNumber: appData.insurancePolicyNumber || "",
      expiryDate: appData.insuranceExpiryDate || "",
      amount: appData.insuranceCharges || 0,
      remarks: appData.insuranceRemarks || "",
    } : appData.vehicleDetails?.insuranceDetails,
    taxDetails: appData.taxExpiryDate ? {
      expiryDate: appData.taxExpiryDate || "",
      amount: appData.taxCharges || 0,
      remarks: appData.taxRemarks || "",
    } : appData.vehicleDetails?.taxDetails,
    fitnessDetails: appData.fitnessExpiryDate ? {
      expiryDate: appData.fitnessExpiryDate || "",
      amount: appData.fitnessCharges || 0,
      remarks: appData.fitnessRemarks || "",
    } : appData.vehicleDetails?.fitnessDetails,
    permitDetails: appData.permitExpiryDate || appData.permitType ? {
      permitType: appData.permitType || "",
      expiryDate: appData.permitExpiryDate || "",
      nationalPermitExpiryDate: appData.nationalPermitExpiryDate || "",
      gujaratPermitExpiryDate: appData.gujaratPermitExpiryDate || "",
      nationalAuthExpiryDate: appData.npAuthExpiryDate || "",
      remarks: appData.permitRemarks || "",
    } : appData.vehicleDetails?.permitDetails,
    registrationDetails: appData.registrationRenewalExpiryDate ? {
      registrationValidity: appData.registrationRenewalExpiryDate,
    } : appData.vehicleDetails?.registrationDetails,
    trackExpiry: appData.trackExpiry || appData.vehicleDetails?.trackExpiry,
    updatedAt: now,
    updatedBy: session?.name || "System",
  });

  const totAmt = Number(appData.amount) || 0;
  const advAmt = Number(appData.totalPaid) || 0;
  const remAmt = typeof appData.pendingAmount === "number" ? appData.pendingAmount : Math.max(0, totAmt - advAmt);
  const pStatus: "Paid" | "Partially Paid" | "Pending" = remAmt <= 0 ? "Paid" : advAmt > 0 ? "Partially Paid" : "Pending";
  const servicesList = appData.services || [];
  const joinedServices = servicesList.join(", ");

  let finalAppId = existingAppId;
  let generatedAppIdStr = "";

  if (!finalAppId) {
    // ─── NEW APPLICATION: ATOMIC FIRESTORE TRANSACTION ─────────────────
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    generatedAppIdStr = `APL-2026-${randomNum}`;

    const newAppRef = doc(collection(db, APPLICATIONS_COL));
    finalAppId = newAppRef.id;

    const newTaskRef = doc(collection(db, "registry_tasks"));
    const newAccountingRef = doc(db, ACCOUNTING_COL, finalAppId);

    const newAppPayload = removeUndefined({
      ...appData,
      id: finalAppId,
      applicationId: generatedAppIdStr,
      vehicleId: cleanVehicleNo,
      createdAt: now,
      updatedAt: now,
      createdBy: session?.name || "System",
    });

    const serviceCards = servicesList.map((srv) => ({
      id: `card-${Math.random().toString(36).substring(2, 9)}`,
      taskName: `${srv} - ${appData.vehicleNumber}`,
      serviceName: srv,
      description: `Processing ${srv} for vehicle ${appData.vehicleNumber}`,
      templateId: "",
    }));

    const newTaskPayload = removeUndefined({
      id: newTaskRef.id,
      taskId: newTaskRef.id,
      title: `${joinedServices || "Application Services"} - ${appData.vehicleNumber}`,
      serviceName: joinedServices,
      serviceType: joinedServices,
      services: servicesList,
      serviceCards: serviceCards,
      applicationDocId: finalAppId,
      applicationId: "",
      applicationType: appData.applicationType || "Home",
      vehicleId: cleanVehicleNo,
      vehicleNumber: appData.vehicleNumber,
      ownerName: appData.ownerName,
      ownerPhone: appData.mobileNumber,
      clientName: appData.ownerName || "",
      mobileNumber: appData.mobileNumber || "",
      phone: appData.mobileNumber || "",
      assignedEmployeeName: appData.assignedEmployeeName || "Unassigned",
      assignee: appData.assignedEmployeeName || "Unassigned",
      assignedEmployeeId: appData.assignedEmployeeId || "",
      assignedEmployeeUid: appData.assignedEmployeeId || "",
      reference: `${generatedAppIdStr} - ${appData.vehicleNumber}`,
      trackExpiry: appData.trackExpiry || appData.vehicleDetails?.trackExpiry,
      remarks: appData.remarks || "",
      dueDate: appData.dueDate || "",
      priority: appData.priority || "Medium",
      documents: appData.documents || {},
      subModule: appData.subModule,
      licenseDetails: appData.licenseDetails,
      issueDate: now,
      createdDate: now,
      createdAt: now,
      createdBy: session?.name || "System",
      manual: false,
      status: appData.applicationStatus === "On Hold" ? "On Hold" : "Assigned",
      done: false,
      associationType: "application",
      bucket: "applications",
      // Expiry details
      pucExpiryDate: appData.pucExpiryDate || "",
      taxExpiryDate: appData.taxExpiryDate || "",
      fitnessExpiryDate: appData.fitnessExpiryDate || "",
      insuranceExpiryDate: appData.insuranceExpiryDate || "",
      nationalPermitExpiryDate: appData.nationalPermitExpiryDate || "",
      gujaratPermitExpiryDate: appData.gujaratPermitExpiryDate || "",
      npAuthExpiryDate: appData.npAuthExpiryDate || "",
      registrationRenewalExpiryDate: appData.registrationRenewalExpiryDate || "",
      totalCharges: totAmt,
      advancePaid: advAmt,
      rtoExpense: 0,
      updatedAt: now,
    });

    const newAccountingPayload = removeUndefined({
      id: finalAppId,
      applicationId: generatedAppIdStr,
      applicationDocId: finalAppId,
      clientId: finalAppId,
      clientName: appData.ownerName || "",
      ownerName: appData.ownerName || "",
      mobileNumber: appData.mobileNumber || "",
      vehicleNumber: appData.vehicleNumber || "",
      employee: appData.assignedEmployeeName || "Unassigned",
      assignedEmployeeName: appData.assignedEmployeeName || "Unassigned",
      serviceCount: servicesList.length,
      selectedServices: servicesList,
      totalCharges: totAmt,
      advancePaid: advAmt,
      outstanding: remAmt,
      rtoExpense: 0,
      totalPayment: totAmt,
      advancePayment: advAmt,
      remainingPayment: remAmt,
      paymentStatus: pStatus,
      createdAt: now,
      updatedAt: now,
    });

    // Execute ATOMIC Firestore transaction
    await runTransaction(db, async (transaction) => {
      const vehSnap = await transaction.get(vehicleRef);
      if (!vehSnap.exists()) {
        vehiclePayload.createdAt = now;
        transaction.set(vehicleRef, vehiclePayload);
      } else {
        transaction.set(vehicleRef, vehiclePayload, { merge: true });
      }

      transaction.set(newAppRef, newAppPayload);
      transaction.set(newTaskRef, newTaskPayload);
      transaction.set(newAccountingRef, newAccountingPayload);
    });

  } else {
    // ─── UPDATE EXISTING APPLICATION ────────────────────────────────────
    const appRef = doc(db, APPLICATIONS_COL, finalAppId);
    const existingSnap = await getDoc(appRef);
    if (existingSnap.exists()) {
      generatedAppIdStr = existingSnap.data()?.applicationId || finalAppId;
    } else {
      generatedAppIdStr = finalAppId;
    }

    const updatePayload = removeUndefined({
      ...appData,
      applicationStatus: "Pending",
      vehicleId: cleanVehicleNo,
      updatedAt: now,
      updatedBy: session?.name || "System",
    });

    await setDoc(vehicleRef, vehiclePayload, { merge: true });
    await setDoc(appRef, updatePayload, { merge: true });

    await saveAccountingRecord({
      id: finalAppId,
      applicationId: generatedAppIdStr,
      applicationDocId: finalAppId,
      clientId: finalAppId,
      clientName: appData.ownerName || "",
      ownerName: appData.ownerName || "",
      mobileNumber: appData.mobileNumber || "",
      vehicleNumber: appData.vehicleNumber || "",
      employee: appData.assignedEmployeeName || "Unassigned",
      assignedEmployeeName: appData.assignedEmployeeName || "Unassigned",
      serviceCount: servicesList.length,
      selectedServices: servicesList,
      totalCharges: totAmt,
      advancePaid: advAmt,
      outstanding: remAmt,
      rtoExpense: 0,
      totalPayment: totAmt,
      advancePayment: advAmt,
      remainingPayment: remAmt,
      paymentStatus: pStatus,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ─── SYNC TASKS & SERVICES FOR UPDATES ──────────────────────────────
  try {
    const syncFields = removeUndefined({
      title: `${joinedServices || "Application Services"} - ${appData.vehicleNumber}`,
      serviceName: joinedServices,
      serviceType: joinedServices,
      services: servicesList,
      applicationDocId: finalAppId,
      applicationId: generatedAppIdStr,
      applicationType: appData.applicationType || "Home",
      vehicleId: cleanVehicleNo,
      vehicleNumber: appData.vehicleNumber,
      ownerName: appData.ownerName,
      ownerPhone: appData.mobileNumber,
      clientName: appData.ownerName || "",
      mobileNumber: appData.mobileNumber || "",
      phone: appData.mobileNumber || "",
      assignedEmployeeName: appData.assignedEmployeeName || "Unassigned",
      assignee: appData.assignedEmployeeName || "Unassigned",
      assignedEmployeeId: appData.assignedEmployeeId || "",
      assignedEmployeeUid: appData.assignedEmployeeId || "",
      reference: `${generatedAppIdStr} - ${appData.vehicleNumber}`,
      trackExpiry: appData.trackExpiry || appData.vehicleDetails?.trackExpiry,
      remarks: appData.remarks || "",
      dueDate: appData.dueDate || "",
      priority: appData.priority || "Medium",
      documents: appData.documents || {},
      subModule: appData.subModule,
      licenseDetails: appData.licenseDetails,
      pucExpiryDate: appData.pucExpiryDate || "",
      taxExpiryDate: appData.taxExpiryDate || "",
      fitnessExpiryDate: appData.fitnessExpiryDate || "",
      insuranceExpiryDate: appData.insuranceExpiryDate || "",
      nationalPermitExpiryDate: appData.nationalPermitExpiryDate || "",
      gujaratPermitExpiryDate: appData.gujaratPermitExpiryDate || "",
      npAuthExpiryDate: appData.npAuthExpiryDate || "",
      registrationRenewalExpiryDate: appData.registrationRenewalExpiryDate || "",
      totalCharges: totAmt,
      advancePaid: advAmt,
      status: "Assigned",
      taskStatus: "Assigned",
      done: false,
      updatedAt: now,
    });

    const taskQueries = [
      query(collection(db, "registry_tasks"), where("applicationDocId", "==", finalAppId)),
      query(collection(db, "registry_tasks"), where("recordId", "==", finalAppId)),
    ];
    if (generatedAppIdStr && generatedAppIdStr.trim() !== "" && generatedAppIdStr !== "undefined" && generatedAppIdStr !== "null") {
      taskQueries.push(query(collection(db, "registry_tasks"), where("applicationId", "==", generatedAppIdStr)));
    }

    const tasksToSyncMap = new Map();
    for (const q of taskQueries) {
      const snap = await getDocs(q);
      snap.docs.forEach((d) => tasksToSyncMap.set(d.id, d.ref));
    }

    const taskDirect1 = doc(db, "registry_tasks", finalAppId);
    const taskDirect1Snap = await getDoc(taskDirect1);
    if (taskDirect1Snap.exists()) tasksToSyncMap.set(finalAppId, taskDirect1);

    const taskDirect2 = doc(db, "registry_tasks", `task-app-${finalAppId}`);
    const taskDirect2Snap = await getDoc(taskDirect2);
    if (taskDirect2Snap.exists()) tasksToSyncMap.set(`task-app-${finalAppId}`, taskDirect2);

    for (const tRef of tasksToSyncMap.values()) {
      await setDoc(tRef, syncFields, { merge: true });
    }

    const serviceQueries = [
      query(collection(db, "registry_services_v2"), where("applicationDocId", "==", finalAppId)),
      query(collection(db, "registry_services_v2"), where("recordId", "==", finalAppId)),
    ];
    if (generatedAppIdStr && generatedAppIdStr.trim() !== "" && generatedAppIdStr !== "undefined" && generatedAppIdStr !== "null") {
      serviceQueries.push(query(collection(db, "registry_services_v2"), where("applicationId", "==", generatedAppIdStr)));
    }

    const servicesToSyncMap = new Map();
    for (const q of serviceQueries) {
      const snap = await getDocs(q);
      snap.docs.forEach((d) => servicesToSyncMap.set(d.id, d.ref));
    }

    const srvDirect1 = doc(db, "registry_services_v2", finalAppId);
    const srvDirect1Snap = await getDoc(srvDirect1);
    if (srvDirect1Snap.exists()) servicesToSyncMap.set(finalAppId, srvDirect1);

    const srvDirect2 = doc(db, "registry_services_v2", `task-app-${finalAppId}`);
    const srvDirect2Snap = await getDoc(srvDirect2);
    if (srvDirect2Snap.exists()) servicesToSyncMap.set(`task-app-${finalAppId}`, srvDirect2);

    for (const sRef of servicesToSyncMap.values()) {
      await setDoc(sRef, syncFields, { merge: true });
    }
  } catch (err) {
    console.error("Error syncing tasks and services for application:", err);
  }

  return finalAppId;
}

export async function deleteApplication(id: string): Promise<void> {
  try {
    const appRef = doc(db, APPLICATIONS_COL, id);
    const appSnap = await getDoc(appRef);
    const generatedAppIdStr = appSnap.exists() ? appSnap.data()?.applicationId : "";
    const vehicleNo = appSnap.exists() ? appSnap.data()?.vehicleNumber : "";
    const cleanVehicleNo = vehicleNo ? vehicleNo.trim().toUpperCase().replace(/[\s-]/g, "") : "";

    // 1. Delete Application Document
    await deleteDoc(appRef);

    // 2. Check if any remaining application exists for this vehicle; if not, delete vehicle master doc
    if (cleanVehicleNo) {
      const remainingQuery = query(
        collection(db, APPLICATIONS_COL),
        where("vehicleId", "==", cleanVehicleNo)
      );
      const remainingSnap = await getDocs(remainingQuery);
      if (remainingSnap.empty) {
        const vehDocRef = doc(db, VEHICLES_CENTRIC_COL, cleanVehicleNo);
        await deleteDoc(vehDocRef).catch(console.error);
      }
    }

    // 3. Delete linked tasks from registry_tasks
    const taskDocsToDelete = new Map();
    if (id) {
      const q1 = query(collection(db, "registry_tasks"), where("applicationDocId", "==", id));
      const s1 = await getDocs(q1);
      s1.docs.forEach((d) => taskDocsToDelete.set(d.id, d.ref));

      const q2 = query(collection(db, "registry_tasks"), where("recordId", "==", id));
      const s2 = await getDocs(q2);
      s2.docs.forEach((d) => taskDocsToDelete.set(d.id, d.ref));
    }
    if (generatedAppIdStr && generatedAppIdStr.trim() !== "" && generatedAppIdStr !== "undefined" && generatedAppIdStr !== "null") {
      const q3 = query(collection(db, "registry_tasks"), where("applicationId", "==", generatedAppIdStr));
      const s3 = await getDocs(q3);
      s3.docs.forEach((d) => taskDocsToDelete.set(d.id, d.ref));
    }

    const taskDirect1 = doc(db, "registry_tasks", id);
    const taskDirect1Snap = await getDoc(taskDirect1);
    if (taskDirect1Snap.exists()) taskDocsToDelete.set(id, taskDirect1);

    const taskDirect2 = doc(db, "registry_tasks", `task-app-${id}`);
    const taskDirect2Snap = await getDoc(taskDirect2);
    if (taskDirect2Snap.exists()) taskDocsToDelete.set(`task-app-${id}`, taskDirect2);

    for (const tRef of taskDocsToDelete.values()) {
      await deleteDoc(tRef);
    }

    // 4. Delete linked services from registry_services_v2
    const serviceDocsToDelete = new Map();
    if (id) {
      const q1 = query(collection(db, "registry_services_v2"), where("applicationDocId", "==", id));
      const s1 = await getDocs(q1);
      s1.docs.forEach((d) => serviceDocsToDelete.set(d.id, d.ref));

      const q2 = query(collection(db, "registry_services_v2"), where("recordId", "==", id));
      const s2 = await getDocs(q2);
      s2.docs.forEach((d) => serviceDocsToDelete.set(d.id, d.ref));
    }
    if (generatedAppIdStr && generatedAppIdStr.trim() !== "" && generatedAppIdStr !== "undefined" && generatedAppIdStr !== "null") {
      const q3 = query(collection(db, "registry_services_v2"), where("applicationId", "==", generatedAppIdStr));
      const s3 = await getDocs(q3);
      s3.docs.forEach((d) => serviceDocsToDelete.set(d.id, d.ref));
    }

    const srvDirect1 = doc(db, "registry_services_v2", id);
    const srvDirect1Snap = await getDoc(srvDirect1);
    if (srvDirect1Snap.exists()) serviceDocsToDelete.set(id, srvDirect1);

    const srvDirect2 = doc(db, "registry_services_v2", `task-app-${id}`);
    const srvDirect2Snap = await getDoc(srvDirect2);
    if (srvDirect2Snap.exists()) serviceDocsToDelete.set(`task-app-${id}`, srvDirect2);

    for (const sRef of serviceDocsToDelete.values()) {
      await deleteDoc(sRef);
    }
  } catch (err) {
    console.error("Error in deleteApplication:", err);
    throw err;
  }
}
