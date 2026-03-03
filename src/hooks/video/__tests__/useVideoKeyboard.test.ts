import { renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";

const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

beforeAll(() => {
  Object.defineProperty(globalThis, "document", {
    writable: true,
    configurable: true,
    value: {
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    },
  });
  Object.defineProperty(Platform, "OS", { value: "web", writable: true });
});

beforeEach(() => {
  jest.clearAllMocks();
});

function createHandlers() {
  return {
    onPlayPause: jest.fn(),
    onSeekBy: jest.fn(),
    onToggleMute: jest.fn(),
    onToggleLoop: jest.fn(),
    onVolumeChange: jest.fn(),
    onFullscreen: jest.fn(),
    volume: 0.5,
  };
}

const { useVideoKeyboard } = require("../useVideoKeyboard") as {
  useVideoKeyboard: typeof import("../useVideoKeyboard").useVideoKeyboard;
};

describe("useVideoKeyboard", () => {
  it("registers keydown listener on web", () => {
    const handlers = createHandlers();
    renderHook(() => useVideoKeyboard(handlers));
    expect(mockAddEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("removes keydown listener on unmount", () => {
    const handlers = createHandlers();
    const { unmount } = renderHook(() => useVideoKeyboard(handlers));
    unmount();
    expect(mockRemoveEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("calls onPlayPause on Space key", () => {
    const handlers = createHandlers();
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    const event = { code: "Space", preventDefault: jest.fn(), target: { tagName: "DIV" } };
    listener(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(handlers.onPlayPause).toHaveBeenCalledTimes(1);
  });

  it("calls onSeekBy(-5) on ArrowLeft", () => {
    const handlers = createHandlers();
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    listener({ code: "ArrowLeft", preventDefault: jest.fn(), target: { tagName: "DIV" } });
    expect(handlers.onSeekBy).toHaveBeenCalledWith(-5);
  });

  it("calls onSeekBy(5) on ArrowRight", () => {
    const handlers = createHandlers();
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    listener({ code: "ArrowRight", preventDefault: jest.fn(), target: { tagName: "DIV" } });
    expect(handlers.onSeekBy).toHaveBeenCalledWith(5);
  });

  it("increases volume on ArrowUp (clamped to 1)", () => {
    const handlers = createHandlers();
    handlers.volume = 0.95;
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    const event = { code: "ArrowUp", preventDefault: jest.fn(), target: { tagName: "DIV" } };
    listener(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(handlers.onVolumeChange).toHaveBeenCalledWith(1);
  });

  it("decreases volume on ArrowDown (clamped to 0)", () => {
    const handlers = createHandlers();
    handlers.volume = 0.05;
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    const event = { code: "ArrowDown", preventDefault: jest.fn(), target: { tagName: "DIV" } };
    listener(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(handlers.onVolumeChange).toHaveBeenCalledWith(0);
  });

  it("calls onToggleMute on KeyM", () => {
    const handlers = createHandlers();
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    listener({ code: "KeyM", preventDefault: jest.fn(), target: { tagName: "DIV" } });
    expect(handlers.onToggleMute).toHaveBeenCalledTimes(1);
  });

  it("calls onSeekBy(10) on KeyL (YouTube-style forward)", () => {
    const handlers = createHandlers();
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    listener({
      code: "KeyL",
      shiftKey: false,
      preventDefault: jest.fn(),
      target: { tagName: "DIV" },
    });
    expect(handlers.onSeekBy).toHaveBeenCalledWith(10);
  });

  it("calls onToggleLoop on Shift+KeyL", () => {
    const handlers = createHandlers();
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    listener({
      code: "KeyL",
      shiftKey: true,
      preventDefault: jest.fn(),
      target: { tagName: "DIV" },
    });
    expect(handlers.onToggleLoop).toHaveBeenCalledTimes(1);
  });

  it("calls onPlayPause on KeyK (YouTube-style)", () => {
    const handlers = createHandlers();
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    listener({ code: "KeyK", preventDefault: jest.fn(), target: { tagName: "DIV" } });
    expect(handlers.onPlayPause).toHaveBeenCalledTimes(1);
  });

  it("calls onSeekBy(-10) on KeyJ (YouTube-style rewind)", () => {
    const handlers = createHandlers();
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    listener({ code: "KeyJ", preventDefault: jest.fn(), target: { tagName: "DIV" } });
    expect(handlers.onSeekBy).toHaveBeenCalledWith(-10);
  });

  it("calls onSeekTo on digit keys when durationSec is provided", () => {
    const handlers = { ...createHandlers(), onSeekTo: jest.fn(), durationSec: 100 };
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    listener({ code: "Digit5", preventDefault: jest.fn(), target: { tagName: "DIV" } });
    expect(handlers.onSeekTo).toHaveBeenCalledWith(50);
  });

  it("calls onCycleRate on Shift+Period (> key)", () => {
    const handlers = { ...createHandlers(), onCycleRate: jest.fn() };
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    listener({
      code: "Period",
      shiftKey: true,
      preventDefault: jest.fn(),
      target: { tagName: "DIV" },
    });
    expect(handlers.onCycleRate).toHaveBeenCalledTimes(1);
  });

  it("calls onFullscreen on KeyF", () => {
    const handlers = createHandlers();
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    listener({ code: "KeyF", preventDefault: jest.fn(), target: { tagName: "DIV" } });
    expect(handlers.onFullscreen).toHaveBeenCalledTimes(1);
  });

  it("ignores keydown when target is INPUT", () => {
    const handlers = createHandlers();
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    listener({ code: "Space", preventDefault: jest.fn(), target: { tagName: "INPUT" } });
    expect(handlers.onPlayPause).not.toHaveBeenCalled();
  });

  it("ignores keydown when target is TEXTAREA", () => {
    const handlers = createHandlers();
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    listener({ code: "KeyM", preventDefault: jest.fn(), target: { tagName: "TEXTAREA" } });
    expect(handlers.onToggleMute).not.toHaveBeenCalled();
  });

  it("ignores keydown when target is SELECT", () => {
    const handlers = createHandlers();
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    listener({ code: "KeyF", preventDefault: jest.fn(), target: { tagName: "SELECT" } });
    expect(handlers.onFullscreen).not.toHaveBeenCalled();
  });

  it("ignores unknown key codes", () => {
    const handlers = createHandlers();
    renderHook(() => useVideoKeyboard(handlers));
    const listener = mockAddEventListener.mock.calls[0][1];
    listener({ code: "KeyZ", preventDefault: jest.fn(), target: { tagName: "DIV" } });
    expect(handlers.onPlayPause).not.toHaveBeenCalled();
    expect(handlers.onSeekBy).not.toHaveBeenCalled();
    expect(handlers.onToggleMute).not.toHaveBeenCalled();
    expect(handlers.onToggleLoop).not.toHaveBeenCalled();
    expect(handlers.onVolumeChange).not.toHaveBeenCalled();
    expect(handlers.onFullscreen).not.toHaveBeenCalled();
  });

  it("uses latest handler refs (not stale closures)", () => {
    const handlers = createHandlers();
    const { rerender } = renderHook(
      (props: ReturnType<typeof createHandlers>) => useVideoKeyboard(props),
      { initialProps: handlers },
    );

    const updatedPlayPause = jest.fn();
    const newHandlers = { ...handlers, onPlayPause: updatedPlayPause };
    rerender(newHandlers);

    const listener = mockAddEventListener.mock.calls[0][1];
    listener({ code: "Space", preventDefault: jest.fn(), target: { tagName: "DIV" } });
    expect(updatedPlayPause).toHaveBeenCalledTimes(1);
    expect(handlers.onPlayPause).not.toHaveBeenCalled();
  });
});

describe("useVideoKeyboard on non-web", () => {
  beforeAll(() => {
    Object.defineProperty(Platform, "OS", { value: "ios", writable: true });
  });

  afterAll(() => {
    Object.defineProperty(Platform, "OS", { value: "web", writable: true });
  });

  it("does nothing on non-web platforms", () => {
    const handlers = createHandlers();
    mockAddEventListener.mockClear();
    renderHook(() => useVideoKeyboard(handlers));
    expect(mockAddEventListener).not.toHaveBeenCalled();
  });
});
