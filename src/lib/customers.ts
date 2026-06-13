// Customers — Firestore-backed customer profiles with vehicles.
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { RecordStatus } from "./records";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VehicleRecord {
  id: string;
  mvNo: string;
  work: string;
  insurance: string;
  fitness: string;
  tax: string;
  status: RecordStatus;
}

export interface CustomerProfile {
  id: string;
  name: string;
  address: string;
  mobile: string;
  email: string;
  vehicles: VehicleRecord[];
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

const COL = "registry_customers";

/** Subscribe to live customer profile updates. Returns unsubscribe function. */
export function subscribeToCustomers(cb: (customers: CustomerProfile[]) => void): () => void {
  const q = query(collection(db, COL), orderBy("name"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CustomerProfile)));
  });
}

/** Upsert a customer profile. */
export async function saveCustomerProfile(profile: CustomerProfile): Promise<void> {
  const { id, ...data } = profile;
  await setDoc(doc(db, COL, id), data, { merge: true });
}

/** Delete a customer profile. */
export async function deleteCustomerProfile(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

// ─── Legacy stubs ─────────────────────────────────────────────────────────────

/** @deprecated Use subscribeToCustomers(). */
export function loadCustomers(): CustomerProfile[] {
  return [];
}

/** @deprecated Use saveCustomerProfile(). */
export async function saveCustomers(profiles: CustomerProfile[]): Promise<void> {
  await Promise.all(profiles.map(saveCustomerProfile));
}
