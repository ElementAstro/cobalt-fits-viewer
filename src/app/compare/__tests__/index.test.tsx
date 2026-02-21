import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockUseLocalSearchParams = jest.fn();
const mockUseImageComparison = jest.fn();
const mockUseFitsFile = jest.fn();
const mockUseImageProcessing = jest.fn();
const mockUpdateFile = jest.fn();
const mockApplySettingsPatch = jest.fn();

const mockFiles = [
  {
    id: "a",
    filename: "A.fits",
    filepath: "/tmp/A.fits",
    fileSize: 1,
    importDate: 1,
    frameType: "light" as const,
    isFavorite: false,
    tags: [],
    albumIds: [],
  },
  {
    id: "b",
    filename: "B.fits",
    filepath: "/tmp/B.fits",
    fileSize: 1,
    importDate: 2,
    frameType: "light" as const,
    isFavorite: false,
    tags: [],
    albumIds: [],
  },
];

const mockSettingsState: Record<string, unknown> = {
  defaultStretch: "asinh",
  defaultColormap: "grayscale",
  defaultBlackPoint: 0,
  defaultWhitePoint: 1,
  defaultGamma: 1,
  defaultShowGrid: false,
  defaultShowCrosshair: false,
  defaultShowPixelInfo: true,
  defaultShowMinimap: false,
  compareDefaultMode: "blink",
  compareBlinkSpeed: 1.5,
  compareSplitPosition: 0.5,
  imageProcessingDebounce: 0,
  useHighQualityPreview: true,
  canvasMinScale: 0.5,
  canvasMaxScale: 10,
  canvasDoubleTapScale: 3,
  canvasPinchSensitivity: 1,
  canvasPinchOverzoomFactor: 1.25,
  canvasPanRubberBandFactor: 0.55,
  canvasWheelZoomSensitivity: 0.0015,
  applySettingsPatch: mockApplySettingsPatch,
};

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: mockUseLocalSearchParams,
}));

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../hooks/useImageComparison", () => ({
  useImageComparison: (args: unknown) => mockUseImageComparison(args),
}));

jest.mock("../../../stores/useFitsStore", () => ({
  useFitsStore: (
    selector: (state: { files: typeof mockFiles; updateFile: typeof mockUpdateFile }) => unknown,
  ) => selector({ files: mockFiles, updateFile: mockUpdateFile }),
}));

jest.mock("../../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockSettingsState),
}));

jest.mock("../../../hooks/useFitsFile", () => ({
  useFitsFile: () => mockUseFitsFile(),
}));

jest.mock("../../../hooks/useImageProcessing", () => ({
  useImageProcessing: () => mockUseImageProcessing(),
}));

jest.mock("../../../hooks/useScreenOrientation", () => ({
  useScreenOrientation: () => ({
    isLandscape: false,
    isPortrait: true,
    orientation: 1,
    screenWidth: 390,
    screenHeight: 844,
    lockOrientation: jest.fn(),
    unlockOrientation: jest.fn(),
  }),
}));

jest.mock("../../../components/fits/FitsCanvas", () => {
  const ReactLocal = require("react");
  const { View } = require("react-native");
  const canvasEntries: Array<{ props: Record<string, unknown>; setTransform: jest.Mock }> = [];

  return {
    FitsCanvas: ReactLocal.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      const setTransform = jest.fn();
      canvasEntries.push({ props, setTransform });
      ReactLocal.useImperativeHandle(ref, () => ({
        setTransform,
        resetView: jest.fn(),
        getTransform: jest.fn(),
      }));
      return ReactLocal.createElement(View, { testID: "fits-canvas" });
    }),
    __getCanvasEntries: () => canvasEntries,
    __resetCanvasEntries: () => {
      canvasEntries.length = 0;
    },
  };
});

jest.mock("../../../components/fits/Minimap", () => ({
  Minimap: () => {
    const ReactLocal = require("react");
    const { View } = require("react-native");
    return ReactLocal.createElement(View, { testID: "minimap" });
  },
}));

jest.mock("../../../components/fits/PixelInspector", () => ({
  PixelInspector: ({ visible }: { visible: boolean }) => {
    if (!visible) return null;
    const ReactLocal = require("react");
    const { View } = require("react-native");
    return ReactLocal.createElement(View, { testID: "pixel-inspector" });
  },
}));

jest.mock("../../../components/common/SimpleSlider", () => ({
  SimpleSlider: ({
    label,
    value,
    onValueChange,
  }: {
    label: string;
    value: number;
    onValueChange: (value: number) => void;
  }) => {
    const ReactLocal = require("react");
    const { Text, Pressable } = require("react-native");
    return ReactLocal.createElement(
      Pressable,
      {
        testID: `slider-${label}`,
        onPress: () => {
          if (label === "compare.blinkLabel") {
            onValueChange(6);
            return;
          }
          if (label === "compare.splitLabel") {
            onValueChange(0.95);
            return;
          }
          onValueChange(value);
        },
      },
      ReactLocal.createElement(Text, null, label),
    );
  },
}));

