import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SessionDateSummary } from "../SessionDateSummary";
import type { ObservationPlan, ObservationSession } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const makeSession = (id: string, startTime: number): ObservationSession => ({
  id,
  date: "2025-03-10",
  startTime,
  endTime: startTime + 7200_000,
  duration: 7200,
  targetRefs: [{ name: "M42" }],
  imageIds: [],
  equipment: {},
  createdAt: 1,
});

const makePlan = (id: string): ObservationPlan => ({
  id,
  title: "M31 session",
  targetName: "M31",
  startDate: "2025-03-10T20:00:00.000Z",
  endDate: "2025-03-10T22:00:00.000Z",
  reminderMinutes: 30,
  status: "planned",
  createdAt: 1,
});

describe("SessionDateSummary", () => {
  const defaultProps = {
    selectedDate: "2025-03-10",
    sessionsOnDate: [makeSession("s1", Date.parse("2025-03-10T20:00:00Z"))],
    plansOnDate: [makePlan("p1")],
    onClearDate: jest.fn(),
    onSessionPress: jest.fn(),
    onPlanPress: jest.fn(),
    getSessionTargetNames: () => ["M42"],
    getPlanTargetName: () => "M31",
    getPlanMaintenanceFlags: () => ({ overdue: false, unsynced: false, conflict: false }),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders session and plan counts", () => {
    render(<SessionDateSummary {...defaultProps} />);
    expect(screen.getAllByText("1")).toHaveLength(2);
    expect(screen.getByText("sessions.sessionsOnDate")).toBeTruthy();
    expect(screen.getByText("sessions.plansOnDate")).toBeTruthy();
  });

  it("shows empty state when no items", () => {
    render(<SessionDateSummary {...defaultProps} sessionsOnDate={[]} plansOnDate={[]} />);
    expect(screen.getByText("sessions.noDateItems")).toBeTruthy();
  });

  it("calls onClearDate when clear button is pressed", () => {
    render(<SessionDateSummary {...defaultProps} />);
    fireEvent.press(screen.getByText("sessions.clearDateFilter"));
    expect(defaultProps.onClearDate).toHaveBeenCalledTimes(1);
  });

  it("marks overdue plans in the date summary row", () => {
    render(
      <SessionDateSummary
        {...defaultProps}
        getPlanMaintenanceFlags={() => ({ overdue: true, unsynced: true, conflict: false })}
      />,
    );
    expect(screen.getByText(/sessions\.planOverdue/)).toBeTruthy();
  });
});
