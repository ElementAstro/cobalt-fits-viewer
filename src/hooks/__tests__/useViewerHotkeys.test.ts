import { renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useViewerHotkeys } from "../useViewerHotkeys";

describe("useViewerHotkeys", () => {
  const onZoomIn = jest.fn();
  const onZoomOut = jest.fn();
  const onResetView = jest.fn();
  const onToggleGrid = jest.fn();
  const onToggleCrosshair = jest.fn();
  const onToggleMinimap = jest.fn();
  const onTogglePixelInfo = jest.fn();
  const onOneToOne = jest.fn();
  const onFit = jest.fn();
  const onPan = jest.fn();

  let capturedHandler: ((event: Partial<KeyboardEvent>) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedHandler = null;
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });
    (global as unknown as { HTMLElement?: unknown }).HTMLElement = class {};
    (global as unknown as { window: unknown }).window = {
      addEventListener: jest.fn((_type: string, handler: () => void) => {
        capturedHandler = handler;
      }),
      removeEventListener: jest.fn(),
    };
  });

  function renderWithAllCallbacks() {
    return renderHook(() =>
      useViewerHotkeys({
        enabled: true,
        onZoomIn,
        onZoomOut,
        onResetView,
        onToggleGrid,
        onToggleCrosshair,
        onToggleMinimap,
        onTogglePixelInfo,
        onOneToOne,
        onFit,
        onPan,
      }),
    );
  }

  function dispatchKey(key: string, target?: EventTarget | null) {
    expect(capturedHandler).not.toBeNull();
    const event = {
      key,
      target: target ?? null,
      preventDefault: jest.fn(),
    };
    capturedHandler!(event);
    return event;
  }

  it("does not subscribe when disabled", () => {
    const addSpy = (global as unknown as { window: { addEventListener: jest.Mock } }).window
      .addEventListener;
    renderHook(() =>
      useViewerHotkeys({
        enabled: false,
        onZoomIn,
        onZoomOut,
        onResetView,
        onToggleGrid,
        onToggleCrosshair,
        onToggleMinimap,
        onTogglePixelInfo,
      }),
    );

    expect(addSpy).not.toHaveBeenCalled();
  });

  it("subscribes and unsubscribes on web when enabled", () => {
    const addSpy = (global as unknown as { window: { addEventListener: jest.Mock } }).window
      .addEventListener;
    const removeSpy = (global as unknown as { window: { removeEventListener: jest.Mock } }).window
      .removeEventListener;

    const { unmount } = renderWithAllCallbacks();

    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("dispatches zoom in on + and = keys", () => {
    renderWithAllCallbacks();
    dispatchKey("+");
    expect(onZoomIn).toHaveBeenCalledTimes(1);
    dispatchKey("=");
    expect(onZoomIn).toHaveBeenCalledTimes(2);
  });

  it("dispatches zoom out on - and _ keys", () => {
    renderWithAllCallbacks();
    dispatchKey("-");
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    dispatchKey("_");
    expect(onZoomOut).toHaveBeenCalledTimes(2);
  });

  it("dispatches reset view on 0 key", () => {
    renderWithAllCallbacks();
    dispatchKey("0");
    expect(onResetView).toHaveBeenCalledTimes(1);
  });

  it("dispatches toggle grid on g key", () => {
    renderWithAllCallbacks();
    dispatchKey("g");
    expect(onToggleGrid).toHaveBeenCalledTimes(1);
  });

  it("dispatches toggle crosshair on c key", () => {
    renderWithAllCallbacks();
    dispatchKey("c");
    expect(onToggleCrosshair).toHaveBeenCalledTimes(1);
  });

  it("dispatches toggle minimap on m key", () => {
    renderWithAllCallbacks();
    dispatchKey("m");
    expect(onToggleMinimap).toHaveBeenCalledTimes(1);
  });

  it("dispatches toggle pixel info on p key", () => {
    renderWithAllCallbacks();
    dispatchKey("p");
    expect(onTogglePixelInfo).toHaveBeenCalledTimes(1);
  });

  it("dispatches 1:1 view on 1 key", () => {
    renderWithAllCallbacks();
    dispatchKey("1");
    expect(onOneToOne).toHaveBeenCalledTimes(1);
  });

  it("dispatches fit on f key", () => {
    renderWithAllCallbacks();
    dispatchKey("f");
    expect(onFit).toHaveBeenCalledTimes(1);
  });

  it("dispatches arrow key panning", () => {
    renderWithAllCallbacks();
    dispatchKey("ArrowLeft");
    expect(onPan).toHaveBeenCalledWith(-50, 0);
    dispatchKey("ArrowRight");
    expect(onPan).toHaveBeenCalledWith(50, 0);
    dispatchKey("ArrowUp");
    expect(onPan).toHaveBeenCalledWith(0, -50);
    dispatchKey("ArrowDown");
    expect(onPan).toHaveBeenCalledWith(0, 50);
    expect(onPan).toHaveBeenCalledTimes(4);
  });

  it("calls preventDefault for handled keys", () => {
    renderWithAllCallbacks();
    const event = dispatchKey("+");
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("does not call preventDefault for unhandled keys", () => {
    renderWithAllCallbacks();
    const event = dispatchKey("x");
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("ignores keydown when target is an editable element", () => {
    class MockHTMLElement {
      tagName = "INPUT";
      isContentEditable = false;
    }
    (global as unknown as Record<string, unknown>).HTMLElement = MockHTMLElement;
    renderWithAllCallbacks();
    const input = new MockHTMLElement();
    dispatchKey("+", input as unknown as EventTarget);
    expect(onZoomIn).not.toHaveBeenCalled();
  });

  it("does not fire optional callbacks when not provided", () => {
    renderHook(() =>
      useViewerHotkeys({
        enabled: true,
        onZoomIn,
        onZoomOut,
        onResetView,
        onToggleGrid,
        onToggleCrosshair,
        onToggleMinimap,
        onTogglePixelInfo,
      }),
    );
    // 1 and f should not throw when optional callbacks are absent
    dispatchKey("1");
    dispatchKey("f");
    dispatchKey("ArrowLeft");
    expect(onOneToOne).not.toHaveBeenCalled();
    expect(onFit).not.toHaveBeenCalled();
    expect(onPan).not.toHaveBeenCalled();
  });
});
