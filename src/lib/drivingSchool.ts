import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { removeUndefined } from "./records";
import { getSession } from "./auth";
import { saveAccountingRecord } from "./applications";

export const DRIVING_SCHOOL_COL = "DrivingSchoolApplications";
export const DRIVING_SCHOOL_VEHICLES_COL = "DrivingSchoolVehicles";

export interface DrivingSchoolApplication {
  id: string;
  applicationId: string;
  studentName: string;
  mobileNumber: string;
  co?: string;
  address?: string;
  dateOfBirth: string;
  gender?: "Male" | "Female" | "Other" | string;
  hasDrivingLicence?: boolean;
  drivingLicenceNumber?: string;
  joiningDate?: string;
  courseStartDate?: string;
  courseEndDate?: string;
  courseType?: "15 Days" | "21 Days" | "26 Days" | "45 Days" | "60 Days" | string;
  totalCourseFees: number;
  advancePaid: number;
  remainingFees: number;
  paymentStatus: "Paid" | "Partial" | "Pending";
  assignedEmployee?: string;
  reminderDate?: string;
  priority?: "Low" | "Medium" | "High" | "Urgent";
  employeeNotes?: string;
  documents?: Record<string, string>;
  vehicleNumber?: string;
  instructorName?: string;
  status?: "Active" | "Completed" | "On Hold";
  createdAt: string;
  updatedAt: string;
}

export interface DrivingSchoolVehicleStatus {
  id: string;
  vehicleNumber: string;
  instructor: string;
  timeSlot: string;
  status: "Available" | "In Class" | "Maintenance";
  distanceToday: string;
  fuelUsed: string;
  expenseToday: string;
}

// Realtime Listener for Driving School Vehicles
export function subscribeDrivingSchoolVehicles(
  callback: (vehicles: DrivingSchoolVehicleStatus[]) => void
): () => void {
  const q = query(collection(db, DRIVING_SCHOOL_VEHICLES_COL));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DrivingSchoolVehicleStatus));
      callback(list);
    },
    (err) => {
      console.error("Error subscribing to Driving School vehicles:", err);
      callback([]);
    }
  );
}

// Realtime Listener for Driving School Applications
export function subscribeDrivingSchoolApplications(
  callback: (apps: DrivingSchoolApplication[]) => void
): () => void {
  const q = query(collection(db, DRIVING_SCHOOL_COL), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const apps = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DrivingSchoolApplication));
      callback(apps);
    },
    (err) => {
      console.error("Error subscribing to Driving School applications:", err);
      callback([]);
    }
  );
}

// Save / Update Driving School Application (Creates ONLY application & accounting entry, NO task)
export async function saveDrivingSchoolApplication(
  appData: Omit<DrivingSchoolApplication, "id" | "applicationId" | "createdAt" | "updatedAt">,
  existingId?: string
): Promise<string> {
  const session = getSession();
  const now = new Date().toISOString();

  let finalId = existingId;
  let generatedAppId = "";
  let docRef;

  const totFee = Number(appData.totalCourseFees) || 0;
  const advFee = Number(appData.advancePaid) || 0;
  const remFee = Math.max(0, totFee - advFee);
  const pStatus: "Paid" | "Partial" | "Pending" =
    remFee <= 0 && totFee > 0 ? "Paid" : advFee > 0 ? "Partial" : "Pending";

  const sanitizedData = {
    ...appData,
    totalCourseFees: totFee,
    advancePaid: advFee,
    remainingFees: remFee,
    paymentStatus: pStatus,
    subModule: "driving_school" as const,
  };

  if (!finalId) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    generatedAppId = `DS-2026-${randomNum}`;
    docRef = doc(collection(db, DRIVING_SCHOOL_COL));
    finalId = docRef.id;

    const payload = removeUndefined({
      ...sanitizedData,
      id: finalId,
      applicationId: generatedAppId,
      status: appData.status || "Active",
      createdAt: now,
      updatedAt: now,
      createdBy: session?.name || "System",
    });

    await setDoc(docRef, payload);
  } else {
    docRef = doc(db, DRIVING_SCHOOL_COL, finalId);
    const existingSnap = await getDoc(docRef);
    generatedAppId = existingSnap.exists()
      ? existingSnap.data()?.applicationId || finalId
      : finalId;

    const payload = removeUndefined({
      ...sanitizedData,
      updatedAt: now,
      updatedBy: session?.name || "System",
    });

    await setDoc(docRef, payload, { merge: true });
  }

  // Sync to Accounting so Driving School revenues appear in Accounting Module
  try {
    const accPaymentStatus: "Paid" | "Partially Paid" | "Pending" =
      remFee <= 0 && totFee > 0 ? "Paid" : advFee > 0 ? "Partially Paid" : "Pending";

    await saveAccountingRecord({
      id: finalId,
      applicationId: generatedAppId,
      applicationDocId: finalId,
      clientId: finalId,
      clientName: appData.studentName || "",
      mobileNumber: appData.mobileNumber || "",
      vehicleNumber: appData.vehicleNumber || generatedAppId,
      totalPayment: totFee,
      advancePayment: advFee,
      remainingPayment: remFee,
      paymentStatus: accPaymentStatus,
      createdAt: now,
      updatedAt: now,
    });
  } catch (accErr) {
    console.error("Error syncing Driving School accounting record:", accErr);
  }

  return finalId;
}

