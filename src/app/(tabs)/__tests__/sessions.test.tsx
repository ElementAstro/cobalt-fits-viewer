import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import Screen from "../sessions";

const mockPush = jest.fn();
const mockSyncSessionsBatch = jest.fn(async () => ({
  total: 1,
  success: 1,
  skipped: 0,
  failed: 0,
}));
const mockRefreshSessionsBatch = jest.fn(async () => ({
  total: 1,
  updated: 1,
  cleared: 0,
  unchanged: 0,
  skipped: 0,
  errors: 0,
}));
const mockUnsyncSessionsBatch = jest.fn(async () => ({
  total: 1,
  success: 1,
  skipped: 0,
  failed: 0,
}));
const mockReconcileSessionsFromLinkedFiles = jest.fn(() => ({
  requested: 2,
  processed: 2,
  updated: 0,
  cleared: 0,
  unchanged: 2,
  logsAdded: 0,
  logsRemoved: 0,
  changed: false,
  sessionIds: ["s1", "s2"],
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../../hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({
    isLandscape: false,
    isLandscapeTablet: false,
    contentPaddingTop: 0,
    sidePanelWidth: 320,
  }),
}));

jest.mock("../../../hooks/useSessions", () => ({
  useSessions: () => ({
    sessions: [
      {
        id: "s1",
        date: "2026-01-01",
        startTime: 1,
        endTime: 2,
        duration: 1,
        targetRefs: [],
        imageIds: [],
        equipment: {},
        createdAt: 1,
      },
      {
        id: "s2",
        date: "2026-01-02",
        startTime: 3,
        endTime: 4,
        duration: 1,
        targetRefs: [],
        imageIds: [],
        equipment: {},
        createdAt: 2,
      },
    ],
    autoDetectSessions: jest.fn(() => ({
      totalDetected: 0,
      newCount: 0,
      updatedCount: 0,
      mergedCount: 0,
      skippedCount: 0,
    })),
    reconcileSessionsFromLinkedFiles: mockReconcileSessionsFromLinkedFiles,
    getObservationDates: jest.fn(() => []),
    getSessionStats: jest.fn(() => ({})),
    getMonthlyData: jest.fn(() => []),
  }),
}));

jest.mock("../../../hooks/useCalendar", () => ({
  useCalendar: () => ({
    calendarSyncEnabled: true,
    syncSession: jest.fn(),
    unsyncSession: jest.fn(),
    syncSessionsBatch: mockSyncSessionsBatch,
    syncAllSessions: jest.fn(),
    unsyncSessionsBatch: mockUnsyncSessionsBatch,
    refreshSessionsBatch: mockRefreshSessionsBatch,
    syncAllObservationPlans: jest.fn(),
    refreshSessionFromCalendar: jest.fn(),
    refreshPlanFromCalendar: jest.fn(),
    refreshAllFromCalendar: jest.fn(),
    cleanupMissingCalendarLinks: jest.fn(),
    openSessionInCalendar: jest.fn(),
    openPlanInCalendar: jest.fn(),
    editSessionInCalendar: jest.fn(),
    editPlanInCalendar: jest.fn(),
    createSessionViaSystemCalendar: jest.fn(),
    createPlanViaSystemCalendar: jest.fn(),
    deleteObservationPlan: jest.fn(),
    updateObservationPlan: jest.fn(),
    syncObservationPlan: jest.fn(),
    unsyncObservationPlan: jest.fn(),
    plans: [],
    syncing: false,
  }),
}));

jest.mock("../../../stores/useFitsStore", () => ({
  useFitsStore: (selector: (state: { files: unknown[] }) => unknown) =>
    selector({
      files: [],
    }),
}));

jest.mock("../../../stores/useSessionStore", () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      getPlannedDates: () => [],
      addSession: jest.fn(),
      removeSession: jest.fn(),
      removeMultipleSessions: jest.fn(),
    }),
}));

jest.mock("../../../stores/useTargetStore", () => ({
  useTargetStore: (selector: (state: { targets: unknown[] }) => unknown) =>
    selector({
      targets: [],
    }),
}));

jest.mock("../../../components/common/EmptyState", () => ({
  EmptyState: () => null,
}));

jest.mock("../../../components/sessions/ActiveSessionBanner", () => ({
  ActiveSessionBanner: () => null,
}));

jest.mock("../../../components/sessions/CreateSessionSheet", () => ({
  CreateSessionSheet: () => null,
}));

jest.mock("../../../components/sessions/MonthlyActivityChart", () => ({
  MonthlyActivityChart: () => null,
}));

jest.mock("../../../components/sessions/ObservationCalendar", () => ({
  ObservationCalendar: () => null,
}));

jest.mock("../../../components/sessions/PlanCard", () => ({
  PlanCard: () => null,
}));

jest.mock("../../../components/sessions/PlanObservationSheet", () => ({
  PlanObservationSheet: () => null,
}));

