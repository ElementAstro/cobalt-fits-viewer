/**
 * BackupService 核心备份/恢复逻辑测试
 */

import { performBackup, performRestore, getBackupInfo } from "../backupService";
import type { BackupDataSource } from "../backupService";
import type { ICloudProvider } from "../cloudProvider";
import type { BackupManifest, BackupProgress } from "../types";
import { DEFAULT_BACKUP_OPTIONS, MANIFEST_VERSION } from "../types";

const mockFileStore = new Map<string, Uint8Array | string>();
const mockThumbnailIds = new Set<string>();

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "snapshot-test-id"),
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  digest: jest.fn(async () => new Uint8Array([1, 2, 3]).buffer),
}));

jest.mock("expo-file-system", () => {
  class MockFile {
    uri: string;

    constructor(pathOrDir: string, name?: string) {
      this.uri = name ? `${pathOrDir}/${name}` : pathOrDir;
    }

    get exists() {
      return mockFileStore.has(this.uri);
    }

    get size() {
      const value = mockFileStore.get(this.uri);
      if (typeof value === "string") return new TextEncoder().encode(value).length;
      if (value instanceof Uint8Array) return value.length;
      return null;
    }

    async bytes() {
      const value = mockFileStore.get(this.uri);
      if (value instanceof Uint8Array) return value;
      if (typeof value === "string") return new TextEncoder().encode(value);
      return new Uint8Array();
    }

    write(value: Uint8Array | string) {
      mockFileStore.set(this.uri, value);
    }
  }

  return {
    File: MockFile,
    Paths: { cache: "/cache" },
  };
});

jest.mock("../../utils/fileManager", () => ({
  getFitsDir: () => "/mock/fits",
}));

jest.mock("../../gallery/thumbnailCache", () => ({
  ensureThumbnailDir: jest.fn(),
  getThumbnailPath: (fileId: string) => `/mock/thumbs/${fileId}.jpg`,
  hasThumbnail: (fileId: string) => mockThumbnailIds.has(fileId),
}));

