import { act, renderHook } from "@testing-library/react-native";
import { useBackup } from "../useBackup";
import { useBackupStore } from "../../stores/useBackupStore";
import { useAlbumStore } from "../../stores/useAlbumStore";
import { useFitsStore } from "../../stores/useFitsStore";
import type { Album, FitsMetadata } from "../../lib/fits/types";

const mockPerformBackup = jest.fn();
const mockPerformRestore = jest.fn();
const mockGetBackupInfoService = jest.fn();
const mockExportLocalBackup = jest.fn();
const mockImportLocalBackup = jest.fn();
const mockPreviewLocalBackup = jest.fn();
const mockGetNetworkStateAsync = jest.fn();
const mockReconcileTargetGraphStores = jest.fn();

jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("uniwind", () => ({
  Uniwind: {
    getColor: jest.fn(() => undefined),
  },
}));

jest.mock("../../stores/useSettingsStore", () => ({
  useSettingsStore: {
    getState: () => ({
      applySettingsPatch: jest.fn(),
    }),
  },
}));

jest.mock("../../lib/backup/backupService", () => ({
  performBackup: (...args: unknown[]) => mockPerformBackup(...args),
  performRestore: (...args: unknown[]) => mockPerformRestore(...args),
  getBackupInfo: (...args: unknown[]) => mockGetBackupInfoService(...args),
}));

jest.mock("../../lib/backup/localBackup", () => ({
  exportLocalBackup: (...args: unknown[]) => mockExportLocalBackup(...args),
  importLocalBackup: (...args: unknown[]) => mockImportLocalBackup(...args),
  previewLocalBackup: (...args: unknown[]) => mockPreviewLocalBackup(...args),
}));

jest.mock("expo-network", () => ({
  getNetworkStateAsync: (...args: unknown[]) => mockGetNetworkStateAsync(...args),
}));

jest.mock("../useTargets", () => ({
  reconcileTargetGraphStores: (...args: unknown[]) => mockReconcileTargetGraphStores(...args),
}));

jest.mock("../../lib/targets/targetRelations", () => ({
  normalizeTargetMatch: jest.fn(() => undefined),
}));

jest.mock("../../lib/backup/providers/googleDrive", () => ({
  GoogleDriveProvider: class {
    name = "mock";
    displayName = "Mock Provider";
    private connected = true;
    isConnected() {
      return this.connected;
    }
    async connect() {
      this.connected = true;
    }
    async disconnect() {
      this.connected = false;
    }
    async getUserInfo() {
      return { name: "Mock", email: "mock@example.com" };
    }
    async getQuota() {
      return { used: 0, total: 100 };
    }
    async testConnection() {
      return true;
    }
    async ensureBackupDir() {}
    async uploadFile() {}
    async downloadFile() {}
    async uploadManifest() {}
    async downloadManifest() {
      return null;
    }
  },
}));
jest.mock("../../lib/backup/providers/onedrive", () => ({
  OneDriveProvider: class {
    name = "mock";
    displayName = "Mock Provider";
    private connected = true;
    isConnected() {
      return this.connected;
    }
    async connect() {
      this.connected = true;
    }
    async disconnect() {
      this.connected = false;
    }
    async getUserInfo() {
      return { name: "Mock", email: "mock@example.com" };
    }
    async getQuota() {
      return { used: 0, total: 100 };
    }
    async testConnection() {
      return true;
    }
    async ensureBackupDir() {}
    async uploadFile() {}
    async downloadFile() {}
    async uploadManifest() {}
    async downloadManifest() {
      return null;
    }
  },
}));
jest.mock("../../lib/backup/providers/dropbox", () => ({
  DropboxProvider: class {
    name = "mock";
    displayName = "Mock Provider";
    private connected = true;
    isConnected() {
      return this.connected;
    }
    async connect() {
      this.connected = true;
    }
    async disconnect() {
      this.connected = false;
    }
    async getUserInfo() {
      return { name: "Mock", email: "mock@example.com" };
    }
    async getQuota() {
      return { used: 0, total: 100 };
    }
    async testConnection() {
      return true;
    }
    async ensureBackupDir() {}
    async uploadFile() {}
    async downloadFile() {}
    async uploadManifest() {}
    async downloadManifest() {
      return null;
    }
  },
}));
jest.mock("../../lib/backup/providers/webdav", () => ({
  WebDAVProvider: class {
    name = "mock";
    displayName = "Mock Provider";
    private connected = true;
    isConnected() {
      return this.connected;
    }
    async connect() {
      this.connected = true;
    }
    async disconnect() {
      this.connected = false;
    }
    async getUserInfo() {
      return { name: "Mock", email: "mock@example.com" };
    }
    async getQuota() {
      return { used: 0, total: 100 };
    }
    async testConnection() {
      return true;
    }
    async ensureBackupDir() {}
    async uploadFile() {}
    async downloadFile() {}
    async uploadManifest() {}
    async downloadManifest() {
      return null;
    }
  },
}));

