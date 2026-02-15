import type { FitsMetadata, ObservationLogEntry, ObservationSession } from "../../fits/types";
import {
  createLogEntry,
  generateLogFromFiles,
  exportToCSV,
  exportToText,
  searchLogEntries,
  escapeCSV,
  exportSessionToJSON,
  exportAllSessionsToJSON,
} from "../observationLog";

const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata =>
  ({
    id: "file1",
    filename: "light_001.fits",
    uri: "/path/light_001.fits",
    importDate: 1700000000000,
    dateObs: "2024-01-15T22:30:00Z",
    object: "M42",
    filter: "Ha",
    exptime: 300,
    gain: 100,
    telescope: "RC8",
    instrument: "ASI294MM",
    detector: undefined,
    ccdTemp: -10,
    ...overrides,
  }) as FitsMetadata;

const makeEntry = (overrides: Partial<ObservationLogEntry> = {}): ObservationLogEntry => ({
  id: "log_file1",
  sessionId: "s1",
  imageId: "file1",
  dateTime: "2024-01-15T22:30:00Z",
  object: "M42",
  filter: "Ha",
  exptime: 300,
  gain: 100,
  telescope: "RC8",
  camera: "ASI294MM",
  ccdTemp: -10,
  ...overrides,
});

// ===== escapeCSV =====

describe("escapeCSV", () => {
  it("returns empty string for null/undefined", () => {
    expect(escapeCSV(null)).toBe("");
    expect(escapeCSV(undefined)).toBe("");
  });

  it("returns plain string when no special chars", () => {
    expect(escapeCSV("hello")).toBe("hello");
    expect(escapeCSV(42)).toBe("42");
  });

  it("wraps and escapes strings with commas", () => {
    expect(escapeCSV("hello, world")).toBe('"hello, world"');
  });

  it("wraps and escapes strings with quotes", () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps strings with newlines", () => {
    expect(escapeCSV("line1\nline2")).toBe('"line1\nline2"');
  });
});

// ===== createLogEntry =====

describe("createLogEntry", () => {
  it("creates entry from file metadata", () => {
    const entry = createLogEntry(makeFile(), "session1");
    expect(entry.id).toBe("log_file1");
    expect(entry.sessionId).toBe("session1");
    expect(entry.imageId).toBe("file1");
    expect(entry.object).toBe("M42");
    expect(entry.filter).toBe("Ha");
    expect(entry.exptime).toBe(300);
    expect(entry.gain).toBe(100);
    expect(entry.telescope).toBe("RC8");
    expect(entry.camera).toBe("ASI294MM");
    expect(entry.ccdTemp).toBe(-10);
  });

  it("defaults object/filter to Unknown when missing", () => {
    const entry = createLogEntry(makeFile({ object: undefined, filter: undefined }), "s1");
    expect(entry.object).toBe("Unknown");
    expect(entry.filter).toBe("Unknown");
  });

  it("uses importDate ISO string when dateObs is missing", () => {
    const entry = createLogEntry(makeFile({ dateObs: undefined }), "s1");
    expect(entry.dateTime).toContain("2023");
  });

  it("falls back to detector when instrument is missing", () => {
    const entry = createLogEntry(makeFile({ instrument: undefined, detector: "QHY268M" }), "s1");
    expect(entry.camera).toBe("QHY268M");
  });
});

// ===== generateLogFromFiles =====

describe("generateLogFromFiles", () => {
  it("filters files without dateObs", () => {
    const files = [makeFile(), makeFile({ id: "f2", dateObs: undefined })];
    const entries = generateLogFromFiles(files, "s1");
    expect(entries).toHaveLength(1);
  });

  it("sorts by dateObs", () => {
    const files = [
      makeFile({ id: "f2", dateObs: "2024-01-15T23:00:00Z" }),
      makeFile({ id: "f1", dateObs: "2024-01-15T22:00:00Z" }),
    ];
    const entries = generateLogFromFiles(files, "s1");
    expect(entries[0].imageId).toBe("f1");
    expect(entries[1].imageId).toBe("f2");
  });

  it("returns empty for empty input", () => {
    expect(generateLogFromFiles([], "s1")).toEqual([]);
  });
});

// ===== exportToCSV =====

