import {
  checkFileSystemIntegrity,
  repairGhostRecords,
  repairOrphanFiles,
  repairTrashGhosts,
} from "../fileSystemIntegrity";
import type { FitsMetadata, TrashedFitsRecord } from "../../fits/types";

jest.mock("../../targets/targetIntegrity", () => ({
  reconcileAllStores: jest.fn(),
}));

jest.mock("../../gallery/thumbnailCache", () => ({
  deleteThumbnails: jest.fn(),
}));

jest.mock("../../../stores/files/useFitsStore", () => {
  let mockFiles: FitsMetadata[] = [];
  return {
    useFitsStore: {
      getState: () => ({
        files: mockFiles,
        removeFiles: (ids: string[]) => {
          const idSet = new Set(ids);
          mockFiles = mockFiles.filter((f) => !idSet.has(f.id));
        },
      }),
      setState: (updater: (state: { files: FitsMetadata[] }) => { files: FitsMetadata[] }) => {
        const result = updater({ files: mockFiles });
        mockFiles = result.files;
      },
    },
    __setFiles: (next: FitsMetadata[]) => {
      mockFiles = next;
    },
    __getFiles: () => mockFiles,
  };
});

jest.mock("../../../stores/files/useTrashStore", () => {
  let mockItems: TrashedFitsRecord[] = [];
  return {
    useTrashStore: {
      getState: () => ({
        items: mockItems,
        removeByTrashIds: (ids: string[]) => {
          const idSet = new Set(ids);
          mockItems = mockItems.filter((item) => !idSet.has(item.trashId));
        },
      }),
    },
    __setItems: (next: TrashedFitsRecord[]) => {
      mockItems = next;
    },
    __getItems: () => mockItems,
  };
});

const mockExistingFiles = new Set<string>();
const mockExistingDirs = new Set<string>([
  "file:///document/fits_files",
  "file:///document/fits_trash",
]);

jest.mock("expo-file-system", () => {
  const normalize = (value: string) => value.replace(/\/+$/, "");

  class MockFile {
    uri: string;
    name: string;

    constructor(parentOrPath: unknown, name?: string) {
      if (name !== undefined) {
        const base =
          typeof parentOrPath === "string" ? parentOrPath : (parentOrPath as { uri: string }).uri;
        this.uri = `${normalize(String(base))}/${name}`;
      } else {
        this.uri = normalize(String(parentOrPath));
      }
      this.name = this.uri.split("/").pop() ?? "";
    }

    get exists() {
      return mockExistingFiles.has(this.uri);
    }

    get size() {
      return this.exists ? 100 : 0;
    }

    delete() {
      mockExistingFiles.delete(this.uri);
    }
  }

  class MockDirectory {
    uri: string;

    constructor(parentOrPath: unknown, name?: string) {
      if (name !== undefined) {
        const base =
          typeof parentOrPath === "string" ? parentOrPath : (parentOrPath as { uri: string }).uri;
        this.uri = `${normalize(String(base))}/${name}`;
      } else {
        this.uri = normalize(String(parentOrPath));
      }
    }

    get exists() {
      return mockExistingDirs.has(this.uri);
    }

    create() {
      mockExistingDirs.add(this.uri);
    }

    list() {
      const prefix = `${this.uri}/`;
      const children: MockFile[] = [];
      for (const fileUri of mockExistingFiles) {
        if (!fileUri.startsWith(prefix)) continue;
        const rest = fileUri.slice(prefix.length);
        if (rest.includes("/")) continue;
        children.push(new MockFile(fileUri));
      }
      return children;
    }
  }

  return {
    Paths: { document: "file:///document", cache: "file:///cache" },
    File: MockFile,
    Directory: MockDirectory,
  };
});

function makeFile(id: string, filepath?: string): FitsMetadata {
  return {
    id,
    filename: `${id}.fits`,
    filepath: filepath ?? `file:///document/fits_files/${id}.fits`,
    fileSize: 100,
    importDate: Date.now(),
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
  } as FitsMetadata;
}

function makeTrash(id: string, overrides: Partial<TrashedFitsRecord> = {}): TrashedFitsRecord {
  return {
    trashId: `trash-${id}`,
    file: makeFile(id),
    originalFilepath: `file:///document/fits_files/${id}.fits`,
    trashedFilepath: `file:///document/fits_trash/${id}.fits`,
    deletedAt: Date.now(),
    expireAt: Date.now() + 60_000,
    groupIds: [],
    ...overrides,
  };
}

