import React from "react";
import { render, screen } from "@testing-library/react-native";
import type { ObservationPlan } from "../../../lib/fits/types";
import { PlanCard } from "../PlanCard";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../stores/observation/useTargetStore", () => ({
  useTargetStore: (
    selector: (state: { targets: Array<{ id: string; name: string }> }) => unknown,
  ) =>
    selector({
      targets: [{ id: "t1", name: "M42" }],
    }),
}));

const makePlan = (overrides: Partial<ObservationPlan> = {}): ObservationPlan => ({
  id: "plan-1",
  title: "M42 Session",
  targetId: "t1",
  targetName: "M42",
  startDate: "2099-03-10T20:00:00.000Z",
  endDate: "2099-03-10T22:00:00.000Z",
  reminderMinutes: 30,
  createdAt: 1,
  status: "planned",
  ...overrides,
});

describe("PlanCard", () => {
  it("shows conflict message when conflictCount is greater than zero", () => {
    render(<PlanCard plan={makePlan()} conflictCount={2} />);
    expect(screen.getByText("sessions.planConflictDetected (2)")).toBeTruthy();
  });

  it("does not show conflict message when there is no conflict", () => {
    render(<PlanCard plan={makePlan()} conflictCount={0} />);
    expect(screen.queryByText("sessions.planConflictDetected")).toBeNull();
  });

  it("shows overdue marker when plan is overdue", () => {
    render(<PlanCard plan={makePlan()} overdue />);
    expect(screen.getByText("sessions.planOverdue")).toBeTruthy();
  });
});