jest.mock("react-native-gesture-handler", () => {
  const ReactLocal = require("react");
  const { View } = require("react-native");
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      ReactLocal.createElement(View, null, children),
    Gesture: {
      Pan: () => {
        const chain = {
          enabled: () => chain,
          runOnJS: () => chain,
          onStart: () => chain,
          onUpdate: () => chain,
          onEnd: () => chain,
        };
        return chain;
      },
    },
  };
});

jest.mock("heroui-native", () => {
  const ReactLocal = require("react");
  const { View, Text, Pressable, TextInput } = require("react-native");
  type mockProps = { children?: React.ReactNode } & Record<string, unknown>;
  type mockPressableProps = mockProps & { onPress?: () => void };

  const Button = ({ children, onPress, ...props }: mockPressableProps) => (
    <Pressable onPress={onPress} {...props}>
      {children}
    </Pressable>
  );
  Button.Label = ({ children, ...props }: mockProps) => <Text {...props}>{children}</Text>;

  const Chip = ({ children, onPress, ...props }: mockPressableProps) => (
    <Pressable onPress={onPress} {...props}>
      {children}
    </Pressable>
  );
  Chip.Label = ({ children, ...props }: mockProps) => <Text {...props}>{children}</Text>;

  const Dialog = ({ children }: mockProps) => <View>{children}</View>;
  Dialog.Portal = ({ children }: mockProps) => <View>{children}</View>;
  Dialog.Overlay = () => <View />;
  Dialog.Content = ({ children }: mockProps) => <View>{children}</View>;
  Dialog.Title = ({ children }: mockProps) => <Text>{children}</Text>;
  Dialog.Close = () => <View />;

  return {
    Button,
    Chip,
    Dialog,
    Input: (props: Record<string, unknown>) => ReactLocal.createElement(TextInput, props),
    useThemeColor: (keys: string[] | string) =>
      Array.isArray(keys) ? keys.map(() => "#000") : "#000",
  };
});

const CompareScreen = require("../index").default as React.ComponentType;

type FitsCanvasMockModule = {
  __getCanvasEntries: () => Array<{
    props: Record<string, unknown>;
    setTransform: jest.Mock;
  }>;
  __resetCanvasEntries: () => void;
};

