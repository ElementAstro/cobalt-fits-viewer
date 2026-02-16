import type { ObservationPlan, ObservationSession } from "../fits/types";

export type PlanStatus = NonNullable<ObservationPlan["status"]>;
export type PlanStatusFilter = PlanStatus | "all";
export type PlanSortBy = "startAsc" | "startDesc" | "target" | "status";

const PLAN_STATUS_ORDER: Record<PlanStatus, number> = {
  planned: 0,
  completed: 1,
  cancelled: 2,
};

export function normalizePlanStatus(status?: ObservationPlan["status"]): PlanStatus {
  return status ?? "planned";
}

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getPlanDateKey(plan: ObservationPlan): string {
  return toLocalDateKey(new Date(plan.startDate));
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

  return {
    id: `from_plan_${plan.id}_${now}`,
    date: toLocalDateKey(new Date(startTime)),
    startTime,
    endTime,
    duration: Math.floor((endTime - startTime) / 1000),
    targets: [plan.targetName],
    imageIds: [],
    equipment: plan.equipment ?? {},
    location: plan.location,
    notes: plan.notes,
    createdAt: now,
  };
}