describe("exportToCSV", () => {
  it("generates header row", () => {
    const csv = exportToCSV([]);
    expect(csv).toContain("DateTime,Object,Filter");
  });

  it("generates data rows", () => {
    const csv = exportToCSV([makeEntry()]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("M42");
    expect(lines[1]).toContain("Ha");
    expect(lines[1]).toContain("300");
  });

  it("escapes fields with special chars", () => {
    const csv = exportToCSV([makeEntry({ notes: 'Good "seeing", clear' })]);
    expect(csv).toContain('"Good ""seeing"", clear"');
  });

  it("handles entries with missing optional fields", () => {
    const csv = exportToCSV([
      makeEntry({
        gain: undefined,
        telescope: undefined,
        camera: undefined,
        ccdTemp: undefined,
        notes: undefined,
      }),
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
  });
});

// ===== exportToText =====

describe("exportToText", () => {
  it("includes header and count", () => {
    const text = exportToText([makeEntry()]);
    expect(text).toContain("=== Observation Log ===");
    expect(text).toContain("Total entries: 1");
  });

  it("includes entry details", () => {
    const text = exportToText([makeEntry()]);
    expect(text).toContain("M42");
    expect(text).toContain("Ha");
    expect(text).toContain("300s");
    expect(text).toContain("G100");
    expect(text).toContain("-10°C");
  });

  it("includes notes when present", () => {
    const text = exportToText([makeEntry({ notes: "Great night" })]);
    expect(text).toContain("Note: Great night");
  });

  it("omits gain/temp when missing", () => {
    const text = exportToText([makeEntry({ gain: undefined, ccdTemp: undefined })]);
    expect(text).not.toContain("G");
    expect(text).not.toContain("°C");
  });
});

// ===== searchLogEntries =====

describe("searchLogEntries", () => {
  const entries = [
    makeEntry({ object: "M42", filter: "Ha" }),
    makeEntry({ id: "log2", object: "NGC7000", filter: "OIII", telescope: "EdgeHD" }),
    makeEntry({ id: "log3", object: "M31", filter: "L", notes: "windy night" }),
  ];

  it("returns all for empty query", () => {
    expect(searchLogEntries(entries, "")).toHaveLength(3);
    expect(searchLogEntries(entries, "  ")).toHaveLength(3);
  });

  it("searches by object name", () => {
    expect(searchLogEntries(entries, "M42")).toHaveLength(1);
    expect(searchLogEntries(entries, "ngc")).toHaveLength(1);
  });

  it("searches by filter", () => {
    expect(searchLogEntries(entries, "OIII")).toHaveLength(1);
  });

  it("searches by telescope", () => {
    expect(searchLogEntries(entries, "edge")).toHaveLength(1);
  });

  it("searches by notes", () => {
    expect(searchLogEntries(entries, "windy")).toHaveLength(1);
  });

  it("is case-insensitive", () => {
    expect(searchLogEntries(entries, "m42")).toHaveLength(1);
  });

  it("searches by camera", () => {
    const withCamera = [
      makeEntry({ id: "log4", camera: "ASI2600MM" }),
      makeEntry({ id: "log5", camera: "QHY268M" }),
    ];
    expect(searchLogEntries(withCamera, "ASI")).toHaveLength(1);
    expect(searchLogEntries(withCamera, "qhy")).toHaveLength(1);
  });

  it("searches by dateTime substring", () => {
    const withDates = [
      makeEntry({ id: "log4", dateTime: "2024-03-15T22:00:00Z" }),
      makeEntry({ id: "log5", dateTime: "2024-04-20T21:00:00Z" }),
    ];
    expect(searchLogEntries(withDates, "2024-03")).toHaveLength(1);
  });

  it("returns multiple matches", () => {
    expect(searchLogEntries(entries, "M")).toHaveLength(3); // M42, M31 contain "M", NGC7000 does not
  });
});

// ===== exportSessionToJSON =====

const makeSession = (overrides: Partial<ObservationSession> = {}): ObservationSession => ({
  id: "s1",
  date: "2024-01-15",
  startTime: 1705352400000,
  endTime: 1705356000000,
  duration: 3600,
  targets: ["M42"],
  imageIds: ["f1", "f2"],
  equipment: { telescope: "RC8", camera: "ASI294MM", mount: "EQ6-R" },
  createdAt: Date.now(),
  rating: 4,
  bortle: 5,
  tags: ["deep sky"],
  ...overrides,
});

describe("exportSessionToJSON", () => {
  it("produces valid JSON with session and logEntries", () => {
    const session = makeSession();
    const entries = [makeEntry()];
    const json = exportSessionToJSON(session, entries);
    const parsed = JSON.parse(json);
    expect(parsed.session.id).toBe("s1");
    expect(parsed.session.targets).toEqual(["M42"]);
    expect(parsed.session.rating).toBe(4);
    expect(parsed.session.bortle).toBe(5);
    expect(parsed.session.tags).toEqual(["deep sky"]);
    expect(parsed.logEntries).toHaveLength(1);
    expect(parsed.exportedAt).toBeDefined();
  });

  it("includes equipment details", () => {
    const json = exportSessionToJSON(makeSession(), []);
    const parsed = JSON.parse(json);
    expect(parsed.session.equipment.telescope).toBe("RC8");
    expect(parsed.session.equipment.mount).toBe("EQ6-R");
  });

  it("handles empty log entries", () => {
    const json = exportSessionToJSON(makeSession(), []);
    const parsed = JSON.parse(json);
    expect(parsed.logEntries).toEqual([]);
  });
});

// ===== exportAllSessionsToJSON =====

describe("exportAllSessionsToJSON", () => {
  it("exports multiple sessions", () => {
    const sessions = [
      makeSession({ id: "s1", duration: 3600 }),
      makeSession({ id: "s2", duration: 7200 }),
    ];
    const json = exportAllSessionsToJSON(sessions);
    const parsed = JSON.parse(json);
    expect(parsed.sessions).toHaveLength(2);
    expect(parsed.totalSessions).toBe(2);
    expect(parsed.totalDuration).toBe(10800);
    expect(parsed.exportedAt).toBeDefined();
  });

  it("exports empty array", () => {
    const json = exportAllSessionsToJSON([]);
    const parsed = JSON.parse(json);
    expect(parsed.sessions).toEqual([]);
    expect(parsed.totalSessions).toBe(0);
    expect(parsed.totalDuration).toBe(0);
  });

  it("includes new fields in export", () => {
    const sessions = [makeSession({ rating: 3, bortle: 6, tags: ["planetary"] })];
    const json = exportAllSessionsToJSON(sessions);
    const parsed = JSON.parse(json);
    expect(parsed.sessions[0].rating).toBe(3);
    expect(parsed.sessions[0].bortle).toBe(6);
    expect(parsed.sessions[0].tags).toEqual(["planetary"]);
  });
});