export async function deleteDrivingSchoolApplication(id: string): Promise<void> {
  if (!id) return;
  await deleteDoc(doc(db, DRIVING_SCHOOL_COL, id));
}

// Export Utilities (CSV, Excel, PDF)
export function exportDrivingSchoolToCSV(apps: DrivingSchoolApplication[]) {
  if (!apps || apps.length === 0) return;
  const headers = [
    "Application ID",
    "Student Name",
    "Mobile Number",
    "C/O",
    "Date of Birth",
    "Course Type",
    "Joining Date",
    "Total Fees",
    "Advance Paid",
    "Remaining Fees",
    "Payment Status",
    "Assigned Employee",
    "Priority",
  ];

  const rows = apps.map((a) => [
    `"${a.applicationId || a.id}"`,
    `"${a.studentName || ""}"`,
    `"${a.mobileNumber || ""}"`,
    `"${a.co || ""}"`,
    `"${a.dateOfBirth || ""}"`,
    `"${a.courseType || ""}"`,
    `"${a.joiningDate || ""}"`,
    a.totalCourseFees || 0,
    a.advancePaid || 0,
    a.remainingFees || 0,
    `"${a.paymentStatus || ""}"`,
    `"${a.assignedEmployee || ""}"`,
    `"${a.priority || ""}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Driving_School_Students_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportDrivingSchoolToExcel(apps: DrivingSchoolApplication[]) {
  exportDrivingSchoolToCSV(apps);
}

export function exportDrivingSchoolToPDF(apps: DrivingSchoolApplication[]) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Driving School Students Report</title>
      <style>
        body { font-family: sans-serif; padding: 20px; color: #1e293b; }
        h1 { color: #0f172a; font-size: 20px; margin-bottom: 4px; }
        p { color: #64748b; font-size: 12px; margin-top: 0; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
        th { background-color: #f1f5f9; font-weight: bold; }
        .paid { color: #047857; font-weight: bold; }
        .partial { color: #b45309; font-weight: bold; }
        .pending { color: #be123c; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>Driving School Students List</h1>
      <p>Report Generated on ${new Date().toLocaleDateString()} | Total Records: ${apps.length}</p>
      <table>
        <thead>
          <tr>
            <th>App ID</th>
            <th>Student Name</th>
            <th>Mobile</th>
            <th>Course</th>
            <th>Joining Date</th>
            <th>Total Fees</th>
            <th>Advance</th>
            <th>Remaining</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${apps
            .map(
              (a) => `
            <tr>
              <td>${a.applicationId || a.id}</td>
              <td><strong>${a.studentName}</strong></td>
              <td>${a.mobileNumber || "—"}</td>
              <td>${a.courseType || "—"}</td>
              <td>${a.joiningDate || "—"}</td>
              <td>₹${(a.totalCourseFees || 0).toLocaleString()}</td>
              <td>₹${(a.advancePaid || 0).toLocaleString()}</td>
              <td>₹${(a.remainingFees || 0).toLocaleString()}</td>
              <td class="${(a.paymentStatus || "").toLowerCase()}">${a.paymentStatus}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
}
