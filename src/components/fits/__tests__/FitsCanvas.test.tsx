import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { View } from "react-native";
import { FitsCanvas, type FitsCanvasHandle } from "../FitsCanvas";

jest.mock("../../../hooks/useSkImage", () => ({
  useSkImage: () => ({ width: 1, height: 1 }),
}));

jest.mock("@shopify/react-native-skia", () => {
  const ReactLocal = require("react");
  const { View: RNView } = require("react-native");

  const Canvas = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    ReactLocal.createElement(RNView, props, children);
  const Group = ({ children }: { children?: React.ReactNode }) =>
    ReactLocal.createElement(ReactLocal.Fragment, null, children);
  const Fill = ({ children }: { children?: React.ReactNode }) =>
    ReactLocal.createElement(ReactLocal.Fragment, null, children);

  return {
    Canvas,
    Fill,
    Group,
    ImageShader: () => null,
    Line: () => null,
    vec: (x: number, y: number) => ({ x, y }),
    rect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
    Skia: {
      Paint: () => ({
        setColor: jest.fn(),
        setAlphaf: jest.fn(),
        setStrokeWidth: jest.fn(),
      }),
      Color: (c: string) => c,
    },
  };
});

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  return {
    ...Reanimated,
    useSharedValue: (value: number) => ({ value }),
    useDerivedValue: (updater: () => unknown) => ({ value: updater() }),
    useAnimatedReaction: jest.fn(),
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    withTiming: (value: number) => value,
    withSpring: (value: number) => value,
    withDecay: ({ velocity = 0 }: { velocity?: number }) => velocity,
    FadeIn: { duration: () => ({}) },
    FadeOut: { duration: () => ({}) },
  };
});

jest.mock("react-native-gesture-handler", () => {
  const ReactLocal = require("react");
  const { View: RNView } = require("react-native");

  const tapGestures: Array<{
    handlers: {
      onEnd?: (event: { x: number; y: number }) => void;
    };
    config: {
      numberOfTaps?: number;
    };
  }> = [];
  const panGestures: Array<{
    handlers: Record<string, unknown>;
    config: {
      numberOfTaps?: number;
    };
  }> = [];
  const pinchGestures: Array<{
    handlers: Record<string, unknown>;
    config: {
      numberOfTaps?: number;
    };
  }> = [];
  const longPressGestures: Array<{
    handlers: Record<string, unknown>;
    config: {
      numberOfTaps?: number;
    };
  }> = [];

  const createBuilder = (type: "tap" | "pan" | "pinch" | "longPress") => {
    const builder = {
      handlers: {} as {
        onStart?: (event: Record<string, unknown>) => void;
        onUpdate?: (event: Record<string, unknown>) => void;
        onEnd?: (event: Record<string, unknown>, success?: boolean) => void;
        onBegin?: (event: Record<string, unknown>) => void;
        onFinalize?: () => void;
      },
      config: {} as { numberOfTaps?: number },
      enabled: () => builder,
      onStart: (fn: (event: Record<string, unknown>) => void) => {
        builder.handlers.onStart = fn;
        return builder;
      },
      onUpdate: (fn: (event: Record<string, unknown>) => void) => {
        builder.handlers.onUpdate = fn;
        return builder;
      },
      onEnd: (fn: (event: Record<string, unknown>, success?: boolean) => void) => {
        builder.handlers.onEnd = fn;
        return builder;
      },
      onBegin: (fn: (event: Record<string, unknown>) => void) => {
        builder.handlers.onBegin = fn;
        return builder;
      },
      onFinalize: (fn: () => void) => {
        builder.handlers.onFinalize = fn;
        return builder;
      },
      minPointers: () => builder,
      maxPointers: () => builder,
      minDistance: () => builder,
      maxDistance: () => builder,
      minDuration: () => builder,
      numberOfTaps: (count: number) => {
        builder.config.numberOfTaps = count;
        return builder;
      },
    };

    if (type === "tap") tapGestures.push(builder);
    if (type === "pan") panGestures.push(builder);
    if (type === "pinch") pinchGestures.push(builder);
    if (type === "longPress") longPressGestures.push(builder);
    return builder;
  };

  return {
    GestureDetector: ({ children }: { children?: React.ReactNode }) =>
      ReactLocal.createElement(RNView, { testID: "gesture-detector" }, children),
    Gesture: {
      Pan: () => createBuilder("pan"),
      Pinch: () => createBuilder("pinch"),
      Tap: () => createBuilder("tap"),
      LongPress: () => createBuilder("longPress"),
      Simultaneous: (...gestures: unknown[]) => ({ gestures }),
      Exclusive: (...gestures: unknown[]) => ({ gestures }),
    },
    __resetGestures: () => {
      tapGestures.length = 0;
      panGestures.length = 0;
      pinchGestures.length = 0;
      longPressGestures.length = 0;
    },
    __getTapGesture: (tapCount: number) =>
      tapGestures.find((g) => g.config.numberOfTaps === tapCount),
    __getPanGesture: () => panGestures[0],
    __getPinchGesture: () => pinchGestures[0],
    __getLongPressGesture: () => longPressGestures[0],
  };
});

