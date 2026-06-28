// Auth — Firebase Auth + Firestore user profiles.
// Maintains the same public API as the old localStorage auth so routes
// don't need major changes.
import { signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import { STAFF_USERS } from "./records";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StaffUser = {
  uid: string;
  username: string;
  name: string;
  role: "admin" | "manager" | "employee" | "viewer";
  isActive?: boolean;
  employeeId?: string;
  status?: string;
};

// ─── In-memory session cache ──────────────────────────────────────────────────
// Populated by initAuth() so getSession() stays synchronous (needed by
// beforeLoad guards in routes).

let _session: StaffUser | null = null;
let _initialized = false;

const EMAIL_DOMAIN = "staff-focus-hub.app";
export const toEmail = (username: string) => `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;

// ─── Staff account definitions ────────────────────────────────────────────────

export const PRIVILEGED_ADMINS = ["admin", "priya", "rahul", "manager", "staff"];
const ALL_ACCOUNTS = [
  // Core admin accounts (always active)
  { username: "admin", password: "admin123", name: "Office Admin", role: "admin" as const, employeeId: "EMP000" },
  { username: "priya", password: "priya123", name: "Priya", role: "admin" as const, employeeId: "EMP000A" },
  { username: "manager", password: "manager123", name: "Manager", role: "manager" as const, employeeId: "EMP001" },
  { username: "employee1", password: "employee1", name: "Employee 1", role: "employee" as const, employeeId: "EMP002" },
  { username: "employee2", password: "employee2", name: "Employee 2", role: "employee" as const, employeeId: "EMP003" },
  { username: "employee3", password: "employee3", name: "Employee 3", role: "employee" as const, employeeId: "EMP004" },
  { username: "employee4", password: "employee4", name: "Employee 4", role: "employee" as const, employeeId: "EMP005" },
  { username: "employee5", password: "employee5", name: "Employee 5", role: "employee" as const, employeeId: "EMP006" },
  { username: "employee6", password: "employee6", name: "Employee 6", role: "employee" as const, employeeId: "EMP007" },
  { username: "employee7", password: "employee7", name: "Employee 7", role: "employee" as const, employeeId: "EMP008" },
  // Staff users defined in records.ts
  ...STAFF_USERS.map((s, idx) => ({
    username: s.username,
    password: `${s.username}123`,
    name: s.name,
    role: "employee" as const,
    employeeId: `EMP0${9 + idx}`,
  })),
];

export const STAFF_CREDENTIALS = ALL_ACCOUNTS.map((a) => ({
  username: a.username,
  name: a.name,
  password: a.password,
}));

// ─── First-run provisioning ───────────────────────────────────────────────────

async function provisionUsers(): Promise<void> {
  // Check whether we've already provisioned
  const metaRef = doc(db, "_meta", "provisioned");
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists()) {
    // If already provisioned, we still want to make sure the manager and employee1-7 exist.
    // Let's run provision sequence for all default accounts anyway to be safe.
  }

  // Create Firebase Auth accounts and Firestore profiles
  for (const acct of ALL_ACCOUNTS) {
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        toEmail(acct.username),
        acct.password,
      );
      await setDoc(doc(db, "users", cred.user.uid), {
        username: acct.username,
        name: acct.name,
        role: acct.role,
        status: "active",
        isActive: true,
        fullName: acct.name,
        employeeId: acct.employeeId,
        createdAt: new Date().toISOString(),
        createdBy: "system",
      });
    } catch {
      // auth/email-already-in-use → already provisioned, skip
    }
  }

  // Seed initial Firestore records
  const { seedInitialData } = await import("./seed");
  await seedInitialData();

  // Mark as provisioned
  await setDoc(metaRef, { provisionedAt: new Date().toISOString() });
}

// Migration: ensure every user document has required fields
async function migrateUsers(): Promise<void> {
  const usersCol = collection(db, "users");
  const snapshot = await getDocs(usersCol);
  const batch = writeBatch(db);
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const updates: any = {};
    // Role default
    if (!data.role) updates.role = "employee";
    // Permissions default
    if (!data.permissions) updates.permissions = {};
    // Status default based on username
    if (!data.status) {
      const privileged = ["admin", "priya", "rahul", "staff"]; // same as privileged admins list
      updates.status = privileged.includes(data.username) ? "active" : "inactive";
    }
    // Add missing audit fields if needed
    if (!data.createdAt) updates.createdAt = new Date().toISOString();
    if (!data.createdBy) updates.createdBy = "system";
    if (Object.keys(updates).length) {
      batch.update(doc(db, "users", docSnap.id), updates);
    }
  });
  await batch.commit();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Bootstrap Firebase auth state.  Call once in the root component.
 * The callback fires every time the signed-in user changes.
 * Returns an unsubscribe function for cleanup.
 */
export function initAuth(onChange: (user: StaffUser | null) => void): () => void {
  // Kick off provisioning in the background (no-op if already done)
  (async () => {
    await provisionUsers().catch(console.error);
    await migrateUsers().catch(console.error);
  })();

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const snap = await getDoc(doc(db, "users", firebaseUser.uid));
      _session = snap.exists() ? ({ uid: firebaseUser.uid, ...snap.data() } as StaffUser) : null;
    } else {
      _session = null;
    }
    _initialized = true;
    // Keep a lightweight session in localStorage for immediate restores
    try {
      if (_session) {
        localStorage.setItem(
          "rp_session",
          JSON.stringify({
            uid: _session.uid,
            username: _session.username,
            name: _session.name,
            role: _session.role,
          }),
        );
      } else {
        localStorage.removeItem("rp_session");
      }
    } catch {
      // ignore storage errors
    }
    onChange(_session);
  });
}

/** Synchronous getter — populated after initAuth fires. */
export function getSession(): StaffUser | null {
  if (_session) return _session;
  // Try to restore lightweight session from localStorage to avoid redirect loops
  try {
    const raw = localStorage.getItem("rp_session");
    if (raw) {
      const parsed = JSON.parse(raw);
      // Minimal validation
      if (parsed && parsed.username) {
        return parsed as StaffUser;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/** True once the first onAuthStateChanged callback has fired. */
export function isAuthReady(): boolean {
  return _initialized;
}

/** Sign in by username + password (maps to Firebase email internally). */
export async function login(username: string, password: string): Promise<StaffUser> {
  const cred = await signInWithEmailAndPassword(auth, toEmail(username), password);
  const snap = await getDoc(doc(db, "users", cred.user.uid));
  if (!snap.exists()) throw new Error("User profile not found — contact admin.");
  const profile = snap.data();
  if (!(profile.isActive ?? (profile.status === 'active'))) {
    await signOut(auth);
    if (profile.isActive === false || profile.status === 'inactive') {
      throw new Error('Your account is inactive. Please contact the Administrator.');
    }
    if (profile.status === 'suspended') {
      throw new Error('Your account has been suspended.');
    }
    // Fallback for any other disabled state
    throw new Error('Account disabled');
  }
  _session = { uid: cred.user.uid, ...profile } as StaffUser;
  try {
    localStorage.setItem(
      "rp_session",
      JSON.stringify({
        uid: _session.uid,
        username: _session.username,
        name: _session.name,
        role: _session.role,
      }),
    );
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event("auth-change"));
  return _session;
}

/** Sign out the current user. */
export async function logout(): Promise<void> {
  await signOut(auth);
  _session = null;
  try {
    localStorage.removeItem("rp_session");
  } catch {}
  window.dispatchEvent(new Event("auth-change"));
}
