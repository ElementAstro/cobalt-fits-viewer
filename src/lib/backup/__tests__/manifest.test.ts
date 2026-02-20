/**
 * Manifest 工具函数测试
 */

import { createManifest, parseManifest, serializeManifest, getManifestSummary } from "../manifest";
import type { BackupManifest, BackupOptions } from "../types";
import { DEFAULT_BACKUP_OPTIONS, MANIFEST_VERSION } from "../types";

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-application", () => ({ nativeApplicationVersion: "1.0.0" }));
jest.mock("expo-device", () => ({ deviceName: "Test Device", modelName: "TestModel" }));
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "snapshot-test-id"),
}));

const mockData = {
  files: [
    {
      id: "f1",
      filename: "test.fits",
      filepath: "/path/test.fits",
      fileSize: 1024,
      sourceType: "fits",
      mediaKind: "image",
    },
  ] as never[],
  albums: [{ id: "a1", name: "Album 1", imageIds: ["f1"] }] as never[],
  targets: [{ id: "t1", name: "M31" }] as never[],
  targetGroups: [{ id: "g1", name: "Group 1", targetIds: ["t1"] }] as never[],
  sessions: [{ id: "s1", date: "2025-01-01" }] as never[],
  plans: [{ id: "p1", title: "Plan 1", targetName: "M31" }] as never[],
  logEntries: [{ id: "l1", sessionId: "s1", imageId: "f1" }] as never[],
  settings: { language: "en", theme: "dark" },
  fileGroups: {
    groups: [{ id: "fg1", name: "Favorites", color: "#ff0" }],
    fileGroupMap: { f1: ["fg1"] },
  } as never,
  astrometry: {
    config: {} as never,
    jobs: [{ id: "job1", fileId: "f1", status: "done" }],
  } as never,
  trash: [] as never[],
  sessionRuntime: { activeSession: null },
  backupPrefs: {
    activeProvider: "webdav",
    autoBackupEnabled: true,
    autoBackupIntervalHours: 24,
    autoBackupNetwork: "wifi",
  },
} as Parameters<typeof createManifest>[0];

describe("createManifest", () => {
  it("creates a v4 manifest with all domains", () => {
    const manifest = createManifest(mockData, DEFAULT_BACKUP_OPTIONS);

    expect(manifest.version).toBe(MANIFEST_VERSION);
    expect(manifest.snapshotId).toBe("snapshot-test-id");
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
    expect(manifest.fileGroups.groups).toHaveLength(1);
    expect(manifest.astrometry.jobs).toHaveLength(1);
    expect(manifest.backupPrefs.activeProvider).toBe("webdav");
    expect(manifest.domains).toContain("backupPrefs");
  });

  it("excludes selected domains by options", () => {
    const options: BackupOptions = {
      ...DEFAULT_BACKUP_OPTIONS,
      includeFiles: false,
      includeAlbums: false,
      includeSettings: false,
      includeThumbnails: true,
    };
    const manifest = createManifest(mockData, options);

    expect(manifest.files).toHaveLength(0);
    expect(manifest.albums).toHaveLength(0);
    expect(manifest.settings).toEqual({});
    expect(manifest.domains).toContain("thumbnails");
    expect(manifest.capabilities.supportsThumbnails).toBe(true);
  });
});

describe("parseManifest compatibility", () => {
  it("parses a valid v4 manifest", () => {
    const v4 = createManifest(mockData, DEFAULT_BACKUP_OPTIONS);
    const result = parseManifest(JSON.stringify(v4));
    expect(result).not.toBeNull();
    expect(result?.version).toBe(4);
    expect(result?.snapshotId).toBe(v4.snapshotId);
  });

  it("parses v1-v3 manifests with defaults for new domains", () => {
    const legacy = [
      { version: 1, createdAt: "2025-01-01T00:00:00.000Z", files: [] },
      { version: 2, createdAt: "2025-01-01T00:00:00.000Z", files: [] },
      { version: 3, createdAt: "2025-01-01T00:00:00.000Z", files: [] },
    ];

    for (const item of legacy) {
      const parsed = parseManifest(JSON.stringify(item));
      expect(parsed).not.toBeNull();
      expect(parsed?.fileGroups.groups).toEqual([]);
      expect(parsed?.fileGroups.fileGroupMap).toEqual({});
      expect(parsed?.astrometry.jobs).toEqual([]);
      expect(parsed?.trash).toEqual([]);
      expect(parsed?.sessionRuntime.activeSession).toBeNull();
    }
  });

  it("rejects invalid v4 cross references", () => {
    const invalidV4: BackupManifest = {
      ...createManifest(mockData, DEFAULT_BACKUP_OPTIONS),
      version: 4,
      albums: [{ id: "a1", name: "Album 1", imageIds: ["missing-file"] }] as never[],
    };

    const parsed = parseManifest(JSON.stringify(invalidV4));
    expect(parsed).toBeNull();
  });

  it("normalizes legacy files without mediaKind", () => {
    const legacyV2 = {
      version: 2,
      createdAt: "2025-01-01T00:00:00.000Z",
      files: [
        { id: "img", filename: "a.fits", filepath: "/a.fits", fileSize: 10, sourceType: "fits" },
        { id: "vid", filename: "b.mp4", filepath: "/b.mp4", fileSize: 20, sourceType: "video" },
        { id: "aud", filename: "c.m4a", filepath: "/c.m4a", fileSize: 15, sourceType: "audio" },
      ],
    };

    const parsed = parseManifest(JSON.stringify(legacyV2));
    expect(parsed?.files[0].mediaKind).toBe("image");
    expect(parsed?.files[1].mediaKind).toBe("video");
    expect(parsed?.files[2].mediaKind).toBe("audio");
  });

  it("rejects invalid json/fields/future version", () => {
    expect(parseManifest("not json")).toBeNull();
    expect(parseManifest(JSON.stringify({ createdAt: "2025-01-01" }))).toBeNull();
    expect(parseManifest(JSON.stringify({ version: 1 }))).toBeNull();
    expect(
      parseManifest(JSON.stringify({ version: MANIFEST_VERSION + 1, createdAt: "2025-01-01" })),
    ).toBeNull();
  });
});

describe("serializeManifest", () => {
  it("produces parseable json", () => {
    const manifest = createManifest(mockData, DEFAULT_BACKUP_OPTIONS);
    const json = serializeManifest(manifest);
    const parsed = parseManifest(json);
    expect(parsed).not.toBeNull();
    expect(parsed?.files).toHaveLength(1);
  });
});

describe("getManifestSummary", () => {
  it("returns expected summary", () => {
    const manifest = createManifest(mockData, DEFAULT_BACKUP_OPTIONS);
    const summary = getManifestSummary(manifest);

    expect(summary.fileCount).toBe(1);
    expect(summary.albumCount).toBe(1);
    expect(summary.targetCount).toBe(1);
    expect(summary.targetGroupCount).toBe(1);
    expect(summary.sessionCount).toBe(1);
    expect(summary.planCount).toBe(1);
    expect(summary.logEntryCount).toBe(1);
    expect(summary.fileGroupCount).toBe(1);
    expect(summary.astrometryJobCount).toBe(1);
    expect(summary.hasSettings).toBe(true);
  });
});
