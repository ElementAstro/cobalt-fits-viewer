import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ActiveSessionBanner } from "../ActiveSessionBanner";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const mockStartLiveSession = jest.fn();
const mockPauseLiveSession = jest.fn();
const mockResumeLiveSession = jest.fn();
const mockAddActiveNote = jest.fn();

let mockActiveSession: ReturnType<typeof makeActiveSession> | null = null;

jest.mock("../../../stores/useSessionStore", () => ({
  useSessionStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      activeSession: mockActiveSession,
      startLiveSession: mockStartLiveSession,
      pauseLiveSession: mockPauseLiveSession,
      resumeLiveSession: mockResumeLiveSession,
      addActiveNote: mockAddActiveNote,
    }),
}));

jest.mock("../../../stores/useFitsStore", () => ({
  useFitsStore: (selector: (s: Record<string, unknown>) => unknown) => selector({ files: [] }),
}));

jest.mock("../../../hooks/useSessions", () => ({
  useSessions: () => ({
    endLiveSessionWithIntegration: jest.fn(() => ({
      session: null,
      linkedFileCount: 0,
      linkedLogCount: 0,
    })),
  }),
}));

jest.mock("../LiveSessionMetaSheet", () => ({
  LiveSessionMetaSheet: () => null,
}));

function makeActiveSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "live-1",
    status: "running" as const,
    startedAt: Date.now() - 60_000,
    pausedAt: null,
    totalPausedMs: 0,
    notes: [],
    draftTargets: [],
    draftEquipment: {},
    ...overrides,
  };
}

describe("ActiveSessionBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveSession = null;
  });

  it("renders start session button when no active session", () => {
    render(<ActiveSessionBanner />);
    expect(screen.getByText("sessions.startSession")).toBeTruthy();
  });

  it("calls startLiveSession when start button is pressed", () => {
    render(<ActiveSessionBanner />);
    fireEvent.press(screen.getByText("sessions.startSession"));
    expect(mockStartLiveSession).toHaveBeenCalledTimes(1);
  });

  it("renders observing state when session is running", () => {
    mockActiveSession = makeActiveSession();
    render(<ActiveSessionBanner />);
    expect(screen.getByText("sessions.observing")).toBeTruthy();
  });

  it("renders paused state when session is paused", () => {
    mockActiveSession = makeActiveSession({ status: "paused", pausedAt: Date.now() });
    render(<ActiveSessionBanner />);
    expect(screen.getByText("sessions.paused")).toBeTruthy();
  });

  it("shows pause button when running", () => {
    mockActiveSession = makeActiveSession();
    render(<ActiveSessionBanner />);
    expect(screen.getByText("sessions.pause")).toBeTruthy();
  });

  it("shows resume button when paused", () => {
    mockActiveSession = makeActiveSession({ status: "paused", pausedAt: Date.now() });
    render(<ActiveSessionBanner />);
    expect(screen.getByText("sessions.resume")).toBeTruthy();
  });

  it("calls pauseLiveSession when pause button is pressed", () => {
    mockActiveSession = makeActiveSession();
    render(<ActiveSessionBanner />);
    fireEvent.press(screen.getByText("sessions.pause"));
    expect(mockPauseLiveSession).toHaveBeenCalledTimes(1);
  });

  it("calls resumeLiveSession when resume button is pressed", () => {
    mockActiveSession = makeActiveSession({ status: "paused", pausedAt: Date.now() });
    render(<ActiveSessionBanner />);
    fireEvent.press(screen.getByText("sessions.resume"));
    expect(mockResumeLiveSession).toHaveBeenCalledTimes(1);
  });

  it("renders notes when present", () => {
    mockActiveSession = makeActiveSession({
      notes: [
        { text: "Clouds clearing", timestamp: 1000 },
        { text: "Seeing improved", timestamp: 2000 },
      ],
    });
    render(<ActiveSessionBanner />);
    expect(screen.getByText(/Clouds clearing/)).toBeTruthy();
    expect(screen.getByText(/Seeing improved/)).toBeTruthy();
  });

  it("shows 'show all' button when notes exceed 3", () => {
    mockActiveSession = makeActiveSession({
      notes: [
        { text: "Note 1", timestamp: 1000 },
        { text: "Note 2", timestamp: 2000 },
        { text: "Note 3", timestamp: 3000 },
        { text: "Note 4", timestamp: 4000 },
      ],
    });
    render(<ActiveSessionBanner />);
    expect(screen.getByText(/common\.showAll/)).toBeTruthy();
  });
});
