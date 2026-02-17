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

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });
    (global as unknown as { HTMLElement?: unknown }).HTMLElement = class {};
    (global as unknown as { window: unknown }).window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
  });

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

    const { unmount } = renderHook(() =>
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

    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });
});
