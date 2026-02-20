import { exportLocalBackup, importLocalBackup, previewLocalBackup } from "../localBackup";
import { DEFAULT_BACKUP_OPTIONS, MANIFEST_VERSION, type BackupManifest } from "../types";
import type { BackupDataSource } from "../backupService";

const mockFileStore = new Map<string, Uint8Array | string>();
const mockDirStore = new Set<string>(["/cache"]);
const mockZipSourceByTarget = new Map<string, string>();

function mockNormalizePath(input: string) {
  return input.replace(/\/+$/, "");
}

jest.mock("expo-file-system", () => {
  class MockDirectory {
    uri: string;
    constructor(pathOrDir: string | { uri: string }, name?: string) {
      const base = typeof pathOrDir === "string" ? pathOrDir : pathOrDir.uri;
      this.uri = name ? `${mockNormalizePath(base)}/${name}` : mockNormalizePath(base);
    }
    get exists() {
      return mockDirStore.has(this.uri);
    }
    create() {
      mockDirStore.add(this.uri);
    }
    delete() {
      mockDirStore.delete(this.uri);
      for (const key of [...mockFileStore.keys()]) {
        if (key.startsWith(`${this.uri}/`)) mockFileStore.delete(key);
      }
    }
  }

  class MockFile {
    uri: string;
    name: string;

    constructor(pathOrDir: string | { uri: string }, name?: string) {
      const base = typeof pathOrDir === "string" ? pathOrDir : pathOrDir.uri;
      this.uri = name ? `${mockNormalizePath(base)}/${name}` : mockNormalizePath(base);
      this.name = this.uri.split("/").pop() ?? "file";
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

    write(data: string | Uint8Array) {
      mockFileStore.set(this.uri, data);
    }

    async text() {
      const value = mockFileStore.get(this.uri);
      if (typeof value === "string") return value;
      if (value instanceof Uint8Array) return new TextDecoder().decode(value);
      return "";
    }

    async bytes() {
      const value = mockFileStore.get(this.uri);
      if (value instanceof Uint8Array) return value;
      if (typeof value === "string") return new TextEncoder().encode(value);
      return new Uint8Array();
    }

    copy(target: { uri: string }) {
      const value = mockFileStore.get(this.uri);
      if (value == null) return;
      mockFileStore.set(target.uri, value);
    }

    delete() {
      mockFileStore.delete(this.uri);
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
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

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "snapshot-test-id"),
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  digest: jest.fn(async () => new Uint8Array([1, 2, 3]).buffer),
}));

jest.mock("../localCrypto", () => ({
  ENCRYPTED_BACKUP_KIND: "cobalt-backup-encrypted",
  ENCRYPTED_BACKUP_VERSION: 1,
  encryptBackupPayload: jest.fn(
    async (payload: Uint8Array, password: string, summary: unknown) => ({
      kind: "cobalt-backup-encrypted",
      version: 1,
      algorithm: "AES-GCM",
      kdf: "PBKDF2-SHA256",
      iterations: 1,
      saltB64: "salt",
      ivB64: "iv",
      payloadB64: Buffer.from(payload).toString("base64"),
      summary: summary as Record<string, unknown>,
      passwordHint: password,
    }),
  ),
  decryptBackupPayload: jest.fn(
    async (envelope: { payloadB64: string; passwordHint?: string }, password: string) => {
      if (envelope.passwordHint && envelope.passwordHint !== password) {
        throw new Error("Invalid password");
      }
      return new Uint8Array(Buffer.from(envelope.payloadB64, "base64"));
    },
  ),
  isEncryptedEnvelope: jest.fn((value: unknown) => {
    return (
      !!value &&
      typeof value === "object" &&
      (value as Record<string, unknown>).kind === "cobalt-backup-encrypted"
    );
  }),
}));

jest.mock("react-native-zip-archive", () => ({
  zip: jest.fn(async (source: string, target: string) => {
    mockZipSourceByTarget.set(target, mockNormalizePath(source));
    mockFileStore.set(target, new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    return target;
  }),
  unzip: jest.fn(async (source: string, target: string) => {
    const sourceDir = mockZipSourceByTarget.get(source);
    if (sourceDir) {
      mockDirStore.add(mockNormalizePath(target));
      for (const [path, content] of mockFileStore.entries()) {
        if (!path.startsWith(`${sourceDir}/`)) continue;
        const rel = path.slice(sourceDir.length + 1);
        mockFileStore.set(`${mockNormalizePath(target)}/${rel}`, content);
      }
    }
    return target;
  }),
}));

jest.mock("../../utils/fileManager", () => ({
  getFitsDir: () => "/mock/fits",
}));

jest.mock("../../gallery/thumbnailCache", () => ({
  ensureThumbnailDir: jest.fn(),
  getThumbnailPath: (fileId: string) => `/mock/thumbs/${fileId}.jpg`,
}));

jest.mock("../../logger", () => {
  const actual = jest.requireActual("../../logger") as typeof import("../../logger");
  return {
    ...actual,
    Logger: {
      ...actual.Logger,
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
});

const baseSource: BackupDataSource = {
  getFiles: () =>
    [
      {
        id: "f1",
        filename: "a.fits",
        filepath: "/mock/a.fits",
        fileSize: 123,
        sourceType: "fits",
        mediaKind: "image",
      },
    ] as never[],
  getAlbums: () => [{ id: "a1", name: "Album", imageIds: ["f1"] }] as never[],
  getTargets: () => [{ id: "t1", name: "M31" }] as never[],
  getTargetGroups: () => [{ id: "g1", name: "Group", targetIds: ["t1"] }] as never[],
  getSessions: () => [{ id: "s1" }] as never[],
  getPlans: () => [{ id: "p1", title: "Plan", targetName: "M31" }] as never[],
  getLogEntries: () => [{ id: "l1", sessionId: "s1", imageId: "f1" }] as never[],
  getSettings: () => ({ theme: "dark" }),
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

describe("localBackup", () => {
  beforeEach(() => {
    mockFileStore.clear();
    mockDirStore.clear();
    mockDirStore.add("/cache");
    mockZipSourceByTarget.clear();
    jest.clearAllMocks();
    mockFileStore.set("/mock/a.fits", new Uint8Array([1, 2, 3]));
    mockFileStore.set("/mock/thumbs/f1.jpg", new Uint8Array([5, 6, 7]));
  });

  it("exports metadata-only backup json", async () => {
    const sharing = jest.requireMock("expo-sharing");
    let exportedManifestJson: string | null = null;
    (sharing.shareAsync as jest.Mock).mockImplementationOnce(async (uri: string) => {
      exportedManifestJson = String(mockFileStore.get(uri) ?? "");
    });

    const result = await exportLocalBackup(baseSource, {
      ...DEFAULT_BACKUP_OPTIONS,
      localPayloadMode: "metadata-only",
    });

    expect(result.success).toBe(true);
    expect(sharing.shareAsync).toHaveBeenCalledTimes(1);
    expect(exportedManifestJson).toBeTruthy();
    const manifest = JSON.parse(exportedManifestJson as unknown as string) as BackupManifest;
    expect(manifest.version).toBe(MANIFEST_VERSION);
    expect(manifest.capabilities.localPayloadMode).toBe("metadata-only");
    expect(manifest.files).toHaveLength(1);
  });

  it("exports full package zip by default for local-export", async () => {
    const sharing = jest.requireMock("expo-sharing");
    const zip = jest.requireMock("react-native-zip-archive");

    const result = await exportLocalBackup(baseSource, {
      ...DEFAULT_BACKUP_OPTIONS,
      localPayloadMode: "full",
      includeThumbnails: true,
    });

    expect(result.success).toBe(true);
    expect(zip.zip).toHaveBeenCalled();
    const sharedUri = (sharing.shareAsync as jest.Mock).mock.calls[0][0] as string;
    expect(sharedUri.endsWith(".zip")).toBe(true);
  });

  it("previews manifest json backup", async () => {
    const picker = jest.requireMock("expo-document-picker");
    const manifest: BackupManifest = {
      version: MANIFEST_VERSION,
      snapshotId: "snapshot-test-id",
      appVersion: "1.0.0",
      createdAt: "2026-01-01T00:00:00.000Z",
      deviceName: "Device",
      platform: "ios",
      capabilities: {
        supportsBinary: true,
        supportsThumbnails: false,
        localPayloadMode: "metadata-only",
        encryptedLocalPackage: false,
      },
      domains: ["files"],
      files: [
        {
          id: "f1",
          filename: "a.fits",
          filepath: "/mock/a.fits",
          fileSize: 1,
          sourceType: "fits",
          mediaKind: "image",
        },
      ] as never[],
      thumbnails: [],
      albums: [{ id: "a1", name: "Album", imageIds: ["f1"] }] as never[],
      targets: [],
      targetGroups: [],
      sessions: [],
      plans: [],
      logEntries: [],
      settings: {},
      fileGroups: { groups: [], fileGroupMap: {} },
      astrometry: { config: {} as never, jobs: [] },
      trash: [],
      sessionRuntime: { activeSession: null },
      backupPrefs: {
        activeProvider: null,
        autoBackupEnabled: false,
        autoBackupIntervalHours: 24,
        autoBackupNetwork: "wifi",
      },
    };

    const uri = "/cache/local-backup.json";
    mockFileStore.set(uri, JSON.stringify(manifest));
    picker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri, name: "local-backup.json" }],
    });

    const result = await previewLocalBackup();
    expect(result.success).toBe(true);
    expect(result.summary?.fileCount).toBe(1);
    expect(result.fileName).toBe("local-backup.json");
  });

  it("imports from preview json source", async () => {
    const manifest = {
      version: MANIFEST_VERSION,
      snapshotId: "snapshot-test-id",
      appVersion: "1.0.0",
      createdAt: "2026-01-01T00:00:00.000Z",
      deviceName: "Device",
      platform: "ios",
      capabilities: {
        supportsBinary: true,
        supportsThumbnails: false,
        localPayloadMode: "metadata-only",
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
      ],
      files: [
        {
          id: "f1",
          filename: "a.fits",
          filepath: "/mock/a.fits",
          fileSize: 1,
          sourceType: "fits",
          mediaKind: "image",
        },
      ],
      thumbnails: [],
      albums: [{ id: "a1", name: "Album", imageIds: ["f1"] }],
      targets: [{ id: "t1", name: "M31" }],
      targetGroups: [{ id: "g1", name: "Group", targetIds: ["t1"] }],
      sessions: [{ id: "s1" }],
      plans: [{ id: "p1", title: "Plan", targetName: "M31" }],
      logEntries: [{ id: "l1", sessionId: "s1", imageId: "f1" }],
      settings: { theme: "dark" },
      fileGroups: { groups: [], fileGroupMap: {} },
      astrometry: { config: {}, jobs: [] },
      trash: [],
      sessionRuntime: { activeSession: null },
      backupPrefs: {
        activeProvider: "webdav",
        autoBackupEnabled: true,
        autoBackupIntervalHours: 24,
        autoBackupNetwork: "wifi",
      },
    } as never as BackupManifest;

    const restoreTarget = {
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

    const result = await importLocalBackup(
      restoreTarget,
      { ...DEFAULT_BACKUP_OPTIONS, restoreConflictStrategy: "merge" },
      undefined,
      {
        fileName: "preview.json",
        sourceUri: "/cache/preview.json",
        sourceType: "manifest-json",
        encrypted: false,
        manifest,
        summary: {
          fileCount: 1,
          thumbnailCount: 0,
          albumCount: 1,
          targetCount: 1,
          targetGroupCount: 1,
          sessionCount: 1,
          planCount: 1,
          logEntryCount: 1,
          fileGroupCount: 0,
          trashCount: 0,
          astrometryJobCount: 0,
          hasSettings: true,
          createdAt: manifest.createdAt,
          deviceName: manifest.deviceName,
          appVersion: manifest.appVersion,
        },
      },
    );

    expect(result.success).toBe(true);
    expect(restoreTarget.setAlbums).toHaveBeenCalledWith(manifest.albums, "merge");
    expect(restoreTarget.setTargets).toHaveBeenCalledWith(manifest.targets, "merge");
    expect(restoreTarget.setFiles).toHaveBeenCalledWith(manifest.files, "merge");
    expect(restoreTarget.setBackupPrefs).toHaveBeenCalled();
  });

  it("imports encrypted payload with password and rejects wrong password", async () => {
    const restoreTarget = {
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

    const payloadManifest = JSON.stringify({
      version: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      files: [],
    });
    const envelope = {
      kind: "cobalt-backup-encrypted",
      version: 1,
      algorithm: "AES-GCM",
      kdf: "PBKDF2-SHA256",
      iterations: 1,
      saltB64: "salt",
      ivB64: "iv",
      payloadB64: Buffer.from(payloadManifest).toString("base64"),
      passwordHint: "good-pass",
      summary: {
        fileCount: 0,
      },
    };

    const ok = await importLocalBackup(
      restoreTarget,
      {
        ...DEFAULT_BACKUP_OPTIONS,
        localEncryption: { enabled: true, password: "good-pass" },
      },
      undefined,
      {
        fileName: "enc.cobaltbak",
        sourceUri: "/cache/enc.cobaltbak",
        sourceType: "encrypted-package",
        encrypted: true,
        encryptedEnvelope: envelope as never,
        summary: {
          fileCount: 0,
          thumbnailCount: 0,
          albumCount: 0,
          targetCount: 0,
          targetGroupCount: 0,
          sessionCount: 0,
          planCount: 0,
          logEntryCount: 0,
          fileGroupCount: 0,
          trashCount: 0,
          astrometryJobCount: 0,
          hasSettings: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          deviceName: "Device",
          appVersion: "1.0.0",
        },
      },
    );
    expect(ok.success).toBe(true);

    const bad = await importLocalBackup(
      restoreTarget,
      {
        ...DEFAULT_BACKUP_OPTIONS,
        localEncryption: { enabled: true, password: "bad-pass" },
      },
      undefined,
      {
        fileName: "enc.cobaltbak",
        sourceUri: "/cache/enc.cobaltbak",
        sourceType: "encrypted-package",
        encrypted: true,
        encryptedEnvelope: envelope as never,
        summary: {
          fileCount: 0,
          thumbnailCount: 0,
          albumCount: 0,
          targetCount: 0,
          targetGroupCount: 0,
          sessionCount: 0,
          planCount: 0,
          logEntryCount: 0,
          fileGroupCount: 0,
          trashCount: 0,
          astrometryJobCount: 0,
          hasSettings: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          deviceName: "Device",
          appVersion: "1.0.0",
        },
      },
    );
    expect(bad.success).toBe(false);
    expect(bad.error).toContain("Invalid password");
  });
});
