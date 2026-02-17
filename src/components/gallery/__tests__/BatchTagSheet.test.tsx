import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { BatchTagSheet } from "../BatchTagSheet";
import { useFitsStore } from "../../../stores/useFitsStore";
import type { FitsMetadata } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "common.cancel": "Cancel",
          "common.confirm": "Confirm",
          "common.success": "Success",
          "common.error": "Error",
          "album.selected": "selected",
          "gallery.batchTag": "Batch Tag",
          "gallery.newTag": "New tag...",
          "gallery.noTags": "No tags yet",
          "gallery.noImages": "No images found",
          "gallery.batchTagApplied": "Applied tags to {count} file(s)",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("../../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("BatchTagSheet", () => {
  const onClose = jest.fn();
  let alertSpy: jest.SpyInstance;

  const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata => ({
    id: `file-${Math.random().toString(36).slice(2, 8)}`,
    filename: "test.fits",
    filepath: "file:///document/fits_files/test.fits",
    fileSize: 1024,
    importDate: Date.now(),
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
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

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("applies new tags and removes fully-shared tags that are deselected", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "f1", tags: ["a", "b"] }), makeFile({ id: "f2", tags: ["a"] })],
    });

    render(<BatchTagSheet visible selectedIds={["f1", "f2"]} onClose={onClose} />);

    fireEvent.press(screen.getByTestId("batch-tag-chip-a"));
    fireEvent.changeText(screen.getByTestId("batch-tag-input"), "c");
    fireEvent.press(screen.getByTestId("batch-tag-add"));
    fireEvent.press(screen.getByTestId("batch-tag-apply"));

    const files = useFitsStore.getState().files;
    expect(files.find((f) => f.id === "f1")?.tags).toEqual(["b", "c"]);
    expect(files.find((f) => f.id === "f2")?.tags).toEqual(["c"]);
    expect(Alert.alert).toHaveBeenCalledWith("Success", "Applied tags to 2 file(s)");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows partial tag count for tags not applied to all selected files", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "f1", tags: ["a", "b"] }), makeFile({ id: "f2", tags: ["b"] })],
    });

    render(<BatchTagSheet visible selectedIds={["f1", "f2"]} onClose={onClose} />);

    expect(screen.getByText("a (1)")).toBeTruthy();
    expect(screen.getByText("b")).toBeTruthy();
  });

  it("resets draft state on close", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "f1", tags: ["a"] })],
    });

    render(<BatchTagSheet visible selectedIds={["f1"]} onClose={onClose} />);

    fireEvent.changeText(screen.getByTestId("batch-tag-input"), "new-tag");
    fireEvent.press(screen.getByTestId("batch-tag-cancel"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("batch-tag-input").props.value).toBe("");
  });

  it("shows an error when applying with no selected files", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "f1", tags: ["a"] })],
    });

    render(<BatchTagSheet visible selectedIds={[]} onClose={onClose} />);
    fireEvent.press(screen.getByTestId("batch-tag-apply"));

    expect(Alert.alert).toHaveBeenCalledWith("Error", "No images found");
    expect(onClose).not.toHaveBeenCalled();
  });
});
