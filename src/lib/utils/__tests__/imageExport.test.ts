const mockSharing = {
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
};

const mockMediaLibrary = {
  requestPermissionsAsync: jest.fn(),
  createAssetAsync: jest.fn(),
};

const mockPlatform = { OS: "ios" };

const mockDirs = new Set<string>();
const mockFiles = new Map<string, { throwOnDelete?: boolean }>();
const mockListShouldThrow = { value: false };
const mockDirDeleteShouldThrow = { value: false };

function mockNormalize(base: string, child?: string): string {
  const joined = child ? `${base}/${child}` : base;
  return joined.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function loadImageExportModule() {
  jest.resetModules();

  jest.doMock("expo-sharing", () => ({
    __esModule: true,
    ...mockSharing,
  }));

  jest.doMock("expo-media-library", () => ({
    __esModule: true,
    ...mockMediaLibrary,
  }));

  jest.doMock("react-native", () => ({
    Platform: mockPlatform,
  }));

  jest.doMock("expo-file-system", () => {
    const mockFileClass = class {
      uri: string;

      constructor(base: string | { uri: string }, name?: string) {
        if (typeof base === "string") {
          this.uri = mockNormalize(base, name);
        } else {
          this.uri = mockNormalize(base.uri, name);
        }
      }

      delete() {
        const meta = mockFiles.get(this.uri);
        if (meta?.throwOnDelete) {
          throw new Error("delete failed");
        }
        mockFiles.delete(this.uri);
      }
    };

    const mockDirectoryClass = class {
      uri: string;

      constructor(base: string | { uri: string }, name?: string) {
        if (typeof base === "string") {
          this.uri = mockNormalize(base, name);
        } else {
          this.uri = mockNormalize(base.uri, name);
        }
      }

      get exists() {
        return mockDirs.has(this.uri);
      }

      create() {
        mockDirs.add(this.uri);
      }

      delete() {
        if (mockDirDeleteShouldThrow.value) {
          throw new Error("dir delete failed");
        }

        const prefix = `${this.uri}/`;
        for (const filePath of [...mockFiles.keys()]) {
          if (filePath === this.uri || filePath.startsWith(prefix)) {
            mockFiles.delete(filePath);
          }
        }
        mockDirs.delete(this.uri);
      }

      list() {
        if (mockListShouldThrow.value) {
          throw new Error("list failed");
        }

        const prefix = `${this.uri}/`;
        const items: Array<InstanceType<typeof mockFileClass>> = [];
        for (const filePath of mockFiles.keys()) {
          if (!filePath.startsWith(prefix)) continue;
          const tail = filePath.slice(prefix.length);
          if (!tail || tail.includes("/")) continue;
          items.push(new mockFileClass(filePath));
        }
        return items;
      }
    };

    return {
      __esModule: true,
      Paths: { cache: "/cache" },
      Directory: mockDirectoryClass,
      File: mockFileClass,
    };
  });

  return require("../imageExport") as {
    ShareNotAvailableError: new () => Error;
    MediaPermissionDeniedError: new () => Error;
    getExportDir: () => { uri: string };
    generateExportFilename: (originalName: string, format: string) => string;
    shareFile: (fileUri: string, options?: any) => Promise<void>;
    saveToMediaLibrary: (fileUri: string) => Promise<string>;
    getMimeType: (format: string) => string;
    getExtension: (format: string) => string;
    getUTI: (format: string) => string;
    cleanExportDir: () => void;
    cleanOldExports: () => void;
  };
}

describe("imageExport", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPlatform.OS = "ios";

    mockDirs.clear();
    mockFiles.clear();
    mockListShouldThrow.value = false;
    mockDirDeleteShouldThrow.value = false;

    mockSharing.isAvailableAsync.mockResolvedValue(true);
    mockSharing.shareAsync.mockResolvedValue(undefined);

    mockMediaLibrary.requestPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockMediaLibrary.createAssetAsync.mockResolvedValue({ uri: "asset://1" });
  });

  it("creates export directory and generates export filename", () => {
    const mod = loadImageExportModule();

    const dir = mod.getExportDir();
    expect(dir.uri).toBe("/cache/fits_exports");
    expect(mockDirs.has("/cache/fits_exports")).toBe(true);

    expect(mod.generateExportFilename("m42.fits", "jpeg")).toBe("m42_export.jpeg");
    expect(mod.generateExportFilename("m42", "png")).toBe("m42_export.png");
  });

  it("throws ShareNotAvailableError when sharing is unavailable", async () => {
    const mod = loadImageExportModule();

    mockSharing.isAvailableAsync.mockResolvedValue(false);
    await expect(mod.shareFile("/tmp/a.png")).rejects.toBeInstanceOf(mod.ShareNotAvailableError);
  });

  it("shares with mapped mime/UTI and iOS anchor", async () => {
    const mod = loadImageExportModule();

    await mod.shareFile("/tmp/a.png", {
      format: "png",
      filename: "export-a",
      anchor: { x: 1, y: 2, width: 3, height: 4 },
    });

    expect(mockSharing.shareAsync).toHaveBeenCalledWith(
      "/tmp/a.png",
      expect.objectContaining({
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: "export-a",
        anchor: { x: 1, y: 2, width: 3, height: 4 },
      }),
    );

    mockPlatform.OS = "android";
    await mod.shareFile("/tmp/b.jpg", {
      format: "jpeg",
      anchor: { x: 9, y: 9, width: 9, height: 9 },
    });

    const androidOptions = mockSharing.shareAsync.mock.calls[1][1] as Record<string, unknown>;
    expect(androidOptions.anchor).toBeUndefined();
  });

  it("saves to media library and handles permission denial", async () => {
    const mod = loadImageExportModule();

    await expect(mod.saveToMediaLibrary("/tmp/a.png")).resolves.toBe("asset://1");
    expect(mockMediaLibrary.createAssetAsync).toHaveBeenCalledWith("/tmp/a.png");

    mockMediaLibrary.requestPermissionsAsync.mockResolvedValue({ status: "denied" });
    await expect(mod.saveToMediaLibrary("/tmp/b.png")).rejects.toBeInstanceOf(
      mod.MediaPermissionDeniedError,
    );
  });

  it("maps mime type, extension, and UTI", () => {
    const mod = loadImageExportModule();

    expect(mod.getMimeType("png")).toBe("image/png");
    expect(mod.getMimeType("jpeg")).toBe("image/jpeg");
    expect(mod.getMimeType("webp")).toBe("image/webp");
    expect(mod.getMimeType("tiff")).toBe("image/tiff");
    expect(mod.getMimeType("bmp")).toBe("image/bmp");

    expect(mod.getExtension("jpeg")).toBe("jpg");
    expect(mod.getExtension("png")).toBe("png");

    expect(mod.getUTI("png")).toBe("public.png");
    expect(mod.getUTI("jpeg")).toBe("public.jpeg");
    expect(mod.getUTI("webp")).toBe("org.webmproject.webp");
    expect(mod.getUTI("tiff")).toBe("public.tiff");
    expect(mod.getUTI("bmp")).toBe("com.microsoft.bmp");
  });

  it("cleans export directory when present", () => {
    const mod = loadImageExportModule();

    mockDirs.add("/cache/fits_exports");
    mockFiles.set("/cache/fits_exports/a.png", {});

    mod.cleanExportDir();

    expect(mockDirs.has("/cache/fits_exports")).toBe(false);
    expect(mockFiles.has("/cache/fits_exports/a.png")).toBe(false);
  });

  it("cleans old exports and ignores per-file deletion errors", () => {
    const mod = loadImageExportModule();

    mockDirs.add("/cache/fits_exports");
    mockFiles.set("/cache/fits_exports/a.png", {});
    mockFiles.set("/cache/fits_exports/b.png", { throwOnDelete: true });

    mod.cleanOldExports();

    expect(mockFiles.has("/cache/fits_exports/a.png")).toBe(false);
    expect(mockFiles.has("/cache/fits_exports/b.png")).toBe(true);
  });

  it("falls back to deleting directory when listing throws", () => {
    const mod = loadImageExportModule();

    mockDirs.add("/cache/fits_exports");
    mockFiles.set("/cache/fits_exports/a.png", {});
    mockListShouldThrow.value = true;

    mod.cleanOldExports();

    expect(mockDirs.has("/cache/fits_exports")).toBe(false);
    expect(mockFiles.has("/cache/fits_exports/a.png")).toBe(false);
  });
});
