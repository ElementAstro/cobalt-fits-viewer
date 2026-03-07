import { renderHook, act } from "@testing-library/react-native";
import { useHeaderEditor } from "../useHeaderEditor";

jest.mock("../../../lib/fits/headerWriter", () => ({
  writeHeaderKeywords: jest.fn().mockResolvedValue(2),
  deleteHeaderKeywords: jest.fn().mockResolvedValue(1),
  formatHeaderRecord: jest.fn((entry: { key: string; value: unknown }) => {
    const key = String(entry.key).padEnd(8).substring(0, 8);
    return `${key}= ${String(entry.value)}`.padEnd(80).substring(0, 80);
  }),
}));

jest.mock("../../../lib/logger", () => ({
  LOG_TAGS: { FitsHeaderWriter: "FitsHeaderWriter" },
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const { writeHeaderKeywords, deleteHeaderKeywords } = jest.requireMock(
  "../../../lib/fits/headerWriter",
);

const sampleKeywords = [
  { key: "SIMPLE", value: true, comment: "standard FITS" },
  { key: "BITPIX", value: 16, comment: "bits per pixel" },
  { key: "NAXIS", value: 2, comment: "number of axes" },
  { key: "OBJECT", value: "M42", comment: "target" },
  { key: "FILTER", value: "Ha", comment: "filter used" },
];

describe("useHeaderEditor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("initializes with given keywords", () => {
    const { result } = renderHook(() => useHeaderEditor());
    act(() => {
      result.current.initialize(sampleKeywords);
    });
    expect(result.current.headers).toHaveLength(5);
    expect(result.current.headers[0].key).toBe("SIMPLE");
    expect(result.current.isDirty).toBe(false);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.historyIndex).toBe(0);
    expect(result.current.historyLength).toBe(1);
  });

  it("does not mutate original keywords on initialize", () => {
    const original = [{ key: "TEST", value: 1, comment: "c" }];
    const { result } = renderHook(() => useHeaderEditor());
    act(() => {
      result.current.initialize(original);
    });
    act(() => {
      result.current.editKeyword(0, { value: 999 });
    });
    expect(original[0].value).toBe(1);
    expect(result.current.headers[0].value).toBe(999);
  });

  describe("editKeyword", () => {
    it("edits a keyword value", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.editKeyword(3, { value: "NGC1234" }));

      expect(result.current.headers[3].value).toBe("NGC1234");
      expect(result.current.isDirty).toBe(true);
      expect(result.current.canUndo).toBe(true);
    });

    it("edits a keyword comment", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.editKeyword(3, { comment: "updated comment" }));

      expect(result.current.headers[3].comment).toBe("updated comment");
    });

    it("does not allow changing key name of protected keyword", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.editKeyword(0, { key: "OTHER" }));

      expect(result.current.headers[0].key).toBe("SIMPLE");
      expect(result.current.isDirty).toBe(false);
    });

    it("ignores out-of-range index", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.editKeyword(99, { value: "X" }));

      expect(result.current.isDirty).toBe(false);
    });
  });

  describe("addKeyword", () => {
    it("adds a new keyword", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.addKeyword({ key: "EXPTIME", value: 300, comment: "exposure" }));

      expect(result.current.headers).toHaveLength(6);
      expect(result.current.headers[5].key).toBe("EXPTIME");
      expect(result.current.isDirty).toBe(true);
    });

    it("rejects keyword with invalid key", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.addKeyword({ key: "", value: 1 }));

      expect(result.current.headers).toHaveLength(5);
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe("deleteKeyword", () => {
    it("deletes a non-protected keyword", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.deleteKeyword(3)); // OBJECT

      expect(result.current.headers).toHaveLength(4);
      expect(result.current.headers.find((h) => h.key === "OBJECT")).toBeUndefined();
      expect(result.current.isDirty).toBe(true);
    });

    it("does not delete a protected keyword", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.deleteKeyword(0)); // SIMPLE

      expect(result.current.headers).toHaveLength(5);
      expect(result.current.headers[0].key).toBe("SIMPLE");
      expect(result.current.isDirty).toBe(false);
    });

    it("ignores out-of-range index", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.deleteKeyword(-1));
      act(() => result.current.deleteKeyword(99));

      expect(result.current.headers).toHaveLength(5);
    });
  });

  describe("undo/redo", () => {
    it("undoes last edit", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.editKeyword(3, { value: "NGC1234" }));

      expect(result.current.headers[3].value).toBe("NGC1234");

      act(() => result.current.undo());

      expect(result.current.headers[3].value).toBe("M42");
      expect(result.current.isDirty).toBe(false);
      expect(result.current.canRedo).toBe(true);
    });

    it("redoes after undo", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.editKeyword(3, { value: "NGC1234" }));
      act(() => result.current.undo());
      act(() => result.current.redo());

      expect(result.current.headers[3].value).toBe("NGC1234");
      expect(result.current.isDirty).toBe(true);
    });

    it("cannot undo past initial state", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.undo());

      expect(result.current.historyIndex).toBe(0);
    });

    it("cannot redo past latest state", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.redo());

      expect(result.current.historyIndex).toBe(0);
    });

    it("truncates future history on new edit after undo", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.editKeyword(3, { value: "A" }));
      act(() => result.current.editKeyword(3, { value: "B" }));
      act(() => result.current.undo()); // back to A
      act(() => result.current.editKeyword(3, { value: "C" })); // replaces B branch

      expect(result.current.headers[3].value).toBe("C");
      expect(result.current.canRedo).toBe(false);
      expect(result.current.historyLength).toBe(3); // initial, A, C
    });
  });

  describe("save", () => {
    it("calls writeHeaderKeywords for updated entries", async () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.editKeyword(3, { value: "NGC1234" }));

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.save("/path/to/file.fits");
      });

      expect(success).toBe(true);
      expect(writeHeaderKeywords).toHaveBeenCalledTimes(1);
      const entries = writeHeaderKeywords.mock.calls[0][1];
      expect(entries.some((e: { key: string }) => e.key === "OBJECT")).toBe(true);
    });

    it("calls deleteHeaderKeywords for removed entries", async () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.deleteKeyword(4)); // FILTER

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.save("/path/to/file.fits");
      });

      expect(success).toBe(true);
      expect(deleteHeaderKeywords).toHaveBeenCalledTimes(1);
      expect(deleteHeaderKeywords.mock.calls[0][1]).toContain("FILTER");
    });

    it("resets history after successful save", async () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.editKeyword(3, { value: "NGC1234" }));

      await act(async () => {
        await result.current.save("/path/to/file.fits");
      });

      expect(result.current.isDirty).toBe(false);
      expect(result.current.historyIndex).toBe(0);
      expect(result.current.historyLength).toBe(1);
    });

    it("sets saveError on failure", async () => {
      writeHeaderKeywords.mockRejectedValueOnce(new Error("disk full"));
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.editKeyword(3, { value: "NGC1234" }));

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.save("/path/to/file.fits");
      });

      expect(success).toBe(false);
      expect(result.current.saveError).toBe("disk full");
    });

    it("does not call write when no changes", async () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));

      await act(async () => {
        await result.current.save("/path/to/file.fits");
      });

      expect(writeHeaderKeywords).not.toHaveBeenCalled();
      expect(deleteHeaderKeywords).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("resets to original state", () => {
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.editKeyword(3, { value: "NGC1234" }));
      act(() => result.current.reset());

      expect(result.current.headers[3].value).toBe("M42");
      expect(result.current.isDirty).toBe(false);
      expect(result.current.historyIndex).toBe(0);
    });
  });

  describe("clearSaveError", () => {
    it("clears save error", async () => {
      writeHeaderKeywords.mockRejectedValueOnce(new Error("err"));
      const { result } = renderHook(() => useHeaderEditor());
      act(() => result.current.initialize(sampleKeywords));
      act(() => result.current.editKeyword(3, { value: "X" }));

      await act(async () => {
        await result.current.save("/path");
      });

      expect(result.current.saveError).toBe("err");

      act(() => result.current.clearSaveError());

      expect(result.current.saveError).toBeNull();
    });
  });

  describe("maxHistory", () => {
    it("trims history to maxHistory", () => {
      const { result } = renderHook(() => useHeaderEditor({ maxHistory: 3 }));
      act(() => result.current.initialize(sampleKeywords));

      for (let i = 0; i < 5; i++) {
        act(() => result.current.editKeyword(3, { value: `v${i}` }));
      }

      // maxHistory=3, so only last 3 snapshots are kept
      expect(result.current.historyLength).toBe(3);
    });
  });
});
