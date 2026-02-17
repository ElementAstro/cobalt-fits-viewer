/**
 * BackupService 核心备份/恢复逻辑测试
 */

import { performBackup, performRestore, getBackupInfo } from "../backupService";
import type { BackupDataSource } from "../backupService";
import type { ICloudProvider } from "../cloudProvider";
import type { BackupManifest, BackupProgress } from "../types";
import { DEFAULT_BACKUP_OPTIONS, MANIFEST_VERSION } from "../types";

// Mock expo-file-system
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((path: string) => ({
    uri: path,
    exists: false,
  })),
  Paths: { cache: "/cache" },
}));

// Mock fileManager
jest.mock("../../utils/fileManager", () => ({
  getFitsDir: () => "/mock/fits",
}));

// Mock logger
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

// Mock react-native, expo-application, expo-device for manifest creation
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-application", () => ({ nativeApplicationVersion: "2.0.0" }));
jest.mock("expo-device", () => ({ deviceName: "TestPhone", modelName: "TestModel" }));

function createMockProvider(manifest?: BackupManifest): ICloudProvider {
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
    downloadFile: jest.fn(),
    deleteFile: jest.fn(),
    listFiles: jest.fn().mockResolvedValue([]),
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
      [{ id: "a1", name: "TestAlbum", fileIds: [], createdAt: Date.now() }] as never[],
    getTargets: () => [{ id: "t1", name: "M31" }] as never[],
    getSessions: () => [],
    getSettings: () => ({ language: "en", theme: "dark" }),
  };
}

function createMockRestoreTarget() {
  return {
    setFiles: jest.fn(),
    setAlbums: jest.fn(),
    setTargets: jest.fn(),
    setSessions: jest.fn(),
    setSettings: jest.fn(),
  };
}

