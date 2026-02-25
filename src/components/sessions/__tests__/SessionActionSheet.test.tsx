import React from "react";
import { render, screen } from "@testing-library/react-native";
import { SessionActionSheet } from "../SessionActionSheet";
import type { ObservationSession } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const makeSession = (overrides: Partial<ObservationSession> = {}): ObservationSession => ({
  id: "s-1",
  date: "2025-03-10",
  startTime: Date.parse("2025-03-10T20:00:00Z"),
  endTime: Date.parse("2025-03-10T22:00:00Z"),
  duration: 7200,
  targetRefs: [{ name: "M42" }],
  imageIds: [],
  equipment: {},
  createdAt: 1,
  ...overrides,
});

describe("SessionActionSheet", () => {
  const onClose = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("returns null when session is null", () => {
    const { toJSON } = render(
      <SessionActionSheet visible session={null} calendarSyncEnabled={false} onClose={onClose} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("shows delete action when onDelete is provided", () => {
    render(
      <SessionActionSheet
        visible
        session={makeSession()}
        calendarSyncEnabled={false}
        onClose={onClose}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByText("common.delete")).toBeTruthy();
  });

  it("shows sync actions when calendar is enabled and session is unsynced", () => {
    render(
      <SessionActionSheet
        visible
        session={makeSession()}
        calendarSyncEnabled
        onClose={onClose}
        onSyncToCalendar={jest.fn()}
      />,
    );
    expect(screen.getByText("sessions.syncToCalendar")).toBeTruthy();
  });

  it("hides sync actions when calendar is disabled", () => {
    render(
      <SessionActionSheet
        visible
        session={makeSession()}
        calendarSyncEnabled={false}
        onClose={onClose}
        onSyncToCalendar={jest.fn()}
      />,
    );
    expect(screen.queryByText("sessions.syncToCalendar")).toBeNull();
  });

  it("shows unsync action for synced session with calendar enabled", () => {
    render(
      <SessionActionSheet
        visible
        session={makeSession({ calendarEventId: "evt-1" })}
        calendarSyncEnabled
        onClose={onClose}
        onUnsyncFromCalendar={jest.fn()}
      />,
    );
    expect(screen.getByText("sessions.unsyncFromCalendar")).toBeTruthy();
  });
});
