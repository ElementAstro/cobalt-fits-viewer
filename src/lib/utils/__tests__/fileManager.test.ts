import {
  renameFitsFile,
  isSupportedImageFile,
  listImportedImageFiles,
  getStorageStats,
  scanDirectoryForSupportedImages,
} from "../fileManager";
import type { Directory as ExpoDirectory } from "expo-file-system";

jest.mock("expo-file-system", () => {
  const files = new Map<string, number>();
  const directories = new Set<string>([
    "file:///document",
    "file:///document/fits_files",
    "file:///cache",
  ]);

  const normalize = (value: string) => value.replace(/\/+$/, "");
  const dirname = (value: string) => value.slice(0, value.lastIndexOf("/"));
  const join = (base: string, name: string) => `${normalize(base)}/${name}`;

  class MockFile {
    uri: string;
    name: string;

    constructor(parentOrPath: unknown, name?: string) {
      if (name !== undefined) {
        const base =
          typeof parentOrPath === "string" ? parentOrPath : (parentOrPath as { uri: string }).uri;
        this.uri = join(String(base), String(name));
      } else {
        this.uri = normalize(String(parentOrPath));
      }
      this.name = this.uri.split("/").pop() ?? "";
    }

    get exists() {
      return files.has(this.uri);
    }

    get size() {
      return files.get(this.uri);
    }

    copy(dest: MockFile) {
      if (!this.exists) {
        throw new Error("Source file does not exist.");
      }
      directories.add(dirname(dest.uri));
      files.set(dest.uri, this.size ?? 0);
    }

    delete() {
      files.delete(this.uri);
    }

    arrayBuffer() {
      return Promise.resolve(new ArrayBuffer(0));
    }
  }

  class MockDirectory {
    uri: string;
    name: string;

    constructor(parentOrPath: unknown, name?: string) {
      if (name !== undefined) {
        const base =
          typeof parentOrPath === "string" ? parentOrPath : (parentOrPath as { uri: string }).uri;
        this.uri = join(String(base), String(name));
      } else {
        this.uri = normalize(String(parentOrPath));
      }
      this.name = this.uri.split("/").pop() ?? "";
    }

    get exists() {
      return directories.has(this.uri);
    }

    create() {
      directories.add(this.uri);
    }

    delete() {
      directories.delete(this.uri);
      const filePrefix = `${this.uri}/`;
      for (const fileUri of [...files.keys()]) {
        if (fileUri.startsWith(filePrefix)) files.delete(fileUri);
      }
      for (const dirUri of [...directories]) {
        if (dirUri.startsWith(filePrefix)) directories.delete(dirUri);
      }
    }

    list() {
      const children: Array<MockFile | MockDirectory> = [];
      const prefix = `${this.uri}/`;

      for (const fileUri of files.keys()) {
        if (!fileUri.startsWith(prefix)) continue;
        const rest = fileUri.slice(prefix.length);
        if (rest.includes("/")) continue;
        children.push(new MockFile(fileUri));
      }

      for (const dirUri of directories) {
        if (dirUri === this.uri || !dirUri.startsWith(prefix)) continue;
        const rest = dirUri.slice(prefix.length);
        if (rest.includes("/")) continue;
        children.push(new MockDirectory(dirUri));
      }

      return children;
    }
  }

  return {
    Paths: {
      document: "file:///document",
      cache: "file:///cache",
    },
    File: MockFile,
    Directory: MockDirectory,
    __mock: {
      reset: () => {
        files.clear();
        directories.clear();
        directories.add("file:///document");
        directories.add("file:///document/fits_files");
        directories.add("file:///cache");
      },
      seedDirectory: (uri: string) => {
        const normalized = normalize(uri);
        const parts = normalized.split("/");
        if (parts.length < 4) {
          directories.add(normalized);
          return;
        }
        // Keep URI root (e.g. file://) and progressively add path segments
        let current = `${parts[0]}//${parts[2]}`;
        for (let i = 3; i < parts.length; i++) {
          current = `${current}/${parts[i]}`;
          directories.add(current);
        }
      },
      seedFile: (uri: string, size = 1) => {
        const normalized = normalize(uri);
        directories.add(dirname(normalized));
        files.set(normalized, size);
      },
      hasFile: (uri: string) => files.has(normalize(uri)),
    },
  };
});

