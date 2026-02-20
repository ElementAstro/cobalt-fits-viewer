import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import ConvertScreen from "../index";
import { useFitsStore } from "../../../stores/useFitsStore";
import type { FitsMetadata } from "../../../lib/fits/types";

const mockUseLocalSearchParams = jest.fn(
  (): { tab?: string | string[]; ids?: string | string[] } => ({}),
);

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock("heroui-native", () => {
  const ReactLib = require("react");
  const { View: RNView, Text: RNText } = require("react-native");

  const createComponent =
    (testID: string) =>
    ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
      ReactLib.createElement(RNView, { testID, ...props }, children);

  type mockComponentProps = {
    children?: React.ReactNode;
  } & Record<string, unknown>;

  const Button = createComponent("button") as React.ComponentType<mockComponentProps> & {
    Label: React.ComponentType<mockComponentProps>;
  };
  Button.Label = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    ReactLib.createElement(RNText, props, children);

  const Card = createComponent("card") as React.ComponentType<mockComponentProps> & {
    Body: React.ComponentType<mockComponentProps>;
  };
  Card.Body = createComponent("card-body");

  const Chip = createComponent("chip") as React.ComponentType<mockComponentProps> & {
    Label: React.ComponentType<mockComponentProps>;
  };
  Chip.Label = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    ReactLib.createElement(RNText, props, children);

  const Accordion = createComponent("accordion") as React.ComponentType<mockComponentProps> & {
    Item: React.ComponentType<mockComponentProps>;
    Trigger: React.ComponentType<mockComponentProps>;
    Content: React.ComponentType<mockComponentProps>;
    Indicator: React.ComponentType<mockComponentProps>;
  };
  Accordion.Item = createComponent("accordion-item");
  Accordion.Trigger = createComponent("accordion-trigger");
  Accordion.Content = createComponent("accordion-content");
  Accordion.Indicator = createComponent("accordion-indicator");

  const Tabs = ({
    children,
    value,
    ...props
  }: {
    children?: React.ReactNode;
    value?: string;
    [key: string]: unknown;
  }) => ReactLib.createElement(RNView, { testID: "tabs", value, ...props }, children);
  Tabs.List = createComponent("tabs-list");
  Tabs.Trigger = createComponent("tabs-trigger");
  Tabs.Label = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    ReactLib.createElement(RNText, props, children);
  Tabs.Indicator = createComponent("tabs-indicator");
  Tabs.Content = createComponent("tabs-content");

  return {
    Accordion,
    Button,
    Card,
    Chip,
    PressableFeedback: createComponent("pressable-feedback"),
    Separator: createComponent("separator"),
    Tabs,
    useThemeColor: (keys: string[] | string) =>
      Array.isArray(keys) ? keys.map(() => "#000000") : "#000000",
  };
});

jest.mock("../../../hooks/useConverter", () => ({
  useConverter: () => ({
    currentOptions: {
      format: "png",
      quality: 90,
      bitDepth: 8,
      dpi: 300,
      fits: {
        mode: "scientific",
        compression: "none",
        bitpix: -32,
        colorLayout: "rgbCube3d",
        preserveOriginalHeader: true,
        preserveWcs: true,
      },
      tiff: {
        compression: "lzw",
        multipage: "preserve",
      },
      stretch: "linear",
      colormap: "grayscale",
      blackPoint: 0,
      whitePoint: 1,
      gamma: 1,
      outputBlack: 0,
      outputWhite: 1,
      brightness: 0,
      contrast: 1,
      mtfMidtone: 0.25,
      curvePreset: "linear",
      includeAnnotations: false,
      includeWatermark: false,
    },
    setFormat: jest.fn(),
    setQuality: jest.fn(),
    setBitDepth: jest.fn(),
    setDpi: jest.fn(),
    setOptions: jest.fn(),
    allPresets: [],
    applyPreset: jest.fn(),
    getEstimatedSize: jest.fn(() => null),
    supportsQuality: jest.fn(() => true),
    getSupportedBitDepths: jest.fn(() => [8]),
  }),
}));

jest.mock("../../../hooks/useFitsFile", () => ({
  useFitsFile: () => ({
    pixels: null,
    dimensions: null,
    isLoading: false,
    loadFromPath: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock("../../../hooks/useImageProcessing", () => ({
  useImageProcessing: () => ({
    rgbaData: null,
    processImage: jest.fn(),
  }),
}));

jest.mock("../../../hooks/useExport", () => ({
  useExport: () => ({
    isExporting: false,
    exportImageDetailed: jest.fn(),
  }),
}));

jest.mock("../../../stores/useAstrometryStore", () => ({
  useAstrometryStore: (selector: (state: unknown) => unknown) =>
    selector({
      jobs: [],
    }),
}));

jest.mock("../../../components/converter/FormatSelector", () => ({
  FormatSelector: () => {
    const ReactLib = require("react");
    const { View } = require("react-native");
    return ReactLib.createElement(View, { testID: "format-selector" });
  },
}));

jest.mock("../../../components/converter/BatchConvertContent", () => ({
  BatchConvertContent: () => {
    const ReactLib = require("react");
    const { Text } = require("react-native");
    return ReactLib.createElement(Text, null, "batch-content");
  },
}));

jest.mock("../../../components/common/SimpleSlider", () => ({
  SimpleSlider: () => {
    const ReactLib = require("react");
    const { View } = require("react-native");
    return ReactLib.createElement(View, { testID: "simple-slider" });
  },
}));

jest.mock("../../../components/fits/FitsCanvas", () => ({
  FitsCanvas: () => {
    const ReactLib = require("react");
    const { View } = require("react-native");
    return ReactLib.createElement(View, { testID: "fits-canvas" });
  },
}));

jest.mock("../../../components/common/LoadingOverlay", () => ({
  LoadingOverlay: () => null,
}));

describe("ConvertScreen query params", () => {
  const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata => ({
    id: "file-1",
    filename: "M42_Light.fits",
    filepath: "file:///document/fits_files/M42_Light.fits",
    fileSize: 1024,
    importDate: 1700000000000,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  });

  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({});
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

  it("switches to batch tab when tab=batch is provided", async () => {
    mockUseLocalSearchParams.mockReturnValue({ tab: "batch" });

    render(<ConvertScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("tabs").props.value).toBe("batch");
    });
  });

  it("prefills selection from ids, supports array params, and keeps unique valid IDs", async () => {
    useFitsStore.setState({
      files: [makeFile({ id: "file-1" }), makeFile({ id: "file-2" })],
    });
    mockUseLocalSearchParams.mockReturnValue({
      tab: ["single"],
      ids: ["file-1,missing,file-1", "file-2"],
    });

    render(<ConvertScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("tabs").props.value).toBe("batch");
      expect(useFitsStore.getState().selectedIds).toEqual(["file-1", "file-2"]);
      expect(useFitsStore.getState().isSelectionMode).toBe(true);
    });
  });

  it("does not change selection when ids has no valid matches", async () => {
    useFitsStore.setState({
      files: [makeFile({ id: "file-1" })],
    });
    mockUseLocalSearchParams.mockReturnValue({ tab: "single", ids: "invalid-a,invalid-b" });

    render(<ConvertScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("tabs").props.value).toBe("single");
      expect(useFitsStore.getState().selectedIds).toEqual([]);
      expect(useFitsStore.getState().isSelectionMode).toBe(false);
    });
  });
});
