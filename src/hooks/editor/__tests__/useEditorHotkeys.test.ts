import { renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useEditorHotkeys } from "../useEditorHotkeys";

const originalOS = Platform.OS;
let listeners: Array<{ type: string; handler: (e: unknown) => void }> = [];

beforeAll(() => {
  Object.defineProperty(Platform, "OS", { value: "web", writable: true });
  // Mock HTMLElement for isEditableTarget check in RN test environment
  if (typeof globalThis.HTMLElement === "undefined") {
    // @ts-expect-error -- minimal HTMLElement stub
    globalThis.HTMLElement = class HTMLElement {};
  }
  globalThis.window = globalThis.window ?? ({} as Window & typeof globalThis);
  globalThis.window.addEventListener = jest.fn((type: string, handler: unknown) => {
    listeners.push({ type, handler: handler as (e: unknown) => void });
  }) as unknown as typeof window.addEventListener;
  globalThis.window.removeEventListener = jest.fn((type: string, handler: unknown) => {
    listeners = listeners.filter((l) => !(l.type === type && l.handler === handler));
  }) as unknown as typeof window.removeEventListener;
});

afterAll(() => {
  Object.defineProperty(Platform, "OS", { value: originalOS, writable: true });
});

beforeEach(() => {
  listeners = [];
});

function makeCallbacks() {
  return {
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    onCancelTool: jest.fn(),
    onToggleOriginal: jest.fn(),
    onToggleHistogram: jest.fn(),
    onTogglePixelInfo: jest.fn(),
    onToggleMinimap: jest.fn(),
  };
}

function fireKey(key: string, opts: Record<string, unknown> = {}) {
  const event = {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: null,
    preventDefault: jest.fn(),
    ...opts,
  };
  for (const l of listeners) {
    if (l.type === "keydown") l.handler(event);
  }
}

describe("useEditorHotkeys", () => {
  it("calls onCancelTool on Escape", () => {
    const cbs = makeCallbacks();
    renderHook(() => useEditorHotkeys(cbs));
    fireKey("Escape");
    expect(cbs.onCancelTool).toHaveBeenCalledTimes(1);
  });

  it("calls onUndo on Ctrl+Z", () => {
    const cbs = makeCallbacks();
    renderHook(() => useEditorHotkeys(cbs));
    fireKey("z", { ctrlKey: true });
    expect(cbs.onUndo).toHaveBeenCalledTimes(1);
  });

  it("calls onRedo on Ctrl+Shift+Z", () => {
    const cbs = makeCallbacks();
    renderHook(() => useEditorHotkeys(cbs));
    fireKey("z", { ctrlKey: true, shiftKey: true });
    expect(cbs.onRedo).toHaveBeenCalledTimes(1);
  });

  it("calls onToggleHistogram on H key", () => {
    const cbs = makeCallbacks();
    renderHook(() => useEditorHotkeys(cbs));
    fireKey("h");
    expect(cbs.onToggleHistogram).toHaveBeenCalledTimes(1);
  });

  it("does not fire when disabled", () => {
    const cbs = makeCallbacks();
    renderHook(() => useEditorHotkeys({ ...cbs, enabled: false }));
    fireKey("Escape");
    expect(cbs.onCancelTool).not.toHaveBeenCalled();
  });
});

describe("useEditorHotkeys crop mode", () => {
  it("calls onCropCancel on Escape in crop mode instead of onCancelTool", () => {
    const cbs = makeCallbacks();
    const onCropCancel = jest.fn();
    renderHook(() => useEditorHotkeys({ ...cbs, isCropMode: true, onCropCancel }));
    fireKey("Escape");
    expect(onCropCancel).toHaveBeenCalledTimes(1);
    expect(cbs.onCancelTool).not.toHaveBeenCalled();
  });

  it("calls onCropConfirm on Enter in crop mode", () => {
    const cbs = makeCallbacks();
    const onCropConfirm = jest.fn();
    renderHook(() => useEditorHotkeys({ ...cbs, isCropMode: true, onCropConfirm }));
    fireKey("Enter");
    expect(onCropConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not call onCropConfirm on Enter when not in crop mode", () => {
    const cbs = makeCallbacks();
    const onCropConfirm = jest.fn();
    renderHook(() => useEditorHotkeys({ ...cbs, isCropMode: false, onCropConfirm }));
    fireKey("Enter");
    expect(onCropConfirm).not.toHaveBeenCalled();
  });

  it("falls through to onCancelTool when crop mode but no onCropCancel", () => {
    const cbs = makeCallbacks();
    renderHook(() => useEditorHotkeys({ ...cbs, isCropMode: true }));
    fireKey("Escape");
    expect(cbs.onCancelTool).toHaveBeenCalledTimes(1);
  });
});