const fitsStoreMock = require("../../../stores/files/useFitsStore") as {
  __setFiles: (files: FitsMetadata[]) => void;
  __getFiles: () => FitsMetadata[];
};

const trashStoreMock = require("../../../stores/files/useTrashStore") as {
  __setItems: (items: TrashedFitsRecord[]) => void;
  __getItems: () => TrashedFitsRecord[];
};

describe("fileSystemIntegrity", () => {
  beforeEach(() => {
    mockExistingFiles.clear();
    fitsStoreMock.__setFiles([]);
    trashStoreMock.__setItems([]);
  });

  describe("checkFileSystemIntegrity", () => {
    it("reports ghost records when file does not exist on disk", () => {
      const file = makeFile("f1");
      // Do NOT seed mockExistingFiles for f1 → ghost
      const report = checkFileSystemIntegrity([file], []);
      expect(report.ghostRecords).toEqual(["f1"]);
      expect(report.orphanFiles).toEqual([]);
      expect(report.trashGhosts).toEqual([]);
    });

    it("reports no issues when all files exist", () => {
      const file = makeFile("f1");
      mockExistingFiles.add(file.filepath);
      const report = checkFileSystemIntegrity([file], []);
      expect(report.ghostRecords).toEqual([]);
      expect(report.orphanFiles).toEqual([]);
    });

    it("reports orphan files on disk not in store", () => {
      mockExistingFiles.add("file:///document/fits_files/orphan.fits");
      const report = checkFileSystemIntegrity([], []);
      expect(report.orphanFiles).toContain("file:///document/fits_files/orphan.fits");
    });

    it("reports trash ghosts when trashed file does not exist", () => {
      const trash = makeTrash("t1");
      // Do NOT seed mockExistingFiles for trash → ghost
      const report = checkFileSystemIntegrity([], [trash]);
      expect(report.trashGhosts).toEqual(["trash-t1"]);
    });

    it("does not report trash files as orphans if referenced in trashItems", () => {
      const trash = makeTrash("t1");
      mockExistingFiles.add(trash.trashedFilepath);
      const report = checkFileSystemIntegrity([], [trash]);
      expect(report.trashGhosts).toEqual([]);
      expect(report.orphanFiles).not.toContain(trash.trashedFilepath);
    });
  });

  describe("repairGhostRecords", () => {
    it("removes ghost records from store", () => {
      const f1 = makeFile("f1");
      const f2 = makeFile("f2");
      fitsStoreMock.__setFiles([f1, f2]);
      mockExistingFiles.add(f2.filepath);

      const removed = repairGhostRecords(["f1"]);
      expect(removed).toBe(1);
      expect(fitsStoreMock.__getFiles().map((f) => f.id)).toEqual(["f2"]);
    });

    it("returns 0 for empty input", () => {
      expect(repairGhostRecords([])).toBe(0);
    });
  });

  describe("repairOrphanFiles", () => {
    it("deletes orphan files from disk", () => {
      mockExistingFiles.add("file:///document/fits_files/orphan.fits");
      const deleted = repairOrphanFiles(["file:///document/fits_files/orphan.fits"]);
      expect(deleted).toBe(1);
      expect(mockExistingFiles.has("file:///document/fits_files/orphan.fits")).toBe(false);
    });

    it("returns 0 for empty input", () => {
      expect(repairOrphanFiles([])).toBe(0);
    });
  });

  describe("repairTrashGhosts", () => {
    it("removes trash ghost records from store", () => {
      const t1 = makeTrash("t1");
      const t2 = makeTrash("t2");
      trashStoreMock.__setItems([t1, t2]);

      const removed = repairTrashGhosts(["trash-t1"]);
      expect(removed).toBe(1);
      expect(trashStoreMock.__getItems().map((item) => item.trashId)).toEqual(["trash-t2"]);
    });

    it("returns 0 for empty input", () => {
      expect(repairTrashGhosts([])).toBe(0);
    });
  });

  describe("repairGhostRecords edge cases", () => {
    it("returns 0 when ghost id does not match any file in store", () => {
      fitsStoreMock.__setFiles([makeFile("f1")]);
      mockExistingFiles.add("file:///document/fits_files/f1.fits");
      const removed = repairGhostRecords(["nonexistent"]);
      expect(removed).toBe(0);
      expect(fitsStoreMock.__getFiles()).toHaveLength(1);
    });

    it("calls deleteThumbnails and reconcileAllStores", () => {
      const { deleteThumbnails } = require("../../gallery/thumbnailCache") as {
        deleteThumbnails: jest.Mock;
      };
      const { reconcileAllStores } = require("../../targets/targetIntegrity") as {
        reconcileAllStores: jest.Mock;
      };
      fitsStoreMock.__setFiles([makeFile("f1")]);

      repairGhostRecords(["f1"]);
      expect(deleteThumbnails).toHaveBeenCalledWith(["f1"]);
      expect(reconcileAllStores).toHaveBeenCalled();
    });
  });

  describe("repairOrphanFiles edge cases", () => {
    it("skips files that no longer exist on disk", () => {
      const deleted = repairOrphanFiles(["file:///document/fits_files/gone.fits"]);
      expect(deleted).toBe(0);
    });
  });

  describe("checkFileSystemIntegrity edge cases", () => {
    it("handles multiple ghosts and orphans simultaneously", () => {
      const f1 = makeFile("f1");
      const f2 = makeFile("f2");
      // f1 does not exist on disk → ghost; f2 exists
      mockExistingFiles.add(f2.filepath);
      // extra file on disk not in store → orphan
      mockExistingFiles.add("file:///document/fits_files/stray.fits");

      const report = checkFileSystemIntegrity([f1, f2], []);
      expect(report.ghostRecords).toEqual(["f1"]);
      expect(report.orphanFiles).toContain("file:///document/fits_files/stray.fits");
      expect(report.orphanFiles).not.toContain(f2.filepath);
    });
  });

  describe("checkAndRepairFileSystemIntegrity", () => {
    it("detects and repairs all issue types in a single call", () => {
      const { checkAndRepairFileSystemIntegrity } = require("../fileSystemIntegrity") as {
        checkAndRepairFileSystemIntegrity: () => {
          report: { ghostRecords: string[]; orphanFiles: string[]; trashGhosts: string[] };
          repairedGhosts: number;
          repairedOrphans: number;
          repairedTrashGhosts: number;
        };
      };

      const f1 = makeFile("f1");
      const f2 = makeFile("f2");
      fitsStoreMock.__setFiles([f1, f2]);
      // f1 missing on disk → ghost; f2 exists
      mockExistingFiles.add(f2.filepath);
      // orphan on disk
      mockExistingFiles.add("file:///document/fits_files/orphan.fits");
      // trash ghost
      const t1 = makeTrash("t1");
      trashStoreMock.__setItems([t1]);
      // t1 trashedFilepath not on disk → trash ghost

      const result = checkAndRepairFileSystemIntegrity();
      expect(result.repairedGhosts).toBe(1);
      expect(result.repairedOrphans).toBe(1);
      expect(result.repairedTrashGhosts).toBe(1);
      expect(result.report.ghostRecords).toContain("f1");
      expect(result.report.orphanFiles).toContain("file:///document/fits_files/orphan.fits");
      expect(result.report.trashGhosts).toContain("trash-t1");
      // After repair: f1 removed from store, orphan deleted from disk, trash ghost removed
      expect(fitsStoreMock.__getFiles().map((f) => f.id)).toEqual(["f2"]);
      expect(mockExistingFiles.has("file:///document/fits_files/orphan.fits")).toBe(false);
      expect(trashStoreMock.__getItems()).toEqual([]);
    });

    it("returns zeros when everything is consistent", () => {
      const { checkAndRepairFileSystemIntegrity } = require("../fileSystemIntegrity") as {
        checkAndRepairFileSystemIntegrity: () => {
          report: { ghostRecords: string[]; orphanFiles: string[]; trashGhosts: string[] };
          repairedGhosts: number;
          repairedOrphans: number;
          repairedTrashGhosts: number;
        };
      };

      const f1 = makeFile("f1");
      fitsStoreMock.__setFiles([f1]);
      mockExistingFiles.add(f1.filepath);

      const result = checkAndRepairFileSystemIntegrity();
      expect(result.repairedGhosts).toBe(0);
      expect(result.repairedOrphans).toBe(0);
      expect(result.repairedTrashGhosts).toBe(0);
    });
  });
});
