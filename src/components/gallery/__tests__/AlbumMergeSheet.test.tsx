import React from "react";
import { Alert, type AlertButton } from "react-native";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { AlbumMergeSheet } from "../AlbumMergeSheet";
import type { Album } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "album.mergeAlbum": "Merge into Album",
          "album.mergeTitle": "Merge Album",
          "album.mergeConfirm": 'Merge "{source}" into "{target}"? Images will be combined.',
          "album.mergeSearchPlaceholder": "Search target albums...",
          "album.mergeNoTargets": "No matching target albums",
          "album.mergeWillContain": "Will contain {count} images after merge",
          "album.mergeWillAdd": "Adds {count} new images",
          "album.mergeNoNewImages": "No new images will be added",
          "album.images": "images",
          "album.noAlbums": "No albums yet",
          "album.cannotMergeSmart": "Cannot merge smart albums",
          "common.cancel": "Cancel",
          "common.confirm": "Confirm",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

const makeAlbum = (id: string, overrides: Partial<Album> = {}): Album => ({
  id,
  name: `Album ${id}`,
  createdAt: 1,
  updatedAt: 1,
  imageIds: [],
  isSmart: false,
  ...overrides,
});

describe("AlbumMergeSheet", () => {
  const onClose = jest.fn();
  const onMerge = jest.fn();
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    onClose.mockReset();
    onMerge.mockReset();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("shows smart album warning and hides search input for smart source albums", () => {
    render(
      <AlbumMergeSheet
        visible
        sourceAlbum={makeAlbum("smart-source", { isSmart: true, name: "Smart Source" })}
        albums={[makeAlbum("target-1", { name: "Target One" })]}
        onClose={onClose}
        onMerge={onMerge}
      />,
    );

    expect(screen.getByText("Cannot merge smart albums")).toBeTruthy();
    expect(screen.queryByTestId("merge-target-search")).toBeNull();
  });

  it("filters target albums by search query and shows empty result text", () => {
    render(
      <AlbumMergeSheet
        visible
        sourceAlbum={makeAlbum("source", { name: "Source", imageIds: ["a"] })}
        albums={[
          makeAlbum("source", { name: "Source", imageIds: ["a"] }),
          makeAlbum("target-alpha", { name: "Alpha Nebula" }),
          makeAlbum("target-beta", { name: "Beta Moon" }),
        ]}
        onClose={onClose}
        onMerge={onMerge}
      />,
    );

    const searchInput = screen.getByTestId("merge-target-search");
    expect(screen.getByText("Alpha Nebula")).toBeTruthy();
    expect(screen.getByText("Beta Moon")).toBeTruthy();

    fireEvent.changeText(searchInput, "zzz");
    expect(screen.getByText("No matching target albums")).toBeTruthy();

    fireEvent.changeText(searchInput, "beta");
    expect(screen.queryByText("Alpha Nebula")).toBeNull();
    expect(screen.getByText("Beta Moon")).toBeTruthy();
  });

  it("shows merged image count preview for each target", () => {
    render(
      <AlbumMergeSheet
        visible
        sourceAlbum={makeAlbum("source", { imageIds: ["a", "b"] })}
        albums={[makeAlbum("target", { imageIds: ["b", "c"], name: "Target" })]}
        onClose={onClose}
        onMerge={onMerge}
      />,
    );

    expect(screen.getByText("Will contain 3 images after merge")).toBeTruthy();
    expect(screen.getByText("Adds 1 new images")).toBeTruthy();
  });

  it("shows no-new-images preview when target already contains all source images", () => {
    render(
      <AlbumMergeSheet
        visible
        sourceAlbum={makeAlbum("source", { imageIds: ["a", "b"] })}
        albums={[makeAlbum("target", { imageIds: ["a", "b", "c"], name: "Target" })]}
        onClose={onClose}
        onMerge={onMerge}
      />,
    );

    expect(screen.getByText("No new images will be added")).toBeTruthy();
  });

  it("calls onMerge and onClose after confirm", () => {
    alertSpy.mockImplementation((_title, _message, buttons) => {
      const confirmBtn = (buttons as AlertButton[] | undefined)?.find(
        (btn: AlertButton) => btn.text === "Confirm",
      );
      confirmBtn?.onPress?.();
    });

    render(
      <AlbumMergeSheet
        visible
        sourceAlbum={makeAlbum("source", { imageIds: ["a"], name: "Source" })}
        albums={[makeAlbum("target", { imageIds: ["b"], name: "Target" })]}
        onClose={onClose}
        onMerge={onMerge}
      />,
    );

    fireEvent.press(screen.getByTestId("merge-target-target"));

    expect(Alert.alert).toHaveBeenCalled();
    expect(onMerge).toHaveBeenCalledWith("target");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows interpolated confirm dialog and does not merge when cancelled", () => {
    let capturedTitle = "";
    let capturedMessage = "";
    alertSpy.mockImplementation((title, message, buttons) => {
      capturedTitle = title ?? "";
      capturedMessage = message ?? "";
      const cancelBtn = (buttons as AlertButton[] | undefined)?.find(
        (btn: AlertButton) => btn.text === "Cancel",
      );
      cancelBtn?.onPress?.();
    });

    render(
      <AlbumMergeSheet
        visible
        sourceAlbum={makeAlbum("source", { imageIds: ["a"], name: "Source Album" })}
        albums={[makeAlbum("target", { imageIds: ["b"], name: "Target Album" })]}
        onClose={onClose}
        onMerge={onMerge}
      />,
    );

    fireEvent.press(screen.getByTestId("merge-target-target"));

    expect(capturedTitle).toBe("Merge Album");
    expect(capturedMessage).toBe(
      'Merge "Source Album" into "Target Album"? Images will be combined.',
    );
    expect(onMerge).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders pinned targets before unpinned targets", () => {
    render(
      <AlbumMergeSheet
        visible
        sourceAlbum={makeAlbum("source", { imageIds: ["a"] })}
        albums={[
          makeAlbum("source", { imageIds: ["a"] }),
          makeAlbum("regular", { name: "Regular Album", updatedAt: 100 }),
          makeAlbum("pinned", { name: "Pinned Album", isPinned: true, updatedAt: 50 }),
        ]}
        onClose={onClose}
        onMerge={onMerge}
      />,
    );

    const targetButtons = screen.getAllByTestId(/^merge-target-(pinned|regular)$/);
    expect(within(targetButtons[0]).getByText("Pinned Album")).toBeTruthy();
    expect(within(targetButtons[1]).getByText("Regular Album")).toBeTruthy();
  });

  it("resets search query after sheet is closed and reopened", () => {
    const sourceAlbum = makeAlbum("source", { imageIds: ["a"] });
    const albums = [
      sourceAlbum,
      makeAlbum("target-a", { name: "Alpha" }),
      makeAlbum("target-b", { name: "Beta" }),
    ];

    const { rerender } = render(
      <AlbumMergeSheet
        visible
        sourceAlbum={sourceAlbum}
        albums={albums}
        onClose={onClose}
        onMerge={onMerge}
      />,
    );

    fireEvent.changeText(screen.getByTestId("merge-target-search"), "beta");
    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.getByText("Beta")).toBeTruthy();

    rerender(
      <AlbumMergeSheet
        visible={false}
        sourceAlbum={sourceAlbum}
        albums={albums}
        onClose={onClose}
        onMerge={onMerge}
      />,
    );
    rerender(
      <AlbumMergeSheet
        visible
        sourceAlbum={sourceAlbum}
        albums={albums}
        onClose={onClose}
        onMerge={onMerge}
      />,
    );

    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
  });
});
