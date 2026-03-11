import { act, render, screen } from "@testing-library/react-native";
import { ThumbnailGrid } from "../ThumbnailGrid";
import type { FitsMetadata } from "../../../lib/fits/types";

const mockRequestThumbnail = jest.fn();
const mockResolveThumbnailUri = jest.fn(
  (_fileId: string, thumbnailUri?: string) => thumbnailUri ?? null,
);
const flashListState: {
  onViewableItemsChanged?:
    | ((event: { viewableItems: Array<Record<string, unknown>> }) => void)
    | null;
} = {};

jest.mock("@shopify/flash-list", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    FlashList: ({ data, renderItem, ListHeaderComponent, onViewableItemsChanged }: any) => {
      flashListState.onViewableItemsChanged = onViewableItemsChanged;
      return (
        <View>
          {ListHeaderComponent}
          {data.map((item: unknown, index: number) => (
            <View key={(item as { id: string }).id ?? index}>{renderItem({ item, index })}</View>
          ))}
        </View>
      );
    },
  };
});

jest.mock("../../../hooks/gallery/useThumbnailOnDemand", () => ({
  useThumbnailOnDemand: () => ({
    requestThumbnail: (file: FitsMetadata, priority?: string) =>
      mockRequestThumbnail(file, priority),
    resetFailed: jest.fn(),
    getMetrics: jest.fn(() => ({})),
  }),
}));

jest.mock("../../../lib/gallery/thumbnailCache", () => ({
  resolveThumbnailUri: (fileId: string, thumbnailUri?: string) =>
    mockResolveThumbnailUri(fileId, thumbnailUri),
}));

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options) {
        return `${key}:${JSON.stringify(options)}`;
      }
      return key;
    },
  }),
}));

jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) =>
      React.createElement(View, { testID: `expo-image-${props.recyclingKey}`, ...props }),
  };
});

const baseFile: FitsMetadata = {
  id: "f1",
  filename: "f1.fits",
  filepath: "file:///f1.fits",
  fileSize: 100,
  importDate: Date.now(),
  frameType: "light",
  isFavorite: false,
  tags: [],
  albumIds: [],
  sourceType: "fits",
  mediaKind: "image",
  thumbnailUri: "https://example.com/f1.jpg",
};

describe("ThumbnailGrid loading progress", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    flashListState.onViewableItemsChanged = null;
    mockResolveThumbnailUri.mockImplementation(
      (_fileId: string, thumbnailUri?: string) => thumbnailUri ?? null,
    );
  });

  it("reports progress summary from image loading events", () => {
    const onLoadingSummaryChange = jest.fn();
    render(
      <ThumbnailGrid
        files={[baseFile]}
        onLoadingSummaryChange={onLoadingSummaryChange}
        columns={1}
      />,
    );

    const image = screen.getByTestId("expo-image-f1");

    act(() => {
      image.props.onLoadStart?.();
      image.props.onProgress?.({ loaded: 20, total: 100 });
      image.props.onDisplay?.();
      image.props.onLoadEnd?.();
    });

    const lastSummary = onLoadingSummaryChange.mock.calls.at(-1)?.[0];
    expect(lastSummary).toBeTruthy();
    expect(lastSummary.totalCount).toBe(1);
    expect(lastSummary.completedCount).toBe(1);
    expect(lastSummary.loadingCount).toBe(0);
    expect(lastSummary.progress).toBe(1);
  });

  it("shows stage fallback when byte progress is unavailable", () => {
    render(<ThumbnailGrid files={[baseFile]} columns={1} />);
    const image = screen.getByTestId("expo-image-f1");

    act(() => {
      image.props.onLoadStart?.();
      image.props.onLoad?.();
    });

    expect(screen.getByText("gallery.thumbnailStageDecoding")).toBeTruthy();
  });

  it("shows error state when image loading fails", () => {
    render(<ThumbnailGrid files={[baseFile]} columns={1} />);
    const image = screen.getByTestId("expo-image-f1");

    act(() => {
      image.props.onError?.({ error: "network" });
    });

    expect(screen.getByText("gallery.thumbnailStageError")).toBeTruthy();
  });
});

describe("ThumbnailGrid selection", () => {
  it("marks selected items using Set-based lookup", () => {
    const file2: FitsMetadata = {
      ...baseFile,
      id: "f2",
      filename: "f2.fits",
      filepath: "file:///f2.fits",
      thumbnailUri: "https://example.com/f2.jpg",
    };
    const onSelect = jest.fn();
    render(
      <ThumbnailGrid
        files={[baseFile, file2]}
        columns={2}
        selectionMode
        selectedIds={["f1"]}
        onSelect={onSelect}
      />,
    );

    const img1 = screen.getByTestId("expo-image-f1");
    const img2 = screen.getByTestId("expo-image-f2");
    expect(img1).toBeTruthy();
    expect(img2).toBeTruthy();
  });
});

describe("ThumbnailGrid prioritized requests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    flashListState.onViewableItemsChanged = null;
    mockResolveThumbnailUri.mockReturnValue(null);
  });

  it("emits visible, nearby, then background thumbnail requests based on viewability", () => {
    const files: FitsMetadata[] = Array.from({ length: 5 }, (_, index) => ({
      ...baseFile,
      id: `f${index + 1}`,
      filename: `f${index + 1}.fits`,
      filepath: `file:///f${index + 1}.fits`,
      thumbnailUri: undefined,
    }));

    render(<ThumbnailGrid files={files} columns={1} />);
    mockRequestThumbnail.mockClear();

    act(() => {
      flashListState.onViewableItemsChanged?.({
        viewableItems: [{ item: files[1], index: 1, isViewable: true }],
      });
    });

    const calls = mockRequestThumbnail.mock.calls.map(([file, priority]) => [
      (file as FitsMetadata).id,
      priority,
    ]);
    expect(calls).toEqual([
      ["f2", "visible"],
      ["f1", "nearby"],
      ["f3", "nearby"],
      ["f4", "nearby"],
      ["f5", "background"],
    ]);
  });
});
