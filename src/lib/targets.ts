// Targets — Firestore-backed target management for various service categories.
import {
  collection,
  query,
  getDocs,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";
import { createActivity, type ActivityLog } from "./activity";
import { getServiceStats } from "./services";
import { removeUndefined, type ServiceType } from "./records";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TargetCategory =
  | "Insurance"
  | "Fitness"
  | "Gujarat Permit"
  | "National Permit"
  | "Tax"
  | "License New"
  | "License Renew"
  | "RC Transfer"
  | "HP Addition"
  | "HP Termination";

export interface Target {
  id: string;
  category: TargetCategory;
  target: number;
  monthlyTarget?: number;
  quarterlyTarget?: number;
  yearlyTarget?: number;
  startDate?: string;
  endDate?: string;
  color?: string;
  status?: string;
  completed: number;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  activityLogs?: ActivityLog[];
}

// ─── Calculated fields ────────────────────────────────────────────────────────

export interface TargetMetrics extends Target {
  remaining: number;
  achievementPercentage: number;
}

/**
 * Calculate metrics for a target.
 */
export function calculateTargetMetrics(target: Target): TargetMetrics {
  const remaining = Math.max(0, target.target - target.completed);
  const achievementPercentage = target.target > 0 ? (target.completed / target.target) * 100 : 0;

  return {
    ...target,
    remaining,
    achievementPercentage: Math.round(achievementPercentage * 100) / 100,
  };
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

const TARGETS_COLLECTION = "targets";

/**
 * Map TargetCategory to ServiceType.
 * They share the same names except for "PUC" and the split License categories.
 */
function categoryToServiceType(category: TargetCategory): ServiceType {
  return category as ServiceType;
}

/**
 * Get actual completed count from service records.
 */
async function getRealCompletedCount(category: TargetCategory): Promise<number> {
  try {
    const serviceType = categoryToServiceType(category);
    const stats = await getServiceStats(serviceType);
    return stats.completed;
  } catch (error) {
    console.warn(`[getRealCompletedCount] Failed to get count for ${category}:`, error);
    return 0;
  }
}

/**
 * Enrich a target with real completed count from service records.
 */
async function enrichTargetWithRealCount(target: Target): Promise<Target> {
  const realCompleted = await getRealCompletedCount(target.category);
  return {
    ...target,
    completed: realCompleted, // Override with real count
  };
}

/**
 * Subscribe to all targets with live updates (with real completed counts).
 * Returns an unsubscribe function for cleanup.
 */
export function subscribeToTargets(callback: (targets: TargetMetrics[]) => void): () => void {
  let targetsList: Target[] = [];
  let servicesList: any[] = [];

  const update = () => {
    const enrichedTargets = targetsList.map((target) => {
      const serviceType = categoryToServiceType(target.category);
      const completedCount = servicesList.filter((s) => {
        return s.serviceType === serviceType;
      }).length;

      return {
        ...target,
        completed: completedCount,
      };
    });

    const metrics = enrichedTargets.map(calculateTargetMetrics);
    metrics.sort((a, b) => a.category.localeCompare(b.category));
    callback(metrics);
  };

  const unsubTargets = onSnapshot(query(collection(db, TARGETS_COLLECTION)), (snap) => {
    targetsList = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Target);
    update();
  });

  const unsubServices = onSnapshot(query(collection(db, "registry_services_v2")), (snap) => {
    servicesList = snap.docs.map((d) => d.data());
    update();
  });

  return () => {
    unsubTargets();
    unsubServices();
  };
}

/**
 * Get a single target by category (with real completed count from service records).
 */
export async function getTargetByCategory(category: TargetCategory): Promise<TargetMetrics | null> {
  const q = query(collection(db, TARGETS_COLLECTION));
  const snapshot = await getDocs(q);

  for (const doc of snapshot.docs) {
    const data = doc.data() as Omit<Target, "id">;
    if (data.category === category) {
      // Enrich with real completed count
      const target = { ...data, id: doc.id };
      const enriched = await enrichTargetWithRealCount(target);
      return calculateTargetMetrics(enriched);
    }
  }

  return null;
}

/**
 * Create or initialize a target.
 */
export async function createOrInitializeTarget(
  category: TargetCategory,
  targetValue: number,
  actor: string,
  extra?: Partial<Target>
): Promise<void> {
  const existing = await getTargetByCategory(category);

  if (existing) {
    const targetRef = doc(db, TARGETS_COLLECTION, existing.id);
    const activity = createActivity(
      actor,
      "Updated",
      "target config",
      `${existing.target}`,
      `${targetValue}`
    );

    await updateDoc(targetRef, removeUndefined({
      target: targetValue,
      monthlyTarget: extra?.monthlyTarget ?? targetValue,
      quarterlyTarget: extra?.quarterlyTarget,
      yearlyTarget: extra?.yearlyTarget,
      startDate: extra?.startDate,
      endDate: extra?.endDate,
      color: extra?.color,
      status: extra?.status,
      lastUpdatedBy: actor,
      lastUpdatedAt: new Date().toISOString(),
      activityLogs: arrayUnion(activity),
    }));
  } else {
    const targetRef = doc(collection(db, TARGETS_COLLECTION));
    const activity = createActivity(actor, "Created", "target", "0", `${targetValue}`);

    await setDoc(
      targetRef,
      removeUndefined({
        category,
        target: targetValue,
        monthlyTarget: extra?.monthlyTarget ?? targetValue,
        quarterlyTarget: extra?.quarterlyTarget,
        yearlyTarget: extra?.yearlyTarget,
        startDate: extra?.startDate,
        endDate: extra?.endDate,
        color: extra?.color,
        status: extra?.status ?? "Active",
        completed: 0,
        lastUpdatedBy: actor,
        lastUpdatedAt: new Date().toISOString(),
        activityLogs: [activity],
      } as Target)
    );
  }
}

/**
 * Update target value (admin only).
 */
export async function updateTargetValue(
  id: string,
  newTarget: number,
  actor: string,
  extra?: Partial<Target>
): Promise<void> {
  const targetRef = doc(db, TARGETS_COLLECTION, id);
  const snapshot = await getDoc(targetRef);

  if (!snapshot.exists()) {
    throw new Error("Target not found");
  }

  const currentTarget = snapshot.data().target;
  const activity = createActivity(actor, "Updated", "target", `${currentTarget}`, `${newTarget}`);

  await updateDoc(targetRef, removeUndefined({
    target: newTarget,
    monthlyTarget: extra?.monthlyTarget ?? newTarget,
    quarterlyTarget: extra?.quarterlyTarget,
    yearlyTarget: extra?.yearlyTarget,
    startDate: extra?.startDate,
    endDate: extra?.endDate,
    color: extra?.color,
    status: extra?.status,
    lastUpdatedBy: actor,
    lastUpdatedAt: new Date().toISOString(),
    activityLogs: arrayUnion(activity),
  }));
}

/**
 * Update completed count.
 */
export async function updateCompletedCount(
  id: string,
  newCompleted: number,
  actor: string,
): Promise<void> {
  const targetRef = doc(db, TARGETS_COLLECTION, id);
  const snapshot = await getDoc(targetRef);

  if (!snapshot.exists()) {
    throw new Error("Target not found");
  }

  const currentCompleted = snapshot.data().completed;
  const activity = createActivity(
    actor,
    "Updated",
    "completed",
    `${currentCompleted}`,
    `${newCompleted}`,
  );

  await updateDoc(targetRef, {
    completed: newCompleted,
    lastUpdatedBy: actor,
    lastUpdatedAt: new Date().toISOString(),
    activityLogs: arrayUnion(activity),
  });
}

/**
 * Increment completed count by 1.
 */
export async function incrementCompleted(id: string, actor: string): Promise<void> {
  const targetRef = doc(db, TARGETS_COLLECTION, id);
  const snapshot = await getDoc(targetRef);

  if (!snapshot.exists()) {
    throw new Error("Target not found");
  }

  const currentCompleted = snapshot.data().completed;
  const newCompleted = currentCompleted + 1;

  await updateCompletedCount(id, newCompleted, actor);
}
