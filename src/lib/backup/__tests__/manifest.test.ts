/**
 * Manifest 工具函数测试
 */

import { createManifest, parseManifest, serializeManifest, getManifestSummary } from "../manifest";
import type { BackupManifest, BackupOptions } from "../types";
import { DEFAULT_BACKUP_OPTIONS, MANIFEST_VERSION } from "../types";

// Mock react-native, expo-application, expo-device
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-application", () => ({ nativeApplicationVersion: "1.0.0" }));
jest.mock("expo-device", () => ({ deviceName: "Test Device", modelName: "TestModel" }));

const mockData = {
  files: [
    { id: "f1", filename: "test.fits", filepath: "/path/test.fits", fileSize: 1024 },
  ] as never[],
  albums: [{ id: "a1", name: "Album 1" }] as never[],
  targets: [{ id: "t1", name: "M31" }] as never[],
  targetGroups: [{ id: "g1", name: "Group 1", targetIds: ["t1"] }] as never[],
  sessions: [{ id: "s1", date: "2025-01-01" }] as never[],
  plans: [{ id: "p1", title: "Plan 1", targetName: "M31" }] as never[],
  logEntries: [{ id: "l1", sessionId: "s1", imageId: "f1" }] as never[],
  settings: { language: "en", theme: "dark" },
};

describe("createManifest", () => {
  it("should create a manifest with all data when all options enabled", () => {
    const manifest = createManifest(mockData, DEFAULT_BACKUP_OPTIONS);

    expect(manifest.version).toBe(MANIFEST_VERSION);
    expect(manifest.appVersion).toBe("1.0.0");
    expect(manifest.deviceName).toBe("Test Device");
    expect(manifest.platform).toBe("ios");
    expect(manifest.files).toHaveLength(1);
    expect(manifest.albums).toHaveLength(1);
    expect(manifest.targets).toHaveLength(1);
    expect(manifest.targetGroups).toHaveLength(1);
    expect(manifest.sessions).toHaveLength(1);
    expect(manifest.plans).toHaveLength(1);
    expect(manifest.logEntries).toHaveLength(1);
    expect(manifest.settings).toEqual({ language: "en", theme: "dark" });
  });

  it("should exclude data based on options", () => {
    const options: BackupOptions = {
      ...DEFAULT_BACKUP_OPTIONS,
      includeFiles: false,
      includeAlbums: false,
      includeSettings: false,
    };
    const manifest = createManifest(mockData, options);

    expect(manifest.files).toHaveLength(0);
    expect(manifest.albums).toHaveLength(0);
    expect(manifest.targets).toHaveLength(1);
    expect(manifest.targetGroups).toHaveLength(1);
    expect(manifest.sessions).toHaveLength(1);
    expect(manifest.plans).toHaveLength(1);
    expect(manifest.logEntries).toHaveLength(1);
    expect(manifest.settings).toEqual({});
  });
});

describe("parseManifest", () => {
  it("should parse a valid manifest", () => {
    const manifest: BackupManifest = {
      version: MANIFEST_VERSION,
      appVersion: "1.0.0",
      createdAt: "2025-01-01T00:00:00.000Z",
      deviceName: "Device",
      platform: "ios",
      files: [],
      albums: [],
      targets: [],
      targetGroups: [],
      sessions: [],
      plans: [],
      logEntries: [],
      settings: {},
    };
    const result = parseManifest(JSON.stringify(manifest));
    expect(result).not.toBeNull();
    expect(result!.version).toBe(MANIFEST_VERSION);
    expect(result!.createdAt).toBe("2025-01-01T00:00:00.000Z");
  });

  it("should return null for invalid JSON", () => {
    expect(parseManifest("not json")).toBeNull();
  });

  it("should return null for missing version", () => {
    expect(parseManifest(JSON.stringify({ createdAt: "2025-01-01" }))).toBeNull();
  });

  it("should return null for missing createdAt", () => {
    expect(parseManifest(JSON.stringify({ version: 1 }))).toBeNull();
  });

  it("should return null for future manifest version", () => {
    expect(
      parseManifest(JSON.stringify({ version: MANIFEST_VERSION + 1, createdAt: "2025-01-01" })),
    ).toBeNull();
  });

  it("should fill defaults for missing optional fields", () => {
    const minimal = { version: MANIFEST_VERSION, createdAt: "2025-01-01" };
    const result = parseManifest(JSON.stringify(minimal));
    expect(result).not.toBeNull();
    expect(result!.files).toEqual([]);
    expect(result!.albums).toEqual([]);
    expect(result!.targets).toEqual([]);
    expect(result!.targetGroups).toEqual([]);
    expect(result!.sessions).toEqual([]);
    expect(result!.plans).toEqual([]);
    expect(result!.logEntries).toEqual([]);
    expect(result!.settings).toEqual({});
    expect(result!.deviceName).toBe("Unknown Device");
    expect(result!.appVersion).toBe("unknown");
  });

  it("should normalize v2 file metadata without mediaKind to v3 shape", () => {
    const legacyV2 = {
      version: 2,
      createdAt: "2025-01-01T00:00:00.000Z",
      files: [
        { id: "img", filename: "a.fits", filepath: "/a.fits", fileSize: 10, sourceType: "fits" },
        { id: "vid", filename: "b.mp4", filepath: "/b.mp4", fileSize: 20, sourceType: "video" },
      ],
    };

    const parsed = parseManifest(JSON.stringify(legacyV2));
    expect(parsed).not.toBeNull();
    expect(parsed?.files[0].mediaKind).toBe("image");
    expect(parsed?.files[1].mediaKind).toBe("video");
  });
});

describe("serializeManifest", () => {
  it("should produce valid JSON", () => {
    const manifest = createManifest(mockData, DEFAULT_BACKUP_OPTIONS);
    const json = serializeManifest(manifest);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(MANIFEST_VERSION);
  });

  it("should be parseable by parseManifest", () => {
    const manifest = createManifest(mockData, DEFAULT_BACKUP_OPTIONS);
    const json = serializeManifest(manifest);
    const result = parseManifest(json);
    expect(result).not.toBeNull();
    expect(result!.files).toHaveLength(1);
  });
});

describe("getManifestSummary", () => {
  it("should return correct summary", () => {
    const manifest = createManifest(mockData, DEFAULT_BACKUP_OPTIONS);
    const summary = getManifestSummary(manifest);

    expect(summary.fileCount).toBe(1);
    expect(summary.albumCount).toBe(1);
    expect(summary.targetCount).toBe(1);
    expect(summary.targetGroupCount).toBe(1);
    expect(summary.sessionCount).toBe(1);
    expect(summary.planCount).toBe(1);
    expect(summary.logEntryCount).toBe(1);
    expect(summary.hasSettings).toBe(true);
    expect(summary.appVersion).toBe("1.0.0");
    expect(summary.deviceName).toBe("Test Device");
  });

  it("should report hasSettings=false for empty settings", () => {
    const manifest = createManifest({ ...mockData, settings: {} }, DEFAULT_BACKUP_OPTIONS);
    const summary = getManifestSummary(manifest);
    expect(summary.hasSettings).toBe(false);
  });
});
