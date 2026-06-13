// Records — Firestore-backed client & lead registry.
import {
  collection,
  query,
  orderBy,
  where,
  getDocs,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";
import { createActivity, type ActivityLog } from "./activity";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecordStatus = "Pending" | "In Progress" | "Completed" | "On Hold";

export type DeleteReason = "Duplicate Entry" | "Wrong Customer" | "Testing Data" | "Other";

export interface RegistryRecord {
  id: string;
  srNo: number;
  date: string; // yyyy-mm-dd
  mvNo: string;
  application: string;
  work: string;
  name: string;
  status: RecordStatus;
  mo: string;
  insurance: string;
  fitness: string;
  tax: string;
  co: string;
  groupName?: string; // Customer group/company
  assignee?: string; // staff username
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  activityLogs?: ActivityLog[];
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: DeleteReason;
}

export type Bucket = "clients" | "leads" | "customers";

// ─── Staff users (shared across auth + tasks) ─────────────────────────────────

export const STAFF_USERS: { username: string; name: string }[] = [
  { username: "staff", name: "Front Desk" },
  { username: "priya", name: "Priya Nair" },
  { username: "rahul", name: "Rahul Verma" },
];

export const staffLabel = (username?: string) =>
  STAFF_USERS.find((s) => s.username === username)?.name ?? "";

// ─── Firestore helpers ────────────────────────────────────────────────────────

const colFor = (bucket: Bucket) => `registry_${bucket}`;

/**
 * Subscribe to live record updates for a bucket.
 * Returns an unsubscribe function (use in useEffect cleanup).
 */
export function subscribeToRecords(
  bucket: Bucket,
  cb: (records: RegistryRecord[]) => void,
): () => void {
  const q = query(collection(db, colFor(bucket)), orderBy("srNo"));
  return onSnapshot(q, (snap) => {
    const records = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as RegistryRecord))
      .filter((r) => !r.isDeleted); // Hide soft-deleted records
    cb(records);
  });
}

/** Upsert a record (creates if new, updates if exists). */
export async function saveRecord(
  bucket: Bucket,
  record: RegistryRecord,
  actor?: string,
): Promise<void> {
  // Get existing record to track changes
  const existingDoc = await getDoc(doc(db, colFor(bucket), record.id));

  const existing = existingDoc.exists()
    ? (existingDoc.data() as RegistryRecord)
    : null;

  // Track field changes for important fields
  const tracked = ["status", "assignee", "priority", "work", "application"];
  const activities: ActivityLog[] = [];

  if (existing && actor) {
    for (const field of tracked) {
      const oldVal = (existing as any)[field];
      const newVal = (record as any)[field];
      if (oldVal !== newVal && newVal !== undefined && newVal !== "") {
        activities.push(
          createActivity(
            actor,
            `Updated ${field}`,
            field,
            String(oldVal ?? "—"),
            String(newVal),
          ),
        );
      }
    }
  }

  // Prepare data with updated metadata
  const now = new Date().toISOString();
  const data = {
    ...record,
    lastUpdatedBy: actor,
    lastUpdatedAt: now,
    activityLogs: existing?.activityLogs
      ? [...existing.activityLogs, ...activities]
      : activities,
  };

  const { id, ...updateData } = data;
  await setDoc(doc(db, colFor(bucket), id), updateData, { merge: true });
}

/** Check for possible duplicate entries (same mvNo and work). */
export async function checkForDuplicates(
  bucket: Bucket,
  mvNo: string,
  work: string,
): Promise<RegistryRecord[]> {
  if (!mvNo || !work) return [];

  const q = query(
    collection(db, colFor(bucket)),
    where("mvNo", "==", mvNo),
    where("work", "==", work),
  );

  const snap = await getDocs(q);
  // Filter out deleted records
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as RegistryRecord))
    .filter((r) => !r.isDeleted);
}

/** Soft-delete a record (admin only). */
export async function softDeleteRecord(
  bucket: Bucket,
  id: string,
  actor: string,
  reason: DeleteReason,
): Promise<void> {
  const now = new Date().toISOString();
  const deleteLog = createActivity(
    actor,
    "Record deleted",
    "deleteReason",
    "",
    reason,
  );

  await updateDoc(doc(db, colFor(bucket), id), {
    isDeleted: true,
    deletedAt: now,
    deletedBy: actor,
    deleteReason: reason,
    activityLogs: arrayUnion(deleteLog),
  });
}

/** Hard-delete a record (internal use only, not exposed to UI). */
export async function deleteRecord(bucket: Bucket, id: string): Promise<void> {
  await deleteDoc(doc(db, colFor(bucket), id));
}

// ─── Legacy stubs (kept so non-updated call-sites don't break at compile time) ─

/**
 * @deprecated Use subscribeToRecords() for live data.
 * Returns an empty array — components using this need migrating.
 */
export function loadRecords(_bucket: Bucket): RegistryRecord[] {
  return [];
}

/**
 * @deprecated Use saveRecord() for individual writes.
 */
export async function saveRecords(bucket: Bucket, records: RegistryRecord[]): Promise<void> {
  await Promise.all(records.map((r) => saveRecord(bucket, r)));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function emptyRecord(srNo: number): RegistryRecord {
  return {
    id: crypto.randomUUID(),
    srNo,
    date: new Date().toISOString().slice(0, 10),
    mvNo: "",
    application: "",
    work: "",
    name: "",
    status: "Pending",
    mo: "",
    insurance: "",
    fitness: "",
    tax: "",
    co: "",
    assignee: "",
  };
}

export const STATUS_OPTIONS: RecordStatus[] = [
  "Pending",
  "In Progress",
  "Completed",
  "On Hold",
];
