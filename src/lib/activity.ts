// Activity — Shared activity log types and helpers for all records.
import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface ActivityLog {
  id: string;
  actor: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}

/**
 * Create an activity log entry.
 */
export function createActivity(
  actor: string,
  action: string,
  field?: string,
  oldValue?: string,
  newValue?: string,
): ActivityLog {
  return {
    id: crypto.randomUUID(),
    actor,
    action,
    field,
    oldValue,
    newValue,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log a detailed client activity to client_activity_logs collection in Firestore.
 */
export async function logClientActivity(
  clientId: string,
  userId: string,
  userName: string,
  action: string,
  field?: string | null,
  oldValue?: string | null,
  newValue?: string | null,
): Promise<void> {
  if (!clientId) return;
  try {
    const logsCol = collection(db, "client_activity_logs");
    await addDoc(logsCol, {
      clientId,
      userId,
      userName,
      action,
      field: field || null,
      oldValue: oldValue || null,
      newValue: newValue || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[logClientActivity] Failed to write client_activity_logs entry:", err);
  }
}

/**
 * Format a timestamp for display.
 */
export function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * Get a human-readable action description.
 */
export function getActivityDescription(log: ActivityLog): string {
  if (log.field && log.oldValue !== undefined && log.newValue !== undefined) {
    return `${log.action}: ${log.field} changed from "${log.oldValue}" to "${log.newValue}"`;
  }
  if (log.field) {
    return `${log.action}: ${log.field}`;
  }
  return log.action;
}