jest.mock("../../logger", () => ({
  LOG_TAGS: {
    BackupService: "BackupService",
  },
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-application", () => ({ nativeApplicationVersion: "2.0.0" }));
jest.mock("expo-device", () => ({ deviceName: "TestPhone", modelName: "TestModel" }));

function createMockProvider(manifest?: BackupManifest): ICloudProvider {
  const listFiles = jest.fn(async (path: string) => {
    if (path.includes("fits_files")) {
      return [
        { name: "keep.fits", path: `${path}/keep.fits`, size: 10, isDirectory: false },
        { name: "stale.fits", path: `${path}/stale.fits`, size: 10, isDirectory: false },
      ];
    }
    if (path.includes("thumbnails")) {
      return [
        { name: "keep.jpg", path: `${path}/keep.jpg`, size: 10, isDirectory: false },
        { name: "stale.jpg", path: `${path}/stale.jpg`, size: 10, isDirectory: false },
      ];
    }
    return [];
  });

  return {
    name: "webdav",
    displayName: "WebDAV Test",
    icon: "server-outline",
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: () => true,
    testConnection: jest.fn().mockResolvedValue(true),
    refreshTokenIfNeeded: jest.fn(),
    uploadFile: jest.fn(),
    downloadFile: jest.fn(async (_remotePath: string, localPath: string) => {
      mockFileStore.set(localPath, new Uint8Array([9, 8, 7]));
    }),
    deleteFile: jest.fn(),
    listFiles,
    fileExists: jest.fn().mockResolvedValue(false),
    uploadManifest: jest.fn(),
    downloadManifest: jest.fn().mockResolvedValue(manifest ?? null),
    ensureBackupDir: jest.fn(),
    getQuota: jest.fn().mockResolvedValue(null),
    getUserInfo: jest.fn().mockResolvedValue(null),
  };
}

function createMockDataSource(): BackupDataSource {
  return {
    getFiles: () => [],
    getAlbums: () =>
      [{ id: "a1", name: "TestAlbum", imageIds: [], createdAt: Date.now() }] as never[],
    getTargets: () => [{ id: "t1", name: "M31" }] as never[],
    getTargetGroups: () => [{ id: "g1", name: "Group", targetIds: ["t1"] }] as never[],
    getSessions: () => [],
    getPlans: () => [{ id: "p1", title: "Plan", targetName: "M31" }] as never[],
    getLogEntries: () => [{ id: "l1", sessionId: "s1", imageId: "f1" }] as never[],
    getSettings: () => ({ language: "en", theme: "dark" }),
    getFileGroups: () => ({ groups: [], fileGroupMap: {} }),
    getAstrometry: () => ({ config: {} as never, jobs: [] }),
    getTrash: () => [],
    getActiveSession: () => null,
    getBackupPrefs: () => ({
      activeProvider: "webdav",
      autoBackupEnabled: true,
      autoBackupIntervalHours: 24,
      autoBackupNetwork: "wifi",
    }),
  };
}

function createMockRestoreTarget() {
  return {
    setFiles: jest.fn(),
    setAlbums: jest.fn(),
    setTargets: jest.fn(),
    setTargetGroups: jest.fn(),
    setSessions: jest.fn(),
    setPlans: jest.fn(),
    setLogEntries: jest.fn(),
    setSettings: jest.fn(),
    setFileGroups: jest.fn(),
    setAstrometry: jest.fn(),
    setTrash: jest.fn(),
    setActiveSession: jest.fn(),
    setBackupPrefs: jest.fn(),
  };
}

const testManifest: BackupManifest = {
  version: MANIFEST_VERSION,
  snapshotId: "snapshot-test-id",
  appVersion: "2.0.0",
  createdAt: "2025-01-15T00:00:00.000Z",
  deviceName: "OtherDevice",
  platform: "android",
  capabilities: {
    supportsBinary: true,
    supportsThumbnails: true,
    localPayloadMode: "full",
    encryptedLocalPackage: false,
  },
  domains: [
    "files",
    "albums",
    "targets",
    "targetGroups",
    "sessions",
    "plans",
    "logEntries",
    "settings",
    "thumbnails",
    "fileGroups",
    "astrometry",
    "trash",
    "sessionRuntime",
    "backupPrefs",
  ],
  files: [],
  thumbnails: [],
  albums: [{ id: "a1", name: "RestoredAlbum", imageIds: [] }] as never[],
  targets: [{ id: "t1", name: "M42" }] as never[],
  targetGroups: [{ id: "g1", name: "Group", targetIds: ["t1"] }] as never[],
  sessions: [{ id: "s1", startTime: 1000 }] as never[],
  plans: [{ id: "p1", title: "Plan", targetName: "M42" }] as never[],
  logEntries: [{ id: "l1", sessionId: "s1", imageId: "f1" }] as never[],
  settings: { language: "zh", theme: "light", gridColor: "#ff0000" },
  fileGroups: { groups: [], fileGroupMap: {} },
  astrometry: { config: {} as never, jobs: [] },
  trash: [],
  sessionRuntime: { activeSession: null },
  backupPrefs: {
    activeProvider: "webdav",
    autoBackupEnabled: true,
    autoBackupIntervalHours: 12,
    autoBackupNetwork: "wifi",
  },
};

describe("performBackup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileStore.clear();
    mockThumbnailIds.clear();
  });

  it("uploads manifest and new domains", async () => {
    const provider = createMockProvider();
    const dataSource = createMockDataSource();

    await performBackup(provider, dataSource, DEFAULT_BACKUP_OPTIONS);

    expect(provider.ensureBackupDir).toHaveBeenCalled();
    expect(provider.uploadManifest).toHaveBeenCalledTimes(1);
    const uploadedManifest = (provider.uploadManifest as jest.Mock).mock
      .calls[0][0] as BackupManifest;
    expect(uploadedManifest.version).toBe(MANIFEST_VERSION);
    expect(uploadedManifest.fileGroups).toEqual({ groups: [], fileGroupMap: {} });
    expect(uploadedManifest.backupPrefs.activeProvider).toBe("webdav");
  });

  it("uploads file binaries and thumbnails when enabled", async () => {
    const provider = createMockProvider();
    const dataSource: BackupDataSource = {
      ...createMockDataSource(),
      getFiles: () =>
        [
          {
            id: "f1",
            filename: "keep.fits",
            filepath: "/mock/a.fits",
            fileSize: 100,
            sourceType: "fits",
          },
        ] as never[],
    };

    mockFileStore.set("/mock/a.fits", new Uint8Array([1, 2, 3]));
    mockFileStore.set("/mock/thumbs/f1.jpg", new Uint8Array([3, 2, 1]));
    mockThumbnailIds.add("f1");

    await performBackup(provider, dataSource, {
      ...DEFAULT_BACKUP_OPTIONS,
      includeThumbnails: true,
    });

    expect(provider.uploadFile).toHaveBeenCalledWith(
      "/mock/a.fits",
      "cobalt-backup/fits_files/f1_keep.fits",
    );
    expect(provider.uploadFile).toHaveBeenCalledWith(
      "/mock/thumbs/f1.jpg",
      "cobalt-backup/thumbnails/f1.jpg",
    );

    expect(provider.deleteFile).toHaveBeenCalledWith("cobalt-backup/fits_files/stale.fits");
    expect(provider.deleteFile).toHaveBeenCalledWith("cobalt-backup/thumbnails/stale.jpg");
  });

  it("reports progress and handles abort", async () => {
    const provider = createMockProvider();
    const dataSource: BackupDataSource = {
      ...createMockDataSource(),
      getFiles: () =>
        [
          {
            id: "f1",
            filename: "keep.fits",
            filepath: "/mock/a.fits",
            fileSize: 100,
            sourceType: "fits",
          },
        ] as never[],
    };
    mockFileStore.set("/mock/a.fits", new Uint8Array([1, 2, 3]));
    const progressCalls: BackupProgress[] = [];

    await performBackup(provider, dataSource, DEFAULT_BACKUP_OPTIONS, (p) =>
      progressCalls.push({ ...p }),
    );

    expect(progressCalls.length).toBeGreaterThanOrEqual(2);
    expect(progressCalls[0].phase).toBe("preparing");
    expect(progressCalls[progressCalls.length - 1].phase).toBe("idle");

    const abortController = new AbortController();
    abortController.abort();
    await expect(
      performBackup(
        provider,
        dataSource,
        DEFAULT_BACKUP_OPTIONS,
        undefined,
        abortController.signal,
      ),
    ).rejects.toThrow("Backup cancelled");
  });
});