type GestureMockModule = {
  __resetGestures: () => void;
  __getTapGesture: (
    tapCount: number,
  ) => { handlers: { onEnd?: (event: { x: number; y: number }) => void } } | undefined;
  __getPanGesture: () =>
    | {
        handlers: {
          onStart?: () => void;
          onUpdate?: (event: { translationX: number; translationY: number }) => void;
        };
      }
    | undefined;
  __getPinchGesture: () =>
    | {
        handlers: {
          onStart?: (event: { focalX: number; focalY: number; scale?: number }) => void;
          onUpdate?: (event: { focalX: number; focalY: number; scale: number }) => void;
        };
      }
    | undefined;
  __getLongPressGesture: () =>
    | {
        handlers: {
          onEnd?: (event: { x: number; y: number }, success?: boolean) => void;
        };
      }
    | undefined;
};

function triggerLayout(instance: ReturnType<typeof render>, width: number, height: number) {
  const rootWithLayout = instance
    .UNSAFE_getAllByType(View)
    .find((node) => typeof node.props.onLayout === "function");
  if (!rootWithLayout) {
    throw new Error("Expected FitsCanvas root view with onLayout");
  }
  fireEvent(rootWithLayout, "layout", {
    nativeEvent: { layout: { width, height, x: 0, y: 0 } },
  });
}