describe("CompareScreen", () => {
  let comparisonState: Record<string, unknown>;
  const fitsCanvasMock = jest.requireMock(
    "../../../components/fits/FitsCanvas",
  ) as FitsCanvasMockModule;

  beforeEach(() => {
    Object.assign(mockSettingsState, {
      defaultShowPixelInfo: true,
      compareDefaultMode: "blink",
      compareBlinkSpeed: 1.5,
      compareSplitPosition: 0.5,
    });
    mockApplySettingsPatch.mockReset();
    fitsCanvasMock.__resetCanvasEntries();
    mockUseLocalSearchParams.mockReturnValue({ ids: "a,b" });
    mockUseFitsFile.mockImplementation(() => ({
      pixels: new Float32Array([0, 1, 2, 3]),
      dimensions: { width: 2, height: 2, isDataCube: false, depth: 1 },
      loadFromPath: jest.fn(),
    }));
    mockUseImageProcessing.mockImplementation(() => ({
      rgbaData: new Uint8ClampedArray(2 * 2 * 4),
      displayWidth: 2,
      displayHeight: 2,
      processImage: jest.fn(),
      processImagePreview: jest.fn(),
      isProcessing: false,
      error: null,
    }));
    comparisonState = {
      imageIds: ["a", "b"],
      mode: "blink",
      activeIndex: 0,
      blinkSpeed: 1,
      splitPosition: 0.5,
      isBlinkPlaying: true,
      setImageIds: jest.fn(),
      setMode: jest.fn(),
      setBlinkSpeed: jest.fn(),
      setSplitPosition: jest.fn(),
      nextImage: jest.fn(),
      prevImage: jest.fn(),
      toggleBlinkPlay: jest.fn(),
    };
    mockUseImageComparison.mockImplementation(() => comparisonState);
  });

  it("passes legacy /compare?ids query into comparison hook", () => {
    render(<CompareScreen />);
    expect(mockUseImageComparison).toHaveBeenCalledWith({
      initialIds: ["a", "b"],
      initialMode: "blink",
      initialBlinkSpeed: 1.5,
      initialSplitPosition: 0.5,
    });
  });

  it("passes zoom limits and gestureConfig into FitsCanvas", () => {
    render(<CompareScreen />);
    const entries = fitsCanvasMock.__getCanvasEntries();
    const latest = entries[entries.length - 1];
    expect(latest.props.minScale).toBe(0.5);
    expect(latest.props.maxScale).toBe(10);
    expect(latest.props.doubleTapScale).toBe(3);
    expect(latest.props.gestureConfig).toEqual({
      pinchSensitivity: 1,
      pinchOverzoomFactor: 1.25,
      panRubberBandFactor: 0.55,
      wheelZoomSensitivity: 0.0015,
    });
  });

  it("renders blink/side-by-side/split branches", () => {
    const { rerender } = render(<CompareScreen />);
    expect(screen.queryAllByTestId("fits-canvas")).toHaveLength(1);
    expect(screen.getByTestId("slider-compare.blinkLabel")).toBeTruthy();

    comparisonState = { ...comparisonState, mode: "side-by-side" };
    rerender(<CompareScreen />);
    expect(screen.queryAllByTestId("fits-canvas")).toHaveLength(2);
    expect(screen.queryByTestId("slider-compare.splitLabel")).toBeNull();

    comparisonState = { ...comparisonState, mode: "split" };
    rerender(<CompareScreen />);
    expect(screen.queryAllByTestId("fits-canvas")).toHaveLength(2);
    expect(screen.getByTestId("slider-compare.splitLabel")).toBeTruthy();
  });

  it("toggles linked state in controls", () => {
    render(<CompareScreen />);
    expect(screen.getByText("compare.linked")).toBeTruthy();
    fireEvent.press(screen.getByText("compare.linked"));
    expect(screen.getByText("compare.unlinked")).toBeTruthy();
  });

  it("persists compare mode/blink/split controls", () => {
    const { rerender } = render(<CompareScreen />);

    fireEvent.press(screen.getByText("compare.modeSplit"));
    expect(comparisonState.setMode).toHaveBeenCalledWith("split");
    expect(mockApplySettingsPatch).toHaveBeenCalledWith({ compareDefaultMode: "split" });

    fireEvent.press(screen.getByTestId("slider-compare.blinkLabel"));
    expect(comparisonState.setBlinkSpeed).toHaveBeenCalledWith(5);
    expect(mockApplySettingsPatch).toHaveBeenCalledWith({ compareBlinkSpeed: 5 });

    comparisonState = { ...comparisonState, mode: "split" };
    rerender(<CompareScreen />);
    fireEvent.press(screen.getByTestId("slider-compare.splitLabel"));
    expect(comparisonState.setSplitPosition).toHaveBeenCalledWith(0.9);
    expect(mockApplySettingsPatch).toHaveBeenCalledWith({ compareSplitPosition: 0.9 });
  });

  it("does not render pixel inspector when showPixelInfo is disabled", () => {
    mockSettingsState.defaultShowPixelInfo = false;
    render(<CompareScreen />);
    expect(screen.queryByTestId("pixel-inspector")).toBeNull();
  });

  it("syncs transform to paired canvas when linked", async () => {
    comparisonState = { ...comparisonState, mode: "side-by-side" };
    mockUseImageComparison.mockImplementation(() => comparisonState);
    render(<CompareScreen />);
    expect(screen.queryAllByTestId("fits-canvas")).toHaveLength(2);

    const entries = fitsCanvasMock.__getCanvasEntries();
    const source = entries[entries.length - 2];
    const target = entries[entries.length - 1];

    act(() => {
      (source.props.onTransformChange as ((value: Record<string, number>) => void) | undefined)?.({
        scale: 2,
        translateX: 42,
        translateY: -24,
        canvasWidth: 320,
        canvasHeight: 200,
      });
    });

    expect(target.setTransform).toHaveBeenCalledWith(42, -24, 2, { animated: false });
  });

  it("does not sync transform when unlinked", async () => {
    comparisonState = { ...comparisonState, mode: "side-by-side" };
    mockUseImageComparison.mockImplementation(() => comparisonState);
    render(<CompareScreen />);
    expect(screen.queryAllByTestId("fits-canvas")).toHaveLength(2);

    fireEvent.press(screen.getByText("compare.linked"));

    const entries = fitsCanvasMock.__getCanvasEntries();
    const source = entries[entries.length - 2];
    const target = entries[entries.length - 1];
    target.setTransform.mockClear();

    act(() => {
      (source.props.onTransformChange as ((value: Record<string, number>) => void) | undefined)?.({
        scale: 1.6,
        translateX: 20,
        translateY: -10,
        canvasWidth: 320,
        canvasHeight: 200,
      });
    });

    expect(target.setTransform).not.toHaveBeenCalled();
  });

  it("aligns B to A when linked is enabled again", async () => {
    comparisonState = { ...comparisonState, mode: "side-by-side" };
    mockUseImageComparison.mockImplementation(() => comparisonState);
    render(<CompareScreen />);
    expect(screen.queryAllByTestId("fits-canvas")).toHaveLength(2);

    fireEvent.press(screen.getByText("compare.linked"));

    let entries = fitsCanvasMock.__getCanvasEntries();
    const source = entries[entries.length - 2];
    let target = entries[entries.length - 1];

    target.setTransform.mockClear();
    act(() => {
      (source.props.onTransformChange as ((value: Record<string, number>) => void) | undefined)?.({
        scale: 1.8,
        translateX: 100,
        translateY: -50,
        canvasWidth: 320,
        canvasHeight: 200,
      });
    });
    expect(target.setTransform).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("compare.unlinked"));

    await waitFor(() => {
      entries = fitsCanvasMock.__getCanvasEntries();
      target = entries[entries.length - 1];
      expect(target.setTransform).toHaveBeenCalledWith(100, -50, 1.8, { animated: false });
    });
  });
});
