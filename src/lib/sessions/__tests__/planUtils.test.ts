import type { ObservationPlan } from "../../fits/types";
import {
  buildSessionFromPlan,
  filterObservationPlans,
  getPlanDateKey,
  normalizePlanStatus,
  sortObservationPlans,
  toLocalDateKey,
} from "../planUtils";

const makePlan = (overrides: Partial<ObservationPlan> = {}): ObservationPlan => ({
  id: `plan-${Math.random().toString(36).slice(2, 8)}`,
  title: "M42 Night Session",
  targetName: "M42",
  startDate: "2025-03-10T20:00:00.000Z",
  endDate: "2025-03-10T22:00:00.000Z",
  reminderMinutes: 30,
  createdAt: 1,
  ...overrides,
});

describe("planUtils", () => {
  describe("status", () => {
    it("normalizes undefined status to planned", () => {
      expect(normalizePlanStatus(undefined)).toBe("planned");
    });

    it("keeps explicit status", () => {
      expect(normalizePlanStatus("completed")).toBe("completed");
      expect(normalizePlanStatus("cancelled")).toBe("cancelled");
    });
  });

  describe("date keys", () => {
    it("formats local date key", () => {
      const date = new Date(2025, 1, 3, 20, 0, 0);
      expect(toLocalDateKey(date)).toBe("2025-02-03");
    });

    it("extracts date key from plan startDate", () => {
      const plan = makePlan({ startDate: "2025-06-15T12:30:00.000Z" });
      expect(getPlanDateKey(plan)).toMatch(/^2025-06-1[45]$/);
    });
  });

  describe("filterObservationPlans", () => {
    const plans = [
      makePlan({
        id: "p1",
        title: "M42 Core",
        targetName: "M42",
        status: "planned",
        startDate: "2025-06-10T20:00:00.000Z",
      }),
      makePlan({
        id: "p2",
        title: "M31 Wide",
        targetName: "M31",
        status: "completed",
        notes: "excellent seeing",
        startDate: "2025-06-11T20:00:00.000Z",
      }),
      makePlan({
        id: "p3",
        title: "NGC7000",
        targetName: "NGC 7000",
        status: "cancelled",
        startDate: "2025-06-11T23:00:00.000Z",
      }),
    ];

    it("filters by status", () => {
      const result = filterObservationPlans(plans, { statusFilter: "completed" });
      expect(result.map((p) => p.id)).toEqual(["p2"]);
    });

    it("filters by query on title/target/notes", () => {
      expect(filterObservationPlans(plans, { query: "core" }).map((p) => p.id)).toEqual(["p1"]);
      expect(filterObservationPlans(plans, { query: "m31" }).map((p) => p.id)).toEqual(["p2"]);
      expect(filterObservationPlans(plans, { query: "seeing" }).map((p) => p.id)).toEqual(["p2"]);
    });

    it("supports selectedDate filter", () => {
      const selectedDate = getPlanDateKey(plans[1]);
      const result = filterObservationPlans(plans, { selectedDate });
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((plan) => getPlanDateKey(plan) === selectedDate)).toBe(true);
    });
  });

  describe("sortObservationPlans", () => {
    const plans = [
      makePlan({
        id: "p1",
        targetName: "M31",
        status: "completed",
        startDate: "2025-06-12T20:00:00.000Z",
      }),
      makePlan({
        id: "p2",
        targetName: "M42",
        status: "planned",
        startDate: "2025-06-10T20:00:00.000Z",
      }),
      makePlan({
        id: "p3",
        targetName: "IC1805",
        status: "cancelled",
        startDate: "2025-06-11T20:00:00.000Z",
      }),
    ];

    it("sorts by startAsc", () => {
      expect(sortObservationPlans(plans, "startAsc").map((p) => p.id)).toEqual(["p2", "p3", "p1"]);
    });

    it("sorts by startDesc", () => {
      expect(sortObservationPlans(plans, "startDesc").map((p) => p.id)).toEqual(["p1", "p3", "p2"]);
    });

    it("sorts by target", () => {
      expect(sortObservationPlans(plans, "target").map((p) => p.id)).toEqual(["p3", "p1", "p2"]);
    });

    it("sorts by status order planned -> completed -> cancelled", () => {
      expect(sortObservationPlans(plans, "status").map((p) => p.id)).toEqual(["p2", "p1", "p3"]);
    });
  });

  describe("buildSessionFromPlan", () => {
    it("creates a valid session from plan", () => {
      const plan = makePlan({
        id: "p-build",
        targetName: "M45",
        notes: "windy",
      });
      const session = buildSessionFromPlan(plan, 12345);

      expect(session.id).toBe("from_plan_p-build_12345");
      expect(session.targets).toEqual(["M45"]);
      expect(session.duration).toBeGreaterThan(0);
      expect(session.notes).toBe("windy");
    });

    it("throws on invalid time range", () => {
      const plan = makePlan({
        startDate: "2025-03-10T22:00:00.000Z",
        endDate: "2025-03-10T20:00:00.000Z",
      });
      expect(() => buildSessionFromPlan(plan)).toThrow("Invalid plan time range");
    });
  });
});
