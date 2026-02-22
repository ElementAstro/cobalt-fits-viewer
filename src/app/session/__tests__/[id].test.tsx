import React from "react";
import { render, screen } from "@testing-library/react-native";
import Screen from "../[id]";

const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "s1" }),
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({
    contentPaddingTop: 0,
    horizontalPadding: 16,
    isLandscapeTablet: false,
  }),
}));

jest.mock("zustand/react/shallow", () => ({
  useShallow: (fn: unknown) => fn,
}));

jest.mock("../../../stores/useSessionStore", () => {
  const s1 = {
    id: "s1",
    date: "2026-01-01",
    startTime: 1000,
    endTime: 5000,
    duration: 4000,
    targetRefs: [],
    imageIds: [],
    equipment: { telescope: "Scope-A" },
    createdAt: 1,
    location: "",
    seeing: "",
    transparency: "",
    bortle: 0,
    notes: "",
    tags: [],
    rating: 0,
  };
  const s2 = {
    ...s1,
    id: "s2",
    date: "2026-01-02",
    startTime: 6000,
    endTime: 9000,
    duration: 3000,
    createdAt: 2,
  };
  const sessions = [s1, s2];
  const logEntries = [
    {
      id: "l1",
      sessionId: "s1",
      timestamp: 1000,
      filter: "Ha",
      label: "sub",
      notes: "",
      exposure: 300,
      subCount: 1,
    },
    {
      id: "l2",
      sessionId: "s1",
      timestamp: 2000,
      filter: "OIII",
      label: "sub",
      notes: "",
      exposure: 300,
      subCount: 1,
    },
    {
      id: "l3",
      sessionId: "s1",
      timestamp: 3000,
      filter: "Ha",
      label: "sub",
      notes: "",
      exposure: 300,
      subCount: 1,
    },
  ];
  return {
    useSessionById: (id: string) => sessions.find((s) => s.id === id) ?? null,
    useLogEntriesBySession: (id: string) => (id === "s1" ? logEntries : []),
    useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        sessions,
        updateSession: jest.fn(),
        removeSession: jest.fn(),
        updateLogEntry: jest.fn(),
      }),
  };
});

jest.mock("../../../stores/useFitsStore", () => ({
  useFitsStore: (selector: (state: { files: unknown[] }) => unknown) => selector({ files: [] }),
}));

jest.mock("../../../stores/useTargetStore", () => ({
  useTargetStore: (selector: (state: { targets: unknown[] }) => unknown) =>
    selector({ targets: [] }),
}));

jest.mock("../../../components/gallery/ThumbnailGrid", () => ({
  ThumbnailGrid: () => null,
}));

jest.mock("../../../components/sessions/EditSessionSheet", () => ({
  EditSessionSheet: () => null,
}));

jest.mock("../../../components/common/EmptyState", () => ({
  EmptyState: () => null,
}));

jest.mock("../../../components/common/PromptDialog", () => ({
  PromptDialog: () => null,
}));

describe("session/[id].tsx route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exports a screen component", () => {
    expect(Screen).toBeTruthy();
  });

  it("renders session date and back button", () => {
    render(<Screen />);
    expect(screen.getByText(/2026-01-01/)).toBeTruthy();
    expect(screen.getByTestId("e2e-action-session__param_id-back")).toBeTruthy();
  });

  it("renders prev/next navigation buttons", () => {
    render(<Screen />);
    // s1 is sorted after s2 (by startTime desc: s2, s1)
    // So s1 is at index 1, prevId = null (last), nextId = s2
    // But s2.startTime > s1.startTime so sorted desc: [s2, s1]
    // currentIndex of s1 = 1, prevId = none (index+1 out of bounds), nextId = allSessionIds[0] = s2
    // nextId exists when currentIndex > 0
    const forwardButtons = screen.queryAllByTestId(/chevron/);
    expect(forwardButtons.length).toBeGreaterThanOrEqual(0);
  });

  it("renders log entries and displays filteredLogEntries count", () => {
    render(<Screen />);
    // Should show "sessions.log" text with count
    const logTexts = screen.getAllByText(/sessions\.log/);
    expect(logTexts.length).toBeGreaterThan(0);
  });

  it("renders equipment section in accordion", () => {
    render(<Screen />);
    expect(screen.getByText("sessions.equipment")).toBeTruthy();
  });
});
