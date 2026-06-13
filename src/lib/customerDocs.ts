// Per-customer document store — Firestore metadata + Firebase Storage for files.
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc as firestoreDeleteDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "./firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerDoc {
  id: string;
  customerId: string;
  name: string;
  type: string;
  addedAt: string;
  /** Present when a real file was uploaded to Firebase Storage. */
  storageKey?: string;
  /** Firebase Storage download URL (if file uploaded). */
  downloadUrl?: string;
  /** Original file MIME type. */
  mimeType?: string;
  /** File size in bytes. */
  fileSize?: number;
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

const COL = "registry_customer_docs";

/**
 * Subscribe to live doc updates for a specific customer.
 * Returns an unsubscribe function for useEffect cleanup.
 */
export function subscribeToDocsFor(
  customerId: string,
  cb: (docs: CustomerDoc[]) => void,
): () => void {
  const q = query(
    collection(db, COL),
    where("customerId", "==", customerId),
    orderBy("addedAt", "desc"),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CustomerDoc)));
  });
}

/**
 * Add a document entry for a customer.
 * If `file` is provided it will be uploaded to Firebase Storage first.
 *
 * @param onProgress  Optional callback 0–100 during upload.
 */
export async function addDoc(
  customerId: string,
  name: string,
  type: string,
  file?: File,
  onProgress?: (pct: number) => void,
): Promise<CustomerDoc> {
  const id = crypto.randomUUID();
  let storageKey: string | undefined;
  let downloadUrl: string | undefined;
  let mimeType: string | undefined;
  let fileSize: number | undefined;

  if (file) {
    storageKey = `customers/${customerId}/docs/${id}_${file.name}`;
    const storageRef = ref(storage, storageKey);
    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
      task.on(
        "state_changed",
        (snap) => onProgress && onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        reject,
        async () => {
          downloadUrl = await getDownloadURL(task.snapshot.ref);
          resolve();
        },
      );
    });
    mimeType = file.type;
    fileSize = file.size;
  }

  const docEntry: CustomerDoc = {
    id,
    customerId,
    name,
    type,
    addedAt: new Date().toISOString(),
    ...(storageKey ? { storageKey, downloadUrl, mimeType, fileSize } : {}),
  };

  const { id: _id, ...data } = docEntry;
  await setDoc(doc(db, COL, id), data);
  return docEntry;
}

/** Delete a document entry and its Storage file (if any). */
export async function deleteDoc(docId: string, storageKey?: string): Promise<void> {
  await firestoreDeleteDoc(doc(db, COL, docId));
  if (storageKey) {
    try {
      await deleteObject(ref(storage, storageKey));
    } catch {
      // File may have already been deleted — ignore
    }
  }
}

// ─── Legacy stubs ─────────────────────────────────────────────────────────────

/** @deprecated Use subscribeToDocsFor(). */
export function loadDocsFor(_customerId: string): CustomerDoc[] {
  return [];
}
