import React from "react";
import { act, render } from "@testing-library/react-native";
import { RegionSelectOverlay } from "../RegionSelectOverlay";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("react-native-reanimated", () => ({
  useSharedValue: (value: number) => ({ value }),
  runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
}));

jest.mock("react-native-gesture-handler", () => {
  const ReactLocal = require("react");
  const { View } = require("react-native");

  const panGestures: Array<{
    handlers: {
      onBegin?: (event: { x: number; y: number }) => void;
      onUpdate?: (event: { x: number; y: number }) => void;
    };
  }> = [];

  const createPanGesture = () => {
    const pan: {
      handlers: {
        onBegin?: (event: { x: number; y: number }) => void;
        onUpdate?: (event: { x: number; y: number }) => void;
      };
    } = { handlers: {} };
    const builder = {
      ...pan,
      onBegin: (fn: (event: { x: number; y: number }) => void) => {
        pan.handlers.onBegin = fn;
        return builder;
      },
      onUpdate: (fn: (event: { x: number; y: number }) => void) => {
        pan.handlers.onUpdate = fn;
        return builder;
      },
      minDistance: () => builder,
    };
    panGestures.push(builder);
    return builder;
  };

  return {
    GestureDetector: ({ children }: { children?: React.ReactNode }) =>
      ReactLocal.createElement(View, { testID: "gesture-detector" }, children),
    Gesture: {
      Pan: () => createPanGesture(),
    },
    __getLastPanGesture: () => panGestures[panGestures.length - 1],
    __resetPanGestures: () => {
      panGestures.length = 0;
    },
  };
});

type GestureMockModule = {
  __getLastPanGesture: () =>
    | {
        handlers: {
          onBegin?: (event: { x: number; y: number }) => void;
          onUpdate?: (event: { x: number; y: number }) => void;
        };
      }
    | undefined;
  __resetPanGestures: () => void;
};

describe("RegionSelectOverlay", () => {
  const gestureMock = jest.requireMock("react-native-gesture-handler") as GestureMockModule;

  beforeEach(() => {
    gestureMock.__resetPanGestures();
  });

  it("emits selected region in source coordinates when drawing on preview image", () => {
    const onRegionChange = jest.fn();
    render(
      <RegionSelectOverlay
        renderWidth={100}
        renderHeight={50}
        sourceWidth={1000}
        sourceHeight={500}
        containerWidth={200}
        containerHeight={100}
        transform={{
          scale: 1,
          translateX: 0,
          translateY: 0,
          canvasWidth: 200,
          canvasHeight: 100,
        }}
        onRegionChange={onRegionChange}
        onClear={jest.fn()}
      />,
    );

    const pan = gestureMock.__getLastPanGesture();
    expect(pan?.handlers.onBegin).toBeDefined();
    expect(pan?.handlers.onUpdate).toBeDefined();

    act(() => {
      pan?.handlers.onBegin?.({ x: 40, y: 20 });
      pan?.handlers.onUpdate?.({ x: 80, y: 60 });
    });

    expect(onRegionChange).toHaveBeenLastCalledWith({
      x: 200,
      y: 100,
      w: 200,
      h: 200,
    });
  });
});