jest.mock("../../lib/backup/oauthHelper", () => ({
  authenticateOneDrive: jest.fn(),
  authenticateDropbox: jest.fn(),
}));

const makeFile = (id: string, overrides: Partial<FitsMetadata> = {}): FitsMetadata =>
  ({
    id,
    filename: `${id}.fits`,
    filepath: `/tmp/${id}.fits`,
    fileSize: 100,
    importDate: 1,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  }) as FitsMetadata;

const makeAlbum = (id: string, overrides: Partial<Album> = {}): Album =>
  ({
    id,
    name: `Album ${id}`,
    createdAt: 1,
    updatedAt: 1,
    imageIds: [],
    isSmart: false,
    ...overrides,
  }) as Album;

describe("useBackup consistency reconciliation", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    useBackupStore.setState({
      connections: [],
      activeProvider: null,
      backupInProgress: false,
      restoreInProgress: false,
      progress: { phase: "idle", current: 0, total: 0 },
      autoBackupEnabled: false,
      autoBackupIntervalHours: 24,
      autoBackupNetwork: "wifi",
      lastAutoBackupCheck: 0,
      lastError: null,
    });

    useAlbumStore.setState({
      albums: [],
      albumSearchQuery: "",
      albumSortBy: "date",
      albumSortOrder: "desc",
    });

    useFitsStore.setState({
      files: [],
      selectedIds: [],
      isSelectionMode: false,
      sortBy: "date",
      sortOrder: "desc",
      searchQuery: "",
      filterTags: [],
    });

    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  it("restore syncs file.albumIds from restored albums", async () => {
    useFitsStore.setState({
      files: [makeFile("img-1", { albumIds: ["stale"] })],
    });

    mockPerformRestore.mockImplementation(async (_provider, restoreTarget) => {
      restoreTarget.setAlbums([makeAlbum("a", { imageIds: ["img-1"] })], "skip-existing");
    });

    const { result } = renderHook(() => useBackup());

    let response: { success: boolean; error?: string } | undefined;
    await act(async () => {
      response = await result.current.restore("webdav");
    });

    expect(response).toEqual({ success: true });
    expect(mockPerformRestore).toHaveBeenCalled();
    expect(useFitsStore.getState().files[0].albumIds).toEqual(["a"]);
    expect(mockReconcileTargetGraphStores).toHaveBeenCalled();
  });

  it("localImport syncs file.albumIds from imported albums", async () => {
    useFitsStore.setState({
      files: [makeFile("img-2", { albumIds: [] })],
    });

    mockImportLocalBackup.mockImplementation(async (restoreTarget) => {
      restoreTarget.setAlbums([makeAlbum("b", { imageIds: ["img-2"] })], "skip-existing");
      return { success: true };
    });

    const { result } = renderHook(() => useBackup());

    let response: { success: boolean; error?: string } | undefined;
    await act(async () => {
      response = await result.current.localImport();
    });

    expect(response).toEqual({ success: true });
    expect(mockImportLocalBackup).toHaveBeenCalled();
    expect(useFitsStore.getState().files[0].albumIds).toEqual(["b"]);
    expect(mockReconcileTargetGraphStores).toHaveBeenCalled();
  });

  it("backup returns no internet error when offline", async () => {
    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    const { result } = renderHook(() => useBackup());
    let response: { success: boolean; error?: string } | undefined;
    await act(async () => {
      response = await result.current.backup("webdav");
    });

    expect(response).toEqual({ success: false, error: "No internet connection" });
    expect(mockPerformBackup).not.toHaveBeenCalled();
  });
});
