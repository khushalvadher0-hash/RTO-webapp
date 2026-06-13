// Activity — Shared activity log types and helpers for all records.

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
