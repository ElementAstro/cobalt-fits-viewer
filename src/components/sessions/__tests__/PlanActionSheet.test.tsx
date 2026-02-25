import React from "react";
import { render, screen } from "@testing-library/react-native";
import { PlanActionSheet } from "../PlanActionSheet";
import type { ObservationPlan } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const makePlan = (overrides: Partial<ObservationPlan> = {}): ObservationPlan => ({
  id: "plan-1",
  title: "M42 session",
  targetName: "M42",
  startDate: "2025-03-10T20:00:00.000Z",
  endDate: "2025-03-10T22:00:00.000Z",
  reminderMinutes: 30,
  createdAt: 1,
  ...overrides,
});

describe("PlanActionSheet", () => {
  const onClose = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("returns null when plan is null", () => {
    const { toJSON } = render(<PlanActionSheet visible plan={null} onClose={onClose} />);
    expect(toJSON()).toBeNull();
  });

  it("shows delete action when onDelete is provided", () => {
    render(<PlanActionSheet visible plan={makePlan()} onClose={onClose} onDelete={jest.fn()} />);
    expect(screen.getByText("common.delete")).toBeTruthy();
  });

  it("shows sync action for unsynced plan", () => {
    render(
      <PlanActionSheet visible plan={makePlan()} onClose={onClose} onSyncToCalendar={jest.fn()} />,
    );
    expect(screen.getByText("sessions.syncToCalendar")).toBeTruthy();
  });

  it("shows unsync action for synced plan", () => {
    render(
      <PlanActionSheet
        visible
        plan={makePlan({ calendarEventId: "evt-1" })}
        onClose={onClose}
        onUnsyncFromCalendar={jest.fn()}
      />,
    );
    expect(screen.getByText("sessions.unsyncFromCalendar")).toBeTruthy();
  });

  it("shows status change actions based on current status", () => {
    render(
      <PlanActionSheet
        visible
        plan={makePlan({ status: "planned" })}
        onClose={onClose}
        onStatusChange={jest.fn()}
      />,
    );
    expect(screen.getByText("sessions.status.completed")).toBeTruthy();
    expect(screen.getByText("sessions.status.cancelled")).toBeTruthy();
    expect(screen.queryByText("sessions.status.planned")).toBeNull();
  });
});
