import { exportLocalBackup, importLocalBackup, previewLocalBackup } from "../localBackup";
import { DEFAULT_BACKUP_OPTIONS, MANIFEST_VERSION, type BackupManifest } from "../types";

const mockFileStore = new Map<string, string | Uint8Array>();

jest.mock("expo-file-system", () => {
  class MockFile {
    uri: string;

    constructor(pathOrDir: string, name?: string) {
      this.uri = name ? `${pathOrDir}/${name}` : pathOrDir;
    }

    get exists() {
      return mockFileStore.has(this.uri);
    }

    write(data: string | Uint8Array) {
      mockFileStore.set(this.uri, data);
    }

    async text() {
      const value = mockFileStore.get(this.uri);
      if (typeof value === "string") return value;
      if (value instanceof Uint8Array) {
        return new TextDecoder().decode(value);
      }
      return "";
    }

    delete() {
      mockFileStore.delete(this.uri);
    }
  }

  return {
    File: MockFile,
    Paths: {
      cache: "/cache",
    },
  };
});

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock("../../logger", () => ({
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("localBackup", () => {
  beforeEach(() => {
    mockFileStore.clear();
    jest.clearAllMocks();
  });

  it("should export file metadata when includeFiles is enabled", async () => {
    const sharing = jest.requireMock("expo-sharing");
    const source = {
      getFiles: () =>
        [
          {
            id: "f1",
            filename: "a.fits",
            filepath: "/mock/a.fits",
            fileSize: 123,
          },
        ] as never[],
      getAlbums: () => [],
      getTargets: () => [],
      getSessions: () => [],
      getSettings: () => ({}),
    };

    let exportedManifest: BackupManifest | null = null;
    (sharing.shareAsync as jest.Mock).mockImplementation(async (uri: string) => {
      const content = mockFileStore.get(uri);
      exportedManifest = JSON.parse(String(content)) as BackupManifest;
    });

    const result = await exportLocalBackup(source, {
      ...DEFAULT_BACKUP_OPTIONS,
      includeFiles: true,
    });

    expect(result.success).toBe(true);
    expect(exportedManifest).not.toBeNull();
    expect(exportedManifest!.files).toHaveLength(1);
  });

  it("should preview selected local backup and return manifest summary", async () => {
    const picker = jest.requireMock("expo-document-picker");
    const manifest: BackupManifest = {
      version: MANIFEST_VERSION,
      appVersion: "1.0.0",
      createdAt: "2026-01-01T00:00:00.000Z",
      deviceName: "Device",
      platform: "ios",
      files: [{ id: "f1", filename: "a.fits", filepath: "/mock/a.fits", fileSize: 1 }] as never[],
      albums: [{ id: "a1", name: "Album", imageIds: [] }] as never[],
      targets: [],
      sessions: [],
      settings: {},
    };

    const uri = "/cache/local-backup.json";
    mockFileStore.set(uri, JSON.stringify(manifest));
    (picker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri, name: "local-backup.json" }],
    });

    const result = await previewLocalBackup();

    expect(result.success).toBe(true);
    expect(result.summary?.fileCount).toBe(1);
    expect(result.fileName).toBe("local-backup.json");
    expect(result.manifest?.version).toBe(MANIFEST_VERSION);
  });

  it("should import from preview source without re-picking file", async () => {
    const picker = jest.requireMock("expo-document-picker");
    const manifest: BackupManifest = {
      version: MANIFEST_VERSION,
      appVersion: "1.0.0",
      createdAt: "2026-01-01T00:00:00.000Z",
      deviceName: "Device",
      platform: "ios",
      files: [{ id: "f1", filename: "a.fits", filepath: "/mock/a.fits", fileSize: 1 }] as never[],
      albums: [{ id: "a1", name: "Album", imageIds: [] }] as never[],
      targets: [{ id: "t1", name: "M31" }] as never[],
      sessions: [{ id: "s1", startTime: 123 }] as never[],
      settings: { theme: "dark" },
    };

    const restoreTarget = {
      setFiles: jest.fn(),
      setAlbums: jest.fn(),
      setTargets: jest.fn(),
      setSessions: jest.fn(),
      setSettings: jest.fn(),
    };

    const result = await importLocalBackup(
      restoreTarget,
      { ...DEFAULT_BACKUP_OPTIONS, restoreConflictStrategy: "merge" },
      undefined,
      {
        fileName: "preview.json",
        manifest,
        summary: {
          fileCount: 1,
          albumCount: 1,
          targetCount: 1,
          sessionCount: 1,
          hasSettings: true,
          createdAt: manifest.createdAt,
          deviceName: manifest.deviceName,
          appVersion: manifest.appVersion,
        },
      },
    );

    expect(result.success).toBe(true);
    expect(picker.getDocumentAsync).not.toHaveBeenCalled();
    expect(restoreTarget.setAlbums).toHaveBeenCalledWith(manifest.albums, "merge");
    expect(restoreTarget.setTargets).toHaveBeenCalledWith(manifest.targets, "merge");
    expect(restoreTarget.setSessions).toHaveBeenCalledWith(manifest.sessions, "merge");
    expect(restoreTarget.setFiles).toHaveBeenCalledWith(manifest.files, "merge");
  });
});
