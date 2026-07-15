// Customers — Firestore-backed customer profiles with vehicles.
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";
import { removeUndefined, type RecordStatus } from "./records";

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

export interface CustomerAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  storagePath: string; // Firebase Storage path
  downloadUrl: string;
  downloadURL?: string; // Support both cases
  uploadedAt: string;
  uploadedBy: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  address: string;
  mobile: string;
  email: string;
  vehicles: VehicleRecord[];
  attachments?: CustomerAttachment[];
}

import { subscribeAllClients, subscribeAllVehicles, deleteClient, saveClient } from "./hierarchy";
import { subscribeToAllDocs } from "./customerDocs";

/** Subscribe to live customer profile updates from V2 collections. */
export function subscribeToCustomers(
  cb: (customers: CustomerProfile[]) => void,
  errorCb?: (error: unknown) => void,
): () => void {
  let clientsList: any[] = [];
  let vehiclesList: any[] = [];
  let docsList: any[] = [];
  let clientsReady = false;
  let vehiclesReady = false;
  let docsReady = false;

  const checkAndUpdate = () => {
    if (clientsReady && vehiclesReady && docsReady) {
      const profiles: CustomerProfile[] = clientsList.map((client) => {
        const clientVehicles = vehiclesList
          .filter((v) => v.clientId === client.id)
          .map((v) => ({
            id: v.id,
            mvNo: v.vehicleNumber,
            work: "",
            insurance: "",
            fitness: "",
            tax: "",
            status: v.status || "Pending",
          }));
        
        const clientDocs = docsList
          .filter((d) => d.customerId === client.id && d.type === "Attachment")
          .map((d) => ({
            id: d.id,
            name: d.name,
            type: d.mimeType || "unknown",
            size: d.fileSize || 0,
            storagePath: d.storagePath || "",
            downloadUrl: d.downloadURL || "",
            downloadURL: d.downloadURL || "",
            uploadedAt: d.addedAt || "",
            uploadedBy: d.uploadedBy || "system",
          }));

        return {
          id: client.id,
          name: client.name,
          address: client.address || "",
          mobile: client.mobile || "",
          email: client.email || "",
          vehicles: clientVehicles,
          attachments: clientDocs,
        };
      });
      cb(profiles);
    }
  };

  const unsubClients = subscribeAllClients((clients) => {
    clientsList = clients;
    clientsReady = true;
    checkAndUpdate();
  }, errorCb);

  const unsubVehicles = subscribeAllVehicles((vehicles) => {
    vehiclesList = vehicles;
    vehiclesReady = true;
    checkAndUpdate();
  });

  const unsubDocs = subscribeToAllDocs((docs) => {
    docsList = docs;
    docsReady = true;
    checkAndUpdate();
  });

  return () => {
    unsubClients();
    unsubVehicles();
    unsubDocs();
  };
}

/** Upsert a customer profile. */
export async function saveCustomerProfile(profile: CustomerProfile): Promise<void> {
  const { id, name, address, mobile, email } = profile;
  await saveClient({
    id,
    name,
    address,
    mobile,
    companyName: "",
    gstNumber: "",
    notes: "",
    type: "client",
  });
}

/** Delete a customer profile. */
export async function deleteCustomerProfile(id: string): Promise<void> {
  await deleteClient(id);
}

/** Add an attachment to a customer profile. */
export async function addAttachment(
  customerId: string,
  attachment: CustomerAttachment,
): Promise<void> {
  console.log("[addAttachment] FIRESTORE_UPDATE_STARTED:", {
    customerId,
    attachmentId: attachment.id,
    attachmentName: attachment.name,
  });

  try {
    const docRef = doc(db, "registry_customer_docs", attachment.id);
    await setDoc(docRef, {
      customerId,
      name: attachment.name,
      type: "Attachment",
      addedAt: attachment.uploadedAt,
      storagePath: attachment.storagePath,
      downloadURL: attachment.downloadUrl,
      mimeType: attachment.type,
      fileSize: attachment.size,
      uploadedBy: attachment.uploadedBy,
    });
    console.log("[addAttachment] FIRESTORE_UPDATE_SUCCESS:", {
      customerId,
      attachmentId: attachment.id,
    });
  } catch (error) {
    console.error("[addAttachment] FIRESTORE_UPDATE_FAILED:", error);
    throw error;
  }
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