describe("FitsCanvas", () => {
  const gestureMock = jest.requireMock("react-native-gesture-handler") as GestureMockModule;

  beforeEach(() => {
    gestureMock.__resetGestures();
  });

  it("clamps imperative scale/translation to bounds", () => {
    const ref = React.createRef<FitsCanvasHandle>();
    const view = render(
      <FitsCanvas
        ref={ref}
        rgbaData={new Uint8ClampedArray(100 * 50 * 4)}
        width={100}
        height={50}
        showGrid={false}
        showCrosshair={false}
        cursorX={-1}
        cursorY={-1}
      />,
    );
    triggerLayout(view, 200, 100);

    act(() => {
      ref.current?.setTransform(9999, -9999, 99);
    });

    const transform = ref.current?.getTransform();
    expect(transform?.scale).toBe(10);
    expect(transform?.translateX).toBeCloseTo(900, 6);
    expect(transform?.translateY).toBeCloseTo(-450, 6);
  });

  it("supports immediate transform updates without animation options", () => {
    const ref = React.createRef<FitsCanvasHandle>();
    const view = render(
      <FitsCanvas
        ref={ref}
        rgbaData={new Uint8ClampedArray(100 * 50 * 4)}
        width={100}
        height={50}
        showGrid={false}
        showCrosshair={false}
        cursorX={-1}
        cursorY={-1}
      />,
    );
    triggerLayout(view, 200, 100);

    act(() => {
      ref.current?.setTransform(9999, -9999, 99, { animated: false });
    });

    const transform = ref.current?.getTransform();
    expect(transform?.scale).toBe(10);
    expect(transform?.translateX).toBeCloseTo(900, 6);
    expect(transform?.translateY).toBeCloseTo(-450, 6);
  });

  it("notifies layout-only changes through onTransformChange", () => {
    const onTransformChange = jest.fn();
    const view = render(
      <FitsCanvas
        rgbaData={new Uint8ClampedArray(10 * 10 * 4)}
        width={10}
        height={10}
        showGrid={false}
        showCrosshair={false}
        cursorX={-1}
        cursorY={-1}
        onTransformChange={onTransformChange}
      />,
    );

    triggerLayout(view, 320, 240);
    triggerLayout(view, 360, 200);

    expect(onTransformChange).toHaveBeenCalled();
    expect(onTransformChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        scale: 1,
        translateX: 0,
        translateY: 0,
        canvasWidth: 360,
        canvasHeight: 200,
      }),
    );
  });

  it("reclamps translation when canvas layout changes", () => {
    const ref = React.createRef<FitsCanvasHandle>();
    const view = render(
      <FitsCanvas
        ref={ref}
        rgbaData={new Uint8ClampedArray(100 * 50 * 4)}
        width={100}
        height={50}
        showGrid={false}
        showCrosshair={false}
        cursorX={-1}
        cursorY={-1}
      />,
    );

    triggerLayout(view, 400, 200);

    act(() => {
      ref.current?.setTransform(200, 100, 2, { animated: false });
    });

    triggerLayout(view, 200, 100);

    const transform = ref.current?.getTransform();
    expect(transform?.scale).toBe(2);
    expect(transform?.translateX).toBeCloseTo(100, 6);
    expect(transform?.translateY).toBeCloseTo(50, 6);
  });

  it("maps single-tap pixel from render space back to source space", () => {
    const onPixelTap = jest.fn();
    const view = render(
      <FitsCanvas
        rgbaData={new Uint8ClampedArray(100 * 50 * 4)}
        width={100}
        height={50}
        sourceWidth={1000}
        sourceHeight={500}
        showGrid={false}
        showCrosshair={false}
        cursorX={-1}
        cursorY={-1}
        onPixelTap={onPixelTap}
      />,
    );
    triggerLayout(view, 200, 100);

    const singleTap = gestureMock.__getTapGesture(1);
    expect(singleTap?.handlers.onEnd).toBeDefined();

    act(() => {
      singleTap?.handlers.onEnd?.({ x: 40, y: 20 });
    });

    expect(onPixelTap).toHaveBeenCalledWith(205, 105);
  });

  it("maps long-press pixel from render space back to source space", () => {
    const onPixelLongPress = jest.fn();
    const view = render(
      <FitsCanvas
        rgbaData={new Uint8ClampedArray(100 * 50 * 4)}
        width={100}
        height={50}
        sourceWidth={1000}
        sourceHeight={500}
        showGrid={false}
        showCrosshair={false}
        cursorX={-1}
        cursorY={-1}
        onPixelLongPress={onPixelLongPress}
      />,
    );
    triggerLayout(view, 200, 100);

    const longPress = gestureMock.__getLongPressGesture();
    expect(longPress?.handlers.onEnd).toBeDefined();

    act(() => {
      longPress?.handlers.onEnd?.({ x: 40, y: 20 }, true);
    });

    expect(onPixelLongPress).toHaveBeenCalledWith(205, 105);
  });

  it("ignores pan updates while pinch gesture is active", () => {
    const ref = React.createRef<FitsCanvasHandle>();
    const view = render(
      <FitsCanvas
        ref={ref}
        rgbaData={new Uint8ClampedArray(100 * 50 * 4)}
        width={100}
        height={50}
        showGrid={false}
        showCrosshair={false}
        cursorX={-1}
        cursorY={-1}
      />,
    );
    triggerLayout(view, 200, 100);

    act(() => {
      ref.current?.setTransform(0, 0, 2, { animated: false });
    });

    const panGesture = gestureMock.__getPanGesture();
    const pinchGesture = gestureMock.__getPinchGesture();
    expect(panGesture?.handlers.onUpdate).toBeDefined();
    expect(pinchGesture?.handlers.onStart).toBeDefined();

    act(() => {
      panGesture?.handlers.onStart?.();
      pinchGesture?.handlers.onStart?.({ focalX: 100, focalY: 50, scale: 1 });
    });
    const before = ref.current?.getTransform();

    act(() => {
      panGesture?.handlers.onUpdate?.({ translationX: 80, translationY: 40 });
    });
    const after = ref.current?.getTransform();

    expect(after?.translateX).toBeCloseTo(before?.translateX ?? 0, 6);
    expect(after?.translateY).toBeCloseTo(before?.translateY ?? 0, 6);
  });

  it("applies pinch sensitivity from gesture config", () => {
    const ref = React.createRef<FitsCanvasHandle>();
    const view = render(
      <FitsCanvas
        ref={ref}
        rgbaData={new Uint8ClampedArray(100 * 50 * 4)}
        width={100}
        height={50}
        showGrid={false}
        showCrosshair={false}
        cursorX={-1}
        cursorY={-1}
        gestureConfig={{ pinchSensitivity: 0.6 }}
      />,
    );
    triggerLayout(view, 200, 100);

    const pinchGesture = gestureMock.__getPinchGesture();
    expect(pinchGesture?.handlers.onUpdate).toBeDefined();

    act(() => {
      pinchGesture?.handlers.onStart?.({ focalX: 100, focalY: 50, scale: 1 });
      pinchGesture?.handlers.onUpdate?.({ focalX: 100, focalY: 50, scale: 1.2 });
    });

    const transform = ref.current?.getTransform();
    expect(transform?.scale).toBeCloseTo(Math.pow(1.2, 0.6), 6);
  });
});
