import { act, render, screen } from "@testing-library/react-native";
import { ThumbnailGrid } from "../ThumbnailGrid";
import type { FitsMetadata } from "../../../lib/fits/types";

jest.mock("@shopify/flash-list", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    FlashList: ({ data, renderItem, ListHeaderComponent }: any) => (
      <View>
        {ListHeaderComponent}
        {data.map((item: unknown, index: number) => (
          <View key={(item as { id: string }).id ?? index}>{renderItem({ item, index })}</View>
        ))}
      </View>
    ),
  };
});

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
