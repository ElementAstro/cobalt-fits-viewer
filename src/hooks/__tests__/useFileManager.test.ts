import { act, renderHook } from "@testing-library/react-native";
import type { FitsMetadata, TrashedFitsRecord } from "../../lib/fits/types";
import { useFileManager } from "../useFileManager";
import { useFitsStore } from "../../stores/useFitsStore";
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
  loadFitsFromBufferAuto: jest.fn(),
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
}));

jest.mock("../../lib/image/rasterParser", () => ({
  extractRasterMetadata: jest.fn(),
  parseRasterFromBuffer: jest.fn(),
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
    loadFitsFromBufferAuto: jest.Mock;
    extractMetadata: jest.Mock;
  };
  const fileManagerMock = require("../../lib/utils/fileManager") as {
    readFileAsArrayBuffer: jest.Mock;
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
    sharingMock.isAvailableAsync.mockResolvedValue(true);
    imagePickerMock.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    imagePickerMock.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    imagePickerMock.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });
    imagePickerMock.launchCameraAsync.mockResolvedValue({ canceled: true, assets: [] });
    fileManagerMock.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(8));
    parserMock.loadFitsFromBufferAuto.mockReturnValue({ fits: true });
    parserMock.extractMetadata.mockReturnValue({
      frameType: "darkflat",
      frameTypeSource: "header",
      imageTypeRaw: "DarkFlat",
      frameHeaderRaw: "DarkFlat",
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
});