describe("performBackup", () => {
  it("should call ensureBackupDir and uploadManifest", async () => {
    const provider = createMockProvider();
    const dataSource = createMockDataSource();

    await performBackup(provider, dataSource, DEFAULT_BACKUP_OPTIONS);

    expect(provider.ensureBackupDir).toHaveBeenCalled();
    expect(provider.uploadManifest).toHaveBeenCalledTimes(1);

    const uploadedManifest = (provider.uploadManifest as jest.Mock).mock.calls[0][0];
    expect(uploadedManifest.version).toBe(MANIFEST_VERSION);
    expect(uploadedManifest.albums).toHaveLength(1);
    expect(uploadedManifest.targets).toHaveLength(1);
  });

  it("should upload files with stable id-prefixed remote names", async () => {
    const provider = createMockProvider();
    const dataSource: BackupDataSource = {
      ...createMockDataSource(),
      getFiles: () =>
        [
          { id: "f1", filename: "M31 light.fits", filepath: "/mock/a.fits", fileSize: 100 },
        ] as never[],
    };

    jest.requireMock("expo-file-system").File.mockImplementation((path: string) => ({
      uri: path,
      exists: true,
    }));

    await performBackup(provider, dataSource, DEFAULT_BACKUP_OPTIONS);

    expect(provider.uploadFile).toHaveBeenCalledWith(
      "/mock/a.fits",
      "cobalt-backup/fits_files/f1_M31_light.fits",
    );
  });

  it("should report progress", async () => {
    const provider = createMockProvider();
    const dataSource = createMockDataSource();
    const progressCalls: BackupProgress[] = [];

    await performBackup(provider, dataSource, DEFAULT_BACKUP_OPTIONS, (p) =>
      progressCalls.push({ ...p }),
    );

    expect(progressCalls.length).toBeGreaterThanOrEqual(2);
    expect(progressCalls[0].phase).toBe("preparing");
    expect(progressCalls[progressCalls.length - 1].phase).toBe("idle");
  });

  it("should throw when aborted", async () => {
    const provider = createMockProvider();
    // Return files so the upload loop runs
    const dataSource: BackupDataSource = {
      ...createMockDataSource(),
      getFiles: () =>
        [{ id: "f1", filename: "a.fits", filepath: "/mock/a.fits", fileSize: 100 }] as never[],
    };

    // Mock File to report exists = true so it tries to upload
    jest.requireMock("expo-file-system").File.mockImplementation((path: string) => ({
      uri: path,
      exists: true,
    }));

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

  it("should skip files when includeFiles is false", async () => {
    const provider = createMockProvider();
    const dataSource: BackupDataSource = {
      ...createMockDataSource(),
      getFiles: () =>
        [{ id: "f1", filename: "a.fits", filepath: "/mock/a.fits", fileSize: 100 }] as never[],
    };

    await performBackup(provider, dataSource, { ...DEFAULT_BACKUP_OPTIONS, includeFiles: false });

    expect(provider.uploadFile).not.toHaveBeenCalled();
    const uploadedManifest = (provider.uploadManifest as jest.Mock).mock.calls[0][0];
    expect(uploadedManifest.files).toHaveLength(0);
  });
});

describe("performRestore", () => {
  const testManifest: BackupManifest = {
    version: MANIFEST_VERSION,
    appVersion: "2.0.0",
    createdAt: "2025-01-15T00:00:00.000Z",
    deviceName: "OtherDevice",
    platform: "android",
    files: [],
    albums: [{ id: "a1", name: "RestoredAlbum", fileIds: [] }] as never[],
    targets: [{ id: "t1", name: "M42" }] as never[],
    sessions: [{ id: "s1", startTime: 1000 }] as never[],
    settings: { language: "zh", theme: "light", gridColor: "#ff0000" },
  };

  it("should restore albums, targets, sessions, settings from manifest", async () => {
    const provider = createMockProvider(testManifest);
    const target = createMockRestoreTarget();

    await performRestore(provider, target, DEFAULT_BACKUP_OPTIONS);

    expect(provider.downloadManifest).toHaveBeenCalled();
    expect(target.setAlbums).toHaveBeenCalledWith(testManifest.albums, "skip-existing");
    expect(target.setTargets).toHaveBeenCalledWith(testManifest.targets, "skip-existing");
    expect(target.setSessions).toHaveBeenCalledWith(testManifest.sessions, "skip-existing");
    expect(target.setSettings).toHaveBeenCalledWith(testManifest.settings);
  });

  it("should skip albums when includeAlbums is false", async () => {
    const provider = createMockProvider(testManifest);
    const target = createMockRestoreTarget();

    await performRestore(provider, target, { ...DEFAULT_BACKUP_OPTIONS, includeAlbums: false });

    expect(target.setAlbums).not.toHaveBeenCalled();
    expect(target.setTargets).toHaveBeenCalled();
  });

  it("should only restore file metadata for files downloaded successfully", async () => {
    jest.requireMock("expo-file-system").File.mockImplementation((path: string) => ({
      uri: path,
      exists: false,
    }));

    const manifestWithFiles: BackupManifest = {
      ...testManifest,
      files: [
        { id: "f1", filename: "a.fits", filepath: "/remote/a.fits", fileSize: 100 },
        { id: "f2", filename: "b.fits", filepath: "/remote/b.fits", fileSize: 200 },
      ] as never[],
    };
    const provider = createMockProvider(manifestWithFiles);
    (provider.downloadFile as jest.Mock).mockImplementation((remotePath: string) => {
      if (remotePath.includes("f1_a.fits") || remotePath.endsWith("/a.fits")) {
        throw new Error("download failed");
      }
      return Promise.resolve();
    });
    const target = createMockRestoreTarget();

    await performRestore(provider, target, DEFAULT_BACKUP_OPTIONS);

    const restoredFilesArg = (target.setFiles as jest.Mock).mock.calls[0][0];
    expect(restoredFilesArg).toHaveLength(1);
    expect(restoredFilesArg[0].id).toBe("f2");
  });

  it("should throw when no manifest found", async () => {
    const provider = createMockProvider(undefined);
    const target = createMockRestoreTarget();

    await expect(performRestore(provider, target, DEFAULT_BACKUP_OPTIONS)).rejects.toThrow(
      "No backup found",
    );
  });

  it("should report progress", async () => {
    const provider = createMockProvider(testManifest);
    const target = createMockRestoreTarget();
    const progressCalls: BackupProgress[] = [];

    await performRestore(provider, target, DEFAULT_BACKUP_OPTIONS, (p) =>
      progressCalls.push({ ...p }),
    );

    expect(progressCalls.length).toBeGreaterThanOrEqual(2);
    expect(progressCalls[0].phase).toBe("preparing");
  });
});

describe("getBackupInfo", () => {
  it("should return backup info from manifest", async () => {
    const manifest: BackupManifest = {
      version: MANIFEST_VERSION,
      appVersion: "2.0.0",
      createdAt: "2025-06-01T12:00:00.000Z",
      deviceName: "MyPhone",
      platform: "ios",
      files: [
        { id: "f1", filename: "a.fits", filepath: "/p", fileSize: 500 },
        { id: "f2", filename: "b.fits", filepath: "/p", fileSize: 300 },
      ] as never[],
      albums: [],
      targets: [],
      sessions: [],
      settings: {},
    };

    const provider = createMockProvider(manifest);
    const info = await getBackupInfo(provider);

    expect(info).not.toBeNull();
    expect(info!.fileCount).toBe(2);
    expect(info!.totalSize).toBe(800);
    expect(info!.deviceName).toBe("MyPhone");
    expect(info!.appVersion).toBe("2.0.0");
    expect(info!.manifestDate).toBe("2025-06-01T12:00:00.000Z");
  });

  it("should return null when no manifest", async () => {
    const provider = createMockProvider(undefined);
    const info = await getBackupInfo(provider);
    expect(info).toBeNull();
  });

  it("should return null when provider throws", async () => {
    const provider = createMockProvider();
    (provider.downloadManifest as jest.Mock).mockRejectedValue(new Error("network error"));
    const info = await getBackupInfo(provider);
    expect(info).toBeNull();
  });
});
