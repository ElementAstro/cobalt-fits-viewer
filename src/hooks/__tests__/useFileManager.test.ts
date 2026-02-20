import { act, renderHook } from "@testing-library/react-native";
import type { FitsMetadata, TrashedFitsRecord } from "../../lib/fits/types";
import { useFileManager } from "../useFileManager";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useTrashStore } from "../../stores/useTrashStore";

jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

jest.mock("expo-video", () => ({
  createVideoPlayer: jest.fn(() => ({
    addListener: jest.fn(),
    remove: jest.fn(),
    release: jest.fn(),
  })),
}));

jest.mock("fitsjs-ng", () => ({
  convertHiPSToFITS: jest.fn(),
}));

jest.mock("expo-clipboard", () => ({
  hasImageAsync: jest.fn().mockResolvedValue(false),
  getImageAsync: jest.fn().mockResolvedValue(null),
  getStringAsync: jest.fn().mockResolvedValue(""),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("uniwind", () => ({
  Uniwind: {
    setTheme: jest.fn(),
  },
}));

jest.mock("react-native-zip-archive", () => ({
  zip: jest.fn(),
}));

jest.mock("expo-file-system", () => {
  const files = new Set<string>();
  const failDelete = new Set<string>();

  const normalize = (value: string) => value.replace(/\/+$/, "");
  const toUri = (pathOrDir: string | { uri: string }, name?: string): string => {
    const base = typeof pathOrDir === "string" ? pathOrDir : pathOrDir.uri;
    return normalize(name ? `${base}/${name}` : base);
  };

  class MockFile {
    uri: string;

    constructor(pathOrDir: string | { uri: string }, name?: string) {
      this.uri = toUri(pathOrDir, name);
    }

    get exists() {
      return files.has(this.uri);
    }

    get size() {
      return this.exists ? 128 : 0;
    }

    delete() {
      if (!this.exists) throw new Error("missing");
      if (failDelete.has(this.uri)) throw new Error("locked");
      files.delete(this.uri);
    }

    copy(target: MockFile) {
      if (!this.exists) throw new Error("missing");
      files.add(target.uri);
    }

    write() {
      files.add(this.uri);
    }

    async arrayBuffer() {
      return new ArrayBuffer(0);
    }
  }

  class MockDirectory {
    uri: string;

    constructor(pathOrDir: string | { uri: string }, name?: string) {
      this.uri = toUri(pathOrDir, name);
    }

    get exists() {
      return true;
    }

    create() {}

    delete() {
      const prefix = `${this.uri}/`;
      for (const uri of Array.from(files)) {
        if (uri.startsWith(prefix)) {
          files.delete(uri);
        }
      }
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: {
      cache: "file:///cache",
    },
    __mock: {
      reset: () => {
        files.clear();
        failDelete.clear();
      },
      seedFile: (uri: string) => {
        files.add(normalize(uri));
      },
      markDeleteFailure: (uri: string) => {
        failDelete.add(normalize(uri));
      },
      hasFile: (uri: string) => files.has(normalize(uri)),
    },
  };
});

jest.mock("../../lib/logger", () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../useTargets", () => ({
  useTargets: () => ({
    upsertAndLinkFileTarget: jest.fn(),
    reconcileTargetGraph: jest.fn(),
  }),
}));

jest.mock("../useLocation", () => ({
  LocationService: {
    getCurrentLocation: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock("../../lib/gallery/thumbnailCache", () => ({
  generateAndSaveThumbnail: jest.fn(),
  deleteThumbnails: jest.fn(),
}));

jest.mock("../../lib/fits/parser", () => ({
  loadScientificFitsFromBuffer: jest.fn(),
  extractMetadata: jest.fn(),
  getImagePixels: jest.fn(),
  getImageDimensions: jest.fn(),
}));

jest.mock("../../lib/converter/formatConverter", () => ({
  fitsToRGBA: jest.fn(),
}));

jest.mock("../../lib/gallery/duplicateDetector", () => ({
  computeQuickHash: jest.fn(),
  findDuplicateOnImport: jest.fn(),
}));

jest.mock("../../lib/gallery/albumSync", () => ({
  computeAlbumFileConsistencyPatches: jest.fn(() => []),
  reconcileAlbumsWithValidFiles: jest.fn((albums) => ({
    albums,
    prunedRefs: 0,
    coverFixes: 0,
  })),
}));

jest.mock("../../lib/image/rasterParser", () => ({
  extractRasterMetadata: jest.fn(),
  parseRasterFromBufferAsync: jest.fn(),
}));

jest.mock("../../lib/utils/fileManager", () => ({
  importFile: jest.fn(),
  deleteFilesPermanently: jest.fn().mockReturnValue(0),
  moveFileToTrash: jest.fn(),
  readFileAsArrayBuffer: jest.fn(),
  renameFitsFile: jest.fn(),
  restoreFileFromTrash: jest.fn(),
  generateFileId: jest.fn(() => "generated"),
  scanDirectoryForSupportedImages: jest.fn(() => []),
  getTempExtractDir: jest.fn(),
  cleanTempExtractDir: jest.fn(),
}));

const makeFile = (id: string, filepath?: string): FitsMetadata => ({
  id,
  filename: `${id}.fits`,
  filepath: filepath ?? `file:///document/fits_files/${id}.fits`,
  fileSize: 100,
  importDate: Date.now(),
  frameType: "light",
  isFavorite: false,
  tags: [],
  albumIds: [],
});

const makeTrash = (id: string, overrides: Partial<TrashedFitsRecord> = {}): TrashedFitsRecord => ({
  trashId: `trash-${id}`,
  file: makeFile(id),
  originalFilepath: `file:///document/fits_files/${id}.fits`,
  trashedFilepath: `file:///document/fits_trash/${id}.fits`,
  deletedAt: Date.now(),
  expireAt: Date.now() + 60_000,
  groupIds: [],
  ...overrides,
});

describe("useFileManager", () => {
  const fsMock = require("expo-file-system") as {
    __mock: {
      reset: () => void;
      seedFile: (uri: string) => void;
      markDeleteFailure: (uri: string) => void;
      hasFile: (uri: string) => boolean;
    };
  };

  const thumbnailCacheMock = require("../../lib/gallery/thumbnailCache") as {
    deleteThumbnails: jest.Mock;
  };

  const sharingMock = require("expo-sharing") as {
    isAvailableAsync: jest.Mock;
    shareAsync: jest.Mock;
  };

  const zipMock = require("react-native-zip-archive") as {
    zip: jest.Mock;
  };
  const parserMock = require("../../lib/fits/parser") as {
    loadScientificFitsFromBuffer: jest.Mock;
    extractMetadata: jest.Mock;
  };
  const fitsJsMock = require("fitsjs-ng") as {
    convertHiPSToFITS: jest.Mock;
  };
  const fileManagerMock = require("../../lib/utils/fileManager") as {
    importFile: jest.Mock;
    readFileAsArrayBuffer: jest.Mock;
    renameFitsFile: jest.Mock;
    moveFileToTrash: jest.Mock;
    restoreFileFromTrash: jest.Mock;
  };
  const rasterParserMock = require("../../lib/image/rasterParser") as {
    extractRasterMetadata: jest.Mock;
    parseRasterFromBufferAsync: jest.Mock;
  };
  const documentPickerMock = require("expo-document-picker") as {
    getDocumentAsync: jest.Mock;
  };
  const imagePickerMock = require("expo-image-picker") as {
    requestMediaLibraryPermissionsAsync: jest.Mock;
    requestCameraPermissionsAsync: jest.Mock;
    launchImageLibraryAsync: jest.Mock;
    launchCameraAsync: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fsMock.__mock.reset();
    useTrashStore.setState({ items: [] });
    useFitsStore.setState({
      files: [],
      selectedIds: [],
      isSelectionMode: false,
      sortBy: "date",
      sortOrder: "desc",
      searchQuery: "",
      filterTags: [],
    });
    useSessionStore.setState({
      sessions: [],
      logEntries: [],
      plans: [],
      activeSession: null,
    });
    sharingMock.isAvailableAsync.mockResolvedValue(true);
    imagePickerMock.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    imagePickerMock.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    imagePickerMock.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });
    imagePickerMock.launchCameraAsync.mockResolvedValue({ canceled: true, assets: [] });
    fileManagerMock.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(8));
    fileManagerMock.importFile.mockImplementation((_uri: string, name: string) => ({
      uri: `file:///document/fits_files/${name}`,
      exists: true,
      delete: jest.fn(),
      arrayBuffer: jest.fn(async () => new ArrayBuffer(8)),
    }));
    fileManagerMock.renameFitsFile.mockReturnValue({
      success: false,
      filepath: "",
      filename: "",
    });
    parserMock.loadScientificFitsFromBuffer.mockResolvedValue({ fits: true });
    fitsJsMock.convertHiPSToFITS.mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer);
    parserMock.extractMetadata.mockReturnValue({
      frameType: "darkflat",
      frameTypeSource: "header",
      imageTypeRaw: "DarkFlat",
      frameHeaderRaw: "DarkFlat",
    });
    rasterParserMock.parseRasterFromBufferAsync.mockResolvedValue({
      width: 2,
      height: 2,
      depth: 1,
      bitDepth: 8,
      rgba: new Uint8Array([255, 255, 255, 255]),
      pixels: new Float32Array([0.5, 0.5, 0.5, 0.5]),
      channels: null,
      headers: [],
      decodeStatus: "ready",
      decodeError: undefined,
    });
    rasterParserMock.extractRasterMetadata.mockReturnValue({
      filename: "raster.png",
      filepath: "file:///document/fits_files/raster.png",
      fileSize: 8,
      bitpix: 8,
      naxis: 2,
      naxis1: 2,
      naxis2: 2,
      naxis3: 1,
      frameType: "light",
      frameTypeSource: "filename",
      decodeStatus: "ready",
      decodeError: undefined,
    });
    documentPickerMock.getDocumentAsync.mockResolvedValue({
      canceled: true,
      assets: [],
    });
  });

  it("keeps undeleted trash entries when emptying partially fails", () => {
    const first = makeTrash("a");
    const second = makeTrash("b");
    fsMock.__mock.seedFile(first.trashedFilepath);
    fsMock.__mock.seedFile(second.trashedFilepath);
    fsMock.__mock.markDeleteFailure(second.trashedFilepath);
    useTrashStore.setState({ items: [first, second] });

    const { result } = renderHook(() => useFileManager());

    let actionResult: { deleted: number; failed: number } | null = null;
    act(() => {
      actionResult = result.current.emptyTrash();
    });

    expect(actionResult).toEqual({ deleted: 1, failed: 1 });
    expect(useTrashStore.getState().items.map((item) => item.trashId)).toEqual([second.trashId]);
    expect(thumbnailCacheMock.deleteThumbnails).toHaveBeenCalledWith([first.file.id]);
    expect(fsMock.__mock.hasFile(first.trashedFilepath)).toBe(false);
    expect(fsMock.__mock.hasFile(second.trashedFilepath)).toBe(true);
  });

  it("cleans stale trash records when trashed files are already missing", () => {
    const stale = makeTrash("stale");
    useTrashStore.setState({ items: [stale] });

    const { result } = renderHook(() => useFileManager());

    let actionResult: { deleted: number; failed: number } | null = null;
    act(() => {
      actionResult = result.current.emptyTrash();
    });

    expect(actionResult).toEqual({ deleted: 1, failed: 0 });
    expect(useTrashStore.getState().items).toEqual([]);
    expect(thumbnailCacheMock.deleteThumbnails).toHaveBeenCalledWith([stale.file.id]);
  });

  it("reconciles session metadata when linked files are deleted", () => {
    const fileA = {
      ...makeFile("f-a"),
      sessionId: "session-1",
      dateObs: "2025-01-01T20:00:00.000Z",
      object: "M42",
      telescope: "Telescope A",
      instrument: "Camera A",
      filter: "Ha",
      location: {
        latitude: 10,
        longitude: 20,
        placeName: "Site A",
      },
    };
    const fileB = {
      ...makeFile("f-b"),
      sessionId: "session-1",
      dateObs: "2025-01-01T20:10:00.000Z",
      object: "M31",
      telescope: "Telescope B",
      instrument: "Camera B",
      filter: "OIII",
      location: {
        latitude: 30,
        longitude: 40,
        placeName: "Site B",
      },
    };
    useFitsStore.setState({ files: [fileA, fileB] });
    useSessionStore.setState({
      sessions: [
        {
          id: "session-1",
          date: "2025-01-01",
          startTime: 1735761600000,
          endTime: 1735765200000,
          duration: 3600,
          targetRefs: [{ name: "M42" }, { name: "M31" }],
          imageIds: ["f-a", "f-b"],
          equipment: { telescope: "Mixed", camera: "Mixed", filters: ["Ha", "OIII"] },
          location: { latitude: 30, longitude: 40, placeName: "Site B" },
          createdAt: Date.now(),
        },
      ],
      logEntries: [
        {
          id: "log_f-a",
          sessionId: "session-1",
          imageId: "f-a",
          dateTime: "2025-01-01T20:00:00.000Z",
          object: "M42",
          filter: "Ha",
          exptime: 120,
        },
        {
          id: "log_f-b",
          sessionId: "session-1",
          imageId: "f-b",
          dateTime: "2025-01-01T20:10:00.000Z",
          object: "M31",
          filter: "OIII",
          exptime: 120,
        },
      ],
    });

    fileManagerMock.moveFileToTrash.mockImplementation((filepath: string, filename: string) => ({
      success: true,
      filepath: filepath.replace("/fits_files/", "/fits_trash/"),
      filename,
    }));

    const { result } = renderHook(() => useFileManager());
    act(() => {
      result.current.handleDeleteFiles(["f-b"]);
    });

    const state = useSessionStore.getState();
    expect(useFitsStore.getState().files.map((file) => file.id)).toEqual(["f-a"]);
    expect(state.sessions[0].imageIds).toEqual(["f-a"]);
    expect(state.sessions[0].targetRefs).toEqual([{ name: "M42" }]);
    expect(state.sessions[0].equipment).toEqual({
      telescope: "Telescope A",
      camera: "Camera A",
      filters: ["Ha"],
    });
    expect(state.sessions[0].location).toEqual({
      latitude: 10,
      longitude: 20,
      placeName: "Site A",
    });
    expect(state.logEntries.map((entry) => entry.imageId)).toEqual(["f-a"]);
  });

  it("reconciles session metadata and avoids duplicate logs after restore", () => {
    const fileA = {
      ...makeFile("f-a"),
      sessionId: "session-restore",
      dateObs: "2025-01-01T20:00:00.000Z",
      object: "M42",
      telescope: "Telescope A",
      instrument: "Camera A",
      filter: "Ha",
      location: {
        latitude: 10,
        longitude: 20,
        placeName: "Site A",
      },
    };
    const restoredFile = {
      ...makeFile("f-b"),
      sessionId: "session-restore",
      dateObs: "2025-01-01T20:10:00.000Z",
      object: "M31",
      telescope: "Telescope B",
      instrument: "Camera B",
      filter: "OIII",
      location: {
        latitude: 10,
        longitude: 20,
        placeName: "Site A",
      },
    };
    useFitsStore.setState({ files: [fileA] });
    useSessionStore.setState({
      sessions: [
        {
          id: "session-restore",
          date: "2025-01-01",
          startTime: 1735761600000,
          endTime: 1735765200000,
          duration: 3600,
          targetRefs: [{ name: "M42" }],
          imageIds: ["f-a"],
          equipment: { telescope: "Telescope A", camera: "Camera A", filters: ["Ha"] },
          location: { latitude: 10, longitude: 20, placeName: "Site A" },
          createdAt: Date.now(),
        },
      ],
      logEntries: [
        {
          id: "log_f-a",
          sessionId: "session-restore",
          imageId: "f-a",
          dateTime: "2025-01-01T20:00:00.000Z",
          object: "M42",
          filter: "Ha",
          exptime: 120,
        },
      ],
    });

    const trashItem = makeTrash("f-b", {
      trashId: "trash-f-b",
      file: restoredFile,
      originalFilepath: restoredFile.filepath,
      trashedFilepath: "file:///document/fits_trash/f-b.fits",
    });
    useTrashStore.setState({ items: [trashItem] });
    fileManagerMock.restoreFileFromTrash.mockReturnValue({
      success: true,
      filepath: restoredFile.filepath,
      filename: restoredFile.filename,
    });

    const { result } = renderHook(() => useFileManager());
    act(() => {
      result.current.restoreFromTrash(["trash-f-b"]);
    });

    const state = useSessionStore.getState();
    expect(
      useFitsStore
        .getState()
        .files.map((file) => file.id)
        .sort(),
    ).toEqual(["f-a", "f-b"]);
    expect(state.sessions[0].imageIds.sort()).toEqual(["f-a", "f-b"]);
    expect(state.sessions[0].targetRefs).toEqual([{ name: "M42" }, { name: "M31" }]);
    expect(state.sessions[0].equipment).toEqual({
      telescope: "Telescope A",
      camera: "Camera A",
      filters: ["Ha", "OIII"],
    });
    const logIds = state.logEntries
      .filter((entry) => entry.sessionId === "session-restore")
      .map((entry) => entry.id);
    expect(new Set(logIds).size).toBe(logIds.length);
    expect(logIds.sort()).toEqual(["log_f-a", "log_f-b"]);
  });

  it("reports export failures without double counting when zip/share fails", async () => {
    const first = makeFile("f1", "file:///document/fits_files/f1.fits");
    const second = makeFile("f2", "file:///document/fits_files/f2.fits");
    useFitsStore.setState({ files: [first, second] });
    fsMock.__mock.seedFile(first.filepath);
    zipMock.zip.mockRejectedValueOnce(new Error("zip failed"));

    const { result } = renderHook(() => useFileManager());

    let exportResult:
      | {
          success: boolean;
          exported: number;
          failed: number;
          shared: boolean;
          error?: string;
        }
      | undefined;

    await act(async () => {
      exportResult = await result.current.exportFiles([first.id, second.id]);
    });

    expect(exportResult).toEqual({
      success: false,
      exported: 1,
      failed: 1,
      shared: false,
      error: "zip failed",
    });
    expect(zipMock.zip).toHaveBeenCalledTimes(1);
    expect(sharingMock.shareAsync).not.toHaveBeenCalled();
  });

  it("returns shareUnavailable when sharing capability is unavailable", async () => {
    const file = makeFile("single", "file:///document/fits_files/single.fits");
    useFitsStore.setState({ files: [file] });
    sharingMock.isAvailableAsync.mockResolvedValue(false);

    const { result } = renderHook(() => useFileManager());
    let exportResult:
      | {
          success: boolean;
          exported: number;
          failed: number;
          shared: boolean;
          error?: string;
        }
      | undefined;

    await act(async () => {
      exportResult = await result.current.exportFiles([file.id]);
    });

    expect(exportResult).toEqual({
      success: false,
      exported: 0,
      failed: 1,
      shared: false,
      error: "shareUnavailable",
    });
  });

  it("sets import error when media library permission is denied", async () => {
    imagePickerMock.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ granted: false });

    const { result } = renderHook(() => useFileManager());
    await act(async () => {
      await result.current.pickAndImportFromMediaLibrary();
    });

    expect(result.current.importError).toBe("mediaLibraryPermissionDenied");
  });

  it("sets import error when camera permission is denied", async () => {
    imagePickerMock.requestCameraPermissionsAsync.mockResolvedValueOnce({ granted: false });

    const { result } = renderHook(() => useFileManager());
    await act(async () => {
      await result.current.recordAndImportVideo();
    });

    expect(result.current.importError).toBe("cameraPermissionDenied");
  });

  it("reclassifies existing files with current rules", async () => {
    useFitsStore.setState({
      files: [
        makeFile("fits-1", "file:///document/fits_files/fits-1.fits"),
        makeFile("raster-1", "file:///document/fits_files/darkflat_image.png"),
      ].map((file, index) =>
        index === 0
          ? { ...file, sourceType: "fits", frameType: "unknown" as const }
          : {
              ...file,
              sourceType: "raster",
              filename: "darkflat_image.png",
              frameType: "unknown" as const,
            },
      ),
    });

    const { result } = renderHook(() => useFileManager());
    let summary:
      | {
          total: number;
          success: number;
          failed: number;
          updated: number;
          failedEntries: Array<{ id: string; filename: string; reason: string }>;
        }
      | undefined;

    await act(async () => {
      summary = await result.current.reclassifyAllFrames();
    });

    expect(summary).toBeDefined();
    expect(summary?.total).toBe(2);
    expect(summary?.failed).toBe(0);
    expect(summary?.updated).toBeGreaterThanOrEqual(1);
    const [fitsFile, rasterFile] = useFitsStore.getState().files;
    expect(fitsFile.frameType).toBe("darkflat");
    expect(fitsFile.frameTypeSource).toBe("header");
    expect(rasterFile.frameType).toBe("darkflat");
    expect(rasterFile.frameTypeSource).toBe("filename");
  });

  it("returns failed entries when reclassification throws", async () => {
    useFitsStore.setState({
      files: [
        {
          ...makeFile("fits-fail", "file:///document/fits_files/fits-fail.fits"),
          sourceType: "fits",
        },
        {
          ...makeFile("raster-ok", "file:///document/fits_files/darkflat_ok.png"),
          sourceType: "raster",
          filename: "darkflat_ok.png",
          frameType: "unknown" as const,
        },
      ],
    });
    fileManagerMock.readFileAsArrayBuffer.mockImplementation(async (filepath: string) => {
      if (filepath.includes("fits-fail")) {
        throw new Error("read failed");
      }
      return new ArrayBuffer(8);
    });

    const { result } = renderHook(() => useFileManager());
    let summary:
      | {
          total: number;
          success: number;
          failed: number;
          updated: number;
          failedEntries: Array<{ id: string; filename: string; reason: string }>;
        }
      | undefined;

    await act(async () => {
      summary = await result.current.reclassifyAllFrames();
    });

    expect(summary).toBeDefined();
    expect(summary?.total).toBe(2);
    expect(summary?.failed).toBe(1);
    expect(summary?.success).toBe(1);
    expect(summary?.failedEntries).toEqual([
      expect.objectContaining({
        id: "fits-fail",
        filename: "fits-fail.fits",
        reason: "read failed",
      }),
    ]);
    const [, rasterFile] = useFitsStore.getState().files;
    expect(rasterFile.frameType).toBe("darkflat");
    expect(rasterFile.frameTypeSource).toBe("filename");
  });

  it("keeps TIFF record when decode fails with explicit error", async () => {
    const importedFile = {
      uri: "file:///document/fits_files/bad.tiff",
      exists: true,
      delete: jest.fn(),
      arrayBuffer: jest.fn(
        async () => new Uint8Array([0x49, 0x49, 0x2b, 0x00, 0x08, 0x00, 0x00, 0x00]).buffer,
      ),
    };
    fileManagerMock.importFile.mockReturnValue(importedFile);
    rasterParserMock.parseRasterFromBufferAsync.mockRejectedValue(
      new Error("Unsupported TIFF photometric: 6"),
    );
    rasterParserMock.extractRasterMetadata.mockImplementation(
      (
        fileInfo: { filename: string; filepath: string; fileSize: number },
        _dims: { width: number; height: number; depth?: number; bitDepth?: number },
        _cfg: unknown,
        options?: { decodeStatus?: "ready" | "failed"; decodeError?: string },
      ) => ({
        ...fileInfo,
        bitpix: 8,
        naxis: 2,
        naxis1: 0,
        naxis2: 0,
        naxis3: 1,
        frameType: "unknown",
        frameTypeSource: "filename",
        decodeStatus: options?.decodeStatus ?? "ready",
        decodeError: options?.decodeError,
      }),
    );
    documentPickerMock.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: "file:///source/bad.tiff", name: "bad.tiff", size: 8, mimeType: "image/tiff" },
      ],
    });

    const { result } = renderHook(() => useFileManager());
    await act(async () => {
      await result.current.pickAndImportFile();
    });

    const [file] = useFitsStore.getState().files;
    expect(file).toEqual(
      expect.objectContaining({
        filename: "bad.tiff",
        sourceType: "raster",
        sourceFormat: "tiff",
        decodeStatus: "failed",
        decodeError: "Unsupported TIFF photometric: 6",
      }),
    );
    expect(result.current.lastImportResult).toEqual(
      expect.objectContaining({
        success: 1,
        failed: 0,
      }),
    );
    expect(importedFile.delete).not.toHaveBeenCalled();
    expect(rasterParserMock.extractRasterMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "bad.tiff" }),
      expect.objectContaining({ width: 0, height: 0, depth: 1 }),
      expect.anything(),
      expect.objectContaining({
        decodeStatus: "failed",
        decodeError: "Unsupported TIFF photometric: 6",
      }),
    );
  });

  it("returns validation error for HiPS URL missing ra/dec/fov", async () => {
    const { result } = renderHook(() => useFileManager());
    await act(async () => {
      await result.current.importFromUrl("https://example.com/hips?hips=1&dec=22.01&fov=1.2");
    });

    expect(result.current.importError).toContain("requires ra");
    expect(useFitsStore.getState().files).toHaveLength(0);
  });

  it("imports HiPS cutout URL and tags source format as hips", async () => {
    const { result } = renderHook(() => useFileManager());
    await act(async () => {
      await result.current.importFromUrl(
        "https://example.com/hips?hips=1&source=https%3A%2F%2Fhips.example.org%2Fsurvey&ra=83.63&dec=22.01&fov=1.2&width=320&height=240",
      );
    });

    expect(fitsJsMock.convertHiPSToFITS).toHaveBeenCalledWith(
      "https://hips.example.org/survey",
      expect.objectContaining({
        cutout: expect.objectContaining({
          ra: 83.63,
          dec: 22.01,
          fov: 1.2,
          width: 320,
          height: 240,
        }),
      }),
    );
    const [file] = useFitsStore.getState().files;
    expect(file).toEqual(
      expect.objectContaining({
        sourceType: "fits",
        sourceFormat: "hips",
        mediaKind: "image",
      }),
    );
  });
});
