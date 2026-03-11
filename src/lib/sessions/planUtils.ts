import type { GeoLocation, ObservationPlan, ObservationSession } from "../fits/types";

export type PlanStatus = NonNullable<ObservationPlan["status"]>;
export type PlanStatusFilter = PlanStatus | "all";
export type PlanSortBy = "startAsc" | "startDesc" | "target" | "status";
export type ObservationPlanDraft = Omit<ObservationPlan, "id" | "calendarEventId" | "createdAt">;

const PLAN_STATUS_ORDER: Record<PlanStatus, number> = {
  planned: 0,
  completed: 1,
  cancelled: 2,
};

export function normalizePlanStatus(status?: ObservationPlan["status"]): PlanStatus {
  return status ?? "planned";
}

function parsePlanTime(plan: Pick<ObservationPlan, "startDate" | "endDate">): {
  start: number;
  end: number;
} {
  return {
    start: new Date(plan.startDate).getTime(),
    end: new Date(plan.endDate).getTime(),
  };
}

function isValidPlanTimeRange(plan: Pick<ObservationPlan, "startDate" | "endDate">): boolean {
  const { start, end } = parsePlanTime(plan);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

function cloneEquipment(plan: ObservationPlan): ObservationPlanDraft["equipment"] {
  if (!plan.equipment) return undefined;
  return {
    ...plan.equipment,
    filters: plan.equipment.filters ? [...plan.equipment.filters] : undefined,
  };
}

function cloneLocation(plan: ObservationPlan): ObservationPlanDraft["location"] {
  if (!plan.location) return undefined;
  return { ...plan.location };
}

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getPlanDateKey(plan: ObservationPlan): string {
  return toLocalDateKey(new Date(plan.startDate));
}

export function planTimeRangesOverlap(
  a: Pick<ObservationPlan, "startDate" | "endDate">,
  b: Pick<ObservationPlan, "startDate" | "endDate">,
): boolean {
  if (!isValidPlanTimeRange(a) || !isValidPlanTimeRange(b)) {
    return false;
  }
  const ar = parsePlanTime(a);
  const br = parsePlanTime(b);
  return ar.start < br.end && br.start < ar.end;
}

export function findOverlappingPlans(
  draft: Pick<ObservationPlan, "id" | "startDate" | "endDate" | "status">,
  plans: ObservationPlan[],
): ObservationPlan[] {
  return plans.filter((existing) => {
    if (existing.id === draft.id) return false;
    if (normalizePlanStatus(existing.status) === "cancelled") return false;
    if (normalizePlanStatus(draft.status) === "cancelled") return false;
    return planTimeRangesOverlap(draft, existing);
  });
}

export function buildPlanConflictCountMap(plans: ObservationPlan[]): Record<string, number> {
  const activePlans = plans.filter((plan) => normalizePlanStatus(plan.status) !== "cancelled");
  const counts: Record<string, number> = {};

  for (let i = 0; i < activePlans.length; i += 1) {
    for (let j = i + 1; j < activePlans.length; j += 1) {
      const a = activePlans[i];
      const b = activePlans[j];
      if (!planTimeRangesOverlap(a, b)) continue;
      counts[a.id] = (counts[a.id] ?? 0) + 1;
      counts[b.id] = (counts[b.id] ?? 0) + 1;
    }
  }

  return counts;
}

function shiftIsoByLocalDays(isoString: string, days: number): string {
  const date = new Date(isoString);
  if (!Number.isFinite(date.getTime())) return isoString;
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function duplicatePlanToDraft(
  plan: ObservationPlan,
  options: { shiftDays?: number; status?: PlanStatus } = {},
): ObservationPlanDraft {
  const { shiftDays = 0, status = "planned" } = options;
  return {
    title: plan.title,
    targetId: plan.targetId,
    targetName: plan.targetName,
    startDate: shiftIsoByLocalDays(plan.startDate, shiftDays),
    endDate: shiftIsoByLocalDays(plan.endDate, shiftDays),
    location: cloneLocation(plan),
    equipment: cloneEquipment(plan),
    notes: plan.notes,
    reminderMinutes: plan.reminderMinutes,
    status,
  };
}

export function rolloverPlanToNextDay(plan: ObservationPlan): ObservationPlanDraft {
  return duplicatePlanToDraft(plan, { shiftDays: 1, status: "planned" });
}

export function filterObservationPlans(
  plans: ObservationPlan[],
  options: {
    selectedDate?: string | null;
    statusFilter?: PlanStatusFilter;
    query?: string;
  } = {},
): ObservationPlan[] {
  const { selectedDate, statusFilter = "all", query = "" } = options;
  const normalizedQuery = query.trim().toLowerCase();

  return plans.filter((plan) => {
    if (selectedDate && getPlanDateKey(plan) !== selectedDate) {
      return false;
    }

    if (statusFilter !== "all" && normalizePlanStatus(plan.status) !== statusFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return (
      plan.title.toLowerCase().includes(normalizedQuery) ||
      plan.targetName.toLowerCase().includes(normalizedQuery) ||
      (plan.notes?.toLowerCase().includes(normalizedQuery) ?? false)
    );
  });
}

export function sortObservationPlans(
  plans: ObservationPlan[],
  sortBy: PlanSortBy = "startAsc",
): ObservationPlan[] {
  const sorted = [...plans];

  switch (sortBy) {
    case "startDesc":
      return sorted.sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      );
    case "target":
      return sorted.sort((a, b) => a.targetName.localeCompare(b.targetName));
    case "status":
      return sorted.sort((a, b) => {
        const statusDiff =
          PLAN_STATUS_ORDER[normalizePlanStatus(a.status)] -
          PLAN_STATUS_ORDER[normalizePlanStatus(b.status)];
        if (statusDiff !== 0) return statusDiff;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });
    case "startAsc":
    default:
      return sorted.sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      );
  }
}

function isValidGeoLocation(location: GeoLocation): boolean {
  return (
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

export function buildSessionFromPlan(
  plan: ObservationPlan,
  now: number = Date.now(),
): ObservationSession {
  const startTime = new Date(plan.startDate).getTime();
  const endTime = new Date(plan.endDate).getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    throw new Error("Invalid plan date");
  }
  if (endTime <= startTime) {
    throw new Error("Invalid plan time range");
  }
  if (plan.location && !isValidGeoLocation(plan.location)) {
    throw new Error("Invalid plan location");
  }

  return {
    id: `from_plan_${plan.id}_${now}`,
    date: toLocalDateKey(new Date(startTime)),
    startTime,
    endTime,
    duration: Math.floor((endTime - startTime) / 1000),
    targetRefs: [{ targetId: plan.targetId, name: plan.targetName }],
    imageIds: [],
    equipment: plan.equipment ?? {},
    location: plan.location,
    notes: plan.notes,
    createdAt: now,
  };
}
