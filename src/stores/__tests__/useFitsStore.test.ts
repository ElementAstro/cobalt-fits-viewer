import { useFitsStore } from "../useFitsStore";
import type { FitsMetadata } from "../../lib/fits/types";

// Mock storage
jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata => ({
  id: `file-${Math.random().toString(36).slice(2, 8)}`,
  filename: "test.fits",
  filepath: "/path/test.fits",
  fileSize: 1024,
  importDate: Date.now(),
  frameType: "light",
  isFavorite: false,
  tags: [],
  albumIds: [],
  ...overrides,
});

describe("useFitsStore", () => {
  beforeEach(() => {
    useFitsStore.setState({
      files: [],
      selectedIds: [],
      isSelectionMode: false,
      sortBy: "date",
      sortOrder: "desc",
      searchQuery: "",
      filterTags: [],
    });
  });

  // ===== batchSetSessionId =====

  describe("batchSetSessionId", () => {
    it("sets sessionId on matching files", () => {
      useFitsStore.setState({
        files: [makeFile({ id: "f1" }), makeFile({ id: "f2" }), makeFile({ id: "f3" })],
      });

      useFitsStore.getState().batchSetSessionId(["f1", "f3"], "session-abc");
      const files = useFitsStore.getState().files;
      expect(files.find((f) => f.id === "f1")?.sessionId).toBe("session-abc");
      expect(files.find((f) => f.id === "f2")?.sessionId).toBeUndefined();
      expect(files.find((f) => f.id === "f3")?.sessionId).toBe("session-abc");
    });

    it("clears sessionId when passed undefined", () => {
      useFitsStore.setState({
        files: [
          makeFile({ id: "f1", sessionId: "old-session" }),
          makeFile({ id: "f2", sessionId: "old-session" }),
        ],
      });

      useFitsStore.getState().batchSetSessionId(["f1"], undefined);
      const files = useFitsStore.getState().files;
      expect(files.find((f) => f.id === "f1")?.sessionId).toBeUndefined();
      expect(files.find((f) => f.id === "f2")?.sessionId).toBe("old-session");
    });

    it("does nothing when fileIds is empty", () => {
      const original = makeFile({ id: "f1", sessionId: "s1" });
      useFitsStore.setState({ files: [original] });
      useFitsStore.getState().batchSetSessionId([], "new-session");
      expect(useFitsStore.getState().files[0].sessionId).toBe("s1");
    });

    it("handles non-existent file IDs gracefully", () => {
      useFitsStore.setState({ files: [makeFile({ id: "f1" })] });
      useFitsStore.getState().batchSetSessionId(["not-exist"], "session-x");
      expect(useFitsStore.getState().files[0].sessionId).toBeUndefined();
    });
  });

  // ===== Basic file CRUD =====

  describe("file CRUD", () => {
    it("adds a single file", () => {
      useFitsStore.getState().addFile(makeFile({ id: "f1" }));
      expect(useFitsStore.getState().files).toHaveLength(1);
    });

    it("adds multiple files", () => {
      useFitsStore.getState().addFiles([makeFile({ id: "f1" }), makeFile({ id: "f2" })]);
      expect(useFitsStore.getState().files).toHaveLength(2);
    });

    it("removes a file", () => {
      useFitsStore.setState({
        files: [makeFile({ id: "f1" }), makeFile({ id: "f2" })],
      });
      useFitsStore.getState().removeFile("f1");
      expect(useFitsStore.getState().files).toHaveLength(1);
      expect(useFitsStore.getState().files[0].id).toBe("f2");
    });

    it("removes multiple files", () => {
      useFitsStore.setState({
        files: [makeFile({ id: "f1" }), makeFile({ id: "f2" }), makeFile({ id: "f3" })],
      });
      useFitsStore.getState().removeFiles(["f1", "f3"]);
      expect(useFitsStore.getState().files).toHaveLength(1);
      expect(useFitsStore.getState().files[0].id).toBe("f2");
    });

    it("updates a file", () => {
      useFitsStore.setState({ files: [makeFile({ id: "f1", object: "M42" })] });
      useFitsStore.getState().updateFile("f1", { object: "M31" });
      expect(useFitsStore.getState().files[0].object).toBe("M31");
    });

    it("toggles favorite", () => {
      useFitsStore.setState({ files: [makeFile({ id: "f1", isFavorite: false })] });
      useFitsStore.getState().toggleFavorite("f1");
      expect(useFitsStore.getState().files[0].isFavorite).toBe(true);
      useFitsStore.getState().toggleFavorite("f1");
      expect(useFitsStore.getState().files[0].isFavorite).toBe(false);
    });
  });

  // ===== Tags =====

  describe("tags", () => {
    it("adds a tag to a file", () => {
      useFitsStore.setState({ files: [makeFile({ id: "f1", tags: [] })] });
      useFitsStore.getState().addTag("f1", "nebula");
      expect(useFitsStore.getState().files[0].tags).toContain("nebula");
    });

    it("does not add duplicate tags", () => {
      useFitsStore.setState({ files: [makeFile({ id: "f1", tags: ["nebula"] })] });
      useFitsStore.getState().addTag("f1", "nebula");
      expect(useFitsStore.getState().files[0].tags).toHaveLength(1);
    });

    it("removes a tag", () => {
      useFitsStore.setState({ files: [makeFile({ id: "f1", tags: ["nebula", "galaxy"] })] });
      useFitsStore.getState().removeTag("f1", "nebula");
      expect(useFitsStore.getState().files[0].tags).toEqual(["galaxy"]);
    });
  });

  // ===== Batch Tags =====

  describe("batch tags", () => {
    it("batchAddTag adds tag to multiple files", () => {
      useFitsStore.setState({
        files: [
          makeFile({ id: "f1", tags: [] }),
          makeFile({ id: "f2", tags: ["existing"] }),
          makeFile({ id: "f3", tags: [] }),
        ],
      });
      useFitsStore.getState().batchAddTag(["f1", "f2"], "nebula");
      const files = useFitsStore.getState().files;
      expect(files.find((f) => f.id === "f1")?.tags).toContain("nebula");
      expect(files.find((f) => f.id === "f2")?.tags).toContain("nebula");
      expect(files.find((f) => f.id === "f2")?.tags).toContain("existing");
      expect(files.find((f) => f.id === "f3")?.tags).not.toContain("nebula");
    });

    it("batchAddTag does not add duplicate tag", () => {
      useFitsStore.setState({
        files: [makeFile({ id: "f1", tags: ["nebula"] })],
      });
      useFitsStore.getState().batchAddTag(["f1"], "nebula");
      expect(useFitsStore.getState().files[0].tags).toHaveLength(1);
    });

    it("batchRemoveTag removes tag from multiple files", () => {
      useFitsStore.setState({
        files: [
          makeFile({ id: "f1", tags: ["nebula", "galaxy"] }),
          makeFile({ id: "f2", tags: ["nebula"] }),
          makeFile({ id: "f3", tags: ["galaxy"] }),
        ],
      });
      useFitsStore.getState().batchRemoveTag(["f1", "f2"], "nebula");
      const files = useFitsStore.getState().files;
      expect(files.find((f) => f.id === "f1")?.tags).toEqual(["galaxy"]);
      expect(files.find((f) => f.id === "f2")?.tags).toEqual([]);
      expect(files.find((f) => f.id === "f3")?.tags).toEqual(["galaxy"]);
    });

    it("batchSetTags replaces all tags on target files", () => {
      useFitsStore.setState({
        files: [
          makeFile({ id: "f1", tags: ["old1", "old2"] }),
          makeFile({ id: "f2", tags: ["old3"] }),
          makeFile({ id: "f3", tags: ["keep"] }),
        ],
      });
      useFitsStore.getState().batchSetTags(["f1", "f2"], ["new1", "new2"]);
      const files = useFitsStore.getState().files;
      expect(files.find((f) => f.id === "f1")?.tags).toEqual(["new1", "new2"]);
      expect(files.find((f) => f.id === "f2")?.tags).toEqual(["new1", "new2"]);
      expect(files.find((f) => f.id === "f3")?.tags).toEqual(["keep"]);
    });
  });

  // ===== Sorting with quality =====

  describe("sorting by quality", () => {
    it("sorts by quality score ascending", () => {
      useFitsStore.setState({
        files: [
          makeFile({ id: "f1", filename: "a.fits", qualityScore: 80 }),
          makeFile({ id: "f2", filename: "b.fits", qualityScore: 30 }),
          makeFile({ id: "f3", filename: "c.fits", qualityScore: 60 }),
        ],
        sortBy: "quality",
        sortOrder: "asc",
      });
      const filtered = useFitsStore.getState().getFilteredFiles();
      expect(filtered[0].qualityScore).toBe(30);
      expect(filtered[1].qualityScore).toBe(60);
      expect(filtered[2].qualityScore).toBe(80);
    });

    it("sorts by quality score descending", () => {
      useFitsStore.setState({
        files: [
          makeFile({ id: "f1", qualityScore: 80 }),
          makeFile({ id: "f2", qualityScore: 30 }),
          makeFile({ id: "f3", qualityScore: 60 }),
        ],
        sortBy: "quality",
        sortOrder: "desc",
      });
      const filtered = useFitsStore.getState().getFilteredFiles();
      expect(filtered[0].qualityScore).toBe(80);
      expect(filtered[1].qualityScore).toBe(60);
      expect(filtered[2].qualityScore).toBe(30);
    });

    it("places files without quality score at the end when ascending", () => {
      useFitsStore.setState({
        files: [
          makeFile({ id: "f1", qualityScore: undefined }),
          makeFile({ id: "f2", qualityScore: 50 }),
        ],
        sortBy: "quality",
        sortOrder: "desc",
      });
      const filtered = useFitsStore.getState().getFilteredFiles();
      expect(filtered[0].qualityScore).toBe(50);
      expect(filtered[1].qualityScore).toBeUndefined();
    });
  });

  // ===== Selection =====

  describe("selection", () => {
    it("toggles selection", () => {
      useFitsStore.setState({ files: [makeFile({ id: "f1" })], selectedIds: [] });
      useFitsStore.getState().toggleSelection("f1");
      expect(useFitsStore.getState().selectedIds).toContain("f1");
      useFitsStore.getState().toggleSelection("f1");
      expect(useFitsStore.getState().selectedIds).not.toContain("f1");
    });

    it("setSelectedIds keeps order, deduplicates, and ignores missing ids", () => {
      useFitsStore.setState({
        files: [makeFile({ id: "f1" }), makeFile({ id: "f2" }), makeFile({ id: "f3" })],
      });

      useFitsStore.getState().setSelectedIds(["f3", "f2", "f3", "missing", "f1"]);

      expect(useFitsStore.getState().selectedIds).toEqual(["f3", "f2", "f1"]);
    });

    it("toggleSelectionBatch flips selection membership for valid ids only", () => {
      useFitsStore.setState({
        files: [makeFile({ id: "f1" }), makeFile({ id: "f2" }), makeFile({ id: "f3" })],
        selectedIds: ["f1"],
      });

      useFitsStore.getState().toggleSelectionBatch(["f1", "f2", "missing"]);

      expect(useFitsStore.getState().selectedIds).toEqual(["f2"]);
    });

    it("toggleSelectionBatch handles empty input without changes", () => {
      useFitsStore.setState({
        files: [makeFile({ id: "f1" }), makeFile({ id: "f2" })],
        selectedIds: ["f2"],
      });

      useFitsStore.getState().toggleSelectionBatch([]);

      expect(useFitsStore.getState().selectedIds).toEqual(["f2"]);
    });

    it("toggleSelectionBatch can invert a fully selected visible set", () => {
      useFitsStore.setState({
        files: [makeFile({ id: "f1" }), makeFile({ id: "f2" }), makeFile({ id: "f3" })],
        selectedIds: ["f1", "f2", "f3"],
      });

      useFitsStore.getState().toggleSelectionBatch(["f1", "f2", "f3"]);

      expect(useFitsStore.getState().selectedIds).toEqual([]);
    });

    it("selectAll selects all file ids", () => {
      useFitsStore.setState({
        files: [makeFile({ id: "f1" }), makeFile({ id: "f2" })],
        selectedIds: [],
      });
      useFitsStore.getState().selectAll();
      expect(useFitsStore.getState().selectedIds).toHaveLength(2);
    });

    it("clearSelection empties selectedIds", () => {
      useFitsStore.setState({ selectedIds: ["f1", "f2"] });
      useFitsStore.getState().clearSelection();
      expect(useFitsStore.getState().selectedIds).toHaveLength(0);
    });

    it("setSelectionMode keeps or clears selected ids by mode", () => {
      useFitsStore.setState({ selectedIds: ["f1", "f2"], isSelectionMode: false });
      useFitsStore.getState().setSelectionMode(true);
      expect(useFitsStore.getState().isSelectionMode).toBe(true);
      expect(useFitsStore.getState().selectedIds).toEqual(["f1", "f2"]);

      useFitsStore.getState().setSelectionMode(false);
      expect(useFitsStore.getState().isSelectionMode).toBe(false);
      expect(useFitsStore.getState().selectedIds).toEqual([]);
    });

    it("setSelectionMode(false) clears selections set by new atomic action", () => {
      useFitsStore.setState({
        files: [makeFile({ id: "f1" }), makeFile({ id: "f2" })],
      });

      useFitsStore.getState().setSelectedIds(["f1", "f2"]);
      useFitsStore.getState().setSelectionMode(false);

      expect(useFitsStore.getState().selectedIds).toEqual([]);
      expect(useFitsStore.getState().isSelectionMode).toBe(false);
    });
  });

  // ===== Getters =====

  describe("getters", () => {
    it("getFileById returns file or undefined", () => {
      useFitsStore.setState({ files: [makeFile({ id: "f1" })] });
      expect(useFitsStore.getState().getFileById("f1")?.id).toBe("f1");
      expect(useFitsStore.getState().getFileById("nope")).toBeUndefined();
    });

    it("getAdjacentFileIds returns prev and next ids", () => {
      useFitsStore.setState({
        files: [makeFile({ id: "f1" }), makeFile({ id: "f2" }), makeFile({ id: "f3" })],
      });
      const result = useFitsStore.getState().getAdjacentFileIds("f2");
      expect(result.prevId).toBe("f1");
      expect(result.nextId).toBe("f3");
    });

    it("getAdjacentFileIds handles first and last", () => {
      useFitsStore.setState({
        files: [makeFile({ id: "f1" }), makeFile({ id: "f2" })],
      });
      const first = useFitsStore.getState().getAdjacentFileIds("f1");
      expect(first.prevId).toBeNull();
      expect(first.nextId).toBe("f2");

      const last = useFitsStore.getState().getAdjacentFileIds("f2");
      expect(last.prevId).toBe("f1");
      expect(last.nextId).toBeNull();
    });

    it("getAdjacentFileIds returns null pair for unknown file", () => {
      useFitsStore.setState({
        files: [makeFile({ id: "f1" }), makeFile({ id: "f2" })],
      });
      expect(useFitsStore.getState().getAdjacentFileIds("missing")).toEqual({
        prevId: null,
        nextId: null,
      });
    });
  });

  describe("sort and filter setters", () => {
    it("updates sortBy/sortOrder/searchQuery/filterTags", () => {
      const store = useFitsStore.getState();
      store.setSortBy("name");
      store.setSortOrder("asc");
      store.setSearchQuery("m31");
      store.setFilterTags(["nebula", "ha"]);

      const s = useFitsStore.getState();
      expect(s.sortBy).toBe("name");
      expect(s.sortOrder).toBe("asc");
      expect(s.searchQuery).toBe("m31");
      expect(s.filterTags).toEqual(["nebula", "ha"]);
    });
  });
});