jest.mock("../../../components/sessions/SessionCard", () => ({
  SessionCard: ({ session, onPress }: { session: { id: string }; onPress: () => void }) => {
    const ReactLocal = require("react");
    const { Pressable, Text } = require("react-native");
    return ReactLocal.createElement(
      Pressable,
      {
        testID: `session-card-${session.id}`,
        onPress,
      },
      ReactLocal.createElement(Text, null, session.id),
    );
  },
}));

jest.mock("../../../components/sessions/SessionStatsCard", () => ({
  SessionStatsCard: () => {
    const ReactLocal = require("react");
    const { View } = require("react-native");
    return ReactLocal.createElement(View);
  },
}));

jest.mock("../../../components/sessions/SessionActionSheet", () => ({
  SessionActionSheet: () => null,
}));

jest.mock("../../../components/sessions/PlanActionSheet", () => ({
  PlanActionSheet: () => null,
}));

jest.mock("../../../components/sessions/SessionSelectionBar", () => ({
  SessionSelectionBar: ({
    onClose,
    onToggleSelectAll,
    onBatchSync,
    onBatchRefresh,
    onBatchUnsync,
    onBatchDelete,
  }: {
    onClose: () => void;
    onToggleSelectAll: () => void;
    onBatchSync: () => void;
    onBatchRefresh: () => void;
    onBatchUnsync: () => void;
    onBatchDelete: () => void;
  }) => {
    const ReactLocal = require("react");
    const { Pressable } = require("react-native");
    return ReactLocal.createElement(
      ReactLocal.Fragment,
      null,
      ReactLocal.createElement(Pressable, {
        testID: "e2e-action-tabs__sessions-selection-close",
        onPress: onClose,
      }),
      ReactLocal.createElement(Pressable, {
        testID: "e2e-action-tabs__sessions-selection-select-all",
        onPress: onToggleSelectAll,
      }),
      ReactLocal.createElement(Pressable, {
        testID: "e2e-action-tabs__sessions-selection-batch-sync",
        onPress: onBatchSync,
      }),
      ReactLocal.createElement(Pressable, {
        testID: "e2e-action-tabs__sessions-selection-batch-refresh",
        onPress: onBatchRefresh,
      }),
      ReactLocal.createElement(Pressable, {
        testID: "e2e-action-tabs__sessions-selection-batch-unsync",
        onPress: onBatchUnsync,
      }),
      ReactLocal.createElement(Pressable, {
        testID: "e2e-action-tabs__sessions-selection-delete",
        onPress: onBatchDelete,
      }),
    );
  },
}));

jest.mock("../../../components/sessions/SessionDateSummary", () => ({
  SessionDateSummary: () => null,
}));

const mockSummaryDialogProps = jest.fn();
jest.mock("../../../components/common/OperationSummaryDialog", () => ({
  OperationSummaryDialog: (props: Record<string, unknown>) => {
    mockSummaryDialogProps(props);
    if (!props.visible) return null;
    const ReactLocal = require("react");
    const { View, Text } = require("react-native");
    return ReactLocal.createElement(
      View,
      { testID: "operation-summary-dialog" },
      ReactLocal.createElement(Text, { testID: "summary-dialog-title" }, props.title),
    );
  },
}));

describe("(tabs)/sessions.tsx", () => {
  let consoleErrorSpy: jest.SpyInstance;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it("renders selection-mode batch calendar actions and triggers handlers with selected sessions", async () => {
    render(<Screen />);

    fireEvent.press(screen.getByTestId("e2e-action-tabs__sessions-open-selection"));
    fireEvent.press(screen.getByTestId("session-card-s1"));

    fireEvent.press(screen.getByTestId("e2e-action-tabs__sessions-selection-batch-sync"));
    fireEvent.press(screen.getByTestId("e2e-action-tabs__sessions-selection-batch-refresh"));
    fireEvent.press(screen.getByTestId("e2e-action-tabs__sessions-selection-batch-unsync"));

    await waitFor(() => {
      expect(mockSyncSessionsBatch).toHaveBeenCalledWith([expect.objectContaining({ id: "s1" })]);
      expect(mockRefreshSessionsBatch).toHaveBeenCalledWith([
        expect.objectContaining({ id: "s1" }),
      ]);
      expect(mockUnsyncSessionsBatch).toHaveBeenCalledWith([expect.objectContaining({ id: "s1" })]);
    });
  });

  it("runs manual reconcile action and shows summary dialog", () => {
    render(<Screen />);

    fireEvent.press(screen.getByTestId("e2e-action-tabs__sessions-reconcile"));

    expect(mockReconcileSessionsFromLinkedFiles).toHaveBeenCalledWith();
    expect(screen.getByTestId("operation-summary-dialog")).toBeTruthy();
    expect(screen.getByTestId("summary-dialog-title").props.children).toBe(
      "sessions.reconcileSummaryTitle",
    );
    const lastCall = mockSummaryDialogProps.mock.calls.at(-1)?.[0];
    expect(lastCall?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "sessions.reconcileSummaryProcessed", value: 2 }),
      ]),
    );
    expect(lastCall?.footnote).toBe("sessions.reconcileNoChanges");
  });
});