describe("fileManager.renameFitsFile", () => {
  const fsMock = require("expo-file-system") as {
    __mock: {
      reset: () => void;
      seedDirectory: (uri: string) => void;
      seedFile: (uri: string, size?: number) => void;
      hasFile: (uri: string) => boolean;
    };
  };

  beforeEach(() => {
    fsMock.__mock.reset();
  });

  it("returns failure when source file does not exist", () => {
    const result = renameFitsFile("file:///document/fits_files/missing.fits", "next.fits");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("renames file and preserves original extension when missing target extension", () => {
    const source = "file:///document/fits_files/original.fits";
    fsMock.__mock.seedFile(source, 12);

    const result = renameFitsFile(source, "renamed");
    expect(result.success).toBe(true);
    expect(result.filename).toBe("renamed.fits");
    expect(result.filepath).toBe("file:///document/fits_files/renamed.fits");
    expect(fsMock.__mock.hasFile(source)).toBe(false);
    expect(fsMock.__mock.hasFile(result.filepath)).toBe(true);
  });

  it("avoids collision by appending timestamp", () => {
    const source = "file:///document/fits_files/source.fits";
    const conflict = "file:///document/fits_files/target.fits";
    fsMock.__mock.seedFile(source, 10);
    fsMock.__mock.seedFile(conflict, 22);

    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1700000000000);
    const result = renameFitsFile(source, "target.fits");
    nowSpy.mockRestore();

    expect(result.success).toBe(true);
    expect(result.filename).toBe("target_1700000000000.fits");
    expect(result.filepath).toBe("file:///document/fits_files/target_1700000000000.fits");
    expect(fsMock.__mock.hasFile(conflict)).toBe(true);
    expect(fsMock.__mock.hasFile(result.filepath)).toBe(true);
  });

  it("sanitizes illegal characters in target filename", () => {
    const source = "file:///document/fits_files/source.fits";
    fsMock.__mock.seedFile(source, 10);

    const result = renameFitsFile(source, "bad:name?.fits");
    expect(result.success).toBe(true);
    expect(result.filename).toBe("bad_name_.fits");
    expect(result.filepath).toBe("file:///document/fits_files/bad_name_.fits");
  });
});

describe("fileManager image format support", () => {
  const fsMock = require("expo-file-system") as {
    __mock: {
      reset: () => void;
      seedDirectory: (uri: string) => void;
      seedFile: (uri: string, size?: number) => void;
    };
    Directory: new (path: string) => ExpoDirectory;
  };

  beforeEach(() => {
    fsMock.__mock.reset();
  });

  it("recognizes supported image formats", () => {
    expect(isSupportedImageFile("image.fits.gz")).toBe(true);
    expect(isSupportedImageFile("image.fit.gz")).toBe(true);
    expect(isSupportedImageFile("image.jpg")).toBe(true);
    expect(isSupportedImageFile("image.tiff")).toBe(true);
    expect(isSupportedImageFile("image.txt")).toBe(false);
  });

  it("lists imported supported image files and excludes unsupported files", () => {
    fsMock.__mock.seedFile("file:///document/fits_files/light_001.fits", 100);
    fsMock.__mock.seedFile("file:///document/fits_files/preview.png", 50);
    fsMock.__mock.seedFile("file:///document/fits_files/readme.txt", 20);

    const listed = listImportedImageFiles()
      .map((f) => f.name)
      .sort();
    expect(listed).toEqual(["light_001.fits", "preview.png"]);

    const stats = getStorageStats();
    expect(stats.fitsCount).toBe(2);
    expect(stats.fitsSize).toBe(150);
  });

  it("recursively scans supported images in nested directories", () => {
    fsMock.__mock.seedDirectory("file:///cache/import_batch");
    fsMock.__mock.seedDirectory("file:///cache/import_batch/sub");
    fsMock.__mock.seedFile("file:///cache/import_batch/M42.fits", 10);
    fsMock.__mock.seedFile("file:///cache/import_batch/readme.md", 10);
    fsMock.__mock.seedFile("file:///cache/import_batch/sub/M31.jpg", 10);
    fsMock.__mock.seedFile("file:///cache/import_batch/sub/archive.fit.gz", 10);

    const rootDir = new fsMock.Directory("file:///cache/import_batch");
    const names = scanDirectoryForSupportedImages(rootDir)
      .map((f) => f.name)
      .sort();
    expect(names).toEqual(["M31.jpg", "M42.fits", "archive.fit.gz"]);
  });
});