describe("performRestore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileStore.clear();
    mockThumbnailIds.clear();
  });

  it("restores all metadata domains including new ones", async () => {
    const provider = createMockProvider(testManifest);
    const target = createMockRestoreTarget();

    await performRestore(provider, target, DEFAULT_BACKUP_OPTIONS);

    expect(target.setAlbums).toHaveBeenCalledWith(testManifest.albums, "skip-existing");
    expect(target.setTargets).toHaveBeenCalledWith(testManifest.targets, "skip-existing");
    expect(target.setTargetGroups).toHaveBeenCalledWith(testManifest.targetGroups, "skip-existing");
    expect(target.setSessions).toHaveBeenCalledWith(testManifest.sessions, "skip-existing");
    expect(target.setPlans).toHaveBeenCalledWith(testManifest.plans, "skip-existing");
    expect(target.setLogEntries).toHaveBeenCalledWith(testManifest.logEntries, "skip-existing");
    expect(target.setSettings).toHaveBeenCalledWith(testManifest.settings);
    expect(target.setFileGroups).toHaveBeenCalledWith(testManifest.fileGroups, "skip-existing");
    expect(target.setAstrometry).toHaveBeenCalledWith(testManifest.astrometry, "skip-existing");
    expect(target.setTrash).toHaveBeenCalledWith(testManifest.trash, "skip-existing");
    expect(target.setActiveSession).toHaveBeenCalledWith(null, "skip-existing");
    expect(target.setBackupPrefs).toHaveBeenCalledWith(testManifest.backupPrefs);
  });

  it("restores files and thumbnails with download", async () => {
    const manifestWithBinaries: BackupManifest = {
      ...testManifest,
      files: [
        {
          id: "f1",
          filename: "keep.fits",
          filepath: "/remote/keep.fits",
          fileSize: 100,
          sourceType: "fits",
          mediaKind: "image",
          binary: { remotePath: "cobalt-backup/fits_files/f1_keep.fits" },
        },
      ] as never[],
      thumbnails: [
        {
          fileId: "f1",
          filename: "f1.jpg",
          remotePath: "cobalt-backup/thumbnails/f1.jpg",
        },
      ],
    };
    const provider = createMockProvider(manifestWithBinaries);
    const target = createMockRestoreTarget();

    await performRestore(provider, target, { ...DEFAULT_BACKUP_OPTIONS, includeThumbnails: true });

    expect(provider.downloadFile).toHaveBeenCalledWith(
      "cobalt-backup/fits_files/f1_keep.fits",
      "/mock/fits/keep.fits",
    );
    expect(provider.downloadFile).toHaveBeenCalledWith(
      "cobalt-backup/thumbnails/f1.jpg",
      "/mock/thumbs/f1.jpg",
    );
    expect(target.setFiles).toHaveBeenCalled();
  });

  it("throws when no manifest found", async () => {
    const provider = createMockProvider(undefined);
    const target = createMockRestoreTarget();
    await expect(performRestore(provider, target, DEFAULT_BACKUP_OPTIONS)).rejects.toThrow(
      "No backup found",
    );
  });
});

describe("getBackupInfo", () => {
  it("returns backup info from manifest", async () => {
    const manifest: BackupManifest = {
      ...testManifest,
      files: [
        {
          id: "f1",
          filename: "a.fits",
          filepath: "/p",
          fileSize: 500,
          sourceType: "fits",
        } as never,
        {
          id: "f2",
          filename: "b.fits",
          filepath: "/p",
          fileSize: 300,
          sourceType: "fits",
          binary: { size: 320 },
        } as never,
      ],
    };

    const provider = createMockProvider(manifest);
    const info = await getBackupInfo(provider);

    expect(info).not.toBeNull();
    expect(info?.fileCount).toBe(2);
    expect(info?.totalSize).toBe(820);
    expect(info?.deviceName).toBe("OtherDevice");
    expect(info?.appVersion).toBe("2.0.0");
    expect(info?.manifestDate).toBe("2025-01-15T00:00:00.000Z");
  });
});
